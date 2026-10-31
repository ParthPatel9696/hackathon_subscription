const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const { toMinor, fromMinor } = require('../utils/money');

// POST /api/payments
exports.recordPayment = async (req, res) => {
  try {
    const { invoiceId, amount, method, paymentDate, referenceNote, recordedBy } = req.body;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }
    const allowedMethods = ['Bank Transfer', 'Credit Card', 'UPI / Online', 'Check'];
    if (method && !allowedMethods.includes(method)) {
      return res.status(400).json({ success: false, error: 'Unsupported payment method.' });
    }
    const amountMinor = toMinor(payAmount);
    const grandTotalMinor = invoice.grandTotalMinor ?? toMinor(invoice.grandTotal);
    const paidAmountMinor = invoice.paidAmountMinor ?? toMinor(invoice.paidAmount || 0);
    if (amountMinor > grandTotalMinor - paidAmountMinor) {
      return res.status(400).json({ success: false, error: 'Payment cannot exceed the outstanding invoice balance.' });
    }

    const payment = new Payment({
      invoice: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      amount: fromMinor(amountMinor),
      amountMinor,
      method: method || 'Bank Transfer',
      paymentDate: paymentDate || new Date(),
      referenceNote: referenceNote || '',
      recordedBy: req.user._id
    });

    await payment.save();

    // Reconcile invoice
    invoice.paidAmountMinor = paidAmountMinor + amountMinor;
    invoice.paidAmount = fromMinor(invoice.paidAmountMinor);
    invoice.grandTotalMinor = grandTotalMinor;
    if (invoice.paidAmountMinor >= grandTotalMinor) {
      invoice.status = 'Paid';
    }
    await invoice.save();

    res.status(201).json({
      success: true,
      message: `Payment of $${payAmount} recorded for invoice ${invoice.invoiceNumber}. Status: ${invoice.status}`,
      payment,
      invoice
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/payments
exports.getPayments = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'customer') {
      const customerInvoices = await Invoice.find({ customer: req.user._id }).select('_id');
      query.invoice = { $in: customerInvoices.map(invoice => invoice._id) };
    }
    const payments = await Payment.find(query).sort({ paymentDate: -1 });
    res.json({ success: true, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
