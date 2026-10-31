const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testUri = process.env.BRIGHTLOOP_INTEGRATION_DB;
if (testUri && !/^mongodb:\/\/127\.0\.0\.1:\d+\/[a-z0-9_]*_test$/i.test(testUri)) throw new Error('Integration tests require an explicitly isolated local MongoDB database ending in _test.');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'brightloop-integration-test-secret';
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = testUri || process.env.MONGODB_URI;

const mongoose = require('mongoose');
const { app } = require('../index');
const User = require('../models/User');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const Invoice = require('../models/Invoice');
const Subscription = require('../models/Subscription');
const { runRecurringBilling } = require('../services/billingService');

test('Phase 1 backend workflows enforce roles, discounts, ownership, billing recovery, and reconciliation', {
  skip: !testUri && 'Set BRIGHTLOOP_INTEGRATION_DB to an isolated MongoDB test database URI.'
}, async (t) => {
  await mongoose.connect(testUri);
  await mongoose.connection.dropDatabase();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const request = async (path, { method = 'GET', body, cookie } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
      setCookie: response.headers.get('set-cookie')
    };
  };

  await User.create({ email: 'admin@test.invalid', password: 'Admin@TestPassword1!', name: 'Test Admin', role: 'admin' });
  const adminLogin = await request('/auth/login', { method: 'POST', body: { email: 'admin@test.invalid', password: 'Admin@TestPassword1!' } });
  assert.equal(adminLogin.status, 200);
  assert.equal(Object.hasOwn(adminLogin.data, 'token'), false);
  assert.match(adminLogin.setCookie, /HttpOnly/);
  assert.match(adminLogin.setCookie, /SameSite=Lax/);
  assert.match(adminLogin.setCookie, /Secure/);
  const adminCookie = adminLogin.cookie;
  await User.create({ email: 'staff@test.invalid', password: 'Staff@TestPassword1!', name: 'Test Staff', role: 'staff' });
  const staffLogin = await request('/auth/login', { method: 'POST', body: { email: 'staff@test.invalid', password: 'Staff@TestPassword1!' } });
  assert.equal(staffLogin.status, 200);
  const staffCookie = staffLogin.cookie;

  const registered = await request('/auth/register', { method: 'POST', body: {
    email: 'customer@test.invalid', password: 'Customer@TestPassword1!', name: 'Test Customer', companyName: 'Test Co', termsAccepted: true
  } });
  assert.equal(registered.status, 201);
  const customerCookie = registered.cookie;
  assert.ok(registered.data.user.id);
  const registeredUser = await User.findById(registered.data.user.id);
  assert.ok(registeredUser.termsAcceptedAt);

  const managedCustomer = await request('/customers', { method: 'POST', cookie: adminCookie, body: {
    name: 'Managed Customer', email: 'managed@test.invalid', password: 'Managed@TestPassword1!', companyName: 'Managed Co', phone: '555-0100'
  } });
  assert.equal(managedCustomer.status, 201);
  const managedId = managedCustomer.data.data._id;
  const managedEdit = await request(`/customers/${managedId}`, { method: 'PATCH', cookie: adminCookie, body: { billingAddress: '10 Market Street' } });
  assert.equal(managedEdit.status, 200);
  assert.equal(managedEdit.data.data.billingAddress, '10 Market Street');
  const archiveManaged = await request(`/customers/${managedId}`, { method: 'DELETE', cookie: adminCookie });
  assert.equal(archiveManaged.status, 200);
  const archivedLogin = await request('/auth/login', { method: 'POST', body: { email: 'managed@test.invalid', password: 'Managed@TestPassword1!' } });
  assert.equal(archivedLogin.status, 401);
  const archivedDirectory = await request('/customers?status=Archived&search=managed', { cookie: adminCookie });
  assert.equal(archivedDirectory.data.data.some((customer) => customer._id === managedId), true);
  assert.equal((await request('/customers', { cookie: staffCookie })).status, 200);
  assert.equal((await request(`/customers/${managedId}`, { method: 'PATCH', cookie: staffCookie, body: { name: 'Forbidden' } })).status, 403);
  assert.equal((await request('/discounts', { method: 'POST', cookie: staffCookie, body: { code: 'DENIED', name: 'Denied', discountType: 'percentage', value: 5 } })).status, 403);

  const closureUser = await request('/auth/register', { method: 'POST', body: {
    name: 'Closing Customer', email: 'closing@test.invalid', password: 'Closing@TestPassword1!', termsAccepted: true
  } });
  assert.equal(closureUser.status, 201);
  const closeOwnAccount = await request('/customers/me', { method: 'DELETE', cookie: closureUser.cookie });
  assert.equal(closeOwnAccount.status, 200);
  const closedAccountRead = await request('/customers/me', { cookie: closureUser.cookie });
  assert.equal(closedAccountRead.status, 401);
  const outsider = await request('/auth/register', { method: 'POST', body: {
    name: 'Other Customer', email: 'other@test.invalid', password: 'Other@TestPassword1!', termsAccepted: true
  } });
  assert.equal(outsider.status, 201);

  const customerDirectory = await request('/customers', { cookie: customerCookie });
  assert.equal(customerDirectory.status, 403);
  assert.equal((await request(`/customers/${managedId}`, { cookie: customerCookie })).status, 403);
  assert.equal((await request('/auth/register', { method: 'POST', body: { name: 'No Terms', email: 'no-terms@test.invalid', password: 'NoTerms@TestPassword1!' } })).status, 400);
  const deniedProductWrite = await request('/products', { method: 'POST', cookie: customerCookie, body: { name: 'Denied', salesPrice: 1 } });
  assert.equal(deniedProductWrite.status, 403);

  const productResponse = await request('/products', { method: 'POST', cookie: adminCookie, body: {
    name: 'Integration Product', type: 'software', salesPrice: 900, costPrice: 125, taxRate: 0.1, taxComponents: [], taxLabel: 'Configured tax', variants: [{ name: 'Brand', options: [{ name: 'Odoo', priceExtra: 560 }, { name: 'Retired', priceExtra: 50, isActive: false }] }]
  } });
  assert.equal(productResponse.status, 201);
  assert.equal(productResponse.data.data.taxRate, 0.1, 'An empty component list must not erase the configured tax rate.');
  const productId = productResponse.data.data._id;

  const planResponse = await request('/plans', { method: 'POST', cookie: adminCookie, body: {
    name: 'Integration Monthly', code: 'INTEGRATION-MONTHLY', product: productId, billingFrequency: 'monthly', basePrice: 200
  } });
  assert.equal(planResponse.status, 201);
  const planId = planResponse.data.data._id;

  const customerProducts = await request('/products', { cookie: customerCookie });
  assert.equal(customerProducts.status, 200);
  assert.equal(Object.hasOwn(customerProducts.data.data[0], 'costPrice'), false);

  const subscriptionResponse = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId,
    lines: [{ productId, quantity: 1, discountAmount: 150 }]
  } });
  assert.equal(subscriptionResponse.status, 201);
  const subscription = subscriptionResponse.data.data;
  assert.equal(subscription.recurringTotal, 220);
  assert.equal(subscription.status, 'Quotation');
  const parallelQuotes = await Promise.all([1, 2].map(() => request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId, lines: [{ productId, quantity: 1 }]
  } })));
  assert.equal(parallelQuotes.every((result) => result.status === 201), true);
  assert.equal(new Set(parallelQuotes.map((result) => result.data.data.subscriptionNumber)).size, 2);

  const percentageDiscount = await request('/discounts', { method: 'POST', cookie: adminCookie, body: {
    code: 'SAVE10', name: 'Ten percent off', discountType: 'percentage', value: 10, minPurchaseAmount: 100,
    minQuantity: 1, usageLimit: 1, appliesTo: 'all', startDate: new Date(Date.now() - 60_000), endDate: new Date(Date.now() + 86_400_000)
  } });
  assert.equal(percentageDiscount.status, 201);
  const discountedQuotes = await Promise.all([1, 2].map(() => request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId, discountCode: 'SAVE10', lines: [{ productId, quantity: 1, discountAmount: 999 }]
  } })));
  assert.equal(discountedQuotes.filter((result) => result.status === 201).length, 1);
  const discountedQuote = discountedQuotes.find((result) => result.status === 201);
  assert.equal((await require('../models/Discount').findOne({ code: 'SAVE10' })).timesUsed, 1);
  assert.equal(discountedQuote.data.data.discountTotal, 20);
  assert.equal(discountedQuote.data.data.recurringTotal, 198);
  assert.equal(discountedQuote.data.data.discountCode, 'SAVE10');
  const exhaustedQuote = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId, discountCode: 'SAVE10', lines: [{ productId, quantity: 1 }]
  } });
  assert.equal(exhaustedQuote.status, 400);

  const fixedDiscount = await request('/discounts', { method: 'POST', cookie: adminCookie, body: {
    code: 'FIXED50', name: 'Fifty off target product', discountType: 'fixed', value: 50, minQuantity: 2,
    usageLimit: 4, appliesTo: 'specific_product', targetProduct: productId,
    startDate: new Date(Date.now() - 60_000), endDate: new Date(Date.now() + 86_400_000)
  } });
  assert.equal(fixedDiscount.status, 201);
  const minimumFailure = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId, discountCode: 'FIXED50', lines: [{ productId, quantity: 1 }]
  } });
  assert.equal(minimumFailure.status, 400);
  const fixedQuote = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId, discountCode: 'FIXED50', lines: [{ productId, quantity: 2 }]
  } });
  assert.equal(fixedQuote.status, 201);
  assert.equal(fixedQuote.data.data.discountTotal, 50);
  assert.equal(fixedQuote.data.data.recurringTotal, 385);

  const inactiveDiscount = await request('/discounts', { method: 'POST', cookie: adminCookie, body: {
    code: 'INACTIVE', name: 'Inactive promo', discountType: 'percentage', value: 5, usageLimit: 2,
    isActive: false, startDate: new Date(Date.now() - 60_000), endDate: new Date(Date.now() + 86_400_000)
  } });
  assert.equal(inactiveDiscount.status, 201);
  const inactiveQuote = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId, discountCode: 'INACTIVE', lines: [{ productId, quantity: 1 }]
  } });
  assert.equal(inactiveQuote.status, 400);
  const enabledDiscount = await request(`/discounts/${inactiveDiscount.data.data._id}/status`, { method: 'PATCH', cookie: adminCookie, body: { isActive: true } });
  assert.equal(enabledDiscount.status, 200);
  const enabledQuote = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId, discountCode: 'INACTIVE', lines: [{ productId, quantity: 1 }]
  } });
  assert.equal(enabledQuote.status, 201);
  assert.equal(enabledQuote.data.data.recurringTotal, 209);

  const seatProductResponse = await request('/products', { method: 'POST', cookie: adminCookie, body: {
    name: 'Integration Seats', type: 'seat', salesPrice: 30, costPrice: 5, taxRate: 0.1
  } });
  assert.equal(seatProductResponse.status, 201);
  const seatDiscount = await request('/discounts', { method: 'POST', cookie: adminCookie, body: {
    code: 'SEAT10', name: 'Seat discount', discountType: 'percentage', value: 10, minQuantity: 2,
    usageLimit: 2, appliesTo: 'seats', startDate: new Date(Date.now() - 60_000), endDate: new Date(Date.now() + 86_400_000)
  } });
  assert.equal(seatDiscount.status, 201);
  const seatQuote = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId, discountCode: 'SEAT10', lines: [{ productId, quantity: 1 }, { productId: seatProductResponse.data.data._id, quantity: 2 }]
  } });
  assert.equal(seatQuote.status, 201);
  assert.equal(seatQuote.data.data.discountTotal, 6);
  assert.equal(seatQuote.data.data.recurringTotal, 279.4);

  const expiredDiscount = await request('/discounts', { method: 'POST', cookie: adminCookie, body: {
    code: 'EXPIRED', name: 'Expired promo', discountType: 'fixed', value: 5, usageLimit: 1,
    startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() - 60_000)
  } });
  assert.equal(expiredDiscount.status, 201);
  const expiredQuote = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id,
    planId, discountCode: 'EXPIRED', lines: [{ productId, quantity: 1 }]
  } });
  assert.equal(expiredQuote.status, 400);

  const profileUpdate = await request('/customers/me', { method: 'PATCH', cookie: customerCookie, body: { name: 'Updated Customer', companyName: 'Updated Co', phone: '555-0111', billingAddress: '20 River Road' } });
  assert.equal(profileUpdate.status, 200);
  assert.equal(profileUpdate.data.data.companyName, 'Updated Co');
  const ownPortfolio = await request('/customers/me', { cookie: customerCookie });
  assert.equal(ownPortfolio.status, 200);
  assert.equal(ownPortfolio.data.data.customer.billingAddress, '20 River Road');
  assert.equal(ownPortfolio.data.data.subscriptions[0].customerName, 'Updated Co');
  const adminPortfolio = await request(`/customers/${registeredUser._id}`, { cookie: adminCookie });
  assert.equal(adminPortfolio.status, 200);
  assert.equal(adminPortfolio.data.data.customer.companyName, 'Updated Co');

  const ownSearch = await request('/search?q=Updated%20Co', { cookie: customerCookie });
  assert.equal(ownSearch.status, 200);
  assert.ok(ownSearch.data.data.some((item) => ['Subscription', 'Quotation'].includes(item.type)));
  const unrelatedSearch = await request('/search?q=someone%40else.invalid', { cookie: customerCookie });
  assert.equal(unrelatedSearch.status, 200);
  assert.equal(unrelatedSearch.data.data.some((item) => item.type === 'Customer'), false);

  const invoice = await Invoice.create({
    invoiceNumber: 'INT-INV-001', subscription: subscription._id, subscriptionNumber: subscription.subscriptionNumber,
    customer: registeredUser._id, customerName: 'Test Co', customerEmail: registeredUser.email,
    invoiceDate: new Date(), dueDate: new Date(Date.now() + 86400000), lines: [], subtotal: 100, taxTotal: 0,
    grandTotal: 100, status: 'Confirmed'
  });
  const concurrentPayments = await Promise.all([
    request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: invoice._id, amount: 60, method: 'Bank Transfer' } }),
    request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: invoice._id, amount: 60, method: 'Bank Transfer' } })
  ]);
  assert.equal(concurrentPayments.filter((result) => result.status === 201).length, 1);
  const afterConcurrent = await Invoice.findById(invoice._id);
  assert.equal(afterConcurrent.paidAmount, 60);
  const excessivePayment = await request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: invoice._id, amount: 50, method: 'Bank Transfer' } });
  assert.equal(excessivePayment.status, 400);

  const referencedPayment = await request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: invoice._id, amount: 30, method: 'Bank Transfer', referenceNote: 'BANK-REC-1' } });
  assert.equal(referencedPayment.status, 201);
  const duplicateReference = await request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: invoice._id, amount: 1, method: 'Bank Transfer', referenceNote: ' bank-rec-1 ' } });
  assert.equal(duplicateReference.status, 409);

  const draftInvoice = await Invoice.create({
    invoiceNumber: 'INT-INV-002', subscription: subscription._id, subscriptionNumber: subscription.subscriptionNumber,
    customer: registeredUser._id, customerName: 'Test Co', customerEmail: registeredUser.email,
    invoiceDate: new Date(), dueDate: new Date(Date.now() + 86400000), lines: [], subtotal: 10, taxTotal: 0,
    grandTotal: 10, status: 'Draft'
  });
  const draftPayment = await request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: draftInvoice._id, amount: 5, method: 'Bank Transfer' } });
  assert.equal(draftPayment.status, 400);
  const unsupportedMethod = await request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: invoice._id, amount: 1, method: 'Unsupported method' } });
  assert.equal(unsupportedMethod.status, 400);
  const ownInvoices = await request(`/invoices?customerId=${managedId}`, { cookie: customerCookie });
  assert.equal(ownInvoices.status, 200);
  assert.equal(ownInvoices.data.data.length, 2);
  assert.equal(ownInvoices.data.data.every((item) => item.customer.toString() === registeredUser._id.toString()), true);
  const outsiderInvoices = await request('/invoices', { cookie: outsider.cookie });
  const outsiderPayments = await request('/payments', { cookie: outsider.cookie });
  const outsiderSubscriptions = await request('/subscriptions', { cookie: outsider.cookie });
  assert.equal(outsiderInvoices.data.count, 0);
  assert.equal(outsiderPayments.data.count, 0);
  assert.equal(outsiderSubscriptions.data.count, 0);
  assert.equal((await request(`/subscriptions/${subscription._id}`, { cookie: outsider.cookie })).status, 403);

  const finalPayment = await request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: invoice._id, amount: 10, method: 'Bank Transfer' } });
  assert.equal(finalPayment.status, 201);
  assert.equal(finalPayment.data.invoice.status, 'Paid');
  assert.equal(finalPayment.data.invoice.paidAmount, 100);
  assert.equal((await request(`/invoices/${invoice._id}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'Confirmed' } })).status, 400);

  for (const targetStatus of ['Confirmed', 'Active']) {
    const transition = await request('/subscriptions/transition', { method: 'POST', cookie: adminCookie, body: { id: subscription._id, targetStatus } });
    assert.equal(transition.status, 200);
  }
  const blockedArchive = await request(`/customers/${registeredUser._id}`, { method: 'DELETE', cookie: adminCookie });
  assert.equal(blockedArchive.status, 409);
  const blockedSelfClose = await request('/customers/me', { method: 'DELETE', cookie: customerCookie });
  assert.equal(blockedSelfClose.status, 409);
  assert.equal((await request('/subscriptions/transition', { method: 'POST', cookie: staffCookie, body: { id: subscription._id, targetStatus: 'Draft' } })).status, 400);

  const recoveryInvoice = await Invoice.create({
    invoiceNumber: 'INT-INV-RECOVERY', subscription: subscription._id, subscriptionNumber: subscription.subscriptionNumber,
    customer: registeredUser._id, customerName: 'Updated Co', customerEmail: registeredUser.email,
    invoiceDate: new Date(), dueDate: new Date(Date.now() + 86400000), lines: [], subtotal: 50, taxTotal: 0,
    grandTotal: 50, status: 'Confirmed'
  });
  const originalPaymentUpdate = require('../models/Payment').findOneAndUpdate;
  let failPosting = true;
  require('../models/Payment').findOneAndUpdate = async function (...args) {
    if (failPosting) { failPosting = false; throw new Error('injected payment posting failure'); }
    return originalPaymentUpdate.apply(this, args);
  };
  try {
    const partialCommit = await request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: recoveryInvoice._id, amount: 20, method: 'Bank Transfer', referenceNote: 'RECOVERY-1' } });
    assert.equal(partialCommit.status, 500);
  } finally { require('../models/Payment').findOneAndUpdate = originalPaymentUpdate; }
  const recoveredPayment = await request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: recoveryInvoice._id, amount: 20, method: 'Bank Transfer', referenceNote: 'RECOVERY-1' } });
  assert.equal(recoveredPayment.status, 201);
  assert.equal(recoveredPayment.data.payment.referenceNote, 'RECOVERY-1');
  assert.equal((await Invoice.findById(recoveryInvoice._id)).paidAmount, 20);
  const nextRecoveryPayment = await request('/payments', { method: 'POST', cookie: staffCookie, body: { invoiceId: recoveryInvoice._id, amount: 10, method: 'Bank Transfer', referenceNote: 'RECOVERY-2' } });
  assert.equal(nextRecoveryPayment.status, 201);
  assert.equal((await Invoice.findById(recoveryInvoice._id)).paidAmount, 30);
  assert.equal(await require('../models/Payment').countDocuments({ invoice: recoveryInvoice._id, status: 'pending' }), 0);

  await Subscription.updateOne({ _id: subscription._id }, { $set: {
    startDate: new Date('2025-12-02T00:00:00.000Z'), lastInvoicedDate: null,
    nextBillingDate: new Date('2026-01-02T00:00:00.000Z')
  } });
  const billingNow = new Date('2026-01-03T00:00:00.000Z');
  const billingRace = await Promise.all([
    runRecurringBilling({ actorRole: 'staff', now: billingNow }),
    runRecurringBilling({ actorRole: 'staff', now: billingNow })
  ]);
  const periodQuery = { subscription: subscription._id, billingPeriodStart: new Date('2025-12-02T00:00:00.000Z'), billingPeriodEnd: new Date('2026-01-02T00:00:00.000Z') };
  assert.equal(await Invoice.countDocuments(periodQuery), 1);
  assert.equal(billingRace.reduce((sum, result) => sum + result.createdInvoices.length, 0), 1);
  const duplicateBilling = await runRecurringBilling({ actorRole: 'staff', now: billingNow });
  assert.equal(duplicateBilling.createdInvoices.length, 0);
  assert.equal(await Invoice.countDocuments(periodQuery), 1);
  const afterFirstCycle = await Subscription.findById(subscription._id);
  assert.equal(afterFirstCycle.lastInvoicedDate.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.equal(afterFirstCycle.nextBillingDate.toISOString(), '2026-02-02T00:00:00.000Z');

  const originalUpdateOne = Subscription.updateOne;
  let failScheduleWrite = true;
  Subscription.updateOne = async function (...args) {
    if (failScheduleWrite) { failScheduleWrite = false; throw new Error('injected schedule write failure'); }
    return originalUpdateOne.apply(this, args);
  };
  try {
    const failedRun = await runRecurringBilling({ actorRole: 'staff', now: new Date('2026-02-03T00:00:00.000Z'), useTransactions: false });
    assert.match(failedRun.failedSubscriptions[0].error, /injected schedule write failure/);
  } finally { Subscription.updateOne = originalUpdateOne; }
  const partialPeriod = { subscription: subscription._id, billingPeriodStart: new Date('2026-01-02T00:00:00.000Z'), billingPeriodEnd: new Date('2026-02-02T00:00:00.000Z') };
  assert.equal(await Invoice.countDocuments(partialPeriod), 1);
  const recoveredRun = await runRecurringBilling({ actorRole: 'staff', now: new Date('2026-02-03T00:00:00.000Z'), useTransactions: false });
  assert.equal(recoveredRun.recoveredSubscriptions.length, 1);
  assert.equal(await Invoice.countDocuments(partialPeriod), 1);

  const beforeFailedInvoice = await Subscription.findById(subscription._id);
  const originalCreate = Invoice.create;
  Invoice.create = async function () { throw new Error('injected invoice creation failure'); };
  try {
    const failedRun = await runRecurringBilling({ actorRole: 'staff', now: new Date('2026-04-03T00:00:00.000Z'), useTransactions: false });
    assert.match(failedRun.failedSubscriptions[0].error, /injected invoice creation failure/);
  } finally { Invoice.create = originalCreate; }
  const afterFailedInvoice = await Subscription.findById(subscription._id);
  assert.equal(afterFailedInvoice.nextBillingDate.toISOString(), beforeFailedInvoice.nextBillingDate.toISOString());
  const retriedInvoiceRun = await runRecurringBilling({ actorRole: 'staff', now: new Date('2026-04-03T00:00:00.000Z'), useTransactions: false });
  assert.equal(retriedInvoiceRun.createdInvoices.length, 2);

  // Review regressions: catalogue rules, variants and editable template lines.
  assert.equal((await request('/subscriptions', { method: 'POST', cookie: customerCookie, body: { planId, lines: [{ productId, quantity: 1 }] } })).status, 403);
  const staffProduct = await request(`/products/${productId}`, { cookie: staffCookie });
  assert.equal(Object.hasOwn(staffProduct.data.data, 'costPrice'), false);
  const variantQuote = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id, planId, lines: [{ productId, quantity: 1, variantName: 'Odoo' }] } });
  assert.equal(variantQuote.status, 201);
  assert.equal(variantQuote.data.data.recurringTotalMinor, 83600);
  assert.equal(variantQuote.data.data.lines[0].taxLabel, 'Configured tax');
  assert.equal((await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id, planId, lines: [{ productId, quantity: 1, variantName: 'Retired' }] } })).status, 400);
  const template = await request('/quotation-templates', { method: 'POST', cookie: adminCookie, body: { name: 'Integration bundle', plan: planId, validityDays: 20, lines: [{ product: productId, quantity: 1 }, { product: seatProductResponse.data.data._id, quantity: 1 }] } });
  assert.equal(template.status, 201);
  const customized = await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id, templateId: template.data.data._id, lines: [{ productId, quantity: 3 }, { productId: seatProductResponse.data.data._id, quantity: 2 }] } });
  assert.equal(customized.status, 201);
  assert.equal(customized.data.data.plan, planId);
  assert.equal(customized.data.data.lines.length, 2);
  assert.equal(customized.data.data.lines[0].quantity, 3);
  await Plan.updateOne({ _id: planId }, { $set: { isActive: false } });
  assert.equal((await request('/subscriptions', { method: 'POST', cookie: staffCookie, body: { customerId: registeredUser._id, planId, lines: [{ productId, quantity: 1 }] } })).status, 409);
  await Plan.updateOne({ _id: planId }, { $set: { isActive: true } });

  // A cancellation must never strand a standalone writer's pending payment.
  const lockedInvoice = await Invoice.create({ invoiceNumber: 'INT-LOCKED', subscription: subscription._id, subscriptionNumber: subscription.subscriptionNumber, customer: registeredUser._id, customerName: 'Test', customerEmail: registeredUser.email, dueDate: new Date(), subtotal: 10, grandTotal: 10, status: 'Confirmed', paymentLockId: 'review-lock', paymentLockExpiresAt: new Date(Date.now() + 60000) });
  assert.equal((await request(`/invoices/${lockedInvoice._id}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'Cancelled' } })).status, 409);
  await Invoice.updateOne({ _id: lockedInvoice._id }, { $set: { paymentLockId: null, paymentLockExpiresAt: null } });
  const pending = await require('../models/Payment').create({ invoice: lockedInvoice._id, invoiceNumber: lockedInvoice.invoiceNumber, amount: 1, amountMinor: 100, method: 'Cash', status: 'pending', balanceBeforeMinor: 0, balanceAfterMinor: 100 });
  assert.equal((await request(`/invoices/${lockedInvoice._id}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'Cancelled' } })).status, 409);
  assert.equal((await request('/search?q=INT-LOCKED', { cookie: staffCookie })).data.data.some((row) => row.type === 'Payment'), false);
  await require('../models/Payment').deleteOne({ _id: pending._id });

  // Summary and CSV must include all rows, not a single 50-row list response.
  await Invoice.insertMany(Array.from({ length: 52 }, (_, index) => ({ invoiceNumber: `INT-REPORT-${index}`, subscription: subscription._id, subscriptionNumber: subscription.subscriptionNumber, customer: registeredUser._id, customerName: index === 0 ? '=1+1' : 'Report customer', customerEmail: registeredUser.email, invoiceDate: new Date('2020-05-10T00:00:00Z'), dueDate: new Date('2020-06-10T00:00:00Z'), subtotal: 1.01, subtotalMinor: 101, grandTotal: 1.01, grandTotalMinor: 101, paidAmount: 0, paidAmountMinor: 0, status: 'Confirmed' })));
  const report = await request('/reports/finance?startDate=2020-05-01&endDate=2020-05-31', { cookie: staffCookie });
  assert.equal(report.status, 200);
  assert.equal(report.data.summary.invoices, 52);
  assert.equal(report.data.summary.outstanding, 52.52);
  assert.equal(report.data.summary.overdueCount, 52);
  assert.equal(report.data.monthly[0].invoiced, 52.52);
  assert.equal((await request('/reports/finance', { cookie: customerCookie })).status, 403);
  assert.equal((await request('/reports/finance?startDate=invalid', { cookie: staffCookie })).status, 400);
  const csv = await fetch(`${baseUrl}/reports/finance/export?startDate=2020-05-01&endDate=2020-05-31`, { headers: { Cookie: staffCookie } });
  assert.equal(csv.status, 200);
  const csvText = await csv.text();
  assert.equal(csvText.trim().split('\r\n').length, 53);
  assert.ok(csvText.includes('"\'=1+1"'), 'CSV must escape spreadsheet formula cells.');
  const pdf = await fetch(`${baseUrl}/invoices/${invoice._id}/pdf`, { headers: { Cookie: customerCookie } });
  assert.equal(pdf.status, 200);
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await fetch(`${baseUrl}/invoices/${invoice._id}/pdf`, { headers: { Cookie: outsider.cookie } })).status, 404);

  const beforeResume = await Subscription.findById(subscription._id);
  await request('/subscriptions/transition', { method: 'POST', cookie: staffCookie, body: { id: subscription._id, targetStatus: 'Paused' } });
  assert.equal((await request('/subscriptions/transition', { method: 'POST', cookie: staffCookie, body: { id: subscription._id, targetStatus: 'Active' } })).status, 200);
  const resumed = await Subscription.findById(subscription._id);
  assert.ok(resumed.nextBillingDate > beforeResume.nextBillingDate);
  assert.ok(resumed.lastInvoicedDate > beforeResume.lastInvoicedDate);
  const nonDebts = await Invoice.insertMany([
    { invoiceNumber: 'INT-ZERO-DUE', grandTotal: 0, grandTotalMinor: 0, paidAmountMinor: 0, status: 'Confirmed', dueDate: new Date('2020-01-01') },
    { invoiceNumber: 'INT-SETTLED-LABEL', grandTotal: 10, grandTotalMinor: 1000, paidAmount: 10, paidAmountMinor: 1000, status: 'Overdue', dueDate: new Date('2020-01-01') },
    { invoiceNumber: 'INT-FUTURE-LABEL', grandTotal: 10, grandTotalMinor: 1000, status: 'Overdue', dueDate: new Date('2099-01-01') }
  ].map((row) => ({ subscription: subscription._id, subscriptionNumber: subscription.subscriptionNumber, customer: registeredUser._id, customerName: 'Review', customerEmail: registeredUser.email, subtotal: row.grandTotal, ...row })));
  const overview = await request('/dashboard/metrics', { cookie: staffCookie });
  const overdueRows = (await Invoice.find({ status: { $in: ['Confirmed', 'Overdue'] }, dueDate: { $lt: new Date() } }).lean()).filter((row) => (row.grandTotalMinor ?? Math.round(row.grandTotal * 100)) > (row.paidAmountMinor ?? Math.round((row.paidAmount || 0) * 100)));
  assert.equal(overview.data.metrics.overdueCount, overdueRows.length);
  const notices = await request('/notifications', { cookie: customerCookie });
  assert.equal(notices.data.data.some((notice) => nonDebts.some((row) => String(row._id) === notice.id)), false);

  const forgottenExisting = await request('/auth/forgot-password', { method: 'POST', body: { email: 'customer@test.invalid' } });
  const forgottenUnknown = await request('/auth/forgot-password', { method: 'POST', body: { email: 'missing@test.invalid' } });
  assert.equal(forgottenExisting.data.message, forgottenUnknown.data.message);
  assert.equal(Object.hasOwn(forgottenExisting.data, 'simulatedResetUrl'), false);
  const resetToken = 'phase-one-reset-verification-token';
  registeredUser.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  registeredUser.resetPasswordExpires = new Date(Date.now() + 60_000);
  await registeredUser.save();
  const resetResponse = await request('/auth/reset-password', { method: 'POST', body: { token: resetToken, password: 'Changed@TestPassword1!' } });
  assert.equal(resetResponse.status, 200);
  assert.equal((await request('/auth/me', { cookie: customerCookie })).status, 401);
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'customer@test.invalid', password: 'Changed@TestPassword1!' } })).status, 200);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const deniedLogin = await request('/auth/login', { method: 'POST', body: { email: 'admin@test.invalid', password: 'wrong-password' } });
    assert.equal(deniedLogin.status, 401);
  }
  const throttledLogin = await request('/auth/login', { method: 'POST', body: { email: 'admin@test.invalid', password: 'wrong-password' } });
  assert.equal(throttledLogin.status, 429);
  const loggedOut = await request('/auth/logout', { method: 'POST', cookie: adminCookie });
  assert.equal(loggedOut.status, 200);
  const revokedSession = await request('/auth/me', { cookie: adminCookie });
  assert.equal(revokedSession.status, 401);
});
