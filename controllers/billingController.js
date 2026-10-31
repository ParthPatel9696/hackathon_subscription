const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const { runRecurringBilling } = require('../services/billingService');

// POST /api/billing/run-batch
// Generates invoices for all active subscriptions due for billing, preventing double-billing.
exports.runRecurringBillingBatch = async (req, res) => {
  try {
    const { forceAllActive } = req.body;
    const { createdInvoices, skippedSubscriptions } = await runRecurringBilling({
      forceAllActive,
      actorRole: req.user.role
    });

    res.json({
      success: true,
      message: `Batch completed: ${createdInvoices.length} invoices generated.`,
      generatedCount: createdInvoices.length,
      skippedCount: skippedSubscriptions.length,
      invoices: createdInvoices,
      skipped: skippedSubscriptions
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
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

    const invoices = await Invoice.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
    const paidAmountMinor = invoice.paidAmountMinor ?? Math.round(Number(invoice.paidAmount || 0) * 100);
    if (status === 'Cancelled' && paidAmountMinor > 0) return res.status(400).json({ success: false, error: 'An invoice with recorded payments cannot be cancelled.' });

    invoice.status = status;
    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
