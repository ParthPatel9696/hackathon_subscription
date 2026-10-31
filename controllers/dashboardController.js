const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const { toMinor, fromMinor } = require('../utils/money');

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

    const activeSubscriptions = await Subscription.find({ status: 'Active' }).select('recurringTotal recurringTotalMinor billingFrequency');
    activeSubscriptions.forEach(subscription => {
      const recurringMinor = subscription.recurringTotalMinor ?? toMinor(subscription.recurringTotal);
      if (subscription.billingFrequency === 'yearly') mrrMinor += Math.round(recurringMinor / 12);
      else if (subscription.billingFrequency === 'weekly') mrrMinor += Math.round(recurringMinor * 52 / 12);
      else if (subscription.billingFrequency === 'daily') mrrMinor += Math.round(recurringMinor * 365 / 12);
      else mrrMinor += recurringMinor;
    });

    // 2. Invoices summary
    const totalInvoices = await Invoice.countDocuments();
    
    // Total Revenue collected (Paid invoices)
    const paidInvoices = await Invoice.aggregate([
      { $match: { status: 'Paid' } },
      { $project: {
        paidMinor: { $ifNull: ['$paidAmountMinor', { $multiply: ['$paidAmount', 100] }] }
      } },
      { $group: { _id: null, total: { $sum: '$paidMinor' } } }
    ]);
    const totalCollectedMinor = paidInvoices[0]?.total || 0;

    // Overdue Invoices
    const overdueInvoices = await Invoice.find({
      $or: [
        { status: 'Overdue' },
        { status: 'Confirmed', dueDate: { $lt: today } }
      ]
    }).sort({ dueDate: 1 }).limit(10);

    const overdueSumMinor = overdueInvoices.reduce((acc, inv) => {
      const grandTotalMinor = inv.grandTotalMinor ?? toMinor(inv.grandTotal);
      const paidAmountMinor = inv.paidAmountMinor ?? toMinor(inv.paidAmount || 0);
      return acc + Math.max(0, grandTotalMinor - paidAmountMinor);
    }, 0);

    // Pending / Outstanding
    const pendingInvoices = await Invoice.aggregate([
      { $match: { status: { $in: ['Confirmed', 'Draft', 'Overdue'] } } },
      { $project: {
        outstanding: {
          $max: [
            0,
            { $subtract: [
              { $ifNull: ['$grandTotalMinor', { $multiply: ['$grandTotal', 100] }] },
              { $ifNull: ['$paidAmountMinor', { $multiply: ['$paidAmount', 100] }] }
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
        overdueCount: overdueInvoices.length,
        overdueAmount: fromMinor(overdueSumMinor),
        totalCollected: fromMinor(Math.round(totalCollectedMinor)),
        pendingAmount: fromMinor(Math.round(pendingAmountMinor)),
        totalInvoices,
        statusPipeline: statusCounts
      },
      urgentOverdueList: overdueInvoices
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
