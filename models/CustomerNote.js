const mongoose = require('mongoose');

const customerNoteSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  editedAt: { type: Date, default: null }
}, { timestamps: true });

customerNoteSchema.index({ customer: 1, createdAt: -1 });
module.exports = mongoose.model('CustomerNote', customerNoteSchema);
