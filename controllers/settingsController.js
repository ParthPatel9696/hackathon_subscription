const WorkspaceSettings = require('../models/WorkspaceSettings');
const { recordAudit } = require('../services/auditService');
const { normalizePaymentTerms } = require('../utils/paymentTerms');

const editable = ['companyName', 'legalName', 'logoUrl', 'email', 'phone', 'website', 'registeredAddress', 'taxId', 'locale', 'timezone', 'dateFormat', 'invoicePrefix', 'subscriptionPrefix', 'defaultPaymentTerms', 'defaultTaxRate'];

exports.getWorkspace = async (req, res) => {
  const settings = await WorkspaceSettings.findOneAndUpdate({ key: 'default' }, { $setOnInsert: { key: 'default' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  res.json({ success: true, data: settings });
};

exports.updateWorkspace = async (req, res) => {
  const updates = Object.fromEntries(editable.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value !== 'string' && key !== 'defaultTaxRate') return res.status(400).json({ success: false, error: `${key} must be text.` });
    if (typeof value === 'string' && value.length > (key === 'registeredAddress' ? 1000 : 160)) return res.status(400).json({ success: false, error: `${key} is too long.` });
  }
  if (updates.companyName !== undefined && !updates.companyName.trim()) return res.status(400).json({ success: false, error: 'Company name is required.' });
  if (updates.defaultPaymentTerms !== undefined) {
    try { updates.defaultPaymentTerms = normalizePaymentTerms(updates.defaultPaymentTerms); }
    catch (error) { return res.status(400).json({ success: false, error: error.message }); }
  }
  if (updates.currency !== undefined && updates.currency !== 'INR') return res.status(400).json({ success: false, error: 'Brightloop currency is configured as INR.' });
  if (updates.locale !== undefined && updates.locale !== 'en-IN') return res.status(400).json({ success: false, error: 'Brightloop locale is configured as en-IN.' });
  if (updates.timezone !== undefined && updates.timezone !== 'Asia/Kolkata') return res.status(400).json({ success: false, error: 'Billing operations are configured for Asia/Kolkata business time.' });
  if (updates.dateFormat !== undefined && !['DD MMM YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].includes(updates.dateFormat)) return res.status(400).json({ success: false, error: 'Choose a supported date format.' });
  for (const key of ['invoicePrefix', 'subscriptionPrefix']) if (updates[key] !== undefined && !/^[A-Z0-9_-]{2,12}$/i.test(updates[key])) return res.status(400).json({ success: false, error: `${key} must be 2 to 12 letters, numbers, dashes, or underscores.` });
  if (updates.defaultTaxRate !== undefined && (!Number.isFinite(Number(updates.defaultTaxRate)) || Number(updates.defaultTaxRate) < 0 || Number(updates.defaultTaxRate) > 1)) return res.status(400).json({ success: false, error: 'Default tax rate must be between zero and one.' });
  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) return res.status(400).json({ success: false, error: 'Enter a valid company email address.' });
  if (updates.website && !/^https?:\/\//i.test(updates.website)) return res.status(400).json({ success: false, error: 'Website must start with http:// or https://.' });
  const settings = await WorkspaceSettings.findOneAndUpdate({ key: 'default' }, { $set: { ...updates, updatedBy: req.user._id, updatedAt: new Date(), currency: 'INR', locale: 'en-IN' }, $setOnInsert: { key: 'default' } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  recordAudit({ actor: req.user, action: 'workspace_settings_updated', resourceType: 'WorkspaceSettings', resourceId: settings._id, newValue: updates }).catch(() => {});
  res.json({ success: true, data: settings });
};
