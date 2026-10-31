const AuditEvent = require('../models/AuditEvent');

async function recordAudit({ actor, action, resourceType, resourceId, customer, previousValue = null, newValue = null, metadata = {} }) {
  return AuditEvent.create({
    actor: actor?._id || actor || null,
    actorName: actor?.name || 'System',
    actorRole: actor?.role || 'system',
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : '',
    customer: customer?._id || customer || null,
    previousValue,
    newValue,
    metadata
  });
}

module.exports = { recordAudit };
