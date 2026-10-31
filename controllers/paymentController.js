const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { toMinor, fromMinor } = require('../utils/money');
const { isTransactionUnsupported } = require('../services/billingService');
const { sortFromQuery, applyNumericRange, applyDateRange } = require('../utils/listQuery');
const { recordAudit } = require('../services/auditService');

const METHODS = ['Bank Transfer', 'Credit Card', 'UPI / Online', 'Check', 'UPI', 'Bank transfer', 'Card', 'Cheque', 'Cash', 'Other'];

class PaymentError extends Error {
  constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}

function normalizeInput(body) {
  const { invoiceId, amount, paymentDate, referenceNote } = body;
  if (!mongoose.isValidObjectId(invoiceId)) throw new PaymentError('A valid invoice is required.');
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new PaymentError('Valid payment amount is required.');
  const amountMinor = toMinor(numericAmount);
  if (amountMinor < 1) throw new PaymentError('Payment must be at least one paise.');
  const method = body.method || 'Bank Transfer';
  if (!METHODS.includes(method)) throw new PaymentError('Unsupported payment method.');
  const timestamp = paymentDate ? new Date(paymentDate) : new Date();
  if (!Number.isFinite(timestamp.getTime())) throw new PaymentError('Enter a valid payment date.');
  const note = typeof referenceNote === 'string' ? referenceNote.trim() : '';
  if (note.length > 500) throw new PaymentError('Payment reference must be 500 characters or fewer.');
  return { invoiceId, amountMinor, method, paymentTimestamp: timestamp, referenceNote: note, referenceKey: note ? note.toLowerCase() : undefined };
}

const balanceOf = (invoice) => ({
  grandTotalMinor: invoice.grandTotalMinor ?? toMinor(invoice.grandTotal),
  paidAmountMinor: invoice.$isDefault?.('paidAmountMinor') || invoice.paidAmountMinor == null
    ? toMinor(invoice.paidAmount || 0)
    : invoice.paidAmountMinor
});

function balancePredicate(invoice, amountMinor) {
  return { $and: [
    invoice.$isDefault?.('paidAmountMinor') ? { $or: [{ paidAmountMinor: 0 }, { paidAmountMinor: { $exists: false } }] } : { paidAmountMinor: amountMinor },
    invoice.$isDefault?.('paidAmount') ? { $or: [{ paidAmount: 0 }, { paidAmount: { $exists: false } }] } : { paidAmount: invoice.paidAmount }
  ] };
}

function ensurePayable(invoice) {
  if (!invoice) throw new PaymentError('Invoice not found.', 404);
  if (!['Confirmed', 'Overdue'].includes(invoice.status)) throw new PaymentError('Payments can only be recorded against confirmed or overdue invoices.');
}

function buildPayment(input, invoice, userId, beforeMinor, afterMinor, status = 'posted') {
  return new Payment({
    invoice: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    amount: fromMinor(input.amountMinor),
    amountMinor: input.amountMinor,
    method: input.method,
    paymentDate: input.paymentTimestamp,
    referenceNote: input.referenceNote,
    referenceKey: input.referenceKey,
    recordedBy: userId,
    status,
    balanceBeforeMinor: beforeMinor,
    balanceAfterMinor: afterMinor
  });
}

async function assertReferenceAvailable(invoiceId, referenceKey, session) {
  if (!referenceKey) return;
  let query = Payment.findOne({ invoice: invoiceId, referenceKey });
  if (session) query = query.session(session);
  if (await query) throw new PaymentError('A payment with this reference has already been recorded for the invoice.', 409);
}

async function applyBalance(invoice, amountMinor, session) {
  const { grandTotalMinor, paidAmountMinor } = balanceOf(invoice);
  if (amountMinor > grandTotalMinor - paidAmountMinor) throw new PaymentError('Payment cannot exceed the outstanding invoice balance.', 400);
  const nextPaidMinor = paidAmountMinor + amountMinor;
  const filter = {
    _id: invoice._id,
    status: invoice.status,
  };
  Object.assign(filter, balancePredicate(invoice, paidAmountMinor));
  const updated = await Invoice.findOneAndUpdate(filter, { $set: {
    paidAmountMinor: nextPaidMinor,
    paidAmount: fromMinor(nextPaidMinor),
    grandTotalMinor,
    status: nextPaidMinor >= grandTotalMinor ? 'Paid' : invoice.status
  } }, { new: true, runValidators: true, session });
  if (!updated) throw new PaymentError('The invoice balance changed. Refresh and try again.', 409);
  return { updated, beforeMinor: paidAmountMinor, afterMinor: nextPaidMinor };
}

