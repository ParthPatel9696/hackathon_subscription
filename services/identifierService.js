const Counter = require('../models/Counter');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function nextBusinessIdentifier({ prefix, year = new Date().getUTCFullYear(), Model, field }) {
  const key = `${prefix}:${year}`;
  const pattern = new RegExp(`^${escapeRegex(prefix)}-${year}-(\\d+)$`);
  const latest = await Model.findOne({ [field]: { $regex: pattern } }).sort({ [field]: -1 }).select(field).lean();
  const existingValue = latest ? Number(latest[field].match(pattern)?.[1] || 0) : 0;

  try {
    await Counter.updateOne({ _id: key }, { $setOnInsert: { value: existingValue } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  await Counter.updateOne({ _id: key }, { $max: { value: existingValue } });
  const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { value: 1 } }, { new: true });
  return `${prefix}-${year}-${String(counter.value).padStart(4, '0')}`;
}

module.exports = { nextBusinessIdentifier };
