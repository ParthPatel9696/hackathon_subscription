import { useReducedMotion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CircleDollarSign, CreditCard, FileWarning, FileText, Users, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatCurrency, formatDate } from '../utils/locale';
import { useAuthStore } from '../store';
import PageHeader from '../components/PageHeader';

export default function Dashboard() {
  const reducedMotion = useReducedMotion();
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['metrics'], queryFn: async () => (await api.get('/dashboard/metrics')).data, enabled: user.role !== 'customer' });
  if (user.role === 'customer') return <CustomerOverview />;
  if (error) return <><PageHeader title="Business overview" subtitle="Live subscription and billing performance." /><p className="error" role="alert">{error.response?.data?.error || 'Metrics are unavailable.'} <button className="inline-action" onClick={() => refetch()}>Try again</button></p></>;
  const metrics = data?.metrics;
  const cards = [
    ['Monthly recurring revenue', metrics?.mrr, CircleDollarSign, 'text-emerald-600'],
    ['Active subscriptions', metrics?.activeSubscriptionsCount, Activity, 'text-blue-600'],
    ['Customers', metrics?.totalCustomers, Users, 'text-blue-600'],
    ['Revenue collected', metrics?.totalCollected, CreditCard, 'text-emerald-600'],
    ['Outstanding balance', metrics?.pendingAmount, AlertTriangle, 'text-amber-600'],
    ['Overdue invoices', metrics?.overdueCount, FileWarning, 'text-rose-600']
  ];
  return <><PageHeader title="Business overview" subtitle="Live subscription and billing performance." />{isLoading ? <p role="status">Loading business metrics…</p> : <><div className="metric-grid">{cards.map(([label, value, Icon, color]) => <div className="card metric-card" key={label}><div className="flex justify-between"><p className="text-sm text-slate-500">{label}</p><Icon size={18} className={color} /></div><p className="metric-value">{typeof value === 'number' && !['Active subscriptions', 'Customers', 'Overdue invoices'].includes(label) ? formatCurrency(value) : value ?? 0}</p><p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><span className="live-dot" /> Live account data</p></div>)}</div><div className="dashboard-panel card mt-6"><div className="panel-heading"><div><h2>Subscription lifecycle</h2><p>Current records grouped by status</p></div><span>All time</span></div><ResponsiveContainer width="100%" height={255}><BarChart data={Object.entries(metrics?.statusPipeline || {}).map(([name, value]) => ({ name, value }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7f8e88' }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#7f8e88' }} /><Tooltip /><Bar isAnimationActive={!reducedMotion} dataKey="value" name="Subscriptions" fill="#167d6b" radius={[3,3,0,0]} maxBarSize={44} /></BarChart></ResponsiveContainer></div></>}</>;
}
function CustomerOverview() {
  const summary = useQuery({ queryKey: ['customer-me'], queryFn: async () => (await api.get('/customers/me')).data.data });
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: async () => (await api.get('/notifications')).data });
  const portfolio = summary.data;
  if (summary.isLoading) return <><PageHeader title="Your account overview" subtitle="Subscriptions, invoices, and payments." /><p className="card" role="status">Loading account summary…</p></>;
  if (summary.isError) return <><PageHeader title="Your account overview" /><p className="error" role="alert">Unable to load your customer summary. <button className="inline-action" onClick={() => summary.refetch()}>Retry</button></p></>;
  const nextRenewal = (portfolio?.subscriptions || []).filter((item) => item.status === 'Active' && item.nextBillingDate).sort((a, b) => new Date(a.nextBillingDate) - new Date(b.nextBillingDate))[0];
  return <><PageHeader title={`Welcome${portfolio?.customer?.name ? `, ${portfolio.customer.name}` : ''}`} subtitle={`${portfolio?.customer?.companyName || 'Your Brightloop account'} · subscriptions, invoices, and payments.`} />
    {summary.isError && <p className="error mb-4" role="alert">Unable to load your customer summary. <button className="inline-action" onClick={() => summary.refetch()}>Try again</button></p>}
    <div className="metric-grid customer-metrics">
      <div className="card metric-card"><div className="flex justify-between"><p className="text-sm text-slate-500">Active subscriptions</p><Wallet size={18} className="text-blue-600"/></div><p className="metric-value">{portfolio?.summary?.activeSubscriptions ?? '—'}</p><Link className="inline-action mt-2" to="/app/subscriptions">View subscriptions</Link></div>
      <div className="card metric-card"><div className="flex justify-between"><p className="text-sm text-slate-500">Next expected renewal</p><Activity size={18} className="text-blue-600"/></div><p className="metric-value text-base">{nextRenewal ? formatDate(nextRenewal.nextBillingDate) : 'No upcoming renewal'}</p>{nextRenewal && <p className="mt-2 text-xs text-slate-500">{nextRenewal.subscriptionNumber} · {money(nextRenewal.recurringTotal)}</p>}</div>
      <div className="card metric-card"><div className="flex justify-between"><p className="text-sm text-slate-500">Payments made</p><CreditCard size={18} className="text-emerald-600"/></div><p className="metric-value">{money(portfolio?.summary?.paid)}</p><Link className="inline-action mt-2" to="/app/payments">View payments</Link></div>
      <div className="card metric-card"><div className="flex justify-between"><p className="text-sm text-slate-500">Outstanding balance</p><AlertTriangle size={18} className="text-amber-600"/></div><p className="metric-value">{money(portfolio?.summary?.outstanding)}</p><Link className="inline-action mt-2" to="/app/invoices">Review invoices</Link></div>
    </div>
    <div className="customer-detail-grid mt-6">
      <section className="card"><div className="panel-heading"><div><h2>Recent subscriptions</h2><p>Plans connected to your account</p></div><Link className="inline-action" to="/app/subscriptions">View all</Link></div>{portfolio?.subscriptions?.slice(0,4).map((row) => <Link className="compact-record" key={row._id} to={`/app/subscriptions/${row._id}`}><span><strong>{row.subscriptionNumber}</strong><small>{row.planName} · {row.billingFrequency}</small></span><span className={`status-text status-${row.status?.toLowerCase()}`}>{row.status}</span></Link>)}{!summary.isLoading && !portfolio?.subscriptions?.length && <p className="empty-copy">No subscriptions yet. <Link className="inline-action" to="/app/plans">Explore available plans</Link></p>}</section>
      <section className="card"><div className="panel-heading"><div><h2>Latest invoices</h2><p>Statements and balances</p></div><Link className="inline-action" to="/app/invoices">View all</Link></div>{portfolio?.invoices?.slice(0,4).map((row) => <Link className="compact-record" key={row._id} to={`/app/invoices/${row._id}`}><span><strong>{row.invoiceNumber}</strong><small>{formatDate(row.invoiceDate)} · {money(row.grandTotal)}</small></span><span className={`status-text status-${row.status?.toLowerCase()}`}>{row.status}</span></Link>)}{!summary.isLoading && !portfolio?.invoices?.length && <p className="empty-copy">Invoices will appear here when billing begins.</p>}</section>
      <section className="card"><div className="panel-heading"><div><h2>Recent payments</h2><p>Recorded against your invoices</p></div><Link className="inline-action" to="/app/payments">View all</Link></div>{portfolio?.payments?.slice(0,5).map((row) => <Link className="compact-record" key={row._id} to={`/app/payments/${row._id}`}><span><strong>{row.referenceNote || row.invoiceNumber}</strong><small>{row.invoiceNumber} · {formatDate(row.paymentDate)}</small></span><strong>{money(row.amount)}</strong></Link>)}{!summary.isLoading && !portfolio?.payments?.length && <p className="empty-copy">No payments recorded yet.</p>}</section>
      <section className="card"><h2>Important notices</h2>{notifications.isLoading ? <p role="status" className="mt-3">Loading notices…</p> : notifications.isError ? <p className="error mt-3">Notices are unavailable. <button className="inline-action" onClick={() => notifications.refetch()}>Retry</button></p> : notifications.data?.data?.length ? notifications.data.data.slice(0,5).map((item) => <Link key={`${item.type}-${item.id}`} className="compact-record" to={item.href}><span><strong>{item.title}</strong><small>{item.detail}</small></span><span>{formatDate(item.date)}</span></Link>) : <p className="empty-copy mt-3">No account notices right now.</p>}</section>
    </div>
  </>;
}

function money(amount) { return amount === undefined ? '—' : formatCurrency(amount); }

export { PageHeader as Header };
