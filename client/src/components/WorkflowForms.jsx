import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import Modal, { Field, FormError, SelectField } from './Modal';
import { useAuthStore } from '../store';
import { formatCurrency, toMinorUnits } from '../utils/locale';
import VariantEditor from './VariantEditor';

function useSubmit(endpoint, method = 'post', invalidate = []) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api[method](endpoint, payload),
    onSuccess: () => [...new Set([...invalidate.map((key) => key.replace(/^\//, '')), 'finance-report', 'customer-me', 'customer', 'invoice-detail', 'subscription', 'subscription-invoices', 'subscription-payments', 'product', 'plan', 'billing-calendar', 'subscription-health', 'revenue-intelligence'])].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  });
}
const currencyMinor = (minor) => formatCurrency(minor / 100);

export { default as SubscriptionForm } from './QuotationForm';

export function CustomerForm({ customer, onClose }) {
  const editing = Boolean(customer?._id);
  const staff = useQuery({ queryKey: ['staff'], queryFn: async () => (await api.get('/staff')).data.data });
  const [form, setForm] = useState({
    name: customer?.name || '', email: customer?.email || '', companyName: customer?.companyName || '',
    alternateEmail: customer?.alternateEmail || '', customerType: customer?.customerType || 'business', phone: customer?.phone || '', alternatePhone: customer?.alternatePhone || '', website: customer?.website || '', taxId: customer?.taxId || '', billingContactName: customer?.billingContactName || '', billingContactEmail: customer?.billingContactEmail || '', billingContactPhone: customer?.billingContactPhone || '', billingAddress: customer?.billingAddress || '', billingAddressLine2: customer?.billingAddressLine2 || '', billingCity: customer?.billingCity || '', billingState: customer?.billingState || '', billingPostalCode: customer?.billingPostalCode || '', billingCountry: customer?.billingCountry || 'India', shippingAddress: customer?.shippingAddress || '', preferredPaymentMethod: customer?.preferredPaymentMethod || '', paymentTerms: customer?.paymentTerms || 'Net 30 Days', assignedStaff: customer?.assignedStaff?._id || customer?.assignedStaff || '', accountStatus: customer?.accountStatus || 'Active', password: ''
  });
  const mutation = useSubmit(editing ? `/customers/${customer._id}` : '/customers', editing ? 'patch' : 'post', ['customers', 'customer', 'global-search']);
  const submit = (event) => {
    event.preventDefault();
    const payload = { ...form };
    if (editing) delete payload.password;
    mutation.mutate(payload, { onSuccess: onClose });
  };
  return <Modal title={editing ? 'Edit customer' : 'Add customer'} onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <Field label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
    <Field label="Email address" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
    <Field label="Company" value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
    <SelectField label="Customer type" value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value })}><option value="business">Business</option><option value="individual">Individual</option></SelectField>
    <Field label="Phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
    <Field label="Alternate phone" type="tel" value={form.alternatePhone} onChange={(event) => setForm({ ...form, alternatePhone: event.target.value })} />
    <Field label="Alternate email" type="email" value={form.alternateEmail} onChange={(event) => setForm({ ...form, alternateEmail: event.target.value })} />
    <Field label="Website" type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
    <Field label="GSTIN / tax ID" value={form.taxId} onChange={(event) => setForm({ ...form, taxId: event.target.value })} />
    <Field label="Billing contact name" value={form.billingContactName} onChange={(event) => setForm({ ...form, billingContactName: event.target.value })} />
    <Field label="Billing contact email" type="email" value={form.billingContactEmail} onChange={(event) => setForm({ ...form, billingContactEmail: event.target.value })} />
    <Field label="Billing contact phone" type="tel" value={form.billingContactPhone} onChange={(event) => setForm({ ...form, billingContactPhone: event.target.value })} />
    <Field label="Billing address line 1" className="sm:col-span-2"><textarea className="field min-h-16" value={form.billingAddress} onChange={(event) => setForm({ ...form, billingAddress: event.target.value })} /></Field>
    <Field label="Billing address line 2" value={form.billingAddressLine2} onChange={(event) => setForm({ ...form, billingAddressLine2: event.target.value })} />
    <Field label="City" value={form.billingCity} onChange={(event) => setForm({ ...form, billingCity: event.target.value })} />
    <Field label="State" value={form.billingState} onChange={(event) => setForm({ ...form, billingState: event.target.value })} />
    <Field label="PIN code" value={form.billingPostalCode} onChange={(event) => setForm({ ...form, billingPostalCode: event.target.value })} />
    <Field label="Country" value={form.billingCountry} onChange={(event) => setForm({ ...form, billingCountry: event.target.value })} />
    <Field label="Shipping address" className="sm:col-span-2"><textarea className="field min-h-16" value={form.shippingAddress} onChange={(event) => setForm({ ...form, shippingAddress: event.target.value })} /></Field>
    <SelectField label="Preferred payment method" value={form.preferredPaymentMethod} onChange={(event) => setForm({ ...form, preferredPaymentMethod: event.target.value })}><option value="">Not specified</option>{['UPI','Bank transfer','Card','Cheque','Cash','Other'].map((method) => <option key={method}>{method}</option>)}</SelectField>
    <SelectField label="Payment terms" value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })}>{['Due on Receipt','Net 15 Days','Net 30 Days','Net 45 Days','Net 60 Days'].map((term) => <option key={term}>{term}</option>)}</SelectField>
    {staff.data && <SelectField label="Assigned staff" value={form.assignedStaff} onChange={(event) => setForm({ ...form, assignedStaff: event.target.value || null })}><option value="">Unassigned</option>{staff.data.filter((person) => person.accountStatus !== 'Archived').map((person) => <option key={person._id} value={person._id}>{person.name} · {person.email}</option>)}</SelectField>}
    {editing && <label className="grid gap-1.5 text-sm font-medium text-slate-700">Account status<select className="field" value={form.accountStatus} onChange={(event) => setForm({ ...form, accountStatus: event.target.value })}><option>Active</option><option>Archived</option></select></label>}
    {!editing && <><Field label="Initial password" type="password" minLength="9" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><p className="field-hint self-end">At least 9 characters with uppercase, lowercase, and a symbol. The customer can change it through password recovery.</p></>}
    <div className="sm:col-span-2"><FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to save this customer.')} /><button className="button mt-3 w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save customer' : 'Create customer'}</button></div>
  </form></Modal>;
}

