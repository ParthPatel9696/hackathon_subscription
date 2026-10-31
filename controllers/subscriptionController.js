const Subscription = require('../models/Subscription');
const Product = require('../models/Product');
const Plan = require('../models/Plan');

// Valid state transitions map
const VALID_TRANSITIONS = {
  Draft: ['Quotation', 'Cancelled'],
  Quotation: ['Confirmed', 'Draft', 'Cancelled'],
  Confirmed: ['Active', 'Cancelled'],
  Active: ['Paused', 'Closed'],
  Paused: ['Active', 'Closed'],
  Closed: ['Draft'], // Renew / Reopen creates or resets
};

// GET /api/subscriptions
exports.getSubscriptions = async (req, res) => {
  const startTime = Date.now();
  try {
    const { status, search, customerId } = req.query;
    let query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (customerId) {
      query.customer = customerId;
    }
    if (search) {
      query.$or = [
        { subscriptionNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { planName: { $regex: search, $options: 'i' } }
      ];
    }

    const subscriptions = await Subscription.find(query).sort({ createdAt: -1 });
    const responseTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      count: subscriptions.length,
      responseTimeMs,
      data: subscriptions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/subscriptions/:id
exports.getSubscriptionById = async (req, res) => {
  try {
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });
    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscriptions/transition
exports.transitionState = async (req, res) => {
  try {
    const { id, targetStatus, reason } = req.body;
    const sub = await Subscription.findById(id);
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });

    const allowed = VALID_TRANSITIONS[sub.status] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid lifecycle transition from ${sub.status} to ${targetStatus}. Allowed: ${allowed.join(', ') || 'None'}`
      });
    }

    sub.status = targetStatus;
    if (targetStatus === 'Active' && !sub.nextBillingDate) {
      // Set next billing date (e.g. 1 month from now)
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 1);
      sub.nextBillingDate = nextDate;
    }

    if (reason) sub.notes = (sub.notes ? sub.notes + ' | ' : '') + `State changed to ${targetStatus}: ${reason}`;
    await sub.save();

    res.json({
      success: true,
      message: `Subscription ${sub.subscriptionNumber} transitioned to ${targetStatus}`,
      data: sub
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscriptions
exports.createSubscription = async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerEmail,
      planId,
      planName,
      billingFrequency,
      lines,
      paymentTerms
    } = req.body;

    // Calculate lines
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    const computedLines = (lines || []).map(line => {
      const unit = (line.unitPrice || 0) + (line.variantPriceExtra || 0);
      const tax = (line.taxRate || 0.10) * unit * (line.quantity || 1);
      const discount = line.discountAmount || 0;
      const total = (unit * (line.quantity || 1)) + tax - discount;

      subtotal += unit * (line.quantity || 1);
      taxTotal += tax;
      discountTotal += discount;

      return {
        product: line.productId,
        productName: line.productName,
        variantName: line.variantName || '',
        variantPriceExtra: line.variantPriceExtra || 0,
        quantity: line.quantity || 1,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate || 0.10,
        taxAmount: tax,
        discountAmount: discount,
        lineTotal: total
      };
    });

    const recurringTotal = subtotal + taxTotal - discountTotal;
    const count = await Subscription.countDocuments();
    const subscriptionNumber = `SUB-2024-${String(count + 101).padStart(4, '0')}`;

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const newSub = new Subscription({
      subscriptionNumber,
      customer: customerId,
      customerName,
      customerEmail,
      plan: planId,
      planName,
      billingFrequency: billingFrequency || 'monthly',
      startDate,
      expiryDate,
      nextBillingDate,
      paymentTerms: paymentTerms || 'Net 30 Days',
      lines: computedLines,
      subtotal,
      taxTotal,
      discountTotal,
      recurringTotal,
      status: 'Draft',
      quotationValidUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
    });

    await newSub.save();
    res.status(201).json({ success: true, data: newSub });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
