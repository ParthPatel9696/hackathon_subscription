const mongoose = require('mongoose');

const subscriptionRequestSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  requestType: { type: String, enum: ['plan_change', 'quantity_change', 'cancellation', 'support'], required: true },
  targetPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  targetQuantity: { type: Number, min: 1, default: null },
  message: { type: String, maxlength: 2000, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, maxlength: 2000, default: '' },
  createdAt: { type: Date, default: Date.now }
});

subscriptionRequestSchema.index({ subscription: 1, status: 1 });
subscriptionRequestSchema.index({ subscription: 1 }, { unique: true, partialFilterExpression: { status: 'Pending' } });
module.exports = mongoose.model('SubscriptionRequest', subscriptionRequestSchema);