export function TransitionForm({ subscription, onClose }) {
  const [targetStatus, setTargetStatus] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useSubmit('/subscriptions/transition', 'post', ['subscriptions', '/subscriptions', 'notifications', 'metrics']);
  const nextStatuses = { Draft: ['Quotation', 'Cancelled'], Quotation: ['Confirmed', 'Draft', 'Cancelled', 'Expired'], Confirmed: ['Active', 'Cancelled'], Active: ['Paused', 'Closed'], Paused: ['Active', 'Closed'], Closed: [] }[subscription.status] || [];
  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({ id: subscription._id, targetStatus, reason }, { onSuccess: onClose });
  };
  return <Modal title={`Change ${subscription.subscriptionNumber}`} onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    <p className="text-sm text-slate-500">Current status: <strong>{subscription.status}</strong></p>
    <SelectField label="Next status" required value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)}><option value="">Select status</option>{nextStatuses.map((status) => <option key={status}>{status}</option>)}</SelectField>
    <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason" />
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to change subscription status.')} />
    <button className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Confirm transition'}</button>
  </form></Modal>;
}

export function PlanChangeForm({ subscription, onClose }) {
  const queryClient = useQueryClient();
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/plans')).data });
  const [planId, setPlanId] = useState('');
  const [quantity, setQuantity] = useState(String(subscription.lines?.[0]?.quantity || 1));
  const [timing, setTiming] = useState('immediate');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const previewMutation = useMutation({ mutationFn: async () => (await api.post(`/subscriptions/${subscription._id}/plan-change/preview`, { planId, quantity: Number(quantity), timing })).data });
  const changeMutation = useMutation({ mutationFn: async () => (await api.post(`/subscriptions/${subscription._id}/plan-change`, { planId, quantity: Number(quantity), timing, reason })).data, onSuccess: async () => { await Promise.all(['subscriptions', '/subscriptions', 'customer', 'metrics', 'subscription-health'].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))); onClose(); } });
  const submitPreview = (event) => { event.preventDefault(); setPreview(null); previewMutation.mutate(undefined, { onSuccess: (result) => setPreview(result.data) }); };
  return <Modal title={`Change plan · ${subscription.subscriptionNumber}`} onClose={onClose}><form onSubmit={submitPreview} className="grid gap-4">
    <p className="text-sm text-slate-600">Current plan: <strong>{subscription.planName}</strong> · {formatCurrency(subscription.recurringTotal)} / {subscription.billingFrequency}</p>
    <SelectField label="New plan" required value={planId} onChange={(e) => { setPlanId(e.target.value); setPreview(null); }}><option value="">Choose an eligible plan</option>{plans?.data?.filter((plan) => subscription.lines?.some((line) => String(line.product?._id || line.product) === String(plan.product?._id || plan.product))).map((plan) => <option key={plan._id} value={plan._id}>{plan.name} · {formatCurrency(plan.basePrice)} / {plan.billingFrequency}</option>)}</SelectField>
    <Field label="Quantity" type="number" min="1" step="1" required value={quantity} onChange={(e) => { setQuantity(e.target.value); setPreview(null); }} />
    <SelectField label="Effective timing" value={timing} onChange={(e) => { setTiming(e.target.value); setPreview(null); }}><option value="immediate">Immediately · prorated for remaining period</option><option value="next_cycle">Next billing cycle · no current-period adjustment</option></SelectField>
    <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional internal reason" />
    {preview && <div className="billing-preview"><div><span>New recurring amount</span><strong>{formatCurrency(preview.nextRecurringAmount)} / period</strong></div><div><span>{preview.prorationMinor < 0 ? 'Credit recorded' : 'Proration adjustment'}</span><strong>{formatCurrency(Math.abs(preview.prorationMinor) / 100)}{preview.prorationMinor < 0 ? ' credit' : ''}</strong></div><p>{preview.policy}</p><p>No payment is collected and no refund is issued automatically.</p></div>}
    <FormError message={previewMutation.error?.response?.data?.error || changeMutation.error?.response?.data?.error || (previewMutation.isError || changeMutation.isError ? 'Unable to calculate or save this change.' : '')} />
    {preview ? <button type="button" className="button" disabled={changeMutation.isPending} onClick={() => changeMutation.mutate()}>{changeMutation.isPending ? 'Saving…' : timing === 'next_cycle' ? 'Schedule plan change' : 'Confirm plan change'}</button> : <button className="button" disabled={previewMutation.isPending || !planId}>{previewMutation.isPending ? 'Calculating…' : 'Preview change'}</button>}
  </form></Modal>;
}

