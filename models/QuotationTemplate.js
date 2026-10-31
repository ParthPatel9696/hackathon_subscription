const mongoose = require('mongoose');

const templateLineSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, max: 10000 },
  variantName: { type: String, trim: true, default: '' }
}, { _id: true });

const quotationTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  validityDays: { type: Number, required: true, min: 1, max: 365, default: 15 },
  lines: { type: [templateLineSchema], validate: [(lines) => lines.length > 0 && lines.length <= 100, 'A template must contain between 1 and 100 lines.'] },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

quotationTemplateSchema.index({ isActive: 1, updatedAt: -1 });

module.exports = mongoose.model('QuotationTemplate', quotationTemplateSchema);
