import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import Modal, { Field, FormError, SelectField } from './Modal';

function useSubmit(endpoint, method = 'post', invalidate = []) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api[method](endpoint, payload),
    onSuccess: () => invalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  });
}

export function SubscriptionForm({ onClose }) {
  const user = JSON.parse(localStorage.getItem('brightloop_user') || '{}');
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/plans')).data });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/products')).data });
  const [form, setForm] = useState({ planId: '', customerId: user.role === 'customer' ? user.id : '', paymentTerms: 'Net 30 Days', productId: '', quantity: 1, variantName: '' });
  const mutation = useSubmit('/subscriptions', 'post', ['subscriptions', '/subscriptions']);
  const selectedProduct = products?.data?.find((item) => item._id === form.productId);
  const variants = selectedProduct?.variants?.flatMap((group) => group.options) || [];
  const submit = (event) => {
    event.preventDefault();
    const plan = plans?.data?.find((item) => item._id === form.planId);
    mutation.mutate({
      customerId: form.customerId || undefined,
      planId: form.planId,
      planName: plan?.name,
      paymentTerms: form.paymentTerms,
      lines: [{ productId: form.productId, quantity: Number(form.quantity), variantName: form.variantName || undefined }]
    }, { onSuccess: onClose });
  };
  return <Modal title="Create quotation" onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    {user.role !== 'customer' && <Field label="Customer ID" required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} placeholder="Customer MongoDB ID" />}
    <SelectField label="Plan" required value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}><option value="">Select a plan</option>{plans?.data?.map((plan) => <option key={plan._id} value={plan._id}>{plan.name} ({plan.billingFrequency})</option>)}</SelectField>
    <SelectField label="Product" required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, variantName: '' })}><option value="">Select a product</option>{products?.data?.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</SelectField>
    {variants.length > 0 && <SelectField label="Variant" value={form.variantName} onChange={(e) => setForm({ ...form, variantName: e.target.value })}><option value="">No variant</option>{variants.map((variant) => <option key={variant._id} value={variant.name}>{variant.name} (+${variant.priceExtra})</option>)}</SelectField>}
    <Field label="Quantity" type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
    <SelectField label="Payment terms" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}><option>Net 30 Days</option><option>Due on Receipt</option><option>Net 60 Days</option></SelectField>
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to create quotation.')} />
    <button className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Creating...' : 'Create quotation'}</button>
  </form></Modal>;
}

export function TransitionForm({ subscription, onClose }) {
  const [targetStatus, setTargetStatus] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useSubmit('/subscriptions/transition', 'post', ['subscriptions', '/subscriptions']);
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
  const mutation = useSubmit('/payments', 'post', ['payments', 'invoices', '/payments', '/invoices', 'metrics']);
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

export function BillingBatch({ onClose }) {
  const [forceAllActive, setForceAllActive] = useState(false);
  const mutation = useSubmit('/billing/run-batch', 'post', ['invoices', 'subscriptions', 'metrics']);
  const submit = (event) => { event.preventDefault(); mutation.mutate({ forceAllActive }, { onSuccess: onClose }); };
  return <Modal title="Run recurring billing" onClose={onClose}><form onSubmit={submit} className="grid gap-4">
    <p className="text-sm text-slate-500">Generate invoices for active subscriptions whose billing date has arrived.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={forceAllActive} onChange={(e) => setForceAllActive(e.target.checked)} /> Force all active subscriptions (admin only)</label>
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Billing batch failed.')} />
    {mutation.data?.data && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mutation.data.data.message}</p>}
    <button className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Running...' : 'Run billing batch'}</button>
  </form></Modal>;
}

export function useTableFilters(rows) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const filtered = useMemo(() => rows.filter((row) => {
    const text = JSON.stringify(row).toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!status || status === 'ALL' || row.status === status);
  }), [rows, search, status]);
  return { search, setSearch, status, setStatus, filtered };
}
