import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import { PlanChangeForm } from '../components/WorkflowForms';
import { formatCurrency, formatDate } from '../utils/locale';

export default function SubscriptionDetail() {
  const { id } = useParams(); const [changeOpen, setChangeOpen] = useState(false);
  const subscription = useQuery({ queryKey: ['subscription', id], queryFn: async () => (await api.get(`/subscriptions/${id}`)).data.data });
  const invoices = useQuery({ queryKey: ['subscription-invoices', id], queryFn: async () => (await api.get('/invoices', { params: { subscriptionId: id, page: 1, limit: 100 } })).data });
  if (subscription.isLoading) return <p className="card" role="status">Loading subscription…</p>;
  if (subscription.isError || !subscription.data) return <p className="error" role="alert">{subscription.error?.response?.data?.error || 'Subscription is unavailable.'} <button className="inline-action" onClick={() => subscription.refetch()}>Try again</button></p>;
  const sub = subscription.data;
  return <><Link to="/app/subscriptions" className="back-link">← Subscriptions</Link><div className="flex flex-wrap items-start justify-between gap-3"><PageHeader title={sub.subscriptionNumber} subtitle={`${sub.customerName} · ${sub.planName} · ${sub.status}`} />{sub.status === 'Active' && <button className="button" onClick={() => setChangeOpen(true)}>Change plan</button>}</div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Recurring amount" value={`${formatCurrency(sub.recurringTotal)} / ${sub.billingFrequency}`} /><Metric label="Start date" value={formatDate(sub.startDate)} /><Metric label="Next billing" value={formatDate(sub.nextBillingDate)} /><Metric label="Scheduled plan change" value={sub.scheduledPlanChange ? `${sub.scheduledPlanChange.planName} · ${formatDate(sub.scheduledPlanChange.effectiveAt)}` : 'None'} /></div>
    <section className="card mt-5"><h2 className="font-semibold">Products and quantities</h2><div className="overflow-x-auto"><table className="resource-table"><thead><tr><th>Product</th><th>Variant</th><th>Quantity</th><th className="amount-cell">Unit price</th><th className="amount-cell">Line total</th></tr></thead><tbody>{(sub.lines || []).map((line) => <tr key={line._id}><td>{line.productName}</td><td>{line.variantName || '—'}</td><td>{line.quantity}</td><td className="amount-cell">{formatCurrency(line.unitPrice + (line.variantPriceExtra || 0))}</td><td className="amount-cell">{formatCurrency(line.lineTotal)}</td></tr>)}</tbody></table></div></section>
    <div className="customer-detail-grid mt-5"><section className="card"><h2 className="font-semibold">Invoice history</h2>{invoices.isLoading ? <p role="status">Loading invoices…</p> : invoices.isError ? <p className="error">Invoice history unavailable. <button className="inline-action" onClick={() => invoices.refetch()}>Retry</button></p> : invoices.data?.data?.length ? <div className="overflow-x-auto"><table className="resource-table"><thead><tr><th>Invoice</th><th>Issue date</th><th>Due date</th><th className="amount-cell">Total</th><th>Status</th></tr></thead><tbody>{invoices.data.data.map((invoice) => <tr key={invoice._id}><td>{invoice.invoiceNumber}</td><td>{formatDate(invoice.invoiceDate)}</td><td>{formatDate(invoice.dueDate)}</td><td className="amount-cell">{formatCurrency(invoice.grandTotal)}</td><td>{invoice.status}</td></tr>)}</tbody></table></div> : <p className="empty-copy">No invoices have been issued for this subscription.</p>}</section><section className="card"><h2 className="font-semibold">Change history</h2>{sub.planChangeHistory?.length ? <ol className="mt-3 space-y-3">{[...sub.planChangeHistory].reverse().map((event) => <li className="compact-record" key={event.operationKey}><span><strong>{event.previousPlan} → {event.newPlan}</strong><small>Quantity {event.previousQuantity} → {event.newQuantity} · {event.reason || 'No reason supplied'}</small></span><span>{formatDate(event.effectiveAt)} · {formatCurrency(Math.abs(event.prorationMinor || 0) / 100)} {event.prorationMinor < 0 ? 'credit' : 'adjustment'}</span></li>)}</ol> : <p className="empty-copy mt-3">No plan changes have been recorded.</p>}</section></div>
    {changeOpen && <PlanChangeForm subscription={sub} onClose={() => { setChangeOpen(false); subscription.refetch(); }} />}
  </>;
}

function Metric({ label, value }) { return <div className="card"><small className="text-slate-500">{label}</small><strong className="mt-2 block text-lg">{value}</strong></div>; }
