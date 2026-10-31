const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const { runRecurringBilling } = require('../services/billingService');
const { sortFromQuery, applyNumericRange, applyDateRange } = require('../utils/listQuery');

// POST /api/billing/run-batch
// Generates invoices for all active subscriptions due for billing, preventing double-billing.
exports.runRecurringBillingBatch = async (req, res) => {
  try {
    const { forceAllActive } = req.body;
    const { createdInvoices, skippedSubscriptions, recoveredSubscriptions } = await runRecurringBilling({
      forceAllActive,
      actorRole: req.user.role
    });

    res.json({
      success: true,
      message: `Batch completed: ${createdInvoices.length} invoices generated.`,
      generatedCount: createdInvoices.length,
      skippedCount: skippedSubscriptions.length,
      recoveredCount: recoveredSubscriptions.length,
      invoices: createdInvoices,
      skipped: skippedSubscriptions,
      recovered: recoveredSubscriptions
    });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: status === 500 ? 'Billing batch failed. Retry it to recover any invoice whose schedule update was interrupted.' : err.message });
  }
};

// GET /api/invoices
exports.getInvoices = async (req, res) => {
  try {
    const { status, customerId } = req.query;
    let query = {};
    if (req.user.role === 'customer') query.customer = req.user._id;
    if (status && status !== 'ALL') query.status = status;
    if (customerId && req.user.role !== 'customer') query.customer = customerId;
    if (req.query.subscriptionId) {
      if (!mongoose.isValidObjectId(req.query.subscriptionId)) return res.status(400).json({ success: false, error: 'Invalid subscription id.' });
      query.subscription = req.query.subscriptionId;
    }
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    if (search) { const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); query.$or = ['invoiceNumber', 'customerName', 'subscriptionNumber'].map((field) => ({ [field]: { $regex: escaped, $options: 'i' } })); }
    applyNumericRange(query, 'grandTotal', req.query.minAmount, req.query.maxAmount);
    if (!applyDateRange(query, 'dueDate', req.query.startDate, req.query.endDate)) return res.status(400).json({ success: false, error: 'Enter valid date filters.' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));

    const [invoices, total] = await Promise.all([Invoice.find(query).sort(sortFromQuery(req.query.sort, { record: 'invoiceNumber', status: 'status', amount: 'grandTotalMinor', details: 'customerName', dueDate: 'dueDate' }, { createdAt: -1 })).skip((page - 1) * pageSize).limit(pageSize), Invoice.countDocuments(query)]);
    res.json({ success: true, count: invoices.length, total, page, pageSize, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to update invoice status.' });
  }
};

// PATCH /api/invoices/:id/status
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid invoice id.' });
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    const allowedTransitions = {
      Draft: ['Confirmed', 'Cancelled'],
      Confirmed: ['Overdue', 'Cancelled'],
      Overdue: ['Cancelled']
    };
    if (!(allowedTransitions[invoice.status] || []).includes(status)) return res.status(400).json({ success: false, error: 'Invalid invoice status transition.' });
    if (status === 'Overdue' && new Date(invoice.dueDate) >= new Date()) return res.status(400).json({ success: false, error: 'An invoice can only be marked overdue after its due date.' });
    const paidAmountMinor = invoice.$isDefault?.('paidAmountMinor') || invoice.paidAmountMinor == null
      ? Math.round(Number(invoice.paidAmount || 0) * 100)
      : invoice.paidAmountMinor;
    if (status === 'Cancelled' && paidAmountMinor > 0) return res.status(400).json({ success: false, error: 'An invoice with recorded payments cannot be cancelled.' });

    const filter = { _id: invoice._id, status: invoice.status };
    if (invoice.$isDefault?.('paidAmountMinor')) filter.$or = [{ paidAmountMinor: 0 }, { paidAmountMinor: { $exists: false } }];
    else filter.paidAmountMinor = paidAmountMinor;
    const updated = await Invoice.findOneAndUpdate(filter, { $set: { status } }, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ success: false, error: 'Invoice changed while you were updating it. Refresh and try again.' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
