const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  invoiceNumber: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: {
    type: String,
    enum: ['Bank Transfer', 'Credit Card', 'UPI / Online', 'Check'],
    required: true
  },
  paymentDate: { type: Date, default: Date.now },
  referenceNote: { type: String, default: '' },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
