const mongoose = require('mongoose');

const subscriptionLineSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: { type: String, required: true },
  variantName: { type: String, default: '' },
  variantPriceExtra: { type: Number, default: 0 },
  quantity: { type: Number, required: true, default: 1, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, default: 0.10 }, // 10%
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  unitPriceMinor: { type: Number, min: 0 },
  variantPriceExtraMinor: { type: Number, min: 0, default: 0 },
  taxMinor: { type: Number, min: 0, default: 0 },
  discountMinor: { type: Number, min: 0, default: 0 },
  lineTotalMinor: { type: Number, min: 0 },
  lineTotal: { type: Number, required: true }
}, { _id: true });

const subscriptionSchema = new mongoose.Schema({
  subscriptionNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  planName: { type: String, required: true },
  billingFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  startDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  nextBillingDate: { type: Date },
  paymentTerms: {
    type: String,
    default: 'Net 30 Days'
  },
  lines: [subscriptionLineSchema],
  subtotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  subtotalMinor: { type: Number, min: 0 },
  taxTotalMinor: { type: Number, min: 0, default: 0 },
  discountTotalMinor: { type: Number, min: 0, default: 0 },
  recurringTotalMinor: { type: Number, min: 0 },
  recurringTotal: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Draft', 'Quotation', 'Confirmed', 'Active', 'Paused', 'Closed'],
    default: 'Draft'
  },
  quotationValidUntil: { type: Date },
  lastInvoicedDate: { type: Date },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
