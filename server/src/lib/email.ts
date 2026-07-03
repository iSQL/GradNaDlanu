import { Resend } from 'resend';
import { env } from '../env.js';

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!env.resendApiKey) return null;
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface VerificationMail {
  to: string;
  displayName: string;
  verifyUrl: string;
}

export async function sendVerificationEmail(mail: VerificationMail): Promise<void> {
  const name = escapeHtml(mail.displayName);
  const url = escapeHtml(mail.verifyUrl);

  const subject = 'Potvrdite svoju e-poštu — Grad na dlanu';
  const text =
    `Zdravo ${mail.displayName},\n\n` +
    `Kliknite na link ispod da potvrdite svoju e-poštu i aktivirate nalog na Grad na dlanu:\n\n` +
    `${mail.verifyUrl}\n\n` +
    `Link važi 24 sata. Ako niste vi pokrenuli registraciju, ignorišite ovu poruku.\n\n` +
    `— Grad na dlanu`;

  const html = `<!doctype html>
<html lang="sr">
  <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f5f0;padding:32px 16px;color:#1c1a16;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e2d6;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:500;font-size:24px;">Potvrdite svoju e-poštu</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Zdravo ${name},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;">Da završite registraciju na <strong>Grad na dlanu</strong>, kliknite na dugme ispod:</p>
      <p style="margin:0 0 24px;">
        <a href="${url}" style="display:inline-block;background:#1c1a16;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Potvrdi e-poštu</a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#6b6557;">Ili otvorite ovaj link:</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.55;word-break:break-all;"><a href="${url}" style="color:#9a7f2b;">${url}</a></p>
      <p style="margin:0;font-size:12px;color:#9a9285;">Link važi 24 sata. Ako niste vi pokrenuli registraciju, ignorišite ovu poruku.</p>
    </div>
  </body>
</html>`;

  const c = getClient();
  if (!c) {
    // Dev fallback: log the link so the developer can click it without needing
    // Resend creds wired up. Never log this in production — env.resendApiKey is
    // required to send, and if it's missing in prod the operator gets the
    // boot-time warning in env.ts.
    console.log(
      `[email] (no RESEND_API_KEY set; not sending) verification link for ${mail.to}: ${mail.verifyUrl}`,
    );
    return;
  }

  const { error } = await c.emails.send({
    from: env.emailFrom,
    to: mail.to,
    subject,
    text,
    html,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`);
  }
}

interface NewsletterConfirmMail {
  to: string;
  confirmUrl: string;
}

// Double opt-in: sent after a footer sign-up, before the address joins the list.
export async function sendNewsletterConfirmEmail(mail: NewsletterConfirmMail): Promise<void> {
  const url = escapeHtml(mail.confirmUrl);
  const subject = 'Potvrdite prijavu na bilten — Grad na dlanu';
  const text =
    `Zdravo,\n\n` +
    `Neko je prijavio ovu adresu na bilten „Grad na dlanu". Ako ste to bili vi, ` +
    `potvrdite prijavu klikom na link ispod:\n\n` +
    `${mail.confirmUrl}\n\n` +
    `Ako se niste prijavljivali, jednostavno ignorišite ovu poruku — nećete biti dodati na listu.\n\n` +
    `— Grad na dlanu`;

  const html = `<!doctype html>
<html lang="sr">
  <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f5f0;padding:32px 16px;color:#1c1a16;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e2d6;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:500;font-size:24px;">Potvrdite prijavu na bilten</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;">Neko je prijavio ovu adresu na bilten <strong>Grad na dlanu</strong>. Ako ste to bili vi, potvrdite klikom na dugme:</p>
      <p style="margin:0 0 24px;">
        <a href="${url}" style="display:inline-block;background:#1c1a16;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Potvrdi prijavu</a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#6b6557;">Ili otvorite ovaj link:</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.55;word-break:break-all;"><a href="${url}" style="color:#9a7f2b;">${url}</a></p>
      <p style="margin:0;font-size:12px;color:#9a9285;">Ako se niste prijavljivali, ignorišite ovu poruku — nećete biti dodati na listu.</p>
    </div>
  </body>
</html>`;

  const c = getClient();
  if (!c) {
    console.log(
      `[email] (no RESEND_API_KEY set; not sending) newsletter confirm link for ${mail.to}: ${mail.confirmUrl}`,
    );
    return;
  }
  const { error } = await c.emails.send({ from: env.emailFrom, to: mail.to, subject, text, html });
  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`);
  }
}

interface NewsletterMail {
  to: string;
  subject: string;
  bodyText: string;
  unsubscribeUrl: string;
  manageUrl: string;
}

// The actual newsletter blast. Body is plain text authored by an admin; we wrap
// it with an unsubscribe/manage footer and set List-Unsubscribe headers so mail
// clients can offer one-click opt-out.
export async function sendNewsletterEmail(mail: NewsletterMail): Promise<void> {
  const unsub = escapeHtml(mail.unsubscribeUrl);
  const manage = escapeHtml(mail.manageUrl);
  // Preserve author line breaks; escape first so the body can't inject markup.
  const bodyHtml = escapeHtml(mail.bodyText).replace(/\r?\n/g, '<br>');

  const text =
    `${mail.bodyText}\n\n` +
    `—\nPodesite bilten: ${mail.manageUrl}\nOdjava: ${mail.unsubscribeUrl}\n— Grad na dlanu`;

  const html = `<!doctype html>
<html lang="sr">
  <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f5f0;padding:32px 16px;color:#1c1a16;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e2d6;border-radius:12px;padding:32px;">
      <div style="font-size:15px;line-height:1.6;">${bodyHtml}</div>
      <hr style="border:none;border-top:1px solid #e6e2d6;margin:28px 0 16px;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9a9285;">
        Primili ste ovu poruku jer ste pretplaćeni na bilten „Grad na dlanu".<br>
        <a href="${manage}" style="color:#9a7f2b;">Podesite bilten</a> ·
        <a href="${unsub}" style="color:#9a7f2b;">Odjavite se</a>
      </p>
    </div>
  </body>
</html>`;

  const c = getClient();
  if (!c) {
    console.log(
      `[email] (no RESEND_API_KEY set; not sending) newsletter "${mail.subject}" to ${mail.to} (unsubscribe: ${mail.unsubscribeUrl})`,
    );
    return;
  }
  const { error } = await c.emails.send({
    from: env.emailFrom,
    to: mail.to,
    subject: mail.subject,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`);
  }
}
