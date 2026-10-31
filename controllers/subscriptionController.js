const Subscription = require('../models/Subscription');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const User = require('../models/User');
const WorkspaceSettings = require('../models/WorkspaceSettings');
const mongoose = require('mongoose');
const { fromMinor, toMinor, calculateLine } = require('../utils/money');
const { advanceBillingDate } = require('../services/billingService');
const { nextBusinessIdentifier } = require('../services/identifierService');
const Discount = require('../models/Discount');
const { assertDiscountAvailable, calculateDiscountMinor, reserveDiscountUsage, releaseDiscountUsage } = require('../services/discountService');
const { calculateProrationMinor } = require('../services/proration');
const crypto = require('crypto');
const { recordAudit } = require('../services/auditService');
const { sortFromQuery, applyNumericRange, applyDateRange } = require('../utils/listQuery');
const { normalizePaymentTerms } = require('../utils/paymentTerms');

// Valid state transitions map
const VALID_TRANSITIONS = {
  Draft: ['Quotation', 'Cancelled'],
  Quotation: ['Confirmed', 'Draft', 'Cancelled', 'Expired'],
  Confirmed: ['Active', 'Cancelled'],
  Active: ['Paused', 'Closed'],
  Paused: ['Active', 'Closed'],
  Closed: ['Draft'], // Renew / Reopen creates or resets
};

// GET /api/subscriptions
exports.getSubscriptions = async (req, res) => {
  const startTime = Date.now();
  try {
    const { status, customerId } = req.query;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
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
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { subscriptionNumber: { $regex: escaped, $options: 'i' } },
        { customerName: { $regex: escaped, $options: 'i' } },
        { planName: { $regex: escaped, $options: 'i' } }
      ];
    }
    applyNumericRange(query, 'recurringTotal', req.query.minAmount, req.query.maxAmount);
    if (!applyDateRange(query, 'nextBillingDate', req.query.startDate, req.query.endDate)) return res.status(400).json({ success: false, error: 'Enter valid date filters.' });

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const [subscriptions, total] = await Promise.all([
      Subscription.find(query).sort(sortFromQuery(req.query.sort, { record: 'subscriptionNumber', status: 'status', amount: 'recurringTotalMinor', details: 'customerName', nextBillingDate: 'nextBillingDate' }, { createdAt: -1 })).skip((page - 1) * pageSize).limit(pageSize),
      Subscription.countDocuments(query)
    ]);
    const responseTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      count: subscriptions.length,
      total, page, pageSize,
      responseTimeMs,
      data: subscriptions
    });
  } catch (err) {
    const status = err instanceof TypeError || ['ValidationError', 'CastError'].includes(err.name) ? 400 : 500;
    res.status(status).json({ success: false, error: status === 400 ? err.message : 'Unable to load subscriptions.' });
  }
};

// GET /api/subscriptions/:id
exports.getSubscriptionById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid subscription id.' });
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });
    if (req.user.role === 'customer' && sub.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'You do not have access to this subscription.' });
    }
    res.json({ success: true, data: sub });
  } catch (err) {
    const status = err instanceof TypeError || ['ValidationError', 'CastError'].includes(err.name) ? 400 : 500;
    res.status(status).json({ success: false, error: status === 400 ? err.message : 'Unable to load subscription.' });
  }
};

