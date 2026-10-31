const mongoose = require('mongoose');

const variantOptionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Odoo Brand", "Standard Edition"
  priceExtra: { type: Number, default: 0 }, // e.g. 60 or 560
  sku: { type: String, default: '' }
}, { _id: true });

const variantGroupSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Brand", "Tier"
  options: [variantOptionSchema]
}, { _id: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['software', 'service', 'addon', 'seat'],
    default: 'software'
  },
  salesPrice: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0, min: 0 },
  notes: { type: String, default: '' },
  variants: [variantGroupSchema],
  taxRate: { type: Number, default: 0.10, min: 0, max: 1 }, // Default 10% tax
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