export function PaymentForm({ onClose, initialInvoice }) {
  const [search, setSearch] = useState('');
  const invoiceQuery = useQuery({ queryKey: ['invoices', 'payment-picker', search], queryFn: async () => (await api.get('/invoices', { params: { search, payable: true, limit: 50 } })).data });
  const invoices = invoiceQuery.data;
  const [form, setForm] = useState({ invoiceId: initialInvoice?._id || '', amount: '', method: 'Bank transfer', referenceNote: '', paymentDate: '' });
  const mutation = useSubmit('/payments', 'post', ['payments', 'invoices', '/payments', '/invoices', 'metrics', 'notifications']);
  const options = [...(invoices?.data || [])];
  if (initialInvoice && !options.some((item) => item._id === initialInvoice._id)) options.unshift(initialInvoice);
  const invoice = options.find((item) => item._id === form.invoiceId);
  const outstanding = invoice ? Math.max(0, (invoice.grandTotalMinor ?? toMinorUnits(invoice.grandTotal || 0)) - (invoice.paidAmountMinor ?? toMinorUnits(invoice.paidAmount || 0))) / 100 : null;
  const submit = (event) => { event.preventDefault(); mutation.mutate({ ...form, amount: Number(form.amount), paymentDate: form.paymentDate || undefined }, { onSuccess: onClose }); };
  return <Modal title="Record payment" onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    <Field label="Find invoice" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice number or customer" />
    {invoiceQuery.isLoading && <p role="status">Loading payable invoices…</p>}
    {invoiceQuery.isError && <p className="error" role="alert">Invoices could not be loaded. <button type="button" className="inline-action" onClick={() => invoiceQuery.refetch()}>Retry</button></p>}
    <SelectField label="Invoice" required value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}><option value="">Select an invoice</option>{options.filter((item) => ['Confirmed', 'Overdue'].includes(item.status)).map((item) => <option key={item._id} value={item._id}>{item.invoiceNumber} — {formatCurrency(item.grandTotal - (item.paidAmount || 0))} outstanding</option>)}</SelectField>
    <Field label="Amount" type="number" min="0.01" step="0.01" max={outstanding || undefined} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
    <SelectField label="Payment method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>UPI</option><option>Bank transfer</option><option>Card</option><option>Cheque</option><option>Cash</option><option>Other</option></SelectField>
    <Field label="Payment date" type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
    <Field label="Transaction reference / notes" value={form.referenceNote} onChange={(e) => setForm({ ...form, referenceNote: e.target.value })} />
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to record payment.')} />
    <button className="button" disabled={mutation.isPending || !invoice || !['Confirmed', 'Overdue'].includes(invoice.status)}>{mutation.isPending ? 'Recording...' : 'Record payment'}</button>
  </form></Modal>;
}

