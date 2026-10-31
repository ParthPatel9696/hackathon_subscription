require('dotenv').config();
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const Discount = require('../models/Discount');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const QuotationTemplate = require('../models/QuotationTemplate');
const CustomerNote = require('../models/CustomerNote');
const SubscriptionRequest = require('../models/SubscriptionRequest');
const AuditEvent = require('../models/AuditEvent');
const WorkspaceSettings = require('../models/WorkspaceSettings');
require('../models/Counter');
const { toMinor, fromMinor, calculateLine } = require('../utils/money');
const { advanceBillingDate } = require('../services/billingService');
const { nextBusinessIdentifier } = require('../services/identifierService');

const namespace = 'brightloop-sample-v1';
const id = (key) => new mongoose.Types.ObjectId(crypto.createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 24));
const stats = {};
async function insert(Model, key, attributes) {
  const existing = await Model.findById(id(key));
  stats[Model.collection.name] ||= { inserted: 0, preserved: 0 };
  if (existing) { stats[Model.collection.name].preserved += 1; return existing; }
  const document = await Model.create({ _id: id(key), ...attributes });
  stats[Model.collection.name].inserted += 1;
  return document;
}
const shiftDays = (date, days) => new Date(date.getTime() + days * 86400000);
const periodBefore = (date, frequency, count) => {
  const result = new Date(date);
  if (frequency === 'daily') result.setUTCDate(result.getUTCDate() - count);
  if (frequency === 'weekly') result.setUTCDate(result.getUTCDate() - count * 7);
  if (frequency === 'monthly') { result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() - count); }
  if (frequency === 'yearly') { result.setUTCMonth(0, 1); result.setUTCFullYear(result.getUTCFullYear() - count); }
  return result;
};

