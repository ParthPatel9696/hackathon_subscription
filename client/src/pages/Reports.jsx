import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api';
import PageHeader from '../components/PageHeader';

const load = (endpoint) => async () => (await api.get(endpoint)).data;

export default function Reports() {
  const [range, setRange] = useState('all');
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: load('/dashboard/metrics') });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: load('/invoices') });
  const payments = useQuery({ queryKey: ['payments'], queryFn: load('/payments') });
  const subscriptions = useQuery({ queryKey: ['subscriptions'], queryFn: load('/subscriptions') });
  const cutoff = range === 'all' ? null : Date.now() - Number(range) * 86400000;
  const inRange = (row, fields) => !cutoff || fields.some((field) => row[field] && new Date(row[field]).getTime() >= cutoff);
  const filteredInvoices = (invoices.data?.data || []).filter((row) => inRange(row, ['invoiceDate', 'createdAt']));
  const filteredPayments = (payments.data?.data || []).filter((row) => inRange(row, ['paymentDate', 'createdAt']));
  const filteredSubscriptions = (subscriptions.data?.data || []).filter((row) => inRange(row, ['startDate', 'createdAt']));
  const chartData = useMemo(() => {
    const groups = {};
    filteredInvoices.filter((invoice) => !['Draft', 'Cancelled'].includes(invoice.status)).forEach((invoice) => {
      const month = new Date(invoice.invoiceDate || invoice.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      groups[month] = (groups[month] || 0) + Number(invoice.grandTotal || 0);
    });
    return Object.entries(groups).map(([month, total]) => ({ month, total: Number(total.toFixed(2)) }));
  }, [filteredInvoices]);
  const exportReport = () => {
    const rows = filteredInvoices.map((invoice) => ({
      invoice: invoice.invoiceNumber,
      customer: invoice.customerName,
      status: invoice.status,
      total: invoice.grandTotal,
      paid: invoice.paidAmount || 0,
      outstanding: Math.max(0, invoice.grandTotal - (invoice.paidAmount || 0))
    }));
    const keys = Object.keys(rows[0] || { invoice: '', customer: '', status: '', total: '', paid: '', outstanding: '' });
    const csvValue = (value) => {
      const raw = String(value ?? '');
      const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [keys.map(csvValue).join(','), ...rows.map((row) => keys.map((key) => csvValue(row[key])).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'brightloop-revenue-report.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const loading = metrics.isLoading || invoices.isLoading || payments.isLoading || subscriptions.isLoading;
  const error = metrics.error || invoices.error || payments.error || subscriptions.error;
  const reportCards = [
    ['Invoices', filteredInvoices.length],
    ['Payments', filteredPayments.length],
    ['Subscriptions', filteredSubscriptions.length],
    ['Overdue invoices', metrics.data?.metrics?.overdueCount ?? 0]
  ];
  return <><PageHeader title="Reports" subtitle="Review revenue, billing activity, and subscription performance." />
    <div className="mb-5 flex flex-wrap gap-2">
      <label className="sr-only" htmlFor="report-range">Report date range</label>
      <select id="report-range" className="field w-auto" value={range} onChange={(event) => setRange(event.target.value)}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
      <button type="button" className="button flex items-center gap-2" onClick={() => [metrics, invoices, payments, subscriptions].forEach((query) => query.refetch())}><RefreshCw aria-hidden="true" size={16} /> Refresh report</button>
      <button type="button" className="button flex items-center gap-2" onClick={exportReport}><Download aria-hidden="true" size={16} /> Export revenue CSV</button>
    </div>
    {error ? <p className="error mb-5" role="alert">{error.response?.data?.error || 'Unable to load report data.'} <button className="inline-action" onClick={() => [metrics, invoices, payments, subscriptions].forEach((query) => query.refetch())}>Try again</button></p> : loading ? <p role="status">Loading report data…</p> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{reportCards.map(([label, value]) => <div className="card" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold">{value}</p></div>)}</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="card"><h2 className="mb-4 font-semibold">Invoice value by month</h2>{chartData.length ? <ResponsiveContainer width="100%" height={280}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value) => `$${value}`} /><Bar dataKey="total" fill="#159a81" name="Invoice total" /></BarChart></ResponsiveContainer> : <p className="text-sm text-slate-500">No invoice data for this period.</p>}</section>
        <section className="card"><h2 className="mb-4 font-semibold">Finance summary</h2><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">MRR</dt><dd className="text-xl font-semibold">${metrics.data?.metrics?.mrr?.toLocaleString?.() || 0}</dd></div><div><dt className="text-sm text-slate-500">Collected revenue</dt><dd className="text-xl font-semibold">${metrics.data?.metrics?.totalCollected?.toLocaleString?.() || 0}</dd></div><div><dt className="text-sm text-slate-500">Outstanding balance</dt><dd className="text-xl font-semibold">${metrics.data?.metrics?.pendingAmount?.toLocaleString?.() || 0}</dd></div><div><dt className="text-sm text-slate-500">Payments recorded</dt><dd className="text-xl font-semibold">{filteredPayments.length}</dd></div></dl></section></div></>}
  </>;
}
