const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');

// GET /api/dashboard/metrics
exports.getFinanceMetrics = async (req, res) => {
  const startTime = Date.now();
  try {
    const today = new Date();

    // 1. Subscription counts by status
    const subsPipeline = await Subscription.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalMRR: { $sum: '$recurringTotal' } } }
    ]);

    const statusCounts = {
      Draft: 0,
      Quotation: 0,
      Confirmed: 0,
      Active: 0,
      Paused: 0,
      Closed: 0
    };
    let mrr = 0;

    subsPipeline.forEach(item => {
      if (statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
      if (item._id === 'Active') {
        mrr = item.totalMRR;
      }
    });

    // 2. Invoices summary
    const totalInvoices = await Invoice.countDocuments();
    
    // Total Revenue collected (Paid invoices)
    const paidInvoices = await Invoice.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } }
    ]);
    const totalCollected = paidInvoices[0]?.total || 0;

    // Overdue Invoices
    const overdueInvoices = await Invoice.find({
      $or: [
        { status: 'Overdue' },
        { status: 'Confirmed', dueDate: { $lt: today } }
      ]
    }).sort({ dueDate: 1 }).limit(10);

    const overdueSum = overdueInvoices.reduce((acc, inv) => acc + (inv.grandTotal - (inv.paidAmount || 0)), 0);

    // Pending / Outstanding
    const pendingInvoices = await Invoice.aggregate([
      { $match: { status: { $in: ['Confirmed', 'Draft'] } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);
    const pendingAmount = pendingInvoices[0]?.total || 0;

    const responseTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      performance: {
        responseTimeMs,
        slaMet: responseTimeMs < 2000
      },
      metrics: {
        mrr,
        activeSubscriptionsCount: statusCounts.Active,
        overdueCount: overdueInvoices.length,
        overdueAmount: overdueSum,
        totalCollected,
        pendingAmount,
        totalInvoices,
        statusPipeline: statusCounts
      },
      urgentOverdueList: overdueInvoices
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
