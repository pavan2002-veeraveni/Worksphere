import crypto from 'crypto';
import { getDb } from '../config/database';
import { logger } from '../utils/logger';

export const webhookService = {
  signPayload(payload: string, secret: string, timestamp: number): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
  },

  verifySignature(payload: string, signature: string, secret: string, timestamp: number): boolean {
    const expected = this.signPayload(payload, secret, timestamp);
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  },

  async registerWebhook(
    orgId: string,
    userId: string,
    data: { name: string; url: string; events: string[]; secret?: string },
  ) {
    const secret = data.secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const [hook] = await getDb()('outgoing_webhooks')
      .insert({
        org_id: orgId,
        name: data.name,
        url: data.url,
        events: data.events,
        secret,
        created_by: userId,
      })
      .returning('*');
    return hook;
  },

  async listWebhooks(orgId: string) {
    return getDb()('outgoing_webhooks')
      .where({ org_id: orgId })
      .select('id', 'org_id', 'name', 'url', 'events', 'is_active', 'created_at', 'updated_at')
      .orderBy('created_at', 'desc');
  },

  async deleteWebhook(orgId: string, webhookId: string): Promise<boolean> {
    const deleted = await getDb()('outgoing_webhooks')
      .where({ id: webhookId, org_id: orgId })
      .del();
    return deleted > 0;
  },

  async deliverToEndpoint(
    url: string,
    secret: string,
    eventType: string,
    deliveryId: string,
    payload: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: string }> {
    const bodyString = JSON.stringify({ id: deliveryId, event: eventType, data: payload });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signPayload(bodyString, secret, timestamp);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WorkSphere-Event': eventType,
          'X-WorkSphere-Delivery': deliveryId,
          'X-WorkSphere-Timestamp': String(timestamp),
          'X-WorkSphere-Signature': `v1=${signature}`,
        },
        body: bodyString,
        signal: controller.signal,
      });
      const text = await response.text().catch(() => '');
      return { statusCode: response.status, body: text.slice(0, 1000) };
    } catch (err) {
      logger.warn('Outgoing webhook delivery failed', { url, deliveryId, error: (err as Error).message });
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
};
