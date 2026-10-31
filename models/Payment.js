const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  currency: { type: String, enum: ['INR'], default: 'INR' },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  invoiceNumber: { type: String, required: true },
  amountMinor: { type: Number, min: 1 },
  amount: { type: Number, required: true, min: 0.01 },
  method: {
    type: String,
    enum: ['Bank Transfer', 'Credit Card', 'UPI / Online', 'Check', 'UPI', 'Bank transfer', 'Card', 'Cheque', 'Cash', 'Other'],
    required: true
  },
  paymentDate: { type: Date, default: Date.now },
  referenceNote: { type: String, default: '' },
  referenceKey: { type: String, default: undefined },
  status: { type: String, enum: ['pending', 'posted'], default: 'posted' },
  balanceBeforeMinor: { type: Number, min: 0 },
  balanceAfterMinor: { type: Number, min: 0 },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: { type: Date, default: Date.now }
});

paymentSchema.index({ invoice: 1, referenceKey: 1 }, { unique: true, partialFilterExpression: { referenceKey: { $type: 'string' } } });
paymentSchema.index({ invoice: 1, status: 1, createdAt: 1 });
paymentSchema.index({ paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