export function DiscountForm({ onClose }) {
  const [form, setForm] = useState({ code: '', name: '', discountType: 'percentage', value: '', minPurchaseAmount: 0, minQuantity: 0, startDate: '', endDate: '', usageLimit: 100, appliesTo: 'all' });
  const mutation = useSubmit('/discounts', 'post', ['discounts', '/discounts']);
  const submit = (event) => { event.preventDefault(); mutation.mutate({ ...form, value: Number(form.value), minPurchaseAmount: Number(form.minPurchaseAmount), minQuantity: Number(form.minQuantity), usageLimit: Number(form.usageLimit), startDate: form.startDate || undefined, endDate: form.endDate || undefined }, { onSuccess: onClose }); };
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  return <Modal title="Create discount" onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <Field label="Code" required value={form.code} onChange={update('code')} />
    <Field label="Name" required value={form.name} onChange={update('name')} />
    <SelectField label="Type" value={form.discountType} onChange={update('discountType')}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></SelectField>
    <Field label={form.discountType === 'percentage' ? 'Percentage value' : 'Amount'} type="number" min="0" step="0.01" required value={form.value} onChange={update('value')} />
    <Field label="Minimum purchase" type="number" min="0" step="0.01" value={form.minPurchaseAmount} onChange={update('minPurchaseAmount')} />
    <Field label="Minimum quantity" type="number" min="0" value={form.minQuantity} onChange={update('minQuantity')} />
    <Field label="Start date" type="date" value={form.startDate} onChange={update('startDate')} />
    <Field label="Expiry date" type="date" value={form.endDate} onChange={update('endDate')} />
    <Field label="Usage limit" type="number" min="1" value={form.usageLimit} onChange={update('usageLimit')} />
    <SelectField label="Applies to" value={form.appliesTo} onChange={update('appliesTo')}><option value="all">All products</option><option value="specific_product">Specific product</option><option value="seats">Seats</option></SelectField>
    <div className="sm:col-span-2"><FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to create discount.')} /><button className="button mt-3 w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Creating...' : 'Create discount'}</button></div>
  </form></Modal>;
}

