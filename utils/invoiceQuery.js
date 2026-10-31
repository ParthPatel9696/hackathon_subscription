// Shared overdue predicate: stored labels alone never establish a debt.
const outstandingExpression = { $max: [0, { $subtract: [
  { $ifNull: ['$grandTotalMinor', { $round: [{ $multiply: [{ $ifNull: ['$grandTotal', 0] }, 100] }, 0] }] },
  { $ifNull: ['$paidAmountMinor', { $round: [{ $multiply: [{ $ifNull: ['$paidAmount', 0] }, 100] }, 0] }] }
] }] };

function overdueFilter(now = new Date()) {
  return { status: { $in: ['Confirmed', 'Overdue'] }, dueDate: { $lt: now }, $expr: { $gt: [outstandingExpression, 0] } };
}

module.exports = { outstandingExpression, overdueFilter };
