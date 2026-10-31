import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import { formatCurrency, formatDate } from '../utils/locale';

function useLoad(key, url, params) {
  return useQuery({ queryKey: [key, params], queryFn: async () => (await api.get(url, { params })).data, staleTime: 30000 });
}

export function BillingCalendarPage() {
  const [view, setView] = useState('month');
  const [type, setType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [anchor, setAnchor] = useState(() => new Date());
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(anchor);
  const byPart = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const y = Number(byPart.year); const m = Number(byPart.month); const d = Number(byPart.day);
  const businessDate = (year, month, day) => new Date(Date.UTC(year, month - 1, day) - 330 * 60 * 1000);
  const calendarAnchor = new Date(Date.UTC(y, m - 1, d));
  const weekdayOffset = (calendarAnchor.getUTCDay() + 6) % 7;
  const monthStartDay = view === 'week' ? d - weekdayOffset : view === 'day' ? d : 1;
  const from = businessDate(y, m, monthStartDay);
  const to = view === 'week' ? new Date(from.getTime() + 7 * 86400000) : view === 'day' ? new Date(from.getTime() + 86400000) : businessDate(y, m + 1, 1);
  const gridStart = new Date(Date.UTC(y, m - 1, monthStartDay - weekdayOffset));
  const gridDays = Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => new Date(gridStart.getTime() + index * 86400000));
  const q = useLoad('billing-calendar', '/billing/calendar', { start: from.toISOString(), end: to.toISOString(), type: type || undefined, status: statusFilter || undefined, search: search || undefined, plan: planFilter || undefined, product: productFilter || undefined, limit: 100 });
  const events = q.data?.data || [];
  const title = view === 'month' ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(anchor) : view === 'week' ? `${formatDate(from)} â€“ ${formatDate(new Date(to.getTime() - 1))}` : view === 'day' ? formatDate(from) : 'Scheduled billing events';
  return <><PageHeader title="Billing calendar" subtitle="Upcoming renewal expectations and invoice due dates, shown in India business time." />
    <section className="card mb-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button className="button secondary-button" onClick={() => setAnchor(view === 'week' ? new Date(anchor.getTime() - 7 * 86400000) : view === 'day' ? new Date(anchor.getTime() - 86400000) : new Date(Date.UTC(y, m - 2, 1)))}>Previous</button><button className="button secondary-button" onClick={() => setAnchor(new Date())}>Today</button><button className="button secondary-button" onClick={() => setAnchor(view === 'week' ? new Date(anchor.getTime() + 7 * 86400000) : view === 'day' ? new Date(anchor.getTime() + 86400000) : new Date(Date.UTC(y, m, 1)))}>Next</button><strong className="self-center">{title}</strong></div><div className="flex flex-wrap gap-2"><select className="field w-auto" value={view} onChange={(e) => setView(e.target.value)} aria-label="Calendar view"><option value="month">Month</option><option value="week">Week</option><option value="day">Day</option><option value="list">List</option></select><select className="field w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter event type"><option value="">All event types</option><option value="renewal">Renewals</option><option value="plan_change">Plan changes</option><option value="invoice_due">Invoice due</option><option value="overdue">Overdue</option></select><select className="field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter event status"><option value="">All statuses</option><option>Active</option><option>Confirmed</option><option>Overdue</option><option>Scheduled</option></select><input className="field w-44" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search customer or record" placeholder="Customer or record"/><input className="field w-36" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} aria-label="Filter plan name" placeholder="Plan name"/><input className="field w-36" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} aria-label="Filter product name" placeholder="Product name"/></div></div>
      <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-4"><Metric label="Events in range" value={q.data?.summary?.events ?? 'â€”'} /><Metric label="Expected renewal billing" value={formatCurrency((q.data?.summary?.expectedRecurringMinor || 0) / 100)} /><Metric label="Invoices due" value={q.data?.summary?.dueSoon ?? 'â€”'} /><Metric label="Overdue invoices" value={q.data?.summary?.overdue ?? 'â€”'} /></div></section>
    <LoadState query={q} />
    {!q.isLoading && !q.isError && (events.length ? (view === 'list' || view === 'day') ? <div className="card overflow-hidden p-0"><div className="overflow-x-auto"><table className="resource-table"><thead><tr><th>Date</th><th>Event</th><th>Customer</th><th>Subscription / invoice</th><th className="amount-cell">Expected / outstanding</th><th>Status</th></tr></thead><tbody>{events.map((e) => <tr key={e.id}><td>{formatDate(e.date)}</td><td><button className="inline-action" onClick={() => setSelected(e)}>{e.type.replaceAll('_', ' ')}</button></td><td>{e.customer}</td><td>{e.subscription || e.invoice || 'â€”'}</td><td className="amount-cell">{formatCurrency(e.amount)}</td><td><span className="badge">{e.status}</span></td></tr>)}</tbody></table></div><p className="p-3 text-xs text-slate-500">Renewal values are expected recurring amounts, not invoices or collected cash.</p></div> : <section className="card"><div className="grid grid-cols-7 border-l border-t">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <strong key={day} className="border-b border-r p-2 text-center text-xs">{day}</strong>)}{gridDays.map((day) => { const dayEvents = events.filter((event) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(event.date)) === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(day)); return <div key={day.toISOString()} className={`min-h-24 border-b border-r p-2 ${view === 'month' && day.getUTCMonth() !== m - 1 ? 'bg-slate-50 text-slate-400' : ''}`}><time className="text-xs font-medium">{day.getUTCDate()}</time><div className="mt-1 grid gap-1">{dayEvents.slice(0, 3).map((event) => <button key={event.id} className="truncate rounded border border-emerald-200 bg-emerald-50 px-1 py-1 text-left text-[10px] text-emerald-900" onClick={() => setSelected(event)} title={`${event.title} Â· ${event.customer} Â· ${formatCurrency(event.amount)}`}>{event.type === 'renewal' ? 'Renewal' : event.type === 'plan_change' ? 'Plan change' : event.type === 'overdue' ? 'Overdue' : 'Invoice'} Â· {event.customer}</button>)}{dayEvents.length > 3 && <small>+{dayEvents.length - 3} more</small>}</div></div>; })}</div><p className="p-3 text-xs text-slate-500">Renewal values are expected recurring amounts, not invoices or collected cash.</p></section> : <Empty message="No billing events in this date range." />)}
    {selected && <div className="command-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="command-dialog p-5" role="dialog" aria-modal="true" aria-label="Billing event details" onClick={(e) => e.stopPropagation()}><div className="flex justify-between"><h2 className="font-semibold">{selected.title}</h2><button className="inline-action" onClick={() => setSelected(null)}>Close</button></div><dl className="mt-4 grid gap-3"><div><dt className="text-xs text-slate-500">Date</dt><dd>{formatDate(selected.date)}</dd></div><div><dt className="text-xs text-slate-500">Customer</dt><dd>{selected.customer}</dd></div><div><dt className="text-xs text-slate-500">Subscription / invoice</dt><dd>{selected.subscription || selected.invoice || 'â€”'}</dd></div><div><dt className="text-xs text-slate-500">Amount</dt><dd>{formatCurrency(selected.amount)}</dd></div><div><dt className="text-xs text-slate-500">Status</dt><dd>{selected.status}</dd></div></dl><Link className="inline-action mt-4 inline-block" to={selected.invoiceId ? `/app/invoices/${selected.invoiceId}` : `/app/subscriptions/${selected.subscriptionId}`}>Open related record</Link></section></div>}
  </>;
}

