const mongoose = require('mongoose');

const invoiceLineSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  variantName: { type: String, default: '' },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  taxRate: { type: Number, default: 0.10 },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  total: { type: Number, required: true }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  subscriptionNumber: { type: String, required: true },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  billingPeriodStart: { type: Date },
  billingPeriodEnd: { type: Date },
  lines: [invoiceLineSchema],
  subtotal: { type: Number, required: true },
  taxTotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Draft', 'Confirmed', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Draft'
  },
  paymentTerms: { type: String, default: 'Net 30 Days' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
