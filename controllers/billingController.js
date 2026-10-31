const Invoice = require('../models/Invoice');
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
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    const allowedStatuses = ['Draft', 'Confirmed', 'Overdue', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid invoice status.' });
    }

    invoice.status = status;
    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
