const mongoose = require('mongoose');
const SubscriptionRequest = require('../models/SubscriptionRequest');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const { recordAudit } = require('../services/auditService');

exports.create = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, error: 'Invalid subscription id.' });
    const subscription = await Subscription.findOne({ _id: id, customer: req.user._id, status: 'Active' }).select('lines');
    if (!subscription) return res.status(404).json({ success: false, error: 'Active subscription not found.' });
    const { requestType, planId, quantity, message } = req.body;
    if (!['plan_change', 'quantity_change', 'cancellation', 'support'].includes(requestType)) return res.status(400).json({ success: false, error: 'Choose a supported request type.' });
    if (typeof message !== 'string' || message.trim().length < 3 || message.length > 2000) return res.status(400).json({ success: false, error: 'Add a request message of 3 to 2000 characters.' });
    let targetPlan = null; let targetQuantity = null;
    if (requestType === 'plan_change') {
      if (!mongoose.isValidObjectId(planId)) return res.status(400).json({ success: false, error: 'Choose a valid plan.' });
      targetPlan = await Plan.findById(planId).select('product minQuantity availableFrom availableTo');
      const productId = subscription.lines.find((line) => line.product)?.product;
      if (!targetPlan || String(targetPlan.product) !== String(productId)) return res.status(400).json({ success: false, error: 'The selected plan is not eligible for this subscription.' });
      if (targetPlan.availableFrom > new Date() || (targetPlan.availableTo && targetPlan.availableTo < new Date())) return res.status(400).json({ success: false, error: 'The selected plan is not currently available.' });
      if (quantity !== undefined) {
        targetQuantity = Number(quantity);
        if (!Number.isInteger(targetQuantity) || targetQuantity < (targetPlan.minQuantity || 1) || targetQuantity > 10000) return res.status(400).json({ success: false, error: 'Enter an eligible whole-number quantity.' });
      }
    }
    if (requestType === 'quantity_change') {
      targetQuantity = Number(quantity);
      if (!Number.isInteger(targetQuantity) || targetQuantity < 1 || targetQuantity > 10000) return res.status(400).json({ success: false, error: 'Enter a valid whole-number quantity.' });
    }
    const pending = await SubscriptionRequest.exists({ subscription: id, status: 'Pending' });
    if (pending) return res.status(409).json({ success: false, error: 'A request is already awaiting review for this subscription.' });
    const request = await SubscriptionRequest.create({ customer: req.user._id, subscription: id, requestType, targetPlan: targetPlan?._id || null, targetQuantity, message: message.trim() });
    res.status(201).json({ success: true, data: request });
  } catch (error) { if (error.code === 11000) return res.status(409).json({ success: false, error: 'A request is already awaiting review for this subscription.' }); res.status(500).json({ success: false, error: 'Unable to submit subscription request.' }); }
};

exports.list = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const filter = {};
  if (req.user.role === 'customer') filter.customer = req.user._id;
  if (req.query.status && ['Pending', 'Approved', 'Rejected'].includes(req.query.status)) filter.status = req.query.status;
  const [data, total] = await Promise.all([
    SubscriptionRequest.find(filter).populate('customer', 'name email companyName').populate('subscription', 'subscriptionNumber planName status').populate('targetPlan', 'name code basePrice billingFrequency').sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    SubscriptionRequest.countDocuments(filter)
  ]);
  res.json({ success: true, data, total, page, pageSize });
};

exports.review = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid request id.' });
  const { status, reviewNote = '' } = req.body;
  if (!['Approved', 'Rejected'].includes(status) || typeof reviewNote !== 'string' || reviewNote.length > 2000) return res.status(400).json({ success: false, error: 'Choose Approved or Rejected and provide a valid review note.' });
  const request = await SubscriptionRequest.findOneAndUpdate({ _id: req.params.id, status: 'Pending' }, { $set: { status, reviewNote: reviewNote.trim(), reviewedBy: req.user._id, reviewedAt: new Date() } }, { new: true, runValidators: true }).populate('customer', 'name email').populate('subscription', 'subscriptionNumber').populate('targetPlan', 'name code');
  if (!request) return res.status(409).json({ success: false, error: 'Request is no longer pending.' });
  recordAudit({ actor: req.user, action: 'subscription_request_reviewed', resourceType: 'SubscriptionRequest', resourceId: request._id, customer: request.customer?._id, previousValue: { status: 'Pending' }, newValue: { status, requestType: request.requestType }, metadata: { reviewNote: request.reviewNote } }).catch(() => {});
  res.json({ success: true, data: request });
};
