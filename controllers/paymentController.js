const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

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

    const payment = new Payment({
      invoice: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      amount: payAmount,
      method: method || 'Bank Transfer',
      paymentDate: paymentDate || new Date(),
      referenceNote: referenceNote || '',
      recordedBy: recordedBy || null
    });

    await payment.save();

    // Reconcile invoice
    invoice.paidAmount = (invoice.paidAmount || 0) + payAmount;
    if (invoice.paidAmount >= invoice.grandTotal) {
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
    const payments = await Payment.find().sort({ paymentDate: -1 });
    res.json({ success: true, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