export function ProductForm({ product, onClose }) {
  const workspaceSettings = useQuery({ queryKey: ['workspace-settings'], queryFn: async () => (await api.get('/settings/workspace')).data.data });
  const initial = {
    sku: product?.sku || '', name: product?.name || '', shortDescription: product?.shortDescription || '', description: product?.description || '', category: product?.category || '', imageUrl: product?.imageUrl || '', type: product?.type || 'software', salesPrice: product?.salesPrice ?? '',
    costPrice: product?.costPrice ?? '', taxRate: product?.taxRate ?? '', taxLabel: product?.taxLabel || '', notes: product?.notes || '', isActive: product?.isActive ?? true, billingEligible: product?.billingEligible ?? true,
    taxComponents: JSON.stringify(product?.taxComponents || [], null, 2), variants: JSON.stringify(product?.variants || [], null, 2)
  };
  const [form, setForm] = useState(initial);
  const [variantError, setVariantError] = useState('');
  const editing = Boolean(product?._id);
  const mutation = useSubmit(editing ? `/products/${product._id}` : '/products', editing ? 'patch' : 'post', ['/products']);
  const submit = (event) => {
    event.preventDefault(); setVariantError('');
    let variants; let taxComponents;
    try { variants = JSON.parse(form.variants || '[]'); if (!Array.isArray(variants)) throw new Error('Variants must be a JSON array.'); taxComponents = JSON.parse(form.taxComponents || '[]'); if (!Array.isArray(taxComponents)) throw new Error('Tax components must be a JSON array.'); }
    catch (error) { setVariantError(error.message || 'Enter valid JSON.'); return; }
    const taxRate = taxComponents.length ? taxComponents.reduce((sum, component) => sum + Number(component.rate || 0), 0) : form.taxRate === '' ? undefined : Number(form.taxRate);
    mutation.mutate({ ...form, salesPrice: Number(form.salesPrice), costPrice: Number(form.costPrice || 0), taxRate, taxComponents, variants }, { onSuccess: onClose });
  };
  return <Modal title={editing ? 'Edit product' : 'Add product'} onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <Field label="Product name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/>
    <Field label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}/>
    <Field label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}/>
    <Field label="Short description" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}/>
    <Field label="Image URL" type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}/>
    <SelectField label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="software">Software</option><option value="service">Service</option><option value="addon">Add-on</option><option value="seat">Seat</option></SelectField>
    <Field label="Sales price (INR)" type="number" min="0" step="0.01" required value={form.salesPrice} onChange={(e) => setForm({ ...form, salesPrice: e.target.value })}/>
    <Field label="Tax rate (decimal, 0–1)" type="number" min="0" max="1" step="0.001" value={form.taxRate === '' ? workspaceSettings.data?.defaultTaxRate ?? 0 : form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })}/>
    <Field label="Tax label" value={form.taxLabel} onChange={(e) => setForm({ ...form, taxLabel: e.target.value })} placeholder="Configurable business label"/>
    <Field label="Cost price (INR, admin only)" type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })}/>
    <Field label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/>
    <Field label="Full description" className="sm:col-span-2"><textarea className="field min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></Field>
    <div className="flex gap-4 sm:col-span-2">{[['isActive','Active'],['billingEligible','Eligible for billing']].map(([key,label])=><label className="flex items-center gap-2 text-sm" key={key}><input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })}/>{label}</label>)}</div>
    <VariantEditor value={JSON.parse(form.variants || '[]')} onChange={(variants) => setForm({ ...form, variants: JSON.stringify(variants) })} />
    <Field label="Tax components (JSON array; decimal rates)" className="sm:col-span-2"><textarea className="field min-h-20 font-mono text-xs" value={form.taxComponents} onChange={(e) => setForm({ ...form, taxComponents: e.target.value })} placeholder='[{"label":"Component A","rate":0.05}]' /></Field>
    <div className="sm:col-span-2"><p className="field-hint">Variant price extras are added per unit. Historical invoice prices stay unchanged.</p>{variantError && <p className="error mt-2">{variantError}</p>}<FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to save product.')}/><button className="button mt-3 w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save product' : 'Create product'}</button></div>
  </form></Modal>;
}