export function SubscriptionHealthPage() {
  const [health, setHealth] = useState('ALL'); const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [selected, setSelected] = useState(null);
  const q = useLoad('subscription-health', '/subscriptions/health', { health, search, page, limit: 25 });
  return <><PageHeader title="Subscription health" subtitle="Rule based monitoring of renewals, unpaid invoices, and inactive subscriptions." />
    <div className="grid grid-cols-2 gap-3 mb-3 md:grid-cols-4">{Object.entries(q.data?.summary || {}).map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div>
    <div className="grid grid-cols-2 gap-3 mb-5 md:grid-cols-5">{Object.entries(q.data?.indicators || {}).map(([label, value]) => <Metric key={label} label={label.replaceAll(/([A-Z])/g, ' $1')} value={value} />)}</div>
    <div className="resource-toolbar"><label className="sr-only" htmlFor="health-status">Health category</label><select id="health-status" className="field w-auto" value={health} onChange={(e) => { setHealth(e.target.value); setPage(1); }}><option value="ALL">All health states</option>{['Healthy','Attention Required','At Risk','Inactive'].map((s) => <option key={s}>{s}</option>)}</select><label className="sr-only" htmlFor="health-search">Search health list</label><input id="health-search" className="field" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search customer, plan, or reason" /></div>
    <LoadState query={q} />
    {!q.isLoading && !q.isError && (q.data?.data?.length ? <div className="card overflow-hidden p-0"><div className="overflow-x-auto"><table className="resource-table"><thead><tr><th>Subscription</th><th>Customer</th><th>Plan</th><th className="amount-cell">Recurring</th><th>Health</th><th className="amount-cell">Outstanding</th><th>Next billing</th><th>Last payment</th><th>Reason / action</th></tr></thead><tbody>{q.data.data.map((s) => <tr key={s._id}><td><Link className="inline-action" to={`/app/subscriptions/${s._id}`}>{s.subscriptionNumber}</Link></td><td>{s.customerName}</td><td>{s.planName}</td><td className="amount-cell">{formatCurrency(s.recurringTotal)}</td><td><span className="badge">{s.health}</span></td><td className="amount-cell">{formatCurrency(s.outstanding)}</td><td>{formatDate(s.nextBillingDate)}</td><td>{formatDate(s.lastPaymentDate)}</td><td><span>{s.reasons.join(' ') || 'No current issue.'}</span><button className="inline-action ml-2" onClick={() => setSelected(s)}>Details</button></td></tr>)}</tbody></table></div><div className="pagination-row"><span>{q.data.total} subscriptions</span><div><button className="pagination-button" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>Previous</button><button className="pagination-button" disabled={page * q.data.pageSize >= q.data.total} onClick={() => setPage((x) => x + 1)}>Next</button></div></div></div> : <Empty message="No subscriptions match this filter." />)}
    {selected && <div className="command-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="command-dialog p-5" role="dialog" aria-modal="true" aria-label="Subscription attention details" onClick={(e) => e.stopPropagation()}><div className="flex justify-between"><h2 className="font-semibold">{selected.subscriptionNumber}</h2><button className="inline-action" onClick={() => setSelected(null)}>Close</button></div><p className="mt-3">{selected.customerName} Â· {selected.planName}</p><p className="mt-2">Health: <strong>{selected.health}</strong></p><p className="mt-2">{selected.reasons.join(' ') || 'No current issue.'}</p><p className="mt-2">Outstanding: {formatCurrency(selected.outstanding)} Â· Next billing: {formatDate(selected.nextBillingDate)} Â· Last payment: {formatDate(selected.lastPaymentDate)}</p><h3 className="mt-4 font-medium">Open invoices</h3>{selected.relatedInvoices?.length ? selected.relatedInvoices.map((invoice) => <Link className="compact-record" key={invoice.invoiceNumber} to={`/app/invoices/${invoice._id}`}><span>{invoice.invoiceNumber} Â· {formatDate(invoice.dueDate)}</span><span>{formatCurrency(invoice.amount)} Â· {invoice.status}</span></Link>) : <p className="empty-copy">No open invoices.</p>}<div className="mt-4 flex gap-3"><Link className="inline-action" to="/app/invoices">Open invoices</Link><Link className="inline-action" to={`/app/subscriptions/${selected._id}`}>Open subscription</Link></div></section></div>}
  </>;
}

export function RevenueIntelligencePage() {
  const [days, setDays] = useState(90);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const q = useLoad('revenue-intelligence', '/analytics/revenue/summary', days === 0 ? { startDate, endDate } : { days });
  const data = q.data;
  const s = data?.summary;
  const chartMoney = (value) => formatCurrency(value);
  return <>
    <PageHeader title="Revenue intelligence" subtitle="Current recurring portfolio, observed subscription movements, and dated cash collections." />
    <div className="flex flex-wrap gap-2 mb-4">
      <label className="sr-only" htmlFor="revenue-range">Revenue trend range</label>
      <select id="revenue-range" className="field w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
        <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">12 months</option><option value="0">Custom range</option>
      </select>
      {days === 0 && <>
        <label className="sr-only" htmlFor="revenue-start">From date</label><input id="revenue-start" className="field w-auto" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label className="sr-only" htmlFor="revenue-end">To date</label><input id="revenue-end" className="field w-auto" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </>}
    </div>
    <LoadState query={q} />
    {s && <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="MRR · current, net of tax" value={formatCurrency(s.mrr)} /><Metric label="ARR · 12× MRR" value={formatCurrency(s.arr)} />
        <Metric label="Lifetime collected" value={formatCurrency(s.collected)} /><Metric label="New MRR in range" value={formatCurrency(s.newMrr)} />
        <Metric label="Expansion MRR" value={formatCurrency(s.expansionMrr)} /><Metric label="Contraction MRR" value={formatCurrency(s.contractionMrr)} />
        <Metric label="Churned MRR" value={formatCurrency(s.churnedMrr)} /><Metric label="Net revenue retention" value={s.nrr === null ? 'Unavailable' : `${s.nrr}%`} />
        <Metric label="Customer churn" value={s.customerChurnRate === null ? 'Unavailable' : `${s.customerChurnRate}%`} />
      </div>
      <div className="customer-detail-grid mt-5">
        <section className="card"><h2 className="font-semibold">Recorded collections</h2><p className="mt-1 text-xs text-slate-500">Payment dates in the selected range; no missing history is synthesized.</p>{data.trends?.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={data.trends}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis tickFormatter={chartMoney}/><Tooltip formatter={chartMoney}/><Line type="monotone" dataKey="collected" stroke="#167d6b" name="Collected" dot={false}/></LineChart></ResponsiveContainer> : <Empty message="No recorded collections in this range."/>}</section>
        <section className="card"><h2 className="font-semibold">MRR trend</h2>{data.mrrTrend?.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={data.mrrTrend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis tickFormatter={chartMoney}/><Tooltip formatter={chartMoney}/><Line type="monotone" dataKey="mrr" stroke="#167d6b" name="MRR" dot={false}/></LineChart></ResponsiveContainer> : <Empty message={data.definitions?.historicalLimitation || 'No complete historical MRR snapshots for this range.'}/>}</section>
        <section className="card"><h2 className="font-semibold">ARR trend</h2>{data.mrrTrend?.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={data.mrrTrend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis tickFormatter={chartMoney}/><Tooltip formatter={chartMoney}/><Line type="monotone" dataKey="arr" stroke="#406b84" name="ARR" dot={false}/></LineChart></ResponsiveContainer> : <Empty message={data.definitions?.historicalLimitation || 'No complete historical ARR snapshots for this range.'}/>}</section>
        <section className="card"><h2 className="font-semibold">Subscription growth and cancellations</h2>{data.subscriptionTrend?.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={data.subscriptionTrend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="newSubscriptions" fill="#167d6b" name="New active subscriptions"/><Bar dataKey="cancelledSubscriptions" fill="#bc6554" name="Cancelled subscriptions"/></BarChart></ResponsiveContainer> : <Empty message="No activation or cancellation events are recorded in this range."/>}</section>
        <section className="card"><h2 className="font-semibold">Active recurring by product</h2>{data.revenueByProduct?.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={data.revenueByProduct}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis tickFormatter={(n) => formatCurrency(n / 100)}/><Tooltip formatter={(v) => formatCurrency(v / 100)}/><Bar dataKey="minor" fill="#167d6b" name="Monthly recurring"/></BarChart></ResponsiveContainer> : <Empty message="No active recurring products."/>}</section>
        <section className="card"><h2 className="font-semibold">Active recurring by plan</h2>{data.revenueByPlan?.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={data.revenueByPlan}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis tickFormatter={(n) => formatCurrency(n / 100)}/><Tooltip formatter={(v) => formatCurrency(v / 100)}/><Bar dataKey="minor" fill="#406b84" name="Monthly recurring"/></BarChart></ResponsiveContainer> : <Empty message="No active plans."/>}</section>
        <section className="card"><h2 className="font-semibold">Customer recurring contribution</h2>{data.topCustomers?.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={data.topCustomers} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" tickFormatter={chartMoney}/><YAxis type="category" dataKey="name" width={110}/><Tooltip formatter={chartMoney}/><Bar dataKey="mrr" fill="#167d6b" name="Current MRR"/></BarChart></ResponsiveContainer> : <Empty message="No active customers."/>}</section>
      </div>
      <section className="card mt-5"><h2 className="font-semibold">Customer revenue analysis</h2><div className="grid gap-5 mt-3 xl:grid-cols-3">
        <CustomerRanking title="Top customers by MRR" rows={data.topCustomers} amountKey="mrr" />
        <CustomerRanking title="Top customers by collected revenue" rows={data.topCollectedCustomers} amountKey="amount" />
        <CustomerRanking title="Highest outstanding balances" rows={data.highOutstandingCustomers} amountKey="amount" />
      </div><h3 className="mt-5 font-medium">Active recurring by billing interval</h3><div className="mt-2 flex flex-wrap gap-2">{(data.revenueByInterval || []).map((item) => <div className="compact-record min-w-48" key={item.name}><span>{item.name}</span><strong>{formatCurrency(item.amount)}</strong></div>)}</div>
        <h3 className="mt-5 font-medium">Estimated upcoming recurring billing · next 90 days</h3>{data.forecast?.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{data.forecast.map((item) => <div key={item.date} className="compact-record"><span>{formatDate(item.date)}<small>Estimate</small></span><strong>{formatCurrency(item.amount)}</strong></div>)}</div> : <p className="empty-copy mt-2">No renewals are scheduled in the forecast period.</p>}
        {data.definitions?.historicalLimitation && <p className="mt-3 text-xs text-slate-500">{data.definitions.historicalLimitation}</p>}
      </section>
    </>}
  </>;
}

function CustomerRanking({ title, rows = [], amountKey }) {
  return <section><h3 className="text-sm font-medium">{title}</h3>{rows.length ? <div className="mt-2 overflow-x-auto"><table className="resource-table"><thead><tr><th>Customer</th><th className="amount-cell">Amount</th></tr></thead><tbody>{rows.map((row) => <tr key={row.customer}><td>{row.name}</td><td className="amount-cell">{formatCurrency(row[amountKey])}</td></tr>)}</tbody></table></div> : <p className="empty-copy mt-2">No records.</p>}</section>;
}

function Metric({ label, value }) { return <div className="card"><p className="text-sm text-slate-500">{label}</p><strong className="block mt-2 text-lg tabular-nums">{value}</strong></div>; }
function Empty({ message }) { return <div className="resource-empty"><strong>{message}</strong></div>; }
function LoadState({ query }) { return <>{query.isLoading && <p role="status" className="card mb-4">Loading recordsâ€¦</p>}{query.isError && <p className="error mb-4" role="alert">{query.error?.response?.data?.error || 'Unable to load this workspace.'} <button className="inline-action" onClick={() => query.refetch()}>Try again</button></p>}</>; }
