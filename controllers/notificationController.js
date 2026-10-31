const Invoice = require('../models/Invoice');
const Subscription = require('../models/Subscription');

exports.listNotifications = async (req, res) => {
  try {
    const today = new Date();
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 7);
    const ownerFilter = req.user.role === 'customer' ? { customer: req.user._id } : {};
    const [overdueInvoices, upcomingSubscriptions] = await Promise.all([
      Invoice.find({ ...ownerFilter, $or: [
        { status: 'Overdue' },
        { status: 'Confirmed', dueDate: { $lt: today } }
      ] }).select('invoiceNumber customerName grandTotal paidAmount dueDate status').sort({ dueDate: 1 }).limit(8),
      Subscription.find({ ...ownerFilter, status: 'Active', nextBillingDate: { $gte: today, $lte: horizon } }).select('subscriptionNumber customerName planName nextBillingDate recurringTotal').sort({ nextBillingDate: 1 }).limit(8)
    ]);
    const items = [
      ...overdueInvoices.map((invoice) => ({
        id: String(invoice._id), type: 'overdue', title: `${invoice.invoiceNumber} is overdue`,
        detail: `${invoice.customerName} · due ${new Date(invoice.dueDate).toLocaleDateString()}`,
        date: invoice.dueDate, href: `/app/invoices/${invoice._id}`
      })),
      ...upcomingSubscriptions.map((subscription) => ({
        id: String(subscription._id), type: 'renewal', title: `${subscription.subscriptionNumber} renews soon`,
        detail: `${subscription.customerName} · ${subscription.planName}`,
        date: subscription.nextBillingDate, href: `/app/subscriptions/${subscription._id}`
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to load notifications.' });
  }
};
