import crypto from 'crypto';
import Stripe from 'stripe';
import { config } from '../config';
import { getDb } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { withIdempotency } from '../utils/idempotency';
import { logger } from '../utils/logger';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
      timeout: 5000,
      maxNetworkRetries: 2,
    });
  }
  return stripeClient;
}

export function isSandboxStripe(): boolean {
  return !config.stripe.secretKey || config.stripe.secretKey.includes('placeholder');
}

export const stripeService = {
  async createCustomer(orgId: string, orgName: string, email: string): Promise<{ customerId: string; sandbox: boolean }> {
    const idempotencyKey = `stripe-customer-${orgId}`;
    if (isSandboxStripe()) {
      const customerId = `cus_sandbox_${orgId.slice(0, 8)}`;
      await getDb()('subscriptions')
        .insert({ org_id: orgId, stripe_customer_id: customerId, plan: 'free', status: 'active' })
        .onConflict('org_id')
        .merge({ stripe_customer_id: customerId, updated_at: getDb().fn.now() });
      return { customerId, sandbox: true };
    }

    const customer = await getStripe().customers.create(
      { name: orgName, email, metadata: { orgId } },
      { idempotencyKey },
    );
    await getDb()('subscriptions')
      .insert({ org_id: orgId, stripe_customer_id: customer.id, plan: 'free', status: 'active' })
      .onConflict('org_id')
      .merge({ stripe_customer_id: customer.id, updated_at: getDb().fn.now() });

    return { customerId: customer.id, sandbox: false };
  },

  async createSubscription(
    orgId: string,
    customerId: string,
    priceId: string = config.stripe.priceId,
    plan: 'starter' | 'professional' | 'enterprise' = 'professional',
  ): Promise<{ subscriptionId: string; status: string; sandbox: boolean }> {
    const idempotencyKey = `stripe-sub-${orgId}-${priceId}`;

    if (isSandboxStripe()) {
      const subscriptionId = `sub_sandbox_${crypto.randomBytes(6).toString('hex')}`;
      await getDb()('subscriptions')
        .insert({
          org_id: orgId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: 'active',
        })
        .onConflict('org_id')
        .merge({ stripe_subscription_id: subscriptionId, plan, status: 'active', updated_at: getDb().fn.now() });
      await getDb()('organizations').where({ id: orgId }).update({ plan });
      return { subscriptionId, status: 'active', sandbox: true };
    }

    const subscription = await getStripe().subscriptions.create(
      { customer: customerId, items: [{ price: priceId }], metadata: { orgId, plan } },
      { idempotencyKey },
    );

    await getDb()('subscriptions')
      .insert({
        org_id: orgId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        plan,
        status: subscription.status,
      })
      .onConflict('org_id')
      .merge({
        stripe_subscription_id: subscription.id,
        plan,
        status: subscription.status,
        updated_at: getDb().fn.now(),
      });

    await getDb()('organizations').where({ id: orgId }).update({ plan });
    return { subscriptionId: subscription.id, status: subscription.status, sandbox: false };
  },

  async cancelSubscription(orgId: string, subscriptionId: string): Promise<{ status: string }> {
    if (!isSandboxStripe()) {
      await getStripe().subscriptions.cancel(subscriptionId);
    }
    await getDb()('subscriptions')
      .where({ org_id: orgId, stripe_subscription_id: subscriptionId })
      .update({ status: 'canceled', plan: 'free', updated_at: getDb().fn.now() });
    await getDb()('organizations').where({ id: orgId }).update({ plan: 'free' });
    return { status: 'canceled' };
  },

  verifySignature(rawBody: Buffer | string, signature: string): Stripe.Event {
    if (!signature) {
      throw ApiError.badRequest('Missing Stripe-Signature header', undefined, 'MISSING_WEBHOOK_SIGNATURE');
    }

    try {
      return getStripe().webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
    } catch (err) {
      throw ApiError.badRequest(
        `Invalid Stripe webhook signature: ${(err as Error).message}`,
        undefined,
        'INVALID_WEBHOOK_SIGNATURE',
      );
    }
  },

  async handleWebhook(rawBody: Buffer | string, signature: string): Promise<{ received: boolean; duplicate: boolean; eventId: string }> {
    const event = this.verifySignature(rawBody, signature);
    const db = getDb();

    const { skipped } = await withIdempotency(db, `stripe:${event.id}`, event.type, async () => {
      logger.info('Processing Stripe webhook event', { eventId: event.id, type: event.type });

      const obj = event.data.object as { metadata?: { orgId?: string; plan?: string }; id?: string; status?: string };
      const orgId = obj.metadata?.orgId;

      if (orgId && event.type === 'customer.subscription.updated') {
        await db('subscriptions')
          .where({ org_id: orgId })
          .update({ status: obj.status || 'active', updated_at: db.fn.now() });
      } else if (orgId && event.type === 'customer.subscription.deleted') {
        await db('subscriptions')
          .where({ org_id: orgId })
          .update({ status: 'canceled', plan: 'free', updated_at: db.fn.now() });
        await db('organizations').where({ id: orgId }).update({ plan: 'free' });
      }

      return { handled: true };
    });

    return {
      received: true,
      duplicate: skipped,
      eventId: event.id,
    };
  },
};
