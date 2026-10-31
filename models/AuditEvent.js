const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, default: 'System' },
  actorRole: { type: String, enum: ['admin', 'staff', 'customer', 'system'], default: 'system' },
  action: { type: String, required: true, maxlength: 100 },
  resourceType: { type: String, required: true, maxlength: 80 },
  resourceId: { type: String, default: '' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false, strict: true });

auditEventSchema.index({ createdAt: -1 });
auditEventSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
module.exports = mongoose.model('AuditEvent', auditEventSchema);
