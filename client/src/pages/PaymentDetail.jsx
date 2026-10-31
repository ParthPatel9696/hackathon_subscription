import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import { formatCurrency, formatDate } from '../utils/locale';

export default function PaymentDetail() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['payment-detail', id], queryFn: async () => (await api.get(`/payments/${id}`)).data.data });
  if (query.isLoading) return <p className="card" role="status">Loading payment…</p>;
  if (query.isError || !query.data) return <p className="error" role="alert">{query.error?.response?.data?.error || 'Payment is unavailable.'} <button className="inline-action" onClick={() => query.refetch()}>Try again</button></p>;
  const payment = query.data;
  return <><Link to="/app/payments" className="back-link">← Payments</Link><div className="flex flex-wrap items-start justify-between gap-3"><PageHeader title={payment.referenceNote || `Payment ${payment._id.slice(-8)}`} subtitle={`${payment.invoiceNumber} · ${payment.method}`} /><button type="button" className="button secondary-button print-hidden" onClick={() => window.print()}>Print receipt</button></div>
    <section className="card"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Info label="Payment reference" value={payment.referenceNote || payment._id} /><Info label="Date" value={formatDate(payment.paymentDate)} /><Info label="Amount received" value={formatCurrency(payment.amount)} /><Info label="Currency" value={payment.currency || 'INR'} /><Info label="Method" value={payment.method} /><Info label="Status" value={payment.status || 'posted'} /><Info label="Invoice" value={<Link className="inline-action" to={`/app/invoices/${payment.invoice?._id}`}>{payment.invoiceNumber}</Link>} /><Info label="Customer" value={payment.invoice?.customerName} /><Info label="Allocated amount" value={formatCurrency(payment.amount)} /><Info label="Unallocated amount" value={formatCurrency(0)} /></dl><p className="mt-5 text-xs text-slate-500">This payment is recorded against one invoice. Brightloop does not treat a manually entered reference as online payment verification.</p></section>
  </>;
}
function Info({ label, value }) { return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm">{value || '—'}</dd></div>; }