async function calculatePlanChange(subscription, body) {
  if (!mongoose.isValidObjectId(body.planId)) throw Object.assign(new Error('Choose a valid plan.'), { statusCode: 400 });
  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) throw Object.assign(new Error('Quantity must be a positive whole number.'), { statusCode: 400 });
  const plan = await Plan.findById(body.planId);
  if (!plan) throw Object.assign(new Error('Plan not found.'), { statusCode: 404 });
  if (plan.availableFrom && plan.availableFrom > new Date() || plan.availableTo && plan.availableTo < new Date()) throw Object.assign(new Error('This plan is not currently available.'), { statusCode: 400 });
  if (quantity < plan.minQuantity || plan.maxQuantity != null && quantity > plan.maxQuantity) throw Object.assign(new Error(`Choose a quantity between ${plan.minQuantity} and ${plan.maxQuantity ?? 'no limit'}.`), { statusCode: 400 });
  const currentLine = subscription.lines.find((line) => String(line.product) === String(plan.product));
  if (!currentLine) throw Object.assign(new Error('Plan changes require the new plan to use a product already included on this subscription.'), { statusCode: 400 });
  if (subscription.scheduledPlanChange) throw Object.assign(new Error('A plan change is already scheduled for this subscription.'), { statusCode: 409 });
  const product = await Product.findById(plan.product);
  if (!product) throw Object.assign(new Error('The plan product is unavailable.'), { statusCode: 400 });
  if (!Number.isFinite(product.taxRate)) throw Object.assign(new Error('Tax configuration is missing for this product. An administrator must review the legacy tax treatment before changing this subscription.'), { statusCode: 409 });
  const unitMinor = toMinor(plan.basePrice) + (currentLine.variantPriceExtraMinor ?? toMinor(currentLine.variantPriceExtra || 0));
  const oldUnitMinor = (currentLine.unitPriceMinor ?? toMinor(currentLine.unitPrice)) + (currentLine.variantPriceExtraMinor ?? toMinor(currentLine.variantPriceExtra || 0));
  const oldSubtotal = oldUnitMinor * currentLine.quantity;
  const oldDiscount = currentLine.discountMinor ?? toMinor(currentLine.discountAmount || 0);
  const newSubtotal = unitMinor * quantity;
  const discountMinor = oldSubtotal ? Number(BigInt(oldDiscount) * BigInt(newSubtotal) / BigInt(oldSubtotal)) : 0;
  const lineCalculation = calculateLine({ unitPrice: fromMinor(toMinor(plan.basePrice)), variantPriceExtra: fromMinor(currentLine.variantPriceExtraMinor ?? toMinor(currentLine.variantPriceExtra || 0)), quantity, taxRate: product.taxRate, discountAmount: fromMinor(discountMinor) });
  const newLine = { ...currentLine.toObject(), quantity, unitPrice: fromMinor(toMinor(plan.basePrice)), unitPriceMinor: toMinor(plan.basePrice), taxRate: product.taxRate, taxLabel: product.taxLabel, taxComponents: product.taxComponents, taxMinor: lineCalculation.taxMinor, taxAmount: fromMinor(lineCalculation.taxMinor), discountMinor, discountAmount: fromMinor(discountMinor), lineTotalMinor: lineCalculation.totalMinor, lineTotal: fromMinor(lineCalculation.totalMinor) };
  const subtotalMinor = (subscription.subtotalMinor ?? toMinor(subscription.subtotal || 0)) - oldSubtotal + newSubtotal;
  const taxTotalMinor = (subscription.taxTotalMinor ?? toMinor(subscription.taxTotal || 0)) - (currentLine.taxMinor ?? toMinor(currentLine.taxAmount || 0)) + lineCalculation.taxMinor;
  const discountTotalMinor = (subscription.discountTotalMinor ?? toMinor(subscription.discountTotal || 0)) - oldDiscount + discountMinor;
  const recurringTotalMinor = subtotalMinor + taxTotalMinor - discountTotalMinor;
  const effectiveAt = body.timing === 'next_cycle' ? new Date(subscription.nextBillingDate) : new Date();
  if (!Number.isFinite(effectiveAt.getTime())) throw Object.assign(new Error('Subscription has no valid next billing date.'), { statusCode: 400 });
  const prorationMinor = body.timing === 'next_cycle' ? 0 : calculateProrationMinor({
    oldRecurringMinor: subscription.recurringTotalMinor ?? toMinor(subscription.recurringTotal), newRecurringMinor: recurringTotalMinor,
    periodStart: subscription.lastInvoicedDate || subscription.startDate, periodEnd: subscription.nextBillingDate, effectiveAt
  });
  return { plan, currentLine, line: newLine, quantity, subtotalMinor, taxTotalMinor, discountTotalMinor, recurringTotalMinor, effectiveAt, prorationMinor };
}

