import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';
import { logger } from '../lib/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!config.smtpUrl) return null;
  transporter ??= nodemailer.createTransport(config.smtpUrl);
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends mail through SMTP when `SMTP_URL` is configured. Without it the message
 * is only logged (development fallback) and the function reports `false`.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    if (!config.isTest) logger.warn({ to: message.to, subject: message.subject }, 'SMTP is not configured; email not sent');
    return false;
  }
  try {
    await transport.sendMail({ from: config.mailFrom, ...message });
    return true;
  } catch (err) {
    logger.error({ err }, 'Failed to send email');
    return false;
  }
}
