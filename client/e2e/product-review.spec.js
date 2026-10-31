import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mongoose = require('../../node_modules/mongoose');
const User = require('../../models/User');

const api = 'http://127.0.0.1:5019/api';
const sessions = {};
let records;

test.beforeAll(async ({ request }) => {
  await mongoose.connect(process.env.BRIGHTLOOP_BROWSER_DB);
  await mongoose.connection.dropDatabase();
  const users = {};
  for (const role of ['admin', 'staff', 'customer']) {
    users[role] = await User.create({ name: `Review ${role}`, email: `${role}@browser.test`, password: 'Review@Secure2026!', role, companyName: role === 'customer' ? 'Review Company' : '' });
    const login = await request.post(`${api}/auth/login`, { data: { email: `${role}@browser.test`, password: 'Review@Secure2026!' } });
    expect(login.status()).toBe(200);
    sessions[role] = (await request.storageState()).cookies;
  }
  const headers = { Cookie: sessions.admin.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ') };
  const post = async (path, data) => {
    const response = await request.post(`${api}${path}`, { headers, data });
    const result = await response.json();
    expect(response.ok(), JSON.stringify(result)).toBeTruthy();
    return result;
  };
  const product = (await post('/products', { name: 'Review Software', salesPrice: 900, costPrice: 125, taxRate: 0.1, taxComponents: [], variants: [{ name: 'Brand', options: [{ name: 'Odoo', priceExtra: 560 }] }] })).data;
  const addon = (await post('/products', { name: 'Review Support', salesPrice: 100, taxRate: 0 })).data;
  const plan = (await post('/plans', { name: 'Review Monthly', code: 'REVIEW-MONTHLY', product: product._id, basePrice: 200, billingFrequency: 'monthly' })).data;
  await post('/quotation-templates', { name: 'Review bundle', plan: plan._id, validityDays: 15, lines: [{ product: product._id, quantity: 2, variantName: 'Odoo' }, { product: addon._id, quantity: 1 }] });
  const subscription = (await post('/subscriptions', { customerId: users.customer._id, planId: plan._id, lines: [{ productId: product._id, quantity: 2, variantName: 'Odoo' }] })).data;
  expect(subscription.recurringTotal).toBe(1672);
  for (const targetStatus of ['Confirmed', 'Active']) await post('/subscriptions/transition', { id: subscription._id, targetStatus });
  const batch = await post('/billing/run-batch', { forceAllActive: true });
  const invoice = batch.invoices[0];
  expect(invoice.status).toBe('Draft');
  const confirmed = await request.patch(`${api}/invoices/${invoice._id}/status`, { headers, data: { status: 'Confirmed' } });
  expect(confirmed.status()).toBe(200);
  const payment = (await post('/payments', { invoiceId: invoice._id, amount: 500, method: 'UPI', referenceNote: 'BROWSER-REVIEW-001' })).payment;
  records = { customer: users.customer._id.toString(), product: product._id, plan: plan._id, subscription: subscription._id, invoice: invoice._id, payment: payment._id };
  await mongoose.disconnect();
});

test.afterAll(async () => {
  await mongoose.connect(process.env.BRIGHTLOOP_BROWSER_DB);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function checkPage(page, path, errors) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByText('Loading workspace…', { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `Horizontal page overflow at ${path}` }).toBeTruthy();
  expect(errors, `Runtime errors at ${path}`).toEqual([]);
}

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.url().startsWith(api) && response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  return errors;
}

for (const width of [1366, 390]) {
  test(`public pages and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = watchErrors(page);
    for (const path of ['/', '/features', '/pricing', '/about', '/contact', '/privacy', '/terms', '/login', '/register', '/forgot-password', '/reset-password', '/unauthorized', '/session-expired', '/account-closed', '/404', '/500']) await checkPage(page, path, errors);
    await page.goto('/');
    if (width < 800) await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Product', exact: true }).click();
    await expect(page).toHaveURL(/\/features$/);
    await page.screenshot({ path: test.info().outputPath(`public-${width}.png`), fullPage: true });
  });
  for (const role of ['admin', 'staff', 'customer']) {
    test(`${role} pages at ${width}px`, async ({ context, page }) => {
      await context.addCookies(sessions[role]);
      await page.setViewportSize({ width, height: 900 });
      const errors = watchErrors(page);
      const paths = ['/app/dashboard', '/app/plans', `/app/plans/${records.plan}`, '/app/subscriptions', `/app/subscriptions/${records.subscription}`, '/app/invoices', `/app/invoices/${records.invoice}`, '/app/payments', `/app/payments/${records.payment}`, '/app/subscription-requests', '/app/notifications', '/app/settings'];
      if (role !== 'customer') paths.push('/app/customers', `/app/customers/${records.customer}`, '/app/products', `/app/products/${records.product}`, '/app/quotations', '/app/activity', '/app/reports', '/app/billing-calendar', '/app/subscription-health', '/app/revenue-analytics');
      if (role === 'admin') paths.push('/app/quotation-templates', '/app/discounts', '/app/staff');
      for (const path of paths) await checkPage(page, path, errors);
      await page.goto('/app/dashboard');
      await page.screenshot({ path: test.info().outputPath(`${role}-${width}.png`), fullPage: true });
      if (role === 'customer') { await page.goto('/app/customers'); await expect(page).toHaveURL(/\/unauthorized$/); }
      if (role === 'staff') { await page.goto('/app/staff'); await expect(page).toHaveURL(/\/unauthorized$/); }
    });
  }
}

test('template lines, dialog keyboard focus, filtered CSV and invoice payment', async ({ context, page }) => {
  await context.addCookies(sessions.admin);
  const errors = watchErrors(page);
  await page.goto('/app/quotation-templates');
  await expect(page.getByText('Review bundle', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Subscriptions', exact: true }).click();
  await page.getByRole('button', { name: 'New quotation' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Quotation template', { exact: true }).selectOption({ label: 'Review bundle · 15 days' });
  await expect(dialog.getByLabel('Product 2', { exact: true })).toBeVisible();
  await dialog.getByLabel('Quantity 1', { exact: true }).fill('3');
  await dialog.getByLabel('Customer', { exact: true }).selectOption(records.customer);
  await dialog.getByRole('button', { name: 'Create quotation', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/app/products');
  await page.getByLabel('Filter by status', { exact: true }).selectOption('Active');
  await expect(page.getByRole('link', { name: 'Review Software', exact: true })).toBeVisible();
  await page.goto(`/app/invoices/${records.invoice}`);
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  const paymentDialog = page.getByRole('dialog');
  await page.keyboard.press('Shift+Tab');
  await expect(paymentDialog.getByRole('button', { name: 'Record payment', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(paymentDialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Record payment', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await paymentDialog.getByLabel('Amount', { exact: true }).fill('1172');
  await paymentDialog.getByLabel('Transaction reference / notes').fill('BROWSER-FINAL-002');
  await paymentDialog.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expect(paymentDialog).toHaveCount(0);
  await expect(page.locator('h1 + p')).toContainText('Paid');
  await page.goto('/app/invoices');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('invoices.csv');
  await page.goto('/app/reports');
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export invoices CSV', exact: true }).click();
  expect((await reportDownload).suggestedFilename()).toBe('brightloop-invoices-INR.csv');
  expect(errors).toEqual([]);
});

test('customer registration opens the isolated customer portal', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/register');
  await page.getByLabel('Full name', { exact: true }).fill('New Review Customer');
  await page.getByLabel('Email address', { exact: true }).fill('registered@browser.test');
  await page.getByLabel('Password', { exact: true }).fill('Registration@Secure2026!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Registration@Secure2026!');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.locator('h1')).toContainText('New Review Customer');
  await expect(page.getByRole('link', { name: 'Customers', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('switching accounts clears cached business queries', async ({ context, page }) => {
  await context.addCookies(sessions.admin);
  await page.goto('/app/invoices');
  await page.waitForLoadState('networkidle');
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill('customer@browser.test');
  await page.getByLabel('Password', { exact: true }).fill('Review@Secure2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('h1')).toContainText('Review customer');
  const response = page.waitForResponse((result) => result.url().startsWith(`${api}/invoices?`) && result.status() === 200);
  await page.getByRole('link', { name: 'Invoices', exact: true }).click();
  const data = await (await response).json();
  expect(data.data.every((invoice) => invoice.customer === records.customer)).toBeTruthy();
});
