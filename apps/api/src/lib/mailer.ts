import type { Env } from '../env';
import type { Logger } from '../logger';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Sends through Resend's HTTP API; no SDK needed for a single endpoint. */
function resendMailer(apiKey: string, from: string, logger: Logger): Mailer {
  return {
    async send(mail) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, ...mail }),
      });
      if (!res.ok) {
        logger.error({ status: res.status, body: await res.text() }, 'Resend rejected email');
        throw new Error(`Email delivery failed (${res.status})`);
      }
    },
  };
}

/** Development fallback: writes the email to the log so codes can be copied from the terminal. */
function logMailer(logger: Logger): Mailer {
  return {
    async send(mail) {
      logger.warn(
        { to: mail.to, subject: mail.subject, text: mail.text },
        'Email not sent (no RESEND_API_KEY)',
      );
    },
  };
}

export function createMailer(env: Env, logger: Logger): Mailer {
  return env.RESEND_API_KEY
    ? resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM, logger)
    : logMailer(logger);
}

export function signInCodeEmail(to: string, code: string): Mail {
  return {
    to,
    subject: `${code} is your Buddy code`,
    text: `Your Buddy sign-in code is ${code}. It expires in 5 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<p>Your Buddy sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 5 minutes. If you didn't ask for it, you can ignore this email.</p>`,
  };
}
