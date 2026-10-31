const mongoose = require('mongoose');
const QuotationTemplate = require('../models/QuotationTemplate');
const Plan = require('../models/Plan');
const Product = require('../models/Product');
const { recordAudit } = require('../services/auditService');

async function validateTemplateInput(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) throw Object.assign(new Error('Template name is required and must be at most 120 characters.'), { statusCode: 400 });
  if (!mongoose.isValidObjectId(body.plan)) throw Object.assign(new Error('Choose a valid plan.'), { statusCode: 400 });
  const plan = await Plan.findById(body.plan).select('_id name product isActive');
  if (!plan || !plan.isActive) throw Object.assign(new Error('Choose an active plan.'), { statusCode: 400 });
  const validityDays = Number(body.validityDays);
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) throw Object.assign(new Error('Validity must be between 1 and 365 days.'), { statusCode: 400 });
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 100) throw Object.assign(new Error('A template must contain between 1 and 100 product lines.'), { statusCode: 400 });
  const lines = [];
  for (const line of body.lines) {
    if (!mongoose.isValidObjectId(line.product)) throw Object.assign(new Error('Each line needs a valid product.'), { statusCode: 400 });
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw Object.assign(new Error('Line quantities must be whole numbers between 1 and 10,000.'), { statusCode: 400 });
    const product = await Product.findById(line.product).select('_id name variants isActive billingEligible');
    if (!product || !product.isActive || !product.billingEligible) throw Object.assign(new Error('Template lines must use active, billable products.'), { statusCode: 400 });
    const variantName = typeof line.variantName === 'string' ? line.variantName.trim() : '';
    if (variantName && !product.variants.flatMap((group) => group.options).some((option) => option.isActive && option.name === variantName)) {
      throw Object.assign(new Error(`Choose an active variant for ${product.name}.`), { statusCode: 400 });
    }
    lines.push({ product: product._id, quantity, variantName });
  }
  if (plan.product && !lines.some((line) => String(line.product) === String(plan.product))) throw Object.assign(new Error('The template must include its plan product.'), { statusCode: 400 });
  return { name, plan: plan._id, validityDays, lines };
}

exports.list = async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { isActive: true };
  const data = await QuotationTemplate.find(filter).populate('plan', 'name code basePrice billingFrequency').populate('lines.product', 'name variants').sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  try {
    const values = await validateTemplateInput(req.body);
    const template = await QuotationTemplate.create({ ...values, createdBy: req.user._id });
    recordAudit({ actor: req.user, action: 'quotation_template_created', resourceType: 'QuotationTemplate', resourceId: template._id, newValue: { name: template.name, plan: template.plan, validityDays: template.validityDays } }).catch(() => {});
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Unable to create quotation template.' });
  }
};

exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid template id.' });
    const values = await validateTemplateInput(req.body);
    const template = await QuotationTemplate.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true });
    if (!template) return res.status(404).json({ success: false, error: 'Quotation template not found.' });
    recordAudit({ actor: req.user, action: 'quotation_template_updated', resourceType: 'QuotationTemplate', resourceId: template._id, newValue: { name: template.name, plan: template.plan, validityDays: template.validityDays } }).catch(() => {});
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Unable to update quotation template.' });
  }
};

exports.setStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid template id.' });
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ success: false, error: 'isActive must be a boolean.' });
  const template = await QuotationTemplate.findByIdAndUpdate(req.params.id, { $set: { isActive: req.body.isActive } }, { new: true });
  if (!template) return res.status(404).json({ success: false, error: 'Quotation template not found.' });
  recordAudit({ actor: req.user, action: req.body.isActive ? 'quotation_template_activated' : 'quotation_template_archived', resourceType: 'QuotationTemplate', resourceId: template._id, newValue: { isActive: template.isActive } }).catch(() => {});
  res.json({ success: true, data: template });
};
