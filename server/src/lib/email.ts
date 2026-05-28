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