export function PlanForm({ plan, onClose }) {
  const { data: products } = useQuery({ queryKey: ['/products'], queryFn: async () => (await api.get('/products')).data });
  const initial = {
    name: plan?.name || '', code: plan?.code || '', product: plan?.product?._id || plan?.product || '',
    billingFrequency: plan?.billingFrequency || 'monthly', basePrice: plan?.basePrice ?? '', minQuantity: plan?.minQuantity ?? 1,
    maxQuantity: plan?.maxQuantity ?? '', trialDays: plan?.trialDays ?? 0, setupFee: plan?.setupFee ?? 0, includedUnits: plan?.includedUnits ?? 0, includedSeats: plan?.includedSeats ?? 0, overagePrice: plan?.overagePrice ?? 0, features: JSON.stringify(plan?.features || [], null, 2), isVisible: plan?.isVisible ?? true, isActive: plan?.isActive ?? true,
    description: plan?.description || '', availableFrom: plan?.availableFrom ? new Date(plan.availableFrom).toISOString().slice(0,10) : '',
    availableTo: plan?.availableTo ? new Date(plan.availableTo).toISOString().slice(0,10) : '',
    autoCloseAtEnd: plan?.autoCloseAtEnd ?? false, allowPause: plan?.allowPause ?? true, allowEarlyClose: plan?.allowEarlyClose ?? true, allowRenew: plan?.allowRenew ?? true
  };
  const [form, setForm] = useState(initial);
  const [planError, setPlanError] = useState('');
  const editing = Boolean(plan?._id);
  const mutation = useSubmit(editing ? `/plans/${plan._id}` : '/plans', editing ? 'patch' : 'post', ['/plans']);
  const submit = (event) => {
    event.preventDefault();
    let features;
    try { features = JSON.parse(form.features || '[]'); if (!Array.isArray(features) || features.some((item) => typeof item !== 'string')) throw new Error(); } catch { setPlanError('Features must be a JSON array of text values.'); return; }
    const payload = { ...form, features, maxQuantity: form.maxQuantity === '' ? null : Number(form.maxQuantity), basePrice: Number(form.basePrice), setupFee: Number(form.setupFee), overagePrice: Number(form.overagePrice), minQuantity: Number(form.minQuantity), trialDays: Number(form.trialDays), includedUnits: Number(form.includedUnits), includedSeats: Number(form.includedSeats), product: form.product || null, availableFrom: form.availableFrom || undefined, availableTo: form.availableTo || undefined };
    mutation.mutate(payload, { onSuccess: onClose });
  };
  return <Modal title={editing ? 'Edit plan' : 'Create plan'} onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <Field label="Plan name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/>
    <Field label="Plan code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}/>
    <SelectField label="Product" required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}><option value="">Select a product</option>{products?.data?.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</SelectField>
    <SelectField label="Billing interval" value={form.billingFrequency} onChange={(e) => setForm({ ...form, billingFrequency: e.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></SelectField>
    <Field label="Price per billing interval (INR)" type="number" min="0" step="0.01" required value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })}/>
    <Field label="Minimum quantity" type="number" min="1" step="1" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}/>
    <Field label="Maximum quantity (optional)" type="number" min="1" step="1" value={form.maxQuantity} onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}/>
    <Field label="Trial days" type="number" min="0" max="365" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })}/>
    <Field label="Setup fee (INR)" type="number" min="0" step="0.01" value={form.setupFee} onChange={(e) => setForm({ ...form, setupFee: e.target.value })}/>
    <Field label="Included units" type="number" min="0" value={form.includedUnits} onChange={(e) => setForm({ ...form, includedUnits: e.target.value })}/>
    <Field label="Included seats" type="number" min="0" value={form.includedSeats} onChange={(e) => setForm({ ...form, includedSeats: e.target.value })}/>
    <Field label="Overage price (INR)" type="number" min="0" step="0.01" value={form.overagePrice} onChange={(e) => setForm({ ...form, overagePrice: e.target.value })}/>
    <Field label="Features (JSON text array)" className="sm:col-span-2"><textarea className="field min-h-20 font-mono text-xs" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })}/></Field>
    <Field label="Available from" type="date" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}/>
    <Field label="Available until" type="date" value={form.availableTo} onChange={(e) => setForm({ ...form, availableTo: e.target.value })}/>
    <Field label="Description" className="sm:col-span-2"><textarea className="field min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></Field>
    <div className="flex flex-wrap gap-4 sm:col-span-2">{[['autoCloseAtEnd','Auto-close at subscription end'],['allowPause','Allow pause'],['allowEarlyClose','Allow early close'],['allowRenew','Allow renewal'],['isVisible','Visible to customers'],['isActive','Active']].map(([key,label])=><label key={key} className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })}/>{label}</label>)}</div>
    <div className="sm:col-span-2">{planError && <p className="error">{planError}</p>}<FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to save plan.')}/><button className="button mt-3 w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save plan' : 'Create plan'}</button></div>
  </form></Modal>;
}