async function recordTransaction(input, userId) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const invoice = await Invoice.findById(input.invoiceId).session(session);
      ensurePayable(invoice);
      await assertReferenceAvailable(invoice._id, input.referenceKey, session);
      const balance = await applyBalance(invoice, input.amountMinor, session);
      const payment = buildPayment(input, invoice, userId, balance.beforeMinor, balance.afterMinor);
      await payment.save({ session });
      result = { payment, invoice: balance.updated };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function reconcilePending(invoiceId) {
  const recovered = [];
  while (true) {
    const pending = await Payment.findOne({ invoice: invoiceId, status: 'pending' }).sort({ createdAt: 1 });
    if (!pending) return recovered;
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new PaymentError('Pending payment references a missing invoice; manual reconciliation is required.', 409);
    const { paidAmountMinor } = balanceOf(invoice);
    if (paidAmountMinor === pending.balanceAfterMinor) {
      const posted = await Payment.updateOne({ _id: pending._id, status: 'pending' }, { $set: { status: 'posted' } });
      if (posted.modifiedCount !== 1) throw new PaymentError('Pending payment could not be marked as posted; manual reconciliation is required.', 409);
      recovered.push({ payment: await Payment.findById(pending._id), invoice });
      continue;
    }
    if (paidAmountMinor !== pending.balanceBeforeMinor) throw new PaymentError('Pending payment cannot be reconciled automatically; manual review is required.', 409);
    const nextStatus = pending.balanceAfterMinor >= balanceOf(invoice).grandTotalMinor ? 'Paid' : invoice.status;
    const filter = { _id: invoice._id, status: invoice.status, ...balancePredicate(invoice, paidAmountMinor) };
    const updated = await Invoice.updateOne(filter, { $set: {
      paidAmountMinor: pending.balanceAfterMinor,
      paidAmount: fromMinor(pending.balanceAfterMinor),
      status: nextStatus
    } });
    if (updated.modifiedCount !== 1) continue;
    const posted = await Payment.updateOne({ _id: pending._id, status: 'pending' }, { $set: { status: 'posted' } });
    if (posted.modifiedCount !== 1) throw new PaymentError('Pending payment could not be marked as posted; manual reconciliation is required.', 409);
    recovered.push({ payment: await Payment.findById(pending._id), invoice: await Invoice.findById(invoice._id) });
  }
}

async function recordWithStandaloneRecovery(input, userId) {
  const lockId = crypto.randomUUID();
  const lockTime = new Date();
  const invoice = await Invoice.findOneAndUpdate({
    _id: input.invoiceId,
    $or: [{ paymentLockExpiresAt: null }, { paymentLockExpiresAt: { $lt: lockTime } }]
  }, { $set: { paymentLockId: lockId, paymentLockExpiresAt: new Date(lockTime.getTime() + 60_000) } }, { new: true });
  if (!invoice) throw new PaymentError('Another payment is being recorded for this invoice. Retry shortly.', 409);
  try {
    const recovered = await reconcilePending(invoice._id);
    const replay = recovered.find(({ payment }) => payment &&
      payment.amountMinor === input.amountMinor && payment.method === input.method &&
      (payment.referenceKey || undefined) === input.referenceKey);
    if (replay) return replay;
    const currentInvoice = await Invoice.findById(invoice._id);
    ensurePayable(currentInvoice);
    await assertReferenceAvailable(currentInvoice._id, input.referenceKey);
    const { grandTotalMinor, paidAmountMinor } = balanceOf(currentInvoice);
    if (input.amountMinor > grandTotalMinor - paidAmountMinor) throw new PaymentError('Payment cannot exceed the outstanding invoice balance.', 400);
    const afterMinor = paidAmountMinor + input.amountMinor;
    const payment = buildPayment(input, currentInvoice, userId, paidAmountMinor, afterMinor, 'pending');
    await payment.save();
    const invoiceFilter = {
      _id: currentInvoice._id,
      status: currentInvoice.status,
      paymentLockId: lockId
    };
    Object.assign(invoiceFilter, balancePredicate(currentInvoice, paidAmountMinor));
    const updatedInvoice = await Invoice.findOneAndUpdate(invoiceFilter, { $set: {
      paidAmountMinor: afterMinor,
      paidAmount: fromMinor(afterMinor),
      grandTotalMinor,
      status: afterMinor >= grandTotalMinor ? 'Paid' : currentInvoice.status
    } }, { new: true, runValidators: true });
    if (!updatedInvoice) {
      await Payment.deleteOne({ _id: payment._id, status: 'pending' });
      throw new PaymentError('The invoice balance changed. Refresh and try again.', 409);
    }
    const posted = await Payment.findOneAndUpdate({ _id: payment._id, status: 'pending' }, { $set: { status: 'posted' } }, { new: true });
    if (!posted) throw new Error('Invoice updated but payment posting needs recovery. Retry the payment operation to reconcile it.');
    return { payment: posted, invoice: updatedInvoice };
  } finally {
    await Invoice.updateOne({ _id: invoice._id, paymentLockId: lockId }, { $set: { paymentLockId: null, paymentLockExpiresAt: null } });
  }
}

