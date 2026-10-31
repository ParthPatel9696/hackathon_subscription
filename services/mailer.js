const nodemailer = require('nodemailer');

let transport;
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transport;
}

async function sendPasswordReset({ to, url, expiresInMinutes = 60 }) {
  const mail = getTransport();
  if (!mail) return false;
  await mail.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Reset your Brightloop password',
    text: `Use this secure link to reset your Brightloop password. It expires in ${expiresInMinutes} minutes.\n\n${url}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Use this secure link to reset your Brightloop password. It expires in ${expiresInMinutes} minutes.</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`
  });
  return true;
}

module.exports = { sendPasswordReset };
