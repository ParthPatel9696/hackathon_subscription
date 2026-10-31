const mongoose = require('mongoose');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const WorkspaceSettings = require('../models/WorkspaceSettings');
const { recordAudit } = require('../services/auditService');
const { sortFromQuery, applyNumericRange, applyDateRange } = require('../utils/listQuery');

const productFields = ['sku', 'name', 'shortDescription', 'description', 'category', 'imageUrl', 'type', 'salesPrice', 'costPrice', 'notes', 'variants', 'taxRate', 'taxLabel', 'taxComponents', 'isActive', 'billingEligible'];
const planFields = ['name', 'code', 'billingFrequency', 'basePrice', 'minQuantity', 'maxQuantity', 'trialDays', 'setupFee', 'includedUnits', 'includedSeats', 'overagePrice', 'features', 'isVisible', 'isActive', 'availableFrom', 'availableTo', 'autoCloseAtEnd', 'allowPause', 'allowEarlyClose', 'allowRenew', 'description', 'product'];
const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
const isDateRangeValid = (start, end) => !start || !end || new Date(end) >= new Date(start);
const validatePlanInput = async (input) => {
  if (input.product) {
    if (!mongoose.isValidObjectId(input.product) || !await Product.exists({ _id: input.product })) return 'Choose an existing product for this plan.';
  }
  if (!isDateRangeValid(input.availableFrom, input.availableTo)) return 'The availability end date must be on or after the start date.';
  if (input.maxQuantity != null && (!Number.isInteger(Number(input.maxQuantity)) || Number(input.maxQuantity) < Number(input.minQuantity || 1))) return 'Maximum quantity must be a whole number equal to or greater than minimum quantity.';
  if (input.features !== undefined && (!Array.isArray(input.features) || input.features.length > 100 || input.features.some((item) => typeof item !== 'string' || item.length > 200))) return 'Plan features must be up to 100 text values, each 200 characters or fewer.';
  return null;
};

exports.listProducts = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const search = String(req.query.search || '').trim().slice(0, 100); const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = search ? { name: { $regex: escaped, $options: 'i' } } : {};
    if (req.user.role !== 'admin') { filter.isActive = { $ne: false }; filter.billingEligible = { $ne: false }; }
    if (req.query.status === 'Active') filter.isActive = { $ne: false };
    if (req.query.status === 'Inactive') filter.isActive = false;
    applyNumericRange(filter, 'salesPrice', req.query.minAmount, req.query.maxAmount);
    if (!applyDateRange(filter, 'availableFrom', req.query.startDate, req.query.endDate)) return res.status(400).json({ success: false, error: 'Enter valid date filters.' });
    let query = Product.find(filter).sort(sortFromQuery(req.query.sort, { record: 'name', amount: 'salesPrice', details: 'type' }, { createdAt: -1 })).skip((page - 1) * pageSize).limit(pageSize);
    if (req.user.role !== 'admin') query = query.select('-costPrice');
    const [data, total] = await Promise.all([query, Product.countDocuments(filter)]);
    res.json({ success: true, count: data.length, total, page, pageSize, data });
  } catch (err) { res.status(500).json({ success: false, error: 'Unable to load products.' }); }
};

