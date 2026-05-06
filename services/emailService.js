let transporter = null;
try {
  const nodemailer = require('nodemailer');
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: (SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
} catch (_e) {
  // nodemailer non installé: fallback no-op/log
}

async function sendEmail({ to, subject, text, html }) {
  try {
    if (!to || !subject) return { sent: false, reason: 'missing_params' };
    if (!transporter) {
      console.log('[EmailService] (dry-run) To:', to, 'Subject:', subject);
      return { sent: false, reason: 'transporter_unavailable' };
    }
    const info = await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
    if (process.env.DEBUG_EMAIL === '1') {
      console.log('[EmailService] sent', { to, subject, messageId: info?.messageId });
    }
    return { sent: true, info };
  } catch (err) {
    if (process.env.DEBUG_EMAIL === '1') {
      console.error('[EmailService] send error', err);
    }
    throw err;
  }
}

module.exports = { sendEmail };


