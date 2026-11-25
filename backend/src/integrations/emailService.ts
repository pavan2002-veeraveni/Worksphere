import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (config.smtp.host && config.nodeEnv !== 'test') {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      ...(config.smtp.user
        ? { auth: { user: config.smtp.user, pass: config.smtp.password } }
        : {}),
    });
  } else {
    // Safe sandbox JSON transport when SMTP is not configured or in tests
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return transporter;
}

export interface EmailSendResult {
  messageId: string;
  accepted: string[];
  sandboxMode: boolean;
}

async function sendWithRetry(
  mailOptions: nodemailer.SendMailOptions,
  maxAttempts = 3,
): Promise<EmailSendResult> {
  const client = getTransporter();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await client.sendMail({
        from: config.smtp.from,
        ...mailOptions,
      });
      return {
        messageId: info.messageId,
        accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [String(mailOptions.to)],
        sandboxMode: !config.smtp.host || config.nodeEnv === 'test',
      };
    } catch (err) {
      lastError = err as Error;
      logger.warn('Email dispatch attempt failed', {
        attempt,
        to: mailOptions.to,
        error: lastError.message,
      });
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError || new Error('Failed to send email');
}

export const emailService = {
  async sendInvitationEmail(
    to: string,
    orgName: string,
    inviteLink: string,
    role: string,
  ): Promise<EmailSendResult> {
    return sendWithRetry({
      to,
      subject: `You are invited to join ${orgName} on WorkSphere`,
      text: `You have been invited to join ${orgName} as ${role}. Accept your invitation: ${inviteLink}`,
      html: `<p>You have been invited to join <strong>${orgName}</strong> as <strong>${role}</strong>.</p><p><a href="${inviteLink}">Accept Invitation</a></p>`,
    });
  },

  async sendNotificationEmail(to: string, subject: string, body: string): Promise<EmailSendResult> {
    return sendWithRetry({
      to,
      subject,
      text: body,
      html: `<p>${body}</p>`,
    });
  },

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<EmailSendResult> {
    return sendWithRetry({
      to,
      subject: 'WorkSphere Password Reset Request',
      text: `Reset your password using this link: ${resetLink}`,
      html: `<p>Click here to reset your password: <a href="${resetLink}">Reset Password</a></p>`,
    });
  },
};
