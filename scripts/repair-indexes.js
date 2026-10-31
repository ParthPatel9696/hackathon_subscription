require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  try {
    const collection = mongoose.connection.db.collection('subscriptions');
    const indexes = await collection.indexes();
    const legacy = indexes.find((index) => index.name === 'scheduledPlanChange.operationKey_1' && index.unique && !index.partialFilterExpression);
    if (!legacy) { console.log('No legacy plan-change index requires repair.'); return; }
    // Validate uniqueness for actual keys before removing the broken null-value rule.
    await collection.createIndex({ 'scheduledPlanChange.operationKey': 1 }, { name: 'scheduled_plan_change_operation_key_unique_v2', unique: true, partialFilterExpression: { 'scheduledPlanChange.operationKey': { $type: 'string' } } });
    await collection.dropIndex(legacy.name);
    console.log('Repaired the legacy plan-change index. Subscription documents were not modified.');
  } finally { await mongoose.disconnect(); }
}

run().catch((error) => { console.error(`Index repair failed: ${error.message}`); process.exitCode = 1; });
