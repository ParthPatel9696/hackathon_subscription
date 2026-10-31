const mongoose = require('mongoose');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const { sortFromQuery, applyNumericRange, applyDateRange } = require('../utils/listQuery');

const productFields = ['name', 'type', 'salesPrice', 'costPrice', 'notes', 'variants', 'taxRate', 'taxLabel', 'taxComponents'];
const planFields = ['name', 'code', 'billingFrequency', 'basePrice', 'minQuantity', 'availableFrom', 'availableTo', 'autoCloseAtEnd', 'allowPause', 'allowEarlyClose', 'allowRenew', 'description', 'product'];
const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
const isDateRangeValid = (start, end) => !start || !end || new Date(end) >= new Date(start);
const validatePlanInput = async (input) => {
  if (input.product) {
    if (!mongoose.isValidObjectId(input.product) || !await Product.exists({ _id: input.product })) return 'Choose an existing product for this plan.';
  }
  if (!isDateRangeValid(input.availableFrom, input.availableTo)) return 'The availability end date must be on or after the start date.';
  return null;
};

exports.listProducts = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const search = String(req.query.search || '').trim().slice(0, 100); const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = search ? { name: { $regex: escaped, $options: 'i' } } : {};
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
    if (input.taxRate === undefined) input.taxRate = 0;
    if (input.taxComponents !== undefined) { if (!Array.isArray(input.taxComponents) || input.taxComponents.some((component) => !component.label || !Number.isFinite(Number(component.rate)) || Number(component.rate) < 0 || Number(component.rate) > 1) || input.taxComponents.reduce((sum, component) => sum + Number(component.rate), 0) > 1) return res.status(400).json({ success: false, error: 'Provide tax components with labels and rates totaling no more than 100%.' }); input.taxRate = input.taxComponents.reduce((sum, component) => sum + Number(component.rate), 0); }
    const product = await Product.create(input);
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
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(err.name === 'ValidationError' ? 400 : 500).json({ success: false, error: err.name === 'ValidationError' ? err.message : 'Unable to update product.' });
  }
};

exports.listPlans = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const search = String(req.query.search || '').trim().slice(0, 100); const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = search ? { $or: ['name', 'code'].map((field) => ({ [field]: { $regex: escaped, $options: 'i' } })) } : {};
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
      availableTo: input.availableTo === undefined ? plan.availableTo : input.availableTo
    });
    if (validationError) return res.status(400).json({ success: false, error: validationError });
    if (!(input.product === undefined ? plan.product : input.product)) return res.status(400).json({ success: false, error: 'Choose a product for this plan.' });
    Object.assign(plan, input);
    await plan.save();
    await plan.populate('product', 'name type salesPrice');
    res.json({ success: true, data: plan });
  } catch (err) {
    const duplicate = err.code === 11000;
    res.status(duplicate ? 409 : err.name === 'ValidationError' ? 400 : 500).json({ success: false, error: duplicate ? 'A plan with this code already exists.' : err.name === 'ValidationError' ? err.message : 'Unable to update plan.' });
  }
};

exports.isDateRangeValid = isDateRangeValid;