exports.previewPlanChange = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid subscription id.' });
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found.' });
    if (req.user.role === 'customer' && String(sub.customer) !== String(req.user._id)) return res.status(403).json({ success: false, error: 'You cannot access this subscription.' });
    if (sub.status !== 'Active') return res.status(409).json({ success: false, error: 'Only active subscriptions can change plans.' });
    const change = await calculatePlanChange(sub, req.body || {});
    res.json({ success: true, policy: 'UTC half-open billing period; effective instant included; paise rounded to nearest integer with halves away from zero. Tax and discount are recalculated on the changed product line. No payment is collected and no refund is issued.', data: { currentPlan: sub.planName, newPlan: change.plan.name, oldRecurringMinor: sub.recurringTotalMinor ?? toMinor(sub.recurringTotal), newRecurringMinor: change.recurringTotalMinor, quantity: change.quantity, prorationMinor: change.prorationMinor, effectiveAt: change.effectiveAt, nextRecurringAmount: fromMinor(change.recurringTotalMinor) } });
  } catch (err) { res.status(err.statusCode || 400).json({ success: false, error: err.message || 'Unable to preview plan change.' }); }
};

exports.changePlan = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid subscription id.' });
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found.' });
    if (req.user.role === 'customer' && String(sub.customer) !== String(req.user._id)) return res.status(403).json({ success: false, error: 'You cannot change this subscription.' });
    if (sub.status !== 'Active') return res.status(409).json({ success: false, error: 'Only active subscriptions can change plans.' });
    const change = await calculatePlanChange(sub, req.body || {});
    const timing = req.body.timing === 'next_cycle' ? 'next_cycle' : 'immediate';
    const reason = String(req.body.reason || '').trim().slice(0, 500);
    const operationKey = crypto.randomUUID();
    const previous = { plan: sub.planName, recurring: sub.recurringTotalMinor ?? toMinor(sub.recurringTotal), quantity: change.currentLine.quantity };
    const oldNetRecurringMinor = Math.max(0, (sub.subtotalMinor ?? toMinor(sub.subtotal || 0)) - (sub.discountTotalMinor ?? toMinor(sub.discountTotal || 0)));
    const newNetRecurringMinor = Math.max(0, change.subtotalMinor - change.discountTotalMinor);
    const optimisticFilter = { _id: sub._id, status: 'Active', $or: [{ __v: sub.__v }, { __v: { $exists: false } }] };
    let update;
    if (timing === 'next_cycle') {
      optimisticFilter.scheduledPlanChange = null;
      update = { $set: { scheduledPlanChange: { plan: change.plan._id, planName: change.plan.name, quantity: change.quantity, billingFrequency: change.plan.billingFrequency, recurringTotalMinor: change.recurringTotalMinor, subtotalMinor: change.subtotalMinor, taxTotalMinor: change.taxTotalMinor, discountTotalMinor: change.discountTotalMinor, line: change.line, effectiveAt: change.effectiveAt, prorationMinor: 0, reason, operationKey, requestedBy: req.user._id } }, $inc: { __v: 1 } };
    } else {
      const lines = sub.lines.map((line) => String(line.product) === String(change.plan.product) ? change.line : line);
      optimisticFilter.scheduledPlanChange = null;
      update = { $set: { plan: change.plan._id, planName: change.plan.name, billingFrequency: change.plan.billingFrequency, lines, subtotalMinor: change.subtotalMinor, taxTotalMinor: change.taxTotalMinor, discountTotalMinor: change.discountTotalMinor, subtotal: fromMinor(change.subtotalMinor), taxTotal: fromMinor(change.taxTotalMinor), discountTotal: fromMinor(change.discountTotalMinor), recurringTotalMinor: change.recurringTotalMinor, recurringTotal: fromMinor(change.recurringTotalMinor) }, $push: { planChangeHistory: { previousPlan: previous.plan, newPlan: change.plan.name, previousRecurringMinor: previous.recurring, newRecurringMinor: change.recurringTotalMinor, previousNetRecurringMinor: oldNetRecurringMinor, newNetRecurringMinor, previousQuantity: previous.quantity, newQuantity: change.quantity, prorationMinor: change.prorationMinor, effectiveAt: change.effectiveAt, changedBy: req.user._id, reason, operationKey }, statusHistory: { eventType: 'plan_change', previousStatus: 'Active', status: 'Active', previousNetRecurringMinor: oldNetRecurringMinor, netRecurringMinor: newNetRecurringMinor, previousBillingFrequency: sub.billingFrequency, billingFrequency: change.plan.billingFrequency, effectiveAt: change.effectiveAt, actor: req.user._id, reason } }, $inc: { __v: 1 } };
    }
    const updated = await Subscription.findOneAndUpdate(optimisticFilter, update, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ success: false, error: 'Subscription changed or a plan change was already scheduled. Reload and retry.' });
    recordAudit({ actor: req.user, action: timing === 'next_cycle' ? 'plan_change_scheduled' : 'plan_changed', resourceType: 'Subscription', resourceId: updated._id, customer: updated.customer, previousValue: { plan: previous.plan, recurringMinor: previous.recurring }, newValue: { plan: change.plan.name, recurringMinor: change.recurringTotalMinor, quantity: change.quantity }, metadata: { prorationMinor: change.prorationMinor, effectiveAt: change.effectiveAt, reason } }).catch(() => {});
    res.json({ success: true, data: updated, prorationMinor: change.prorationMinor, collected: false, refunded: false });
  } catch (err) { res.status(err.statusCode || (err.code === 11000 ? 409 : 400)).json({ success: false, error: err.message || 'Unable to change subscription plan.' }); }
};


