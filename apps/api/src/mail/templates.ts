import { type Language, RTL_LANGUAGES } from '@sabaq/shared';
import type { MailMessage } from './mailer.js';

export type EmailKind = 'verify_email' | 'reset_password' | 'password_changed';

interface Copy {
  subject: string;
  intro: string;
  action: string;
  outro: string;
}

const GREETING: Record<Language, (name: string) => string> = {
  en: (name) => `Hello ${name},`,
  ur: (name) => `السلام علیکم ${name}،`,
};

const FALLBACK: Record<Language, string> = {
  en: 'If the button does not work, copy this link into your browser:',
  ur: 'اگر بٹن کام نہ کرے تو یہ لنک اپنے براؤزر میں کاپی کریں:',
};

const SIGNATURE: Record<Language, string> = { en: '— Sabaq', ur: '— سبق' };

const COPY: Record<EmailKind, Record<Language, Copy>> = {
  verify_email: {
    en: {
      subject: 'Confirm your e-mail address for Sabaq',
      intro: 'Please confirm that this is your e-mail address. The link works for 24 hours.',
      action: 'Confirm e-mail address',
      outro: 'If you did not create a Sabaq account, you can ignore this e-mail.',
    },
    ur: {
      subject: 'سبق کے لیے اپنا ای میل پتہ تصدیق کریں',
      intro: 'براہِ کرم تصدیق کریں کہ یہ آپ کا ای میل پتہ ہے۔ یہ لنک 24 گھنٹے تک کام کرے گا۔',
      action: 'ای میل پتہ تصدیق کریں',
      outro: 'اگر آپ نے سبق اکاؤنٹ نہیں بنایا تو اس ای میل کو نظر انداز کر دیں۔',
    },
  },
  reset_password: {
    en: {
      subject: 'Reset your Sabaq password',
      intro:
        'We received a request to reset your password. The link works for one hour and can be used once.',
      action: 'Choose a new password',
      outro: 'If you did not ask for this, ignore this e-mail; your password stays the same.',
    },
    ur: {
      subject: 'اپنا سبق پاس ورڈ دوبارہ ترتیب دیں',
      intro:
        'ہمیں آپ کا پاس ورڈ دوبارہ ترتیب دینے کی درخواست موصول ہوئی ہے۔ یہ لنک ایک گھنٹے تک اور صرف ایک بار کام کرے گا۔',
      action: 'نیا پاس ورڈ منتخب کریں',
      outro:
        'اگر آپ نے یہ درخواست نہیں کی تو اس ای میل کو نظر انداز کریں، آپ کا پاس ورڈ تبدیل نہیں ہوگا۔',
    },
  },
  password_changed: {
    en: {
      subject: 'Your Sabaq password was changed',
      intro: 'Your password was changed and you were signed out on your other devices.',
      action: 'This was not me: reset my password',
      outro: 'If you made this change, you do not need to do anything.',
    },
    ur: {
      subject: 'آپ کا سبق پاس ورڈ تبدیل کر دیا گیا ہے',
      intro: 'آپ کا پاس ورڈ تبدیل کر دیا گیا ہے اور آپ کے دوسرے آلات سے سائن آؤٹ کر دیا گیا ہے۔',
      action: 'یہ میں نے نہیں کیا: پاس ورڈ دوبارہ ترتیب دیں',
      outro: 'اگر یہ تبدیلی آپ نے کی ہے تو آپ کو کچھ کرنے کی ضرورت نہیں۔',
    },
  },
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character,
  );

/**
 * Builds an e-mail in the recipient's language, as plain text and as simple, accessible HTML
 * (correct language and direction, a large button and the link written out in full).
 */
export function renderEmail(
  kind: EmailKind,
  { to, name, link, language }: { to: string; name: string; link: string; language: Language },
): MailMessage {
  const copy = COPY[kind][language];
  const greeting = GREETING[language](name);
  const direction = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
  const text = [
    greeting,
    '',
    copy.intro,
    '',
    `${copy.action}: ${link}`,
    '',
    copy.outro,
    '',
    SIGNATURE[language],
  ].join('\n');

  const safeLink = escapeHtml(link);
  const html = `<!doctype html>
<html lang="${language}" dir="${direction}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Nastaliq Urdu',sans-serif;font-size:16px;line-height:1.6;color:#1f2933">
<main style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px">${escapeHtml(copy.intro)}</p>
<p style="margin:0 0 24px"><a href="${safeLink}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(copy.action)}</a></p>
<p style="margin:0 0 8px;font-size:14px;color:#52606d">${escapeHtml(FALLBACK[language])}</p>
<p style="margin:0 0 24px;font-size:14px;word-break:break-all"><a href="${safeLink}" style="color:#1d4ed8">${safeLink}</a></p>
<p style="margin:0 0 16px;font-size:14px;color:#52606d">${escapeHtml(copy.outro)}</p>
<p style="margin:0">${SIGNATURE[language]}</p>
</main>
</body>
</html>`;

  return { to, subject: copy.subject, text, html };
}
