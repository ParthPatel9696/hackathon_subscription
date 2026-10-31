import { useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import Modal, { Field, FormError, SelectField } from './Modal';
import { formatCurrency, toMinorUnits } from '../utils/locale';

const emptyLine = () => ({ productId: '', quantity: 1, variantName: '' });

export default function QuotationForm({ onClose, initialCustomer }) {
  const client = useQueryClient();
  const [form, setForm] = useState({ customerId: initialCustomer?._id || '', planId: '', templateId: '', paymentTerms: 'Net 30 Days', discountCode: '', lines: [emptyLine()] });
  const [customerSearch, setCustomerSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const customers = useQuery({ queryKey: ['customer-picker', customerSearch], queryFn: async () => (await api.get('/customers', { params: { search: customerSearch, status: 'Active', limit: 50 } })).data });
  const plans = useQuery({ queryKey: ['plans', 'quotation-picker', planSearch], queryFn: async () => (await api.get('/plans', { params: { search: planSearch, status: 'Active', limit: 50 } })).data });
  const products = useQuery({ queryKey: ['products', 'quotation-picker', catalogSearch], queryFn: async () => (await api.get('/products', { params: { search: catalogSearch, status: 'Active', limit: 50 } })).data });
  const templates = useQuery({ queryKey: ['quotation-templates', 'picker'], queryFn: async () => (await api.get('/quotation-templates', { params: { active: true } })).data });
  const plan = useQuery({ queryKey: ['plan', form.planId], queryFn: async () => (await api.get(`/plans/${form.planId}`)).data.data, enabled: Boolean(form.planId) });
  const selectedProducts = useQueries({ queries: [...new Set(form.lines.map((line) => line.productId).filter(Boolean))].map((id) => ({ queryKey: ['product', id], queryFn: async () => (await api.get(`/products/${id}`)).data.data })) });
  const productMap = new Map([...(products.data?.data || []), ...selectedProducts.map((query) => query.data).filter(Boolean)].map((product) => [product._id, product]));
  const planOptions = new Map([...(plans.data?.data || []), ...(plan.data ? [plan.data] : [])].map((item) => [item._id, item]));
  const customerOptions = new Map([...(customers.data?.data || []), ...(initialCustomer ? [initialCustomer] : [])].map((customer) => [customer._id, customer]));
  const mutation = useMutation({ mutationFn: (payload) => api.post('/subscriptions', payload), onSuccess: () => { ['subscriptions', 'customer', 'customer-me', 'metrics', 'activity-log'].forEach((key) => client.invalidateQueries({ queryKey: [key] })); onClose(); } });
  const dependencies = [customers, plans, products, templates, ...(form.planId ? [plan] : []), ...selectedProducts];
  const error = dependencies.find((query) => query.isError);
  const loading = dependencies.some((query) => query.isLoading);
  const setLine = (index, key, value) => setForm((current) => ({ ...current, lines: current.lines.map((line, i) => i === index ? { ...line, [key]: value, ...(key === 'productId' ? { variantName: '' } : {}) } : line) }));
  const useTemplate = (id) => {
    const template = templates.data?.data?.find((item) => item._id === id);
    setForm((current) => ({ ...current, templateId: id, ...(template ? { planId: template.plan?._id || template.plan, lines: template.lines.map((line) => ({ productId: line.product?._id || line.product, quantity: line.quantity, variantName: line.variantName || '' })) } : {}) }));
  };
  let estimateMinor = 0;
  for (const line of form.lines) {
    const product = productMap.get(line.productId);
    const quantity = Number(line.quantity);
    if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) continue;
    const variant = product.variants?.flatMap((group) => group.options).find((option) => option.name === line.variantName);
    const price = String(plan.data?.product?._id || plan.data?.product) === product._id ? plan.data.basePrice : product.salesPrice;
    estimateMinor += (toMinorUnits(price || 0) + toMinorUnits(variant?.priceExtra || 0)) * quantity;
  }
  return <Modal title="Create quotation" onClose={onClose}><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ ...form, templateId: form.templateId || undefined, discountCode: form.discountCode.trim() || undefined, lines: form.lines.map((line) => ({ ...line, quantity: Number(line.quantity) })) }); }}>
    <SelectField label="Quotation template" value={form.templateId} onChange={(event) => useTemplate(event.target.value)}><option value="">Start without a template</option>{templates.data?.data?.filter((template) => template.isActive).map((template) => <option key={template._id} value={template._id}>{template.name} · {template.validityDays} days</option>)}</SelectField>
    <Field label="Find customer" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Name, company or email" />
    <SelectField label="Customer" required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}><option value="">Select a customer</option>{[...customerOptions.values()].map((customer) => <option key={customer._id} value={customer._id}>{customer.companyName || customer.name} · {customer.email}</option>)}</SelectField>
    <Field label="Find plan" value={planSearch} onChange={(event) => setPlanSearch(event.target.value)} placeholder="Plan name or code" />
    <SelectField label="Plan" required value={form.planId} onChange={(event) => setForm({ ...form, templateId: '', planId: event.target.value })}><option value="">Select a plan</option>{[...planOptions.values()].map((item) => <option key={item._id} value={item._id}>{item.name} · {item.billingFrequency}</option>)}</SelectField>
    <Field label="Find products" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search the catalogue" />
    <div className="quotation-lines">{form.lines.map((line, index) => {
      const product = productMap.get(line.productId);
      const options = product?.variants?.flatMap((group) => group.options).filter((variant) => variant.isActive !== false) || [];
      return <fieldset key={index} className="quotation-line"><legend>Line {index + 1}</legend><div className="grid gap-3 sm:grid-cols-2"><SelectField label={`Product ${index + 1}`} required value={line.productId} onChange={(event) => setLine(index, 'productId', event.target.value)}><option value="">Select product</option>{[...productMap.values()].filter((item) => item.isActive !== false && item.billingEligible !== false).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</SelectField><Field label={`Quantity ${index + 1}`} type="number" min="1" max="10000" step="1" required value={line.quantity} onChange={(event) => setLine(index, 'quantity', event.target.value)} /><SelectField label={`Variant ${index + 1}`} value={line.variantName} onChange={(event) => setLine(index, 'variantName', event.target.value)}><option value="">No variant</option>{options.map((variant) => <option key={variant._id} value={variant.name}>{variant.name} (+{formatCurrency(variant.priceExtra)})</option>)}</SelectField><button type="button" className="inline-action justify-self-start self-end" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })}>Remove line {index + 1}</button></div></fieldset>;
    })}</div>
    <button type="button" className="button secondary-button justify-self-start" disabled={form.lines.length >= 100} onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}>Add product line</button>
    <SelectField label="Payment terms" value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })}>{['Due on Receipt', 'Net 15 Days', 'Net 30 Days', 'Net 60 Days'].map((terms) => <option key={terms}>{terms}</option>)}</SelectField>
    <Field label="Discount code" value={form.discountCode} onChange={(event) => setForm({ ...form, discountCode: event.target.value.toUpperCase() })} />
    <div className="billing-preview"><div><span>Subtotal before discounts and tax</span><strong>{formatCurrency(estimateMinor / 100)}</strong></div><p>The server validates eligibility and calculates the final quotation.</p></div>
    {loading && <p role="status">Loading quotation options…</p>}
    {error && <p className="error" role="alert">Quotation options could not be loaded. <button type="button" className="inline-action" onClick={() => dependencies.filter((query) => query.isError).forEach((query) => query.refetch())}>Retry</button></p>}
    <FormError message={mutation.error?.response?.data?.error || (mutation.isError && 'Unable to create quotation.')} />
    <button className="button" disabled={loading || Boolean(error) || mutation.isPending}>{mutation.isPending ? 'Creating…' : 'Create quotation'}</button>
  </form></Modal>;
}
