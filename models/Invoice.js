const mongoose = require('mongoose');

const invoiceLineSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  variantName: { type: String, default: '' },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  taxLabel: { type: String, default: '' },
  taxComponents: [{ label: String, rate: Number }],
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  unitPriceMinor: { type: Number, min: 0 },
  taxMinor: { type: Number, min: 0, default: 0 },
  discountMinor: { type: Number, min: 0, default: 0 },
  totalMinor: { type: Number, min: 0 },
  total: { type: Number, required: true }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  currency: { type: String, enum: ['INR'], default: 'INR' },
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
  companySnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  billingAddressSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  billingPeriodStart: { type: Date },
  billingPeriodEnd: { type: Date },
  lines: [invoiceLineSchema],
  subtotal: { type: Number, required: true },
  taxTotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  subtotalMinor: { type: Number, min: 0 },
  taxTotalMinor: { type: Number, min: 0, default: 0 },
  discountTotalMinor: { type: Number, min: 0, default: 0 },
  grandTotalMinor: { type: Number, min: 0 },
  grandTotal: { type: Number, required: true },
  paidAmountMinor: { type: Number, min: 0, default: 0 },
  paidAmount: { type: Number, default: 0 },
  paymentLockId: { type: String, default: null, select: false },
  paymentLockExpiresAt: { type: Date, default: null, select: false },
  status: {
    type: String,
    enum: ['Draft', 'Confirmed', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Draft'
  },
  paymentTerms: { type: String, default: 'Net 30 Days' },
  createdAt: { type: Date, default: Date.now }
});

invoiceSchema.index(
  { subscription: 1, billingPeriodStart: 1, billingPeriodEnd: 1 },
  { unique: true, partialFilterExpression: { billingPeriodStart: { $exists: true }, billingPeriodEnd: { $exists: true } } }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
