const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');

// POST /api/billing/run-batch
// Generates invoices for all active subscriptions due for billing, preventing double-billing.
exports.runRecurringBillingBatch = async (req, res) => {
  try {
    const today = new Date();
    // In demo mode, we can process all active subscriptions or those due
    const { forceAllActive } = req.body;

    const query = { status: 'Active' };
    if (!forceAllActive) {
      query.nextBillingDate = { $lte: today };
    }

    const activeSubs = await Subscription.find(query);
    const createdInvoices = [];
    const skippedSubs = [];

    for (const sub of activeSubs) {
      // Check for double billing in current calendar month / cycle
      const periodStart = sub.lastInvoicedDate || sub.startDate || today;
      const periodEnd = sub.nextBillingDate || today;

      const existingInvoice = await Invoice.findOne({
        subscription: sub._id,
        createdAt: {
          $gte: new Date(today.getFullYear(), today.getMonth(), 1)
        }
      });

      if (existingInvoice && !forceAllActive) {
        skippedSubs.push({
          subNumber: sub.subscriptionNumber,
          reason: 'Already billed for this billing cycle.'
        });
        continue;
      }

      // Generate Invoice lines directly from subscription lines
      const invoiceLines = sub.lines.map(line => ({
        productName: line.productName,
        variantName: line.variantName,
        quantity: line.quantity,
        unitPrice: line.unitPrice + (line.variantPriceExtra || 0),
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        discountAmount: line.discountAmount,
        total: line.lineTotal
      }));

      const count = await Invoice.countDocuments();
      const invoiceNumber = `INV-2024-${String(count + 201).padStart(4, '0')}`;

      // Due date based on payment terms (e.g. Net 30 = +30 days)
      const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      const newInvoice = new Invoice({
        invoiceNumber,
        subscription: sub._id,
        subscriptionNumber: sub.subscriptionNumber,
        customer: sub.customer,
        customerName: sub.customerName,
        customerEmail: sub.customerEmail,
        invoiceDate: today,
        dueDate,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        lines: invoiceLines,
        subtotal: sub.subtotal,
        taxTotal: sub.taxTotal,
        discountTotal: sub.discountTotal,
        grandTotal: sub.recurringTotal,
        status: 'Confirmed', // Created and confirmed ready to send/pay
        paymentTerms: sub.paymentTerms
      });

      await newInvoice.save();
      createdInvoices.push(newInvoice);

      // Advance next billing date according to cadence
      const nextDate = new Date(sub.nextBillingDate || today);
      if (sub.billingFrequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
      else if (sub.billingFrequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (sub.billingFrequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
      else nextDate.setMonth(nextDate.getMonth() + 1); // monthly

      sub.lastInvoicedDate = today;
      sub.nextBillingDate = nextDate;
      await sub.save();
    }

    res.json({
      success: true,
      message: `Batch completed: ${createdInvoices.length} invoices generated.`,
      generatedCount: createdInvoices.length,
      skippedCount: skippedSubs.length,
      invoices: createdInvoices,
      skipped: skippedSubs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/invoices
exports.getInvoices = async (req, res) => {
  try {
    const { status, customerId } = req.query;
    let query = {};
    if (status && status !== 'ALL') query.status = status;
    if (customerId) query.customer = customerId;

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

    invoice.status = status;
    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