exports.createProduct = async (req, res) => {
  try {
    const input = pick(req.body, productFields);
    if (!input.name || input.salesPrice === undefined) return res.status(400).json({ success: false, error: 'Product name and sales price are required.' });
    if (input.taxRate === undefined) {
      const settings = await WorkspaceSettings.findOne({ key: 'default' }).select('defaultTaxRate').lean();
      input.taxRate = settings?.defaultTaxRate ?? 0;
    }
    if (input.taxComponents !== undefined) { if (!Array.isArray(input.taxComponents) || input.taxComponents.some((component) => !component.label || !Number.isFinite(Number(component.rate)) || Number(component.rate) < 0 || Number(component.rate) > 1) || input.taxComponents.reduce((sum, component) => sum + Number(component.rate), 0) > 1) return res.status(400).json({ success: false, error: 'Provide tax components with labels and rates totaling no more than 100%.' }); input.taxRate = input.taxComponents.reduce((sum, component) => sum + Number(component.rate), 0); }
    const product = await Product.create(input);
    recordAudit({ actor: req.user, action: 'product_created', resourceType: 'Product', resourceId: product._id, newValue: { name: product.name, sku: product.sku, salesPrice: product.salesPrice, currency: product.currency } }).catch(() => {});
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(err.name === 'ValidationError' ? 400 : 500).json({ success: false, error: err.name === 'ValidationError' ? err.message : 'Unable to create product.' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid product id.' });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found.' });
    const input = pick(req.body, productFields);
    Object.assign(product, input);
    if (req.body.taxComponents !== undefined) { if (!Array.isArray(req.body.taxComponents) || req.body.taxComponents.some((component) => !component.label || !Number.isFinite(Number(component.rate)) || Number(component.rate) < 0 || Number(component.rate) > 1) || req.body.taxComponents.reduce((sum, component) => sum + Number(component.rate), 0) > 1) return res.status(400).json({ success: false, error: 'Provide tax components with labels and rates totaling no more than 100%.' }); product.taxRate = req.body.taxComponents.reduce((sum, component) => sum + Number(component.rate), 0); }
    await product.save();
    recordAudit({ actor: req.user, action: 'product_updated', resourceType: 'Product', resourceId: product._id, newValue: { name: product.name, sku: product.sku, salesPrice: product.salesPrice, currency: product.currency, isActive: product.isActive } }).catch(() => {});
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(err.name === 'ValidationError' ? 400 : 500).json({ success: false, error: err.name === 'ValidationError' ? err.message : 'Unable to update product.' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid product id.' });
    const productQuery = Product.findById(req.params.id);
    if (req.user.role !== 'admin') productQuery.select('-costPrice');
    const product = await productQuery.lean();
    if (!product) return res.status(404).json({ success: false, error: 'Product not found.' });
    const [plans, subscriptions] = await Promise.all([
      Plan.find({ product: product._id }).select('name code billingFrequency basePrice currency isActive').lean(),
      require('../models/Subscription').find({ 'lines.product': product._id }).select('subscriptionNumber customerName planName status').limit(100).lean()
    ]);
    res.json({ success: true, data: { ...product, plans, subscriptions } });
  } catch (err) { res.status(500).json({ success: false, error: 'Unable to load product details.' }); }
};

exports.setProductStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || typeof req.body.isActive !== 'boolean') return res.status(400).json({ success: false, error: 'Provide a valid product and status.' });
  const product = await Product.findByIdAndUpdate(req.params.id, { $set: { isActive: req.body.isActive, updatedAt: new Date() } }, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ success: false, error: 'Product not found.' });
  recordAudit({ actor: req.user, action: req.body.isActive ? 'product_activated' : 'product_archived', resourceType: 'Product', resourceId: product._id, newValue: { isActive: product.isActive } }).catch(() => {});
  res.json({ success: true, data: product });
};

exports.listPlans = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const search = String(req.query.search || '').trim().slice(0, 100); const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = search ? { $or: ['name', 'code'].map((field) => ({ [field]: { $regex: escaped, $options: 'i' } })) } : {};
    if (req.query.status === 'Active') filter.isActive = { $ne: false };
    if (req.query.status === 'Inactive') filter.isActive = false;
    if (req.user.role === 'customer') {
      const now = new Date();
      const eligibleProductIds = await Product.find({ isActive: { $ne: false }, billingEligible: { $ne: false } }).distinct('_id');
      filter.isVisible = { $ne: false };
      filter.isActive = { $ne: false };
      filter.product = { $in: eligibleProductIds };
      filter.$and = [
        { $or: [{ availableFrom: { $exists: false } }, { availableFrom: null }, { availableFrom: { $lte: now } }] },
        { $or: [{ availableTo: { $exists: false } }, { availableTo: null }, { availableTo: { $gte: now } }] }
      ];
    }
    applyNumericRange(filter, 'basePrice', req.query.minAmount, req.query.maxAmount);
    if (!applyDateRange(filter, 'createdAt', req.query.startDate, req.query.endDate)) return res.status(400).json({ success: false, error: 'Enter valid date filters.' });
    const [data, total] = await Promise.all([Plan.find(filter).populate('product', 'name type salesPrice').sort(sortFromQuery(req.query.sort, { record: 'name', amount: 'basePrice', details: 'billingFrequency' }, { createdAt: -1 })).skip((page - 1) * pageSize).limit(pageSize), Plan.countDocuments(filter)]);
    res.json({ success: true, count: data.length, total, page, pageSize, data });
  } catch (err) { res.status(500).json({ success: false, error: 'Unable to load plans.' }); }
};

