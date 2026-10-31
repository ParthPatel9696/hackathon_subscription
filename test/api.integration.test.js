const test = require('node:test');
const assert = require('node:assert/strict');

const testUri = process.env.BRIGHTLOOP_INTEGRATION_DB;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'brightloop-integration-test-secret';
process.env.MONGODB_URI = testUri || process.env.MONGODB_URI;

const mongoose = require('mongoose');
const { app } = require('../index');
const User = require('../models/User');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const Invoice = require('../models/Invoice');

test('authenticated API enforces roles, scoped search, pricing, and payment balances', {
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
      cookie: response.headers.get('set-cookie')?.split(';')[0]
    };
  };

  await User.create({ email: 'admin@test.invalid', password: 'Admin@TestPassword1!', name: 'Test Admin', role: 'admin' });
  const adminLogin = await request('/auth/login', { method: 'POST', body: { email: 'admin@test.invalid', password: 'Admin@TestPassword1!' } });
  assert.equal(adminLogin.status, 200);
  const adminCookie = adminLogin.cookie;

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

  const closureUser = await request('/auth/register', { method: 'POST', body: {
    name: 'Closing Customer', email: 'closing@test.invalid', password: 'Closing@TestPassword1!', termsAccepted: true
  } });
  assert.equal(closureUser.status, 201);
  const closeOwnAccount = await request('/customers/me', { method: 'DELETE', cookie: closureUser.cookie });
  assert.equal(closeOwnAccount.status, 200);
  const closedAccountRead = await request('/customers/me', { cookie: closureUser.cookie });
  assert.equal(closedAccountRead.status, 401);

  const customerDirectory = await request('/customers', { cookie: customerCookie });
  assert.equal(customerDirectory.status, 403);
  const deniedProductWrite = await request('/products', { method: 'POST', cookie: customerCookie, body: { name: 'Denied', salesPrice: 1 } });
  assert.equal(deniedProductWrite.status, 403);

  const productResponse = await request('/products', { method: 'POST', cookie: adminCookie, body: {
    name: 'Integration Product', type: 'software', salesPrice: 900, costPrice: 125, taxRate: 0.1
  } });
  assert.equal(productResponse.status, 201);
  const productId = productResponse.data.data._id;

  const planResponse = await request('/plans', { method: 'POST', cookie: adminCookie, body: {
    name: 'Integration Monthly', code: 'INTEGRATION-MONTHLY', product: productId, billingFrequency: 'monthly', basePrice: 200
  } });
  assert.equal(planResponse.status, 201);
  const planId = planResponse.data.data._id;

  const customerProducts = await request('/products', { cookie: customerCookie });
  assert.equal(customerProducts.status, 200);
  assert.equal(Object.hasOwn(customerProducts.data.data[0], 'costPrice'), false);

  const subscriptionResponse = await request('/subscriptions', { method: 'POST', cookie: customerCookie, body: {
    planId,
    lines: [{ productId, quantity: 1, discountAmount: 150 }]
  } });
  assert.equal(subscriptionResponse.status, 201);
  const subscription = subscriptionResponse.data.data;
  assert.equal(subscription.recurringTotal, 220);
  assert.equal(subscription.status, 'Draft');

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
  assert.ok(ownSearch.data.data.some((item) => item.type === 'Subscription'));
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
    request('/payments', { method: 'POST', cookie: adminCookie, body: { invoiceId: invoice._id, amount: 60, method: 'Bank Transfer' } }),
    request('/payments', { method: 'POST', cookie: adminCookie, body: { invoiceId: invoice._id, amount: 60, method: 'Bank Transfer' } })
  ]);
  assert.equal(concurrentPayments.filter((result) => result.status === 201).length, 1);
  const afterConcurrent = await Invoice.findById(invoice._id);
  assert.equal(afterConcurrent.paidAmount, 60);

  const draftInvoice = await Invoice.create({
    invoiceNumber: 'INT-INV-002', subscription: subscription._id, subscriptionNumber: subscription.subscriptionNumber,
    customer: registeredUser._id, customerName: 'Test Co', customerEmail: registeredUser.email,
    invoiceDate: new Date(), dueDate: new Date(Date.now() + 86400000), lines: [], subtotal: 10, taxTotal: 0,
    grandTotal: 10, status: 'Draft'
  });
  const draftPayment = await request('/payments', { method: 'POST', cookie: adminCookie, body: { invoiceId: draftInvoice._id, amount: 5, method: 'Bank Transfer' } });
  assert.equal(draftPayment.status, 400);

  const finalPayment = await request('/payments', { method: 'POST', cookie: adminCookie, body: { invoiceId: invoice._id, amount: 40, method: 'Bank Transfer' } });
  assert.equal(finalPayment.status, 201);
  assert.equal(finalPayment.data.invoice.status, 'Paid');
  assert.equal(finalPayment.data.invoice.paidAmount, 100);

  for (const targetStatus of ['Quotation', 'Confirmed', 'Active']) {
    const transition = await request('/subscriptions/transition', { method: 'POST', cookie: adminCookie, body: { id: subscription._id, targetStatus } });
    assert.equal(transition.status, 200);
  }
  const blockedArchive = await request(`/customers/${registeredUser._id}`, { method: 'DELETE', cookie: adminCookie });
  assert.equal(blockedArchive.status, 409);
  const blockedSelfClose = await request('/customers/me', { method: 'DELETE', cookie: customerCookie });
  assert.equal(blockedSelfClose.status, 409);
});