// POST /api/subscriptions/transition
exports.transitionState = async (req, res) => {
  try {
    const { id, targetStatus, reason } = req.body;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, error: 'Invalid subscription id.' });
    const sub = await Subscription.findById(id);
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });

    const allowed = VALID_TRANSITIONS[sub.status] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid lifecycle transition from ${sub.status} to ${targetStatus}. Allowed: ${allowed.join(', ') || 'None'}`
      });
    }
    if (sub.status === 'Quotation' && targetStatus === 'Confirmed' && sub.quotationValidUntil && new Date(sub.quotationValidUntil) < new Date()) return res.status(409).json({ success: false, error: 'This quotation has expired and cannot be confirmed. Mark it expired or create a new quotation.' });
    if (sub.status === 'Quotation' && targetStatus === 'Expired' && sub.quotationValidUntil && new Date(sub.quotationValidUntil) >= new Date()) return res.status(409).json({ success: false, error: 'This quotation has not reached its expiry date.' });

    const update = { status: targetStatus };
    const netRecurringMinor = Math.max(0, (sub.subtotalMinor ?? toMinor(sub.subtotal || 0)) - (sub.discountTotalMinor ?? toMinor(sub.discountTotal || 0)));
    const set = { ...update };
    if (['Closed', 'Cancelled', 'Expired'].includes(targetStatus)) set.closedAt = new Date();
    if (targetStatus === 'Active') set.closedAt = null;
    if (targetStatus === 'Active') update.nextBillingDate = advanceBillingDate(new Date(), sub.billingFrequency);
    if (reason) set.notes = (sub.notes ? `${sub.notes} | ` : '') + `State changed to ${targetStatus}: ${String(reason).slice(0, 500)}`;
    const updated = await Subscription.findOneAndUpdate({ _id: sub._id, status: sub.status }, { $set: set, $push: { statusHistory: { eventType: 'status_change', previousStatus: sub.status, status: targetStatus, previousNetRecurringMinor: netRecurringMinor, netRecurringMinor, billingFrequency: sub.billingFrequency, previousBillingFrequency: sub.billingFrequency, effectiveAt: new Date(), actor: req.user._id, reason: String(reason || '').slice(0, 500) } } }, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ success: false, error: 'Subscription status changed. Refresh and try again.' });
    if (['Cancelled', 'Expired'].includes(targetStatus) && sub.discount) await releaseDiscountUsage(sub.discount);
    recordAudit({ actor: req.user, action: 'subscription_status_changed', resourceType: 'Subscription', resourceId: updated._id, customer: updated.customer, previousValue: { status: sub.status }, newValue: { status: targetStatus }, metadata: { reason: String(reason || '').slice(0, 500) } }).catch(() => {});

    res.json({
      success: true,
      message: `Subscription ${sub.subscriptionNumber} transitioned to ${targetStatus}`,
      data: updated
    });
  } catch (err) {
    const status = err.statusCode || (err instanceof TypeError || ['ValidationError', 'CastError'].includes(err.name) ? 400 : 500);
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
      paymentTerms,
      discountCode
    } = req.body;

    if (!Array.isArray(lines) || lines.length === 0 || lines.length > 100) {
      return res.status(400).json({ success: false, error: 'A quotation must include between one and one hundred lines.' });
    }

    const customer = req.user.role === 'customer'
      ? req.user
      : await User.findOne({ _id: customerId, role: 'customer', accountStatus: 'Active' }).select('_id name email companyName');
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

    const baseLines = await Promise.all((lines || []).map(async line => {
      const product = line.productId && mongoose.isValidObjectId(line.productId)
        ? await Product.findById(line.productId)
        : line.productName
          ? await Product.findOne({ name: line.productName })
          : null;
      if (!product) {
        throw new TypeError('Every subscription line must reference a valid product.');
      }
      if (!Number.isFinite(product.taxRate)) throw Object.assign(new Error(`Tax configuration is missing for ${product.name}. An administrator must review its legacy tax treatment before quoting.`), { statusCode: 409 });

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

      const unitPrice = plan.product && product._id.toString() === plan.product.toString()
        ? plan.basePrice
        : product.salesPrice;
      const calculation = calculateLine({
        unitPrice,
        variantPriceExtra,
        quantity: line.quantity === undefined ? 1 : line.quantity,
        taxRate: product.taxRate,
        taxLabel: product.taxLabel,
        taxComponents: product.taxComponents,
        discountAmount: 0
      });
      return {
        product: product._id,
        productType: product.type,
        productName: product.name,
        variantName: line.variantName || '',
        variantPriceExtra,
        variantPriceExtraMinor: calculation.variantPriceExtraMinor,
        quantity: calculation.quantity,
        unitPrice,
        unitPriceMinor: calculation.unitPriceMinor,
        taxRate: product.taxRate,
        subtotalMinor: calculation.subtotalMinor
      };
    }));

    if (plan.product) {
      const primaryLine = baseLines.find((line) => line.product.toString() === plan.product.toString());
      if (!primaryLine) return res.status(400).json({ success: false, error: 'This plan requires a line for its associated product.' });
      if (primaryLine.quantity < plan.minQuantity || plan.maxQuantity != null && primaryLine.quantity > plan.maxQuantity) return res.status(400).json({ success: false, error: `Choose a quantity between ${plan.minQuantity} and ${plan.maxQuantity ?? 'no limit'}.` });
    }

    const subtotalMinor = baseLines.reduce((sum, line) => sum + line.subtotalMinor, 0);
    if (!Number.isSafeInteger(subtotalMinor)) throw new TypeError('Quotation subtotal exceeds the supported precision range.');
    let discount = null;
    let discountTotalMinor = 0;
    let eligibleLines = baseLines.map(() => false);
    if (discountCode) {
      if (typeof discountCode !== 'string' || discountCode.trim().length > 80) return res.status(400).json({ success: false, error: 'Enter a valid discount code.' });
      discount = await Discount.findOne({ code: discountCode.trim().toUpperCase() });
      assertDiscountAvailable(discount);
      if (discount.appliesTo === 'specific_product' && !discount.targetProduct) return res.status(400).json({ success: false, error: 'This discount is missing its target product.' });
      const eligibleIndexes = baseLines.map((line, index) => ({ line, index })).filter(({ line }) => {
        if (discount.appliesTo === 'specific_product') return line.product.toString() === discount.targetProduct.toString();
        if (discount.appliesTo === 'seats') return line.productType === 'seat';
        return true;
      });
      const eligibleSubtotalMinor = eligibleIndexes.reduce((sum, item) => sum + item.line.subtotalMinor, 0);
      const eligibleQuantity = eligibleIndexes.reduce((sum, item) => sum + item.line.quantity, 0);
      if (eligibleIndexes.length === 0) return res.status(400).json({ success: false, error: 'This discount does not apply to the selected products.' });
      if (eligibleQuantity < discount.minQuantity) return res.status(400).json({ success: false, error: `Minimum quantity of ${discount.minQuantity} required for this discount.` });
      discountTotalMinor = calculateDiscountMinor(discount, eligibleSubtotalMinor);
      for (const item of eligibleIndexes) eligibleLines[item.index] = true;
    }

    const eligibleSubtotalMinor = baseLines.reduce((sum, line, index) => sum + (eligibleLines[index] ? line.subtotalMinor : 0), 0);
    const eligibleIndexes = baseLines.map((line, index) => ({ line, index })).filter((item) => eligibleLines[item.index]);
    const allocations = new Array(baseLines.length).fill(0);
    let allocatedMinor = 0;
    if (discountTotalMinor > 0 && eligibleSubtotalMinor > 0) {
      const denominator = BigInt(eligibleSubtotalMinor);
      const shares = eligibleIndexes.map(({ line, index }) => {
        const numerator = BigInt(discountTotalMinor) * BigInt(line.subtotalMinor);
        const floor = Number(numerator / denominator);
        allocations[index] = floor;
        allocatedMinor += floor;
        return { index, remainder: numerator % denominator };
      }).sort((left, right) => left.remainder === right.remainder ? left.index - right.index : left.remainder > right.remainder ? -1 : 1);
      for (let remainder = discountTotalMinor - allocatedMinor, index = 0; remainder > 0; remainder -= 1, index += 1) allocations[shares[index % shares.length].index] += 1;
    }

    let taxTotalMinor = 0;
    const computedLines = baseLines.map((line, index) => {
      const calculation = calculateLine({
        unitPrice: line.unitPrice,
        variantPriceExtra: line.variantPriceExtra,
        quantity: line.quantity,
        taxRate: line.taxRate,
        taxLabel: line.taxLabel,
        taxComponents: line.taxComponents,
        discountAmount: fromMinor(allocations[index])
      });
      taxTotalMinor += calculation.taxMinor;
      return {
        product: line.product,
        productName: line.productName,
        variantName: line.variantName,
        variantPriceExtra: line.variantPriceExtra,
        variantPriceExtraMinor: calculation.variantPriceExtraMinor,
        quantity: calculation.quantity,
        unitPrice: line.unitPrice,
        unitPriceMinor: calculation.unitPriceMinor,
        taxRate: line.taxRate,
        taxAmount: fromMinor(calculation.taxMinor),
        taxMinor: calculation.taxMinor,
        discountAmount: fromMinor(calculation.discountMinor),
        discountMinor: calculation.discountMinor,
        lineTotal: fromMinor(calculation.totalMinor),
        lineTotalMinor: calculation.totalMinor
      };
    });

    const recurringTotalMinor = subtotalMinor + taxTotalMinor - discountTotalMinor;
    if (!Number.isSafeInteger(taxTotalMinor) || !Number.isSafeInteger(recurringTotalMinor) || recurringTotalMinor < 0) throw new TypeError('Quotation total exceeds the supported precision range.');
    const subscriptionNumber = await nextBusinessIdentifier({ prefix: 'SUB', Model: Subscription, field: 'subscriptionNumber' });

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const nextBillingDate = advanceBillingDate(startDate, plan.billingFrequency);

    const workspaceSettings = await WorkspaceSettings.findOne({ key: 'default' }).select('defaultPaymentTerms').lean();
    const resolvedPaymentTerms = normalizePaymentTerms(paymentTerms || workspaceSettings?.defaultPaymentTerms || 'Net 30 Days');
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
      paymentTerms: resolvedPaymentTerms,
      lines: computedLines,
      subtotal: fromMinor(subtotalMinor),
      taxTotal: fromMinor(taxTotalMinor),
      discountTotal: fromMinor(discountTotalMinor),
      subtotalMinor,
      taxTotalMinor,
      discountTotalMinor,
      discount: discount?._id || null,
      discountCode: discount?.code || '',
      discountName: discount?.name || '',
      discountType: discount?.discountType || null,
      discountValue: discount?.value || 0,
      recurringTotal: fromMinor(recurringTotalMinor),
      recurringTotalMinor,
      status: 'Quotation',
      statusHistory: [{ eventType: 'created', previousStatus: null, status: 'Quotation', netRecurringMinor: Math.max(0, subtotalMinor - discountTotalMinor), billingFrequency: plan.billingFrequency, effectiveAt: new Date(), actor: req.user._id }],
      quotationValidUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
    });

    if (discount) await reserveDiscountUsage(discount._id);
    try {
      await newSub.save();
    } catch (saveError) {
      if (discount) await releaseDiscountUsage(discount._id);
      throw saveError;
    }
    recordAudit({ actor: req.user, action: 'quotation_created', resourceType: 'Subscription', resourceId: newSub._id, customer: newSub.customer, newValue: { status: newSub.status, plan: newSub.planName, recurringTotalMinor: newSub.recurringTotalMinor }, metadata: { subscriptionNumber: newSub.subscriptionNumber } }).catch(() => {});
    res.status(201).json({ success: true, data: newSub });
  } catch (err) {
    const status = err.statusCode || (err instanceof TypeError || ['ValidationError', 'CastError'].includes(err.name) ? 400 : 500);
    res.status(status).json({ success: false, error: status === 400 ? err.message : 'Unable to create subscription draft.' });
  }
};
