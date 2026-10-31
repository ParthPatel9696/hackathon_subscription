import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import Modal, { Field, FormError, SelectField } from './Modal';
import { useAuthStore } from '../store';

function useSubmit(endpoint, method = 'post', invalidate = []) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api[method](endpoint, payload),
    onSuccess: () => invalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  });
}
const currencyMinor = (minor) => `$${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SubscriptionForm({ onClose }) {
  const user = useAuthStore((state) => state.user);
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/plans')).data });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/products')).data });
  const [customerSearch, setCustomerSearch] = useState('');
  const customerQuery = useQuery({ queryKey: ['customer-picker', customerSearch], queryFn: async () => (await api.get('/customers', { params: { search: customerSearch, limit: 20 } })).data, enabled: user?.role !== 'customer' });
  const [form, setForm] = useState({ planId: '', customerId: user?.role === 'customer' ? user.id : '', paymentTerms: 'Net 30 Days', productId: '', quantity: 1, variantName: '' });
  const mutation = useSubmit('/subscriptions', 'post', ['subscriptions', '/subscriptions', 'metrics']);
  const selectedPlan = plans?.data?.find((item) => item._id === form.planId);
  const selectedProduct = products?.data?.find((item) => item._id === form.productId);
  const variants = selectedProduct?.variants?.flatMap((group) => group.options) || [];
  const selectedVariant = variants.find((item) => item.name === form.variantName);
  const quantity = Math.max(1, Number(form.quantity) || 1);
  const unitPrice = selectedPlan?.product?._id === selectedProduct?._id ? Number(selectedPlan.basePrice) : Number(selectedProduct?.salesPrice || 0);
  const unitMinor = Math.round((unitPrice + Number(selectedVariant?.priceExtra || 0)) * 100);
  const subtotalMinor = unitMinor * quantity;
  const taxMinor = Math.round(subtotalMinor * Number(selectedProduct?.taxRate || 0));
  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({
      customerId: form.customerId || undefined,
      planId: form.planId,
      planName: selectedPlan?.name,
      paymentTerms: form.paymentTerms,
      lines: [{ productId: form.productId, quantity: Number(form.quantity), variantName: form.variantName || undefined }]
    }, { onSuccess: onClose });
  };
  return <Modal title="Create quotation draft" onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    {user?.role !== 'customer' && <><Field label="Find customer" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search name, company, or email"/><SelectField label="Customer" required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Select a customer</option>{customerQuery.data?.data?.map((customer) => <option key={customer._id} value={customer._id}>{customer.companyName || customer.name} · {customer.email}</option>)}</SelectField></>}
    <SelectField label="Plan" required value={form.planId} onChange={(e) => { const plan = plans?.data?.find((item) => item._id === e.target.value); setForm({ ...form, planId: e.target.value, productId: plan?.product?._id || '', variantName: '' }); }}><option value="">Select a plan</option>{plans?.data?.map((plan) => <option key={plan._id} value={plan._id}>{plan.name} · {plan.billingFrequency}</option>)}</SelectField>
    <SelectField label="Product" required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, variantName: '' })}><option value="">Select a product</option>{products?.data?.filter((product) => !selectedPlan?.product?._id || product._id === selectedPlan.product._id).map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</SelectField>
    {variants.length > 0 && <SelectField label="Variant" value={form.variantName} onChange={(e) => setForm({ ...form, variantName: e.target.value })}><option value="">No variant</option>{variants.map((variant) => <option key={variant._id} value={variant.name}>{variant.name} (+${variant.priceExtra})</option>)}</SelectField>}
    <Field label="Quantity" type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
    <SelectField label="Payment terms" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}><option>Net 30 Days</option><option>Due on Receipt</option><option>Net 60 Days</option></SelectField>
    {selectedProduct && <div className="billing-preview"><div><span>Estimated subtotal</span><strong>{currencyMinor(subtotalMinor)}</strong></div><div><span>Tax ({(Number(selectedProduct.taxRate || 0) * 100).toFixed(1)}%)</span><strong>{currencyMinor(taxMinor)}</strong></div><div className="preview-total"><span>Estimated recurring total</span><strong>{currencyMinor(subtotalMinor + taxMinor)} / {selectedPlan?.billingFrequency || 'period'}</strong></div><p>Final amounts are calculated and validated by Brightloop when you save.</p></div>}
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to create quotation.')} />
    <button className="button" disabled={mutation.isPending || (user?.role !== 'customer' && customerQuery.isLoading)}>{mutation.isPending ? 'Saving…' : 'Save quotation draft'}</button>
  </form></Modal>;
}

export function CustomerForm({ customer, onClose }) {
  const editing = Boolean(customer?._id);
  const [form, setForm] = useState({
    name: customer?.name || '', email: customer?.email || '', companyName: customer?.companyName || '',
    phone: customer?.phone || '', billingAddress: customer?.billingAddress || '', accountStatus: customer?.accountStatus || 'Active', password: ''
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
    <Field label="Phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
    <Field label="Billing address" className="sm:col-span-2"><textarea className="field min-h-20" value={form.billingAddress} onChange={(event) => setForm({ ...form, billingAddress: event.target.value })} /></Field>
    {editing && <label className="grid gap-1.5 text-sm font-medium text-slate-700">Account status<select className="field" value={form.accountStatus} onChange={(event) => setForm({ ...form, accountStatus: event.target.value })}><option>Active</option><option>Archived</option></select></label>}
    {!editing && <><Field label="Initial password" type="password" minLength="9" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><p className="field-hint self-end">At least 9 characters with uppercase, lowercase, and a symbol. The customer can change it through password recovery.</p></>}
    <div className="sm:col-span-2"><FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to save this customer.')} /><button className="button mt-3 w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save customer' : 'Create customer'}</button></div>
  </form></Modal>;
}

export function TransitionForm({ subscription, onClose }) {
  const [targetStatus, setTargetStatus] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useSubmit('/subscriptions/transition', 'post', ['subscriptions', '/subscriptions', 'notifications', 'metrics']);
  const nextStatuses = { Draft: ['Quotation', 'Cancelled'], Quotation: ['Confirmed', 'Draft', 'Cancelled'], Confirmed: ['Active', 'Cancelled'], Active: ['Paused', 'Closed'], Paused: ['Active', 'Closed'], Closed: ['Draft'] }[subscription.status] || [];
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

export function PaymentForm({ onClose }) {
  const { data: invoices } = useQuery({ queryKey: ['invoices'], queryFn: async () => (await api.get('/invoices')).data });
  const [form, setForm] = useState({ invoiceId: '', amount: '', method: 'Bank Transfer', referenceNote: '', paymentDate: '' });
  const mutation = useSubmit('/payments', 'post', ['payments', 'invoices', '/payments', '/invoices', 'metrics', 'notifications']);
  const invoice = invoices?.data?.find((item) => item._id === form.invoiceId);
  const outstanding = invoice ? Math.max(0, (invoice.grandTotal || 0) - (invoice.paidAmount || 0)) : null;
  const submit = (event) => { event.preventDefault(); mutation.mutate({ ...form, amount: Number(form.amount), paymentDate: form.paymentDate || undefined }, { onSuccess: onClose }); };
  return <Modal title="Record payment" onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    <SelectField label="Invoice" required value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}><option value="">Select an invoice</option>{invoices?.data?.filter((item) => item.status !== 'Paid' && item.status !== 'Cancelled').map((item) => <option key={item._id} value={item._id}>{item.invoiceNumber} — ${item.grandTotal - (item.paidAmount || 0)} outstanding</option>)}</SelectField>
    <Field label="Amount" type="number" min="0.01" step="0.01" max={outstanding || undefined} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
    <SelectField label="Payment method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>Bank Transfer</option><option>Credit Card</option><option>UPI / Online</option><option>Check</option></SelectField>
    <Field label="Payment date" type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
    <Field label="Transaction reference / notes" value={form.referenceNote} onChange={(e) => setForm({ ...form, referenceNote: e.target.value })} />
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to record payment.')} />
    <button className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Recording...' : 'Record payment'}</button>
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
  const initial = {
    name: product?.name || '', type: product?.type || 'software', salesPrice: product?.salesPrice ?? '',
    costPrice: product?.costPrice ?? '', taxRate: product?.taxRate ?? 0.1, notes: product?.notes || '',
    variants: JSON.stringify(product?.variants || [], null, 2)
  };
  const [form, setForm] = useState(initial);
  const [variantError, setVariantError] = useState('');
  const editing = Boolean(product?._id);
  const mutation = useSubmit(editing ? `/products/${product._id}` : '/products', editing ? 'patch' : 'post', ['/products']);
  const submit = (event) => {
    event.preventDefault(); setVariantError('');
    let variants;
    try { variants = JSON.parse(form.variants || '[]'); if (!Array.isArray(variants)) throw new Error('Variants must be a JSON array.'); }
    catch (error) { setVariantError(error.message || 'Enter valid JSON for product variants.'); return; }
    mutation.mutate({ ...form, salesPrice: Number(form.salesPrice), costPrice: Number(form.costPrice || 0), taxRate: Number(form.taxRate), variants }, { onSuccess: onClose });
  };
  return <Modal title={editing ? 'Edit product' : 'Add product'} onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <Field label="Product name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/>
    <SelectField label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="software">Software</option><option value="service">Service</option><option value="addon">Add-on</option><option value="seat">Seat</option></SelectField>
    <Field label="Sales price" type="number" min="0" step="0.01" required value={form.salesPrice} onChange={(e) => setForm({ ...form, salesPrice: e.target.value })}/>
    <Field label="Tax rate (decimal)" type="number" min="0" max="1" step="0.001" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })}/>
    <Field label="Cost price (admin only)" type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })}/>
    <Field label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/>
    <Field label="Variants (JSON array)" className="sm:col-span-2"><textarea className="field min-h-24 font-mono text-xs" value={form.variants} onChange={(e) => setForm({ ...form, variants: e.target.value })} placeholder="[]" /></Field>
    <div className="sm:col-span-2"><p className="field-hint">Each variant group uses a name and options with name, priceExtra, and optional SKU.</p>{variantError && <p className="error mt-2">{variantError}</p>}<FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to save product.')}/><button className="button mt-3 w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save product' : 'Create product'}</button></div>
  </form></Modal>;
}

export function PlanForm({ plan, onClose }) {
  const { data: products } = useQuery({ queryKey: ['/products'], queryFn: async () => (await api.get('/products')).data });
  const initial = {
    name: plan?.name || '', code: plan?.code || '', product: plan?.product?._id || plan?.product || '',
    billingFrequency: plan?.billingFrequency || 'monthly', basePrice: plan?.basePrice ?? '', minQuantity: plan?.minQuantity ?? 1,
    description: plan?.description || '', availableFrom: plan?.availableFrom ? new Date(plan.availableFrom).toISOString().slice(0,10) : '',
    availableTo: plan?.availableTo ? new Date(plan.availableTo).toISOString().slice(0,10) : '',
    allowPause: plan?.allowPause ?? true, allowEarlyClose: plan?.allowEarlyClose ?? true, allowRenew: plan?.allowRenew ?? true
  };
  const [form, setForm] = useState(initial);
  const editing = Boolean(plan?._id);
  const mutation = useSubmit(editing ? `/plans/${plan._id}` : '/plans', editing ? 'patch' : 'post', ['/plans']);
  const submit = (event) => {
    event.preventDefault();
    const payload = { ...form, basePrice: Number(form.basePrice), minQuantity: Number(form.minQuantity), product: form.product || null, availableFrom: form.availableFrom || undefined, availableTo: form.availableTo || undefined };
    mutation.mutate(payload, { onSuccess: onClose });
  };
  return <Modal title={editing ? 'Edit plan' : 'Create plan'} onClose={onClose}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <Field label="Plan name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/>
    <Field label="Plan code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}/>
    <SelectField label="Product" required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}><option value="">Select a product</option>{products?.data?.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</SelectField>
    <SelectField label="Billing interval" value={form.billingFrequency} onChange={(e) => setForm({ ...form, billingFrequency: e.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></SelectField>
    <Field label="Price per billing interval" type="number" min="0" step="0.01" required value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })}/>
    <Field label="Minimum quantity" type="number" min="1" step="1" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}/>
    <Field label="Available from" type="date" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}/>
    <Field label="Available until" type="date" value={form.availableTo} onChange={(e) => setForm({ ...form, availableTo: e.target.value })}/>
    <Field label="Description" className="sm:col-span-2"><textarea className="field min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></Field>
    <div className="flex flex-wrap gap-4 sm:col-span-2">{[['allowPause','Allow pause'],['allowEarlyClose','Allow early close'],['allowRenew','Allow renewal']].map(([key,label])=><label key={key} className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })}/>{label}</label>)}</div>
    <div className="sm:col-span-2"><FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to save plan.')}/><button className="button mt-3 w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Save plan' : 'Create plan'}</button></div>
  </form></Modal>;
}

export function BillingBatch({ onClose }) {
  const user = useAuthStore((state) => state.user);
  const [forceAllActive, setForceAllActive] = useState(false);
  const mutation = useSubmit('/billing/run-batch', 'post', ['/invoices', '/subscriptions', 'metrics', 'notifications']);
  const submit = (event) => { event.preventDefault(); mutation.mutate({ forceAllActive }, { onSuccess: onClose }); };
  return <Modal title="Run recurring billing" onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    <p className="text-sm text-slate-500">Generate invoices for active subscriptions whose billing date has arrived.</p>
    {user?.role === 'admin' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={forceAllActive} onChange={(e) => setForceAllActive(e.target.checked)} /> Force all active subscriptions</label>}
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Billing batch failed.')} />
    {mutation.data?.data && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mutation.data.data.message}</p>}
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

export function useTableFilters(rows) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const filtered = useMemo(() => rows.filter((row) => {
    const text = JSON.stringify(row).toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!status || status === 'ALL' || (row.status || row.accountStatus) === status);
  }), [rows, search, status]);
  return { search, setSearch, status, setStatus, filtered };
}
