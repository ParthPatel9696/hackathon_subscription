const mongoose = require('mongoose');
const Product = require('../models/Product');
const Plan = require('../models/Plan');

const productFields = ['name', 'type', 'salesPrice', 'costPrice', 'notes', 'variants', 'taxRate'];
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
    let query = Product.find().sort({ createdAt: -1 });
    if (req.user.role !== 'admin') query = query.select('-costPrice');
    const data = await query;
    res.json({ success: true, count: data.length, data });
  } catch (err) { res.status(500).json({ success: false, error: 'Unable to load products.' }); }
};

exports.createProduct = async (req, res) => {
  try {
    const input = pick(req.body, productFields);
    if (!input.name || input.salesPrice === undefined) return res.status(400).json({ success: false, error: 'Product name and sales price are required.' });
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
    Object.assign(product, pick(req.body, productFields));
    await product.save();
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(err.name === 'ValidationError' ? 400 : 500).json({ success: false, error: err.name === 'ValidationError' ? err.message : 'Unable to update product.' });
  }
};

exports.listPlans = async (req, res) => {
  try {
    const data = await Plan.find().populate('product', 'name type salesPrice').sort({ createdAt: -1 });
    res.json({ success: true, count: data.length, data });
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
