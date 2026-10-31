import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Download, Plus, RefreshCw } from 'lucide-react';
import api from '../api';
import { Header } from './Dashboard';
import { BillingBatch, DiscountForm, PaymentForm, SubscriptionForm, TransitionForm, useTableFilters } from '../components/WorkflowForms';

export default function ResourcePage({ title, endpoint, resource }) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: [endpoint], queryFn: async () => (await api.get(endpoint)).data });
  const rows = Array.isArray(data?.data) ? data.data : data?.user ? [data.user] : [];
  const [modal, setModal] = useState(null);
  const { search, setSearch, status, setStatus, filtered } = useTableFilters(rows);
  const statuses = [...new Set(rows.map((row) => row.status).filter(Boolean))];
  const exportCsv = () => {
    const keys = [...new Set(filtered.flatMap((row) => Object.keys(row)))].filter((key) => !['_id', '__v', 'lines', 'variants'].includes(key));
    const csv = [keys.join(','), ...filtered.map((row) => keys.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `${title.toLowerCase().replaceAll(' ', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return <><Header title={title} subtitle="Live records from the Brightloop API." /><div className="mb-5 flex flex-wrap gap-2">
    <input className="field max-w-xs" placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} />
    {statuses.length > 0 && <select className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>}
    <button className="button flex items-center gap-2" onClick={() => refetch()}><RefreshCw size={16} /> Refresh</button>
    <button className="button flex items-center gap-2" onClick={exportCsv}><Download size={16} /> Export CSV</button>
    {resource === 'subscriptions' && <button className="button flex items-center gap-2" onClick={() => setModal('subscription')}><Plus size={16} /> New quotation</button>}
    {resource === 'payments' && <button className="button flex items-center gap-2" onClick={() => setModal('payment')}><Plus size={16} /> Record payment</button>}
    {resource === 'discounts' && <button className="button flex items-center gap-2" onClick={() => setModal('discount')}><Plus size={16} /> New discount</button>}
    {resource === 'invoices' && <button className="button flex items-center gap-2" onClick={() => setModal('billing')}><RefreshCw size={16} /> Run billing</button>}
  </div>{error && <p className="error mb-5">{error.response?.data?.error || 'Unable to load records.'}</p>}<div className="card overflow-hidden p-0">{isLoading ? <p className="p-6">Loading...</p> : filtered.length === 0 ? <p className="p-6 text-sm text-slate-500">No records found.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-6 py-4">Name / Number</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Amount</th><th className="px-6 py-4">Details</th><th className="px-6 py-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => <tr key={row._id || row.id || row.code || row.invoiceNumber}><td className="px-6 py-4 font-medium">{row.name || row.subscriptionNumber || row.invoiceNumber || row.email || row.code || 'Record'}</td><td className="px-6 py-4"><span className="badge">{row.status || row.role || 'Active'}</span></td><td className="px-6 py-4">{row.grandTotal !== undefined ? `$${row.grandTotal}` : row.recurringTotal !== undefined ? `$${row.recurringTotal}` : row.amount !== undefined ? `$${row.amount}` : '—'}</td><td className="max-w-xs truncate px-6 py-4 text-slate-500">{row.customerName || row.description || row.companyName || row.planName || '—'}</td><td className="px-6 py-4">{resource === 'subscriptions' && row._id && <button className="text-sm font-semibold text-blue-700" onClick={() => setModal(row)}>Change status</button>}</td></tr>)}</tbody></table></div>}</div>
    {modal === 'subscription' && <SubscriptionForm onClose={() => setModal(null)} />}{modal === 'payment' && <PaymentForm onClose={() => setModal(null)} />}{modal === 'discount' && <DiscountForm onClose={() => setModal(null)} />}{modal === 'billing' && <BillingBatch onClose={() => setModal(null)} />}{modal?._id && <TransitionForm subscription={modal} onClose={() => setModal(null)} />}
  </>;
}
