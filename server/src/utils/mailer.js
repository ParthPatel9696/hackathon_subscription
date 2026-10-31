import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter;
if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
  });
}

export async function sendPasswordResetEmail(email, token) {
  if (!transporter) {
    if (env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
    return false;
  }
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: email,
    subject: 'Reset your Ledgerly password',
    text: `Use this password reset token within one hour: ${token}`
  });
  return true;
}
