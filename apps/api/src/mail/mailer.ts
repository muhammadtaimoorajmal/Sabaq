import nodemailer, { type Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import type { Config } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send: (message: MailMessage) => Promise<void>;
}

type TransportFactory = (options: {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}) => Pick<Transporter, 'sendMail'>;

/**
 * Sends e-mail through SMTP (for example Brevo). Without an SMTP server, which is only
 * allowed outside production, messages are written to the log so links can be opened locally.
 */
export function createMailer(
  config: Pick<Config, 'mail'>,
  logger: Logger,
  createTransport: TransportFactory = (options) => nodemailer.createTransport(options),
): Mailer {
  const { from, smtp } = config.mail;
  if (!smtp) {
    return {
      send: async ({ to, subject, text }) => {
        logger.info({ mail: { to, subject, text } }, 'E-mail written to the log (no SMTP server)');
      },
    };
  }
  const transport = createTransport({
    host: smtp.host,
    port: smtp.port,
    // Port 465 uses TLS from the start; other ports upgrade with STARTTLS.
    secure: smtp.port === 465,
    ...(smtp.user && smtp.pass && { auth: { user: smtp.user, pass: smtp.pass } }),
  });
  return {
    send: async (message) => {
      await transport.sendMail({ from, ...message });
    },
  };
}