async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('Sample data is disabled in production.');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    console.log(`Adding sample data to ${mongoose.connection.host}/${mongoose.connection.name}. Existing records and passwords are preserved.`);
    const now = new Date();
    const password = process.env.BRIGHTLOOP_SAMPLE_PASSWORD || 'Brightloop@Demo2026!';
    const account = async (key, details) => {
      const collision = await User.findOne({ email: details.email }).select('_id');
      if (collision && String(collision._id) !== String(id(key))) throw new Error(`Sample email ${details.email} already belongs to an existing account. No account was overwritten.`);
      return insert(User, key, { ...details, password, termsAcceptedAt: now, accountStatus: 'Active' });
    };
    const admin = await account('admin', { name: 'Brightloop Demo Admin', email: 'demo.admin@brightloop.test', role: 'admin', companyName: 'Brightloop Demo' });
    const staff = await account('staff', { name: 'Isha Mehta', email: 'demo.staff@brightloop.test', role: 'staff', companyName: 'Brightloop Demo' });
    await account('staff-2', { name: 'Rohan Desai', email: 'demo.operations@brightloop.test', role: 'staff', companyName: 'Brightloop Demo' });
    const names = [
      ['Aarav Shah', 'Moksha Retail', 'Ahmedabad', 'Gujarat', '380001'], ['Ananya Rao', 'Cedar Studios', 'Bengaluru', 'Karnataka', '560001'],
      ['Vivaan Patel', 'Orbit Logistics', 'Surat', 'Gujarat', '395003'], ['Diya Nair', 'Maple Foods', 'Kochi', 'Kerala', '682001'],
      ['Kabir Joshi', 'Northstar Labs', 'Pune', 'Maharashtra', '411001'], ['Saanvi Iyer', 'Linen Collective', 'Chennai', 'Tamil Nadu', '600001'],
      ['Arjun Kapoor', 'Fieldnote Media', 'New Delhi', 'Delhi', '110001'], ['Myra Singh', 'Atlas Learning', 'Jaipur', 'Rajasthan', '302001'],
      ['Reyansh Gupta', 'Summit Services', 'Mumbai', 'Maharashtra', '400001'], ['Aditi Menon', 'Palm Analytics', 'Hyderabad', 'Telangana', '500001'],
      ['Ishaan Verma', 'Riverstone Works', 'Lucknow', 'Uttar Pradesh', '226001'], ['Tara Bose', 'Juniper Design', 'Kolkata', 'West Bengal', '700001']
    ];
    const customers = [];
    for (const [index, [name, companyName, billingCity, billingState, billingPostalCode]] of names.entries()) {
      const email = index === 0 ? 'demo.customer@brightloop.test' : `demo.customer${index + 1}@brightloop.test`;
      customers.push(await account(`customer-${index}`, { name, email, role: 'customer', companyName, customerType: 'business', assignedStaff: staff._id, billingContactName: name, billingContactEmail: email, billingAddress: `${index + 10}, Sample Business Park`, billingCity, billingState, billingPostalCode, billingCountry: 'India', shippingAddress: `${index + 10}, Sample Business Park, ${billingCity}`, preferredPaymentMethod: index % 2 ? 'Bank transfer' : 'UPI', tags: ['demo', index % 2 ? 'growth' : 'business'], createdAt: shiftDays(now, -220 + index * 5) }));
    }
    const products = [];
    for (const [index, [name, salesPrice, type, category]] of [
      ['Workspace ERP', 1499, 'software', 'Business software'], ['Cloud Storage', 799, 'service', 'Cloud'],
      ['Revenue Analytics', 4999, 'software', 'Analytics'], ['Priority Support', 999, 'addon', 'Services'],
      ['Team Seat', 299, 'seat', 'Collaboration'], ['Daily Backup', 199, 'service', 'Cloud']
    ].entries()) products.push(await insert(Product, `product-${index}`, { sku: `DEMO-PROD-${index + 1}`, name: `${name} (Demo)`, type, category, salesPrice, costPrice: Math.round(salesPrice * 0.35), description: 'Fictional catalogue item for the Brightloop demonstration.', notes: 'Sample data. Tax rates are illustrative configuration, not GST advice.', taxRate: index === 4 ? 0 : 0.1, taxLabel: index === 4 ? 'No demo tax' : 'Demo tax', variants: index === 0 ? [{ name: 'Brand', options: [{ name: 'Standard', priceExtra: 0, sku: 'DEMO-STD' }, { name: 'Odoo', priceExtra: 560, sku: 'DEMO-ODOO' }] }] : [{ name: 'Edition', options: [{ name: 'Standard', priceExtra: 0 }, { name: 'Plus', priceExtra: 250 }] }] }));
    const plans = [];
    for (const [index, [productIndex, frequency, price, label]] of [
      [0, 'monthly', 1499, 'Business Monthly'], [0, 'yearly', 14990, 'Business Annual'], [1, 'monthly', 799, 'Cloud Monthly'],
      [2, 'monthly', 4999, 'Analytics Monthly'], [3, 'weekly', 499, 'Support Weekly'], [4, 'monthly', 299, 'Team Seats'],
      [5, 'daily', 49, 'Backup Daily'], [2, 'yearly', 49990, 'Analytics Annual']
    ].entries()) plans.push(await insert(Plan, `plan-${index}`, { code: `DEMO-PLAN-${index + 1}`, name: `${label} (Demo)`, product: products[productIndex]._id, basePrice: price, billingFrequency: frequency, minQuantity: 1, maxQuantity: 1000, availableFrom: shiftDays(now, -400), description: 'Sample plan with configurable lifecycle permissions.', features: ['Customer portal', 'Recurring invoices', 'Payment tracking'], autoCloseAtEnd: index === 7, allowPause: index !== 6, allowEarlyClose: index !== 7, allowRenew: true }));
    const discounts = [];
    for (const [index, rule] of [
      { code: 'DEMO-WELCOME10', name: 'Demo welcome offer', discountType: 'percentage', value: 10, minPurchaseAmount: 500, minQuantity: 1, appliesTo: 'all', usageLimit: 100, startDate: shiftDays(now, -30), endDate: shiftDays(now, 365) },
      { code: 'DEMO-ERP500', name: 'Demo ERP offer', discountType: 'fixed', value: 500, minPurchaseAmount: 2000, minQuantity: 2, appliesTo: 'specific_product', targetProduct: products[0]._id, usageLimit: 25, startDate: shiftDays(now, -30), endDate: shiftDays(now, 90) },
      { code: 'DEMO-EXPIRED', name: 'Expired sample offer', discountType: 'percentage', value: 5, minPurchaseAmount: 0, appliesTo: 'all', usageLimit: 10, startDate: shiftDays(now, -90), endDate: shiftDays(now, -1), isActive: false }
    ].entries()) discounts.push(await insert(Discount, `discount-${index}`, rule));
    for (let index = 0; index < 3; index++) await insert(QuotationTemplate, `template-${index}`, { name: ['Business starter bundle (Demo)', 'Analytics team bundle (Demo)', 'Cloud essentials (Demo)'][index], plan: plans[index === 1 ? 3 : index === 2 ? 2 : 0]._id, validityDays: 15 + index * 5, createdBy: admin._id, lines: [{ product: products[index === 1 ? 2 : index === 2 ? 1 : 0]._id, quantity: index + 1, variantName: index === 0 ? 'Odoo' : 'Standard' }, { product: products[3]._id, quantity: 1 }] });
    if (!await WorkspaceSettings.exists({ key: 'default' })) await insert(WorkspaceSettings, 'settings', { key: 'default', companyName: 'Brightloop Demo', legalName: 'Brightloop Demo Workspace', email: 'demo.admin@brightloop.test', registeredAddress: 'Sample Business Park, Ahmedabad, Gujarat, India', defaultTaxRate: 0.1, updatedBy: admin._id });
    else stats[WorkspaceSettings.collection.name] = { inserted: 0, preserved: 1 };
    const subscriptions = [];
    const states = ['Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Paused', 'Paused', 'Closed', 'Quotation', 'Quotation', 'Draft', 'Confirmed', 'Quotation'];
    for (let index = 0; index < states.length; index++) {
      const plan = plans[index % plans.length];
      const product = products.find((item) => String(item._id) === String(plan.product));
      const customer = customers[index % customers.length];
      const quantity = index % 3 + 1;
      const extra = product === products[0] && index % 2 === 0 ? 560 : 0;
      const calculation = calculateLine({ unitPrice: plan.basePrice, variantPriceExtra: extra, quantity, taxRate: product.taxRate });
      const startDate = periodBefore(now, plan.billingFrequency, plan.billingFrequency === 'yearly' ? 1 : 6);
      const line = { product: product._id, productName: product.name, variantName: extra ? 'Odoo' : 'Standard', quantity, unitPrice: plan.basePrice, unitPriceMinor: calculation.unitPriceMinor, variantPriceExtra: extra, variantPriceExtraMinor: calculation.variantPriceExtraMinor, taxRate: product.taxRate, taxLabel: product.taxLabel, taxAmount: fromMinor(calculation.taxMinor), taxMinor: calculation.taxMinor, discountAmount: 0, discountMinor: 0, lineTotal: fromMinor(calculation.totalMinor), lineTotalMinor: calculation.totalMinor };
      const existing = await Subscription.findById(id(`subscription-${index}`));
      const subscriptionNumber = existing?.subscriptionNumber || await nextBusinessIdentifier({ prefix: 'DEMO-SUB', Model: Subscription, field: 'subscriptionNumber' });
      const status = states[index];
      const subscription = await insert(Subscription, `subscription-${index}`, { subscriptionNumber, customer: customer._id, customerName: customer.companyName, customerEmail: customer.email, plan: plan._id, planName: plan.name, billingFrequency: plan.billingFrequency, startDate, expiryDate: shiftDays(now, status === 'Closed' ? -2 : 365), nextBillingDate: shiftDays(now, index % 7 + 1), paymentTerms: 'Net 30 Days', lines: [line], subtotal: fromMinor(calculation.subtotalMinor), subtotalMinor: calculation.subtotalMinor, taxTotal: fromMinor(calculation.taxMinor), taxTotalMinor: calculation.taxMinor, discountTotal: 0, discountTotalMinor: 0, recurringTotal: fromMinor(calculation.totalMinor), recurringTotalMinor: calculation.totalMinor, status, quotationValidUntil: shiftDays(now, 15), closedAt: status === 'Closed' ? shiftDays(now, -2) : null, notes: 'Fictional demonstration subscription.', createdAt: startDate, statusHistory: [{ eventType: 'created', status, netRecurringMinor: calculation.subtotalMinor, billingFrequency: plan.billingFrequency, effectiveAt: startDate, actor: admin._id, reason: 'Sample dataset setup.' }] });
      subscriptions.push(subscription);
      await insert(AuditEvent, `audit-subscription-${index}`, { actor: admin._id, actorName: admin.name, actorRole: 'admin', action: 'demo_data_created', resourceType: 'Subscription', resourceId: String(subscription._id), customer: customer._id, newValue: { status: subscription.status, recurringTotalMinor: subscription.recurringTotalMinor }, metadata: { dataset: namespace }, createdAt: startDate });
      if (index > 10) continue;
      const periods = plan.billingFrequency === 'yearly' ? 1 : 6;
      for (let periodIndex = 0; periodIndex < periods; periodIndex++) {
        const key = `invoice-${index}-${periodIndex}`;
        const periodStart = periodBefore(now, plan.billingFrequency, periods - periodIndex);
        const periodEnd = advanceBillingDate(periodStart, plan.billingFrequency);
        const invoiceDate = periodEnd;
        // Historical samples include paid, partial, overdue, draft and cancelled invoices.
        const last = periodIndex === periods - 1;
        let status = !last ? 'Paid' : index % 5 === 0 ? 'Overdue' : index % 5 === 1 ? 'Confirmed' : index % 5 === 2 ? 'Draft' : index % 5 === 3 ? 'Cancelled' : 'Paid';
        const termsDays = status === 'Overdue' ? 0 : status === 'Confirmed' ? 45 : 30;
        const dueDate = shiftDays(invoiceDate, termsDays);
        if (status === 'Confirmed' && dueDate < now) status = 'Overdue';
        const paidAt = new Date(Math.min(shiftDays(invoiceDate, 3).getTime(), now.getTime()));
        const paidMinor = status === 'Paid' ? calculation.totalMinor : status === 'Overdue' ? Math.floor(calculation.totalMinor / 3) : 0;
        const prior = await Invoice.findById(id(key));
        const invoiceNumber = prior?.invoiceNumber || await nextBusinessIdentifier({ prefix: 'DEMO-INV', Model: Invoice, field: 'invoiceNumber' });
        const invoice = await insert(Invoice, key, { invoiceNumber, subscription: subscription._id, subscriptionNumber, customer: customer._id, customerName: customer.companyName, customerEmail: customer.email, companySnapshot: { name: 'Brightloop Demo', address: 'Sample Business Park, Ahmedabad, India' }, billingAddressSnapshot: { name: customer.companyName, line1: customer.billingAddress, city: customer.billingCity, state: customer.billingState, postalCode: customer.billingPostalCode, country: 'India' }, invoiceDate, dueDate, billingPeriodStart: periodStart, billingPeriodEnd: periodEnd, paymentTerms: termsDays === 0 ? 'Due on Receipt' : `Net ${termsDays} Days`, lines: [{ productName: product.name, variantName: line.variantName, quantity, unitPrice: fromMinor(calculation.unitPriceMinor + calculation.variantPriceExtraMinor), unitPriceMinor: calculation.unitPriceMinor + calculation.variantPriceExtraMinor, taxRate: product.taxRate, taxLabel: product.taxLabel, taxAmount: fromMinor(calculation.taxMinor), taxMinor: calculation.taxMinor, discountAmount: 0, discountMinor: 0, total: fromMinor(calculation.totalMinor), totalMinor: calculation.totalMinor }], subtotal: fromMinor(calculation.subtotalMinor), subtotalMinor: calculation.subtotalMinor, taxTotal: fromMinor(calculation.taxMinor), taxTotalMinor: calculation.taxMinor, discountTotal: 0, discountTotalMinor: 0, grandTotal: fromMinor(calculation.totalMinor), grandTotalMinor: calculation.totalMinor, paidAmount: fromMinor(paidMinor), paidAmountMinor: paidMinor, status, createdAt: invoiceDate });
        // Use the persisted snapshot on reruns; never overwrite a payment made in the UI.
        if (paidMinor && (!prior || (invoice.paidAmountMinor === paidMinor && !await Payment.exists({ invoice: invoice._id })))) await insert(Payment, `payment-${index}-${periodIndex}`, { invoice: invoice._id, invoiceNumber: invoice.invoiceNumber, amount: fromMinor(paidMinor), amountMinor: paidMinor, method: ['UPI', 'Bank transfer', 'Card', 'Cheque'][index % 4], paymentDate: paidAt, referenceNote: `DEMO-PAY-${index + 1}-${periodIndex + 1}`, referenceKey: `demo-pay-${index + 1}-${periodIndex + 1}`, status: 'posted', balanceBeforeMinor: 0, balanceAfterMinor: paidMinor, recordedBy: staff._id, createdAt: paidAt });
      }
    }
    for (let index = 0; index < customers.length; index++) await insert(CustomerNote, `note-${index}`, { customer: customers[index]._id, author: staff._id, authorName: staff.name, body: `Demo account for ${customers[index].companyName}. Use this sample to explore billing history, notes and the customer portal.` });
    for (const [index, requestType] of ['plan_change', 'quantity_change', 'support'].entries()) await insert(SubscriptionRequest, `request-${index}`, { customer: subscriptions[index].customer, subscription: subscriptions[index]._id, requestType, targetPlan: requestType === 'plan_change' ? plans[1]._id : null, targetQuantity: requestType === 'quantity_change' ? 5 : null, message: requestType === 'support' ? 'Demo request: please help us review our next invoice.' : 'Demo request: please review this change for the next billing cycle.', status: 'Pending' });
    console.table(stats);
    for (const Model of Object.values(mongoose.models)) console.log(`${Model.collection.name}: ${await Model.countDocuments()} records total`);
    console.log('Sample setup complete. Login: demo.admin@brightloop.test / demo.staff@brightloop.test / demo.customer@brightloop.test. Password: BRIGHTLOOP_SAMPLE_PASSWORD, or the development default documented in README.md.');
  } finally { await mongoose.disconnect(); }
}

run().catch((error) => { console.error(`Sample setup failed: ${error.message}`); process.exitCode = 1; });