exports.recordPayment = async (req, res) => {
  try {
    const input = normalizeInput(req.body || {});
    let result;
    try {
      result = await recordTransaction(input, req.user._id);
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      result = await recordWithStandaloneRecovery(input, req.user._id);
    }
    recordAudit({ actor: req.user, action: 'payment_recorded', resourceType: 'Payment', resourceId: result.payment._id, customer: result.invoice.customer, newValue: { amountMinor: input.amountMinor, method: result.payment.method, status: result.payment.status }, metadata: { invoiceNumber: result.invoice.invoiceNumber, reference: result.payment.referenceNote } }).catch(() => {});
    res.status(201).json({
      success: true,
      message: `Payment of ₹${fromMinor(input.amountMinor)} recorded for invoice ${result.invoice.invoiceNumber}. Status: ${result.invoice.status}`,
      payment: result.payment,
      invoice: result.invoice
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, error: 'A payment with this reference has already been recorded for the invoice.' });
    const status = err.statusCode || (err instanceof TypeError ? 400 : 500);
    res.status(status).json({ success: false, error: status >= 500 ? 'Unable to record payment.' : err.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const query = { $or: [{ status: 'posted' }, { status: { $exists: false } }] };
    if (req.user.role === 'customer') {
      const customerInvoices = await Invoice.find({ customer: req.user._id }).select('_id');
      query.invoice = { $in: customerInvoices.map((invoice) => invoice._id) };
    }
    if (req.query.subscriptionId) {
      if (!mongoose.isValidObjectId(req.query.subscriptionId)) return res.status(400).json({ success: false, error: 'Invalid subscription id.' });
      const relatedInvoices = await Invoice.find({ subscription: req.query.subscriptionId }).select('_id');
      const allowedIds = relatedInvoices.map((invoice) => String(invoice._id));
      query.invoice = query.invoice?.$in ? { $in: allowedIds.filter((id) => query.invoice.$in.some((ownedId) => String(ownedId) === id)) } : { $in: allowedIds };
    }
    if (req.query.status === 'posted') query.status = 'posted';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    if (search) { const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); query.$and = [{ $or: query.$or }, { $or: ['invoiceNumber', 'method', 'referenceNote'].map((field) => ({ [field]: { $regex: escaped, $options: 'i' } })) }]; delete query.$or; }
    applyNumericRange(query, 'amount', req.query.minAmount, req.query.maxAmount);
    if (!applyDateRange(query, 'paymentDate', req.query.startDate, req.query.endDate)) return res.status(400).json({ success: false, error: 'Enter valid date filters.' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const [payments, total] = await Promise.all([Payment.find(query).sort(sortFromQuery(req.query.sort, { record: 'invoiceNumber', status: 'status', amount: 'amountMinor', details: 'method', paymentDate: 'paymentDate' }, { paymentDate: -1 })).skip((page - 1) * pageSize).limit(pageSize), Payment.countDocuments(query)]);
    res.json({ success: true, count: payments.length, total, page, pageSize, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to load payments.' });
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid payment id.' });
    const payment = await Payment.findOne({ _id: req.params.id, $or: [{ status: 'posted' }, { status: { $exists: false } }] }).populate('invoice').lean();
    if (!payment || (req.user.role === 'customer' && String(payment.invoice?.customer) !== String(req.user._id))) return res.status(404).json({ success: false, error: 'Payment not found.' });
    res.json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to load payment details.' });
  }
};
