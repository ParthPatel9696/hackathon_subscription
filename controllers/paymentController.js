const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const { toMinor, fromMinor } = require('../utils/money');

// POST /api/payments
exports.recordPayment = async (req, res) => {
  try {
    const { invoiceId, amount, method, paymentDate, referenceNote, recordedBy } = req.body;

    if (!mongoose.isValidObjectId(invoiceId)) {
      return res.status(400).json({ success: false, error: 'A valid invoice is required.' });
    }
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    if (!['Confirmed', 'Overdue'].includes(invoice.status)) {
      return res.status(400).json({ success: false, error: 'Payments can only be recorded against confirmed or overdue invoices.' });
    }

    const payAmount = Number(amount);
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }
    const allowedMethods = ['Bank Transfer', 'Credit Card', 'UPI / Online', 'Check'];
    if (method && !allowedMethods.includes(method)) {
      return res.status(400).json({ success: false, error: 'Unsupported payment method.' });
    }
    const paymentTimestamp = paymentDate ? new Date(paymentDate) : new Date();
    if (!Number.isFinite(paymentTimestamp.getTime())) return res.status(400).json({ success: false, error: 'Enter a valid payment date.' });
    if (referenceNote !== undefined && String(referenceNote).length > 500) return res.status(400).json({ success: false, error: 'Payment reference must be 500 characters or fewer.' });
    const amountMinor = toMinor(payAmount);
    const grandTotalMinor = invoice.grandTotalMinor ?? toMinor(invoice.grandTotal);
    const paidAmountMinor = invoice.paidAmountMinor ?? toMinor(invoice.paidAmount || 0);
    if (amountMinor > grandTotalMinor - paidAmountMinor) {
      return res.status(400).json({ success: false, error: 'Payment cannot exceed the outstanding invoice balance.' });
    }

    const newPaidAmountMinor = paidAmountMinor + amountMinor;
    const nextStatus = newPaidAmountMinor >= grandTotalMinor ? 'Paid' : invoice.status;
    const updatedInvoice = await Invoice.findOneAndUpdate({
      _id: invoice._id,
      status: invoice.status,
      paidAmountMinor,
      paidAmount: invoice.paidAmount || 0
    }, {
      $set: {
        paidAmountMinor: newPaidAmountMinor,
        paidAmount: fromMinor(newPaidAmountMinor),
        grandTotalMinor,
        status: nextStatus
      }
    }, { new: true, runValidators: true });
    if (!updatedInvoice) {
      return res.status(409).json({ success: false, error: 'The invoice balance changed. Refresh and try again.' });
    }

    const payment = new Payment({
      invoice: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      amount: fromMinor(amountMinor),
      amountMinor,
      method: method || 'Bank Transfer',
      paymentDate: paymentTimestamp,
      referenceNote: referenceNote || '',
      recordedBy: req.user._id
    });

    try {
      await payment.save();
    } catch (paymentError) {
      await Invoice.findOneAndUpdate({ _id: invoice._id, paidAmountMinor: newPaidAmountMinor }, {
        $set: {
          paidAmountMinor,
          paidAmount: invoice.paidAmount || 0,
          status: invoice.status
        }
      });
      throw paymentError;
    }

    res.status(201).json({
      success: true,
      message: `Payment of $${fromMinor(amountMinor)} recorded for invoice ${invoice.invoiceNumber}. Status: ${updatedInvoice.status}`,
      payment,
      invoice: updatedInvoice
    });
  } catch (err) {
    const invalidInput = err instanceof TypeError;
    res.status(invalidInput ? 400 : 500).json({ success: false, error: invalidInput ? err.message : 'Unable to record payment.' });
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
