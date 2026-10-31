const { formatCurrency, fromMinor, invoiceOutstandingMinor } = require('../utils/money');
const nodemailer = require('nodemailer');

let transport;
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS } : undefined
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

async function sendInvoice({ to, invoice, pdfBuffer }) {
  const mail = getTransport();
  if (!mail) return false;
  const invoiceNumber = String(invoice.invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '');
  const companyName = invoice.companySnapshot?.displayName || invoice.companySnapshot?.name || 'Brightloop';
  await mail.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Invoice ${invoiceNumber} from ${companyName}`,
    text: `Invoice ${invoiceNumber} is attached. Amount due: ${formatCurrency(fromMinor(invoiceOutstandingMinor(invoice)))}. Due date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    html: `<p>Invoice <strong>${invoiceNumber}</strong> is attached.</p><p>Amount due: ${formatCurrency(fromMinor(invoiceOutstandingMinor(invoice)))}<br>Due date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>`,
    attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
  });
  return true;
}

async function sendQuotation({ to, quotation, pdfBuffer }) {
  const mail = getTransport();
  if (!mail) return false;
  const quoteNumber = String(quotation.subscriptionNumber || 'quotation').replace(/[^a-zA-Z0-9_-]/g, '');
  const companyName = quotation.companySnapshot?.displayName || quotation.companySnapshot?.name || 'Brightloop';
  await mail.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Quotation ${quoteNumber} from ${companyName}`,
    text: `Quotation ${quoteNumber} is attached. Recurring total: ${formatCurrency(quotation.grandTotal || 0)} per ${quotation.billingFrequency || 'billing period'}. This quotation is valid until ${new Date(quotation.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}. Sign in to Brightloop to accept or decline it.`,
    html: `<p>Quotation <strong>${quoteNumber}</strong> is attached.</p><p>Recurring total: ${formatCurrency(quotation.grandTotal || 0)} per ${quotation.billingFrequency || 'billing period'}<br>Valid until: ${new Date(quotation.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p><p>Sign in to Brightloop to accept or decline this quotation.</p>`,
    attachments: [{ filename: `${quoteNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
  });
  return true;
}

module.exports = { sendPasswordReset, sendInvoice, sendQuotation };
