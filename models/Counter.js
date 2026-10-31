const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String },
  value: { type: Number, required: true, min: 0 }
}, { versionKey: false, collection: 'business_counters' });

module.exports = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
