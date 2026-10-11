import { appendFile } from 'node:fs/promises';

import { EMAIL_LOGO } from '../brand/email-logo';
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

/**
 * Development fallback: writes the email to the log so codes can be copied
 * from the terminal, and to DEV_OUTBOX (one JSON line each) if set, where the
 * browser tests read their sign-in codes.
 */
function logMailer(logger: Logger, outbox?: string): Mailer {
  return {
    async send(mail) {
      logger.warn(
        { to: mail.to, subject: mail.subject, text: mail.text },
        'Email not sent (no RESEND_API_KEY)',
      );
      if (outbox) await appendFile(outbox, `${JSON.stringify(mail)}\n`);
    },
  };
}

export function createMailer(env: Env, logger: Logger): Mailer {
  return env.RESEND_API_KEY
    ? resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM, logger)
    : logMailer(logger, env.DEV_OUTBOX);
}

/**
 * `baseUrl` is the API's public URL, which serves the logo image
 * (mail apps don't show SVG, so emails use a PNG).
 */
export function signInCodeEmail(to: string, code: string, baseUrl: string): Mail {
  const logo = new URL('/brand/email-logo.png', baseUrl).href;
  const { width, height } = EMAIL_LOGO;
  return {
    to,
    subject: `${code} is your Buddy code`,
    text: `Your Buddy sign-in code is ${code}. It expires in 5 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<p><img src="${logo}" width="${width / 2}" height="${height / 2}" alt="Buddy"></p><p>Your Buddy sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 5 minutes. If you didn't ask for it, you can ignore this email.</p>`,
  };
}
