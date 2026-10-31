import { useReducedMotion } from 'motion/react';
﻿import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatCurrency, formatDate } from '../utils/locale';
import PageHeader from '../components/PageHeader';

export default function Reports() {
  const reducedMotion = useReducedMotion();
  const [filters, setFilters] = useState({ startDate: '', endDate: '', status: '' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const report = useQuery({ queryKey: ['finance-report', filters], queryFn: async () => (await api.get('/reports/finance', { params: filters })).data });
  const summary = report.data?.summary;
  const exportReport = async () => {
    setExporting(true); setExportError('');
    try {
      const { data } = await api.get('/reports/finance/export', { params: filters, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url; link.download = 'brightloop-invoices-INR.csv';
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { setExportError('The report could not be exported. Try again.'); }
    finally { setExporting(false); }
  };
  const update = (key) => (event) => { setFilters((current) => ({ ...current, [key]: event.target.value })); setExportError(''); };
  return <>
    <PageHeader title="Finance reports" subtitle="Cash collections and invoiced value, calculated across every matching record." />
    <div className="resource-toolbar report-filters">
      <label>From<input className="field" type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={update('startDate')} /></label>
      <label>Through<input className="field" type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={update('endDate')} /></label>
      <label>Invoice status<select className="field" value={filters.status} onChange={update('status')}><option value="">All statuses</option>{['Draft', 'Confirmed', 'Paid', 'Overdue', 'Cancelled'].map((status) => <option key={status}>{status}</option>)}</select></label>
      <button type="button" className="button secondary-button" disabled={report.isFetching} onClick={() => report.refetch()}><RefreshCw size={15} /> Refresh</button>
      <button type="button" className="button secondary-button" disabled={report.isLoading || report.isError || exporting} onClick={exportReport}><Download size={15} />{exporting ? 'Exporting…' : 'Export invoices CSV'}</button>
    </div>
    {exportError && <p className="error mb-4" role="alert">{exportError}</p>}
    {report.isError ? <p className="error" role="alert">{report.error?.response?.data?.error || 'Unable to load the finance report.'} <button className="inline-action" onClick={() => report.refetch()}>Retry</button></p> : report.isLoading ? <p className="card" role="status">Loading finance report…</p> : <>
      <div className="metric-grid">{[['Active subscriptions', summary.activeSubscriptions], ['Cash collected', formatCurrency(summary.collected)], ['Outstanding balance', formatCurrency(summary.outstanding)], ['Overdue invoices', summary.overdueCount]].map(([label, value]) => <div className="card metric-card" key={label}><p>{label}</p><strong className="metric-value">{value}</strong></div>)}</div>
      <p className="report-definition">Cash uses the payment date. Invoice balances use the issue date. Active subscriptions describe the current portfolio. All dates use India time; draft and cancelled invoices are excluded from receivables.</p>
      <section className="card mt-5"><div className="panel-heading"><div><h2>Collections and invoiced value</h2><p>{summary.invoices} invoices · {summary.payments} posted payments · INR</p></div></div>{report.data.monthly.length ? <ResponsiveContainer width="100%" height={280}><BarChart data={report.data.monthly}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis width={90} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={(value) => formatCurrency(value)} /><Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }} /><Bar isAnimationActive={!reducedMotion} dataKey="invoiced" fill="var(--accent)" name="Invoiced" radius={[3, 3, 0, 0]} /><Bar isAnimationActive={!reducedMotion} dataKey="collected" fill="#91aaa0" name="Collected cash" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="resource-empty">No confirmed invoices or posted payments match these dates.</p>}</section>
      <section className="card mt-5"><div className="panel-heading"><div><h2>Overdue invoices</h2><p>Ten oldest outstanding invoices in the selection</p></div></div>{report.data.overdue.length ? <div className="overflow-x-auto"><table className="resource-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Due date</th><th>Days late</th><th className="amount-cell">Balance</th></tr></thead><tbody>{report.data.overdue.map((row) => <tr key={row._id}><td><Link className="inline-action" to={`/app/invoices/${row._id}`}>{row.invoiceNumber}</Link></td><td>{row.customerName}</td><td>{formatDate(row.dueDate)}</td><td>{row.daysLate}</td><td className="amount-cell">{formatCurrency(row.outstanding)}</td></tr>)}</tbody></table></div> : <p className="empty-copy">No overdue invoices in this selection.</p>}</section>
    </>}
  </>;
}
