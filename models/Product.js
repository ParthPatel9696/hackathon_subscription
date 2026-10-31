const mongoose = require('mongoose');

const variantOptionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Odoo Brand", "Standard Edition"
  priceExtra: { type: Number, default: 0 }, // e.g. 60 or 560
  sku: { type: String, default: '' },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: true });

const variantGroupSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Brand", "Tier"
  options: [variantOptionSchema]
}, { _id: true });

const productSchema = new mongoose.Schema({
  sku: { type: String, trim: true, uppercase: true, default: '' },
  name: { type: String, required: true, trim: true },
  shortDescription: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  category: { type: String, trim: true, default: '' },
  imageUrl: { type: String, trim: true, default: '' },
  type: {
    type: String,
    enum: ['software', 'service', 'addon', 'seat'],
    default: 'software'
  },
  salesPrice: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0, min: 0 },
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  billingEligible: { type: Boolean, default: true },
  variants: [variantGroupSchema],
  taxRate: { type: Number, default: undefined, min: 0, max: 1 },
  taxLabel: { type: String, trim: true, default: '' },
  taxComponents: [{ label: { type: String, trim: true }, rate: { type: Number, min: 0, max: 1 } }],
  currency: { type: String, enum: ['INR'], default: 'INR' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.pre('save', function setUpdatedAt(next) { this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('Product', productSchema);
