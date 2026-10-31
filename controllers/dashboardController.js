const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { toMinor, fromMinor, normalizeMonthlyMinor } = require('../utils/money');

// GET /api/dashboard/metrics
exports.getFinanceMetrics = async (req, res) => {
  const startTime = Date.now();
  try {
    const today = new Date();

    // 1. Subscription counts by status
    const subsPipeline = await Subscription.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusCounts = {
      Draft: 0,
      Quotation: 0,
      Confirmed: 0,
      Active: 0,
      Paused: 0,
      Closed: 0
    };
    let mrrMinor = 0;

    subsPipeline.forEach(item => {
      if (statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
    });

    const activeSubscriptions = await Subscription.find({ status: 'Active' }).select('recurringTotal recurringTotalMinor subtotal subtotalMinor taxTotal taxTotalMinor discountTotal discountTotalMinor billingFrequency');
    activeSubscriptions.forEach(subscription => {
      const recurringMinor = subscription.recurringTotalMinor ?? toMinor(subscription.recurringTotal);
      const taxMinor = subscription.taxTotalMinor ?? toMinor(subscription.taxTotal || 0);
      const subtotalMinor = subscription.subtotalMinor ?? (subscription.subtotal !== undefined ? toMinor(subscription.subtotal) : recurringMinor - taxMinor);
      const discountMinor = subscription.discountTotalMinor ?? toMinor(subscription.discountTotal || 0);
      mrrMinor += normalizeMonthlyMinor({ billingFrequency: subscription.billingFrequency, subtotalMinor, discountMinor });
    });

    // 2. Invoices summary
    const [totalInvoices, totalCustomers, overdueCount, collectionAggregate] = await Promise.all([
      Invoice.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      Invoice.countDocuments({ $or: [
        { status: 'Overdue' },
        { status: 'Confirmed', dueDate: { $lt: today } }
      ] }),
      Invoice.aggregate([
        { $match: { status: { $ne: 'Cancelled' } } },
        { $project: {
          paidMinor: { $ifNull: ['$paidAmountMinor', { $multiply: [{ $ifNull: ['$paidAmount', 0] }, 100] }] }
        } },
        { $group: { _id: null, total: { $sum: '$paidMinor' } } }
      ])
    ]);
    const totalCollectedMinor = collectionAggregate[0]?.total || 0;

    // Overdue Invoices
    const overdueInvoices = await Invoice.find({
      $or: [
        { status: 'Overdue' },
        { status: 'Confirmed', dueDate: { $lt: today } }
      ]
    }).sort({ dueDate: 1 }).limit(10);

    const overdueBalances = await Invoice.aggregate([
      { $match: { $or: [
        { status: 'Overdue' },
        { status: 'Confirmed', dueDate: { $lt: today } }
      ] } },
      { $project: {
        outstanding: { $max: [0, { $subtract: [
          { $ifNull: ['$grandTotalMinor', { $multiply: ['$grandTotal', 100] }] },
          { $ifNull: ['$paidAmountMinor', { $multiply: [{ $ifNull: ['$paidAmount', 0] }, 100] }] }
        ] }] }
      } },
      { $group: { _id: null, total: { $sum: '$outstanding' } } }
    ]);
    const overdueSumMinor = overdueBalances[0]?.total || 0;

    // Pending / Outstanding
    const pendingInvoices = await Invoice.aggregate([
      { $match: { status: { $in: ['Confirmed', 'Overdue'] } } },
      { $project: {
        outstanding: {
          $max: [
            0,
            { $subtract: [
              { $ifNull: ['$grandTotalMinor', { $multiply: ['$grandTotal', 100] }] },
              { $ifNull: ['$paidAmountMinor', { $multiply: [{ $ifNull: ['$paidAmount', 0] }, 100] }] }
            ] }
          ]
        }
      } },
      { $group: { _id: null, total: { $sum: '$outstanding' } } }
    ]);
    const pendingAmountMinor = pendingInvoices[0]?.total || 0;

    const responseTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      performance: {
        responseTimeMs,
        slaMet: responseTimeMs < 2000
      },
      metrics: {
        mrr: fromMinor(mrrMinor),
        activeSubscriptionsCount: statusCounts.Active,
        overdueCount,
        overdueAmount: fromMinor(overdueSumMinor),
        totalCollected: fromMinor(Math.round(totalCollectedMinor)),
        pendingAmount: fromMinor(Math.round(pendingAmountMinor)),
        totalInvoices,
        totalCustomers,
        statusPipeline: statusCounts
      },
      urgentOverdueList: overdueInvoices
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