exports.createPlan = async (req, res) => {
  try {
    const input = pick(req.body, planFields);
    if (!input.name || !input.code || input.basePrice === undefined || !input.product) return res.status(400).json({ success: false, error: 'Plan name, code, product, and price are required.' });
    const validationError = await validatePlanInput(input);
    if (validationError) return res.status(400).json({ success: false, error: validationError });
    const plan = await Plan.create(input);
    await plan.populate('product', 'name type salesPrice');
    recordAudit({ actor: req.user, action: 'plan_created', resourceType: 'Plan', resourceId: plan._id, newValue: { name: plan.name, code: plan.code, basePrice: plan.basePrice, currency: plan.currency } }).catch(() => {});
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    const duplicate = err.code === 11000;
    res.status(duplicate ? 409 : err.name === 'ValidationError' ? 400 : 500).json({ success: false, error: duplicate ? 'A plan with this code already exists.' : err.name === 'ValidationError' ? err.message : 'Unable to create plan.' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid plan id.' });
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found.' });
    const input = pick(req.body, planFields);
    const validationError = await validatePlanInput({
      product: input.product === undefined ? plan.product : input.product,
      availableFrom: input.availableFrom === undefined ? plan.availableFrom : input.availableFrom,
      availableTo: input.availableTo === undefined ? plan.availableTo : input.availableTo,
      minQuantity: input.minQuantity === undefined ? plan.minQuantity : input.minQuantity,
      maxQuantity: input.maxQuantity === undefined ? plan.maxQuantity : input.maxQuantity,
      features: input.features === undefined ? plan.features : input.features
    });
    if (validationError) return res.status(400).json({ success: false, error: validationError });
    if (!(input.product === undefined ? plan.product : input.product)) return res.status(400).json({ success: false, error: 'Choose a product for this plan.' });
    Object.assign(plan, input);
    plan.revision = Math.max(1, Number(plan.revision || 1)) + 1;
    await plan.save();
    await plan.populate('product', 'name type salesPrice');
    recordAudit({ actor: req.user, action: 'plan_updated', resourceType: 'Plan', resourceId: plan._id, newValue: { name: plan.name, code: plan.code, basePrice: plan.basePrice, currency: plan.currency, revision: plan.revision } }).catch(() => {});
    res.json({ success: true, data: plan });
  } catch (err) {
    const duplicate = err.code === 11000;
    res.status(duplicate ? 409 : err.name === 'ValidationError' ? 400 : 500).json({ success: false, error: duplicate ? 'A plan with this code already exists.' : err.name === 'ValidationError' ? err.message : 'Unable to update plan.' });
  }
};

exports.getPlanById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid plan id.' });
    const plan = await Plan.findById(req.params.id).populate('product', 'name type salesPrice taxRate taxLabel taxComponents isActive billingEligible').lean();
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found.' });
    const now = new Date();
    if (req.user.role === 'customer' && (plan.isVisible === false || plan.isActive === false || plan.product?.isActive === false || plan.product?.billingEligible === false || plan.availableFrom > now || plan.availableTo && plan.availableTo < now)) return res.status(404).json({ success: false, error: 'Plan not found.' });
    const subscriptionFilter = { plan: plan._id };
    if (req.user.role === 'customer') subscriptionFilter.customer = req.user._id;
    const subscriptions = await require('../models/Subscription').find(subscriptionFilter).select('subscriptionNumber customerName status createdAt').limit(100).lean();
    res.json({ success: true, data: { ...plan, subscriptions } });
  } catch (err) { res.status(500).json({ success: false, error: 'Unable to load plan details.' }); }
};

exports.setPlanStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || typeof req.body.isActive !== 'boolean') return res.status(400).json({ success: false, error: 'Provide a valid plan and status.' });
  const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: { isActive: req.body.isActive } }, { new: true, runValidators: true });
  if (!plan) return res.status(404).json({ success: false, error: 'Plan not found.' });
  recordAudit({ actor: req.user, action: req.body.isActive ? 'plan_activated' : 'plan_archived', resourceType: 'Plan', resourceId: plan._id, newValue: { isActive: plan.isActive, revision: plan.revision } }).catch(() => {});
  res.json({ success: true, data: plan });
};

exports.isDateRangeValid = isDateRangeValid;