export function BillingBatch({ onClose }) {
  const user = useAuthStore((state) => state.user);
  const [forceAllActive, setForceAllActive] = useState(false);
  const mutation = useSubmit('/billing/run-batch', 'post', ['invoices', 'subscriptions', 'metrics', 'notifications']);
  const submit = (event) => { event.preventDefault(); mutation.mutate({ forceAllActive }); };
  return <Modal title="Run recurring billing" onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    <p className="text-sm text-slate-500">Generate invoices for active subscriptions whose billing date has arrived.</p>
    {user?.role === 'admin' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={forceAllActive} onChange={(e) => setForceAllActive(e.target.checked)} /> Force all active subscriptions</label>}
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Billing batch failed.')} />
    {mutation.data?.data && <section className="billing-preview" aria-live="polite"><strong>{mutation.data.data.message}</strong><p>{mutation.data.data.skippedCount} skipped | {mutation.data.data.recoveredCount} recovered | {mutation.data.data.failedCount} failed | {mutation.data.data.catchUpPendingCount} awaiting catch-up</p>{mutation.data.data.invoices?.map((invoice) => <a className="inline-action" key={invoice._id} href={`/app/invoices/${invoice._id}`}>{invoice.invoiceNumber}</a>)}{mutation.data.data.failed?.map((failure) => <p className="error" key={failure.subNumber}>{failure.subNumber}: {failure.error}</p>)}{mutation.data.data.failedCount > 0 && <p>Retry the batch after resolving failures. Existing billing periods are protected against duplicate invoices.</p>}</section>}
    <button className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Running...' : 'Run billing batch'}</button>
  </form></Modal>;
}

export function InvoiceStatusForm({ invoice, onClose }) {
  const allowedStatuses = {
    Draft: ['Confirmed', 'Cancelled'],
    Confirmed: [...(new Date(invoice.dueDate) < new Date() ? ['Overdue'] : []), 'Cancelled'],
    Overdue: ['Cancelled']
  }[invoice.status] || [];
  const [status, setStatus] = useState('');
  const mutation = useSubmit(`/invoices/${invoice._id}/status`, 'patch', ['invoices', '/invoices', 'notifications', 'metrics']);
  if (allowedStatuses.length === 0) return null;
  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({ status }, { onSuccess: onClose });
  };
  return <Modal title={`Update ${invoice.invoiceNumber}`} onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    <p className="text-sm text-slate-600">Changing an invoice status does not alter its recorded financial amounts.</p>
    <SelectField label="Invoice status" required value={status} onChange={(event) => setStatus(event.target.value)}>
      <option value="">Choose an action</option>{allowedStatuses.map((value) => <option key={value}>{value}</option>)}
    </SelectField>
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to update invoice status.')} />
    <button className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save status'}</button>
  </form></Modal>;
}

export function useTableFilters(rows, initialSearch = '') {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState('ALL');
  const filtered = useMemo(() => rows.filter((row) => {
    const text = JSON.stringify(row).toLowerCase();
    const rowStatus = row.status || row.accountStatus || (typeof row.isActive === 'boolean' ? row.isActive ? 'Active' : 'Inactive' : '');
    return (!search || text.includes(search.toLowerCase())) && (!status || status === 'ALL' || rowStatus === status);
  }), [rows, search, status]);
  return { search, setSearch, status, setStatus, filtered };
}
