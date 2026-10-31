const Subscription = require('../models/Subscription');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const User = require('../models/User');
const mongoose = require('mongoose');
const { fromMinor, calculateLine } = require('../utils/money');

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
    if (req.user.role === 'customer') {
      query.customer = req.user._id;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (customerId && req.user.role !== 'customer') {
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
    const status = err instanceof TypeError ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
};

// GET /api/subscriptions/:id
exports.getSubscriptionById = async (req, res) => {
  try {
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });
    if (req.user.role === 'customer' && sub.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'You do not have access to this subscription.' });
    }
    res.json({ success: true, data: sub });
  } catch (err) {
    const status = err instanceof TypeError ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
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
    const status = err instanceof TypeError ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
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

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one subscription line is required.' });
    }

    const customer = req.user.role === 'customer'
      ? req.user
      : await User.findOne({ _id: customerId, role: 'customer' }).select('_id name email companyName');
    if (!customer) {
      return res.status(400).json({ success: false, error: 'A valid customer is required.' });
    }

    const plan = planId && mongoose.isValidObjectId(planId)
      ? await Plan.findById(planId)
      : planName
        ? await Plan.findOne({ name: planName })
        : null;
    if (!plan) {
      return res.status(400).json({ success: false, error: 'A valid plan is required.' });
    }

    let subtotalMinor = 0;
    let taxTotalMinor = 0;
    let discountTotalMinor = 0;

    const computedLines = await Promise.all((lines || []).map(async line => {
      const product = line.productId && mongoose.isValidObjectId(line.productId)
        ? await Product.findById(line.productId)
        : line.productName
          ? await Product.findOne({ name: line.productName })
          : null;
      if (!product) {
        throw new TypeError('Every subscription line must reference a valid product.');
      }

      let variantPriceExtra = 0;
      if (line.variantName) {
        const variantOption = product.variants
          .flatMap(group => group.options)
          .find(option => option.name === line.variantName ||
            line.variantName.startsWith(`${option.name} (`));
        if (!variantOption) {
          throw new TypeError(`Invalid variant "${line.variantName}" for ${product.name}.`);
        }
        variantPriceExtra = variantOption.priceExtra;
      }

      const calculation = calculateLine({
        unitPrice: product.salesPrice,
        variantPriceExtra,
        quantity: line.quantity || 1,
        taxRate: product.taxRate,
        discountAmount: line.discountAmount || 0
      });

      subtotalMinor += calculation.subtotalMinor;
      taxTotalMinor += calculation.taxMinor;
      discountTotalMinor += calculation.discountMinor;

      return {
        product: line.productId,
        productName: product.name,
        variantName: line.variantName || '',
        variantPriceExtra,
        variantPriceExtraMinor: calculation.variantPriceExtraMinor,
        quantity: calculation.quantity,
        unitPrice: product.salesPrice,
        unitPriceMinor: calculation.unitPriceMinor,
        taxRate: product.taxRate,
        taxAmount: fromMinor(calculation.taxMinor),
        taxMinor: calculation.taxMinor,
        discountAmount: fromMinor(calculation.discountMinor),
        discountMinor: calculation.discountMinor,
        lineTotal: fromMinor(calculation.totalMinor),
        lineTotalMinor: calculation.totalMinor
      };
    }));

    const recurringTotalMinor = subtotalMinor + taxTotalMinor - discountTotalMinor;
    const count = await Subscription.countDocuments();
    const subscriptionNumber = `SUB-${new Date().getFullYear()}-${String(count + 101).padStart(4, '0')}`;

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const newSub = new Subscription({
      subscriptionNumber,
      customer: customer._id,
      customerName: customer.companyName || customer.name,
      customerEmail: customer.email,
      plan: planId,
      planName: plan.name,
      billingFrequency: plan.billingFrequency,
      startDate,
      expiryDate,
      nextBillingDate,
      paymentTerms: paymentTerms || 'Net 30 Days',
      lines: computedLines,
      subtotal: fromMinor(subtotalMinor),
      taxTotal: fromMinor(taxTotalMinor),
      discountTotal: fromMinor(discountTotalMinor),
      subtotalMinor,
      taxTotalMinor,
      discountTotalMinor,
      recurringTotal: fromMinor(recurringTotalMinor),
      recurringTotalMinor,
      status: 'Draft',
      quotationValidUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
    });

    await newSub.save();
    res.status(201).json({ success: true, data: newSub });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
