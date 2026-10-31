const mongoose = require('mongoose');

const workspaceSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'default' },
  companyName: { type: String, trim: true, default: 'Brightloop' },
  legalName: { type: String, trim: true, default: '' },
  logoUrl: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  website: { type: String, trim: true, default: '' },
  registeredAddress: { type: String, trim: true, default: '' },
  taxId: { type: String, trim: true, default: '' },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  locale: { type: String, default: 'en-IN' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  dateFormat: { type: String, enum: ['DD MMM YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'], default: 'DD MMM YYYY' },
  invoicePrefix: { type: String, trim: true, uppercase: true, default: 'INV' },
  subscriptionPrefix: { type: String, trim: true, uppercase: true, default: 'SUB' },
  defaultPaymentTerms: { type: String, trim: true, default: 'Net 30 Days' },
  defaultTaxRate: { type: Number, min: 0, max: 1, default: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WorkspaceSettings', workspaceSettingsSchema);
