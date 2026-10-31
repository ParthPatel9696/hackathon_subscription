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
  taxRate: { type: Number, default: 0 },
  taxLabel: { type: String, default: '' },
  taxComponents: [{ label: String, rate: Number }],
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  unitPriceMinor: { type: Number, min: 0 },
  variantPriceExtraMinor: { type: Number, min: 0, default: 0 },
  taxMinor: { type: Number, min: 0, default: 0 },
  discountMinor: { type: Number, min: 0, default: 0 },
  lineTotalMinor: { type: Number, min: 0 },
  lineTotal: { type: Number, required: true }
}, { _id: true });

const scheduledPlanChangeSchema = new mongoose.Schema({
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  planName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  billingFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
  recurringTotalMinor: { type: Number, required: true, min: 0 },
  subtotalMinor: { type: Number, required: true, min: 0 },
  taxTotalMinor: { type: Number, required: true, min: 0 },
  discountTotalMinor: { type: Number, required: true, min: 0 },
  line: { type: mongoose.Schema.Types.Mixed, required: true },
  effectiveAt: { type: Date, required: true },
  prorationMinor: { type: Number, required: true },
  reason: { type: String, default: '' },
  operationKey: { type: String, required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: false });

const planChangeHistorySchema = new mongoose.Schema({
  previousPlan: String,
  newPlan: String,
  previousRecurringMinor: Number,
  newRecurringMinor: Number,
  previousNetRecurringMinor: Number,
  newNetRecurringMinor: Number,
  previousQuantity: Number,
  newQuantity: Number,
  prorationMinor: Number,
  effectiveAt: Date,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: String,
  operationKey: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const subscriptionStatusEventSchema = new mongoose.Schema({
  eventType: { type: String, enum: ['created', 'status_change', 'plan_change'], required: true },
  status: { type: String, required: true },
  previousStatus: { type: String, default: null },
  netRecurringMinor: { type: Number, min: 0, default: 0 },
  previousNetRecurringMinor: { type: Number, min: 0, default: null },
  billingFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'monthly' },
  previousBillingFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly', null], default: null },
  effectiveAt: { type: Date, default: Date.now },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, default: '' }
}, { _id: true });

const subscriptionSchema = new mongoose.Schema({
  subscriptionNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  currency: { type: String, enum: ['INR'], default: 'INR' },
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
  discount: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount', default: null },
  discountCode: { type: String, default: '' },
  discountName: { type: String, default: '' },
  discountType: { type: String, enum: ['percentage', 'fixed', null], default: null },
  discountValue: { type: Number, min: 0, default: 0 },
  recurringTotalMinor: { type: Number, min: 0 },
  recurringTotal: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Draft', 'Quotation', 'Confirmed', 'Active', 'Paused', 'Closed', 'Cancelled', 'Expired'],
    default: 'Draft'
  },
  quotationValidUntil: { type: Date },
  lastInvoicedDate: { type: Date },
  notes: { type: String, default: '' },
  scheduledPlanChange: { type: scheduledPlanChangeSchema, default: null },
  planChangeHistory: { type: [planChangeHistorySchema], default: [] },
  statusHistory: { type: [subscriptionStatusEventSchema], default: [] },
  closedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

subscriptionSchema.index({ 'scheduledPlanChange.operationKey': 1 }, { name: 'scheduled_plan_change_operation_key_unique_v2', unique: true, partialFilterExpression: { 'scheduledPlanChange.operationKey': { $type: 'string' } } });
subscriptionSchema.index({ status: 1, nextBillingDate: 1 });
subscriptionSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
