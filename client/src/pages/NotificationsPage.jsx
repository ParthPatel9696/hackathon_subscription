import { useQuery } from '@tanstack/react-query';
import { Bell, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import { formatDate } from '../utils/locale';

export default function NotificationsPage() {
  const query = useQuery({ queryKey: ['notifications'], queryFn: async () => (await api.get('/notifications')).data, staleTime: 30000 });
  return <>
    <PageHeader title="Notifications" subtitle="Billing alerts and renewal reminders from your account records." />
    <div className="mb-5 flex justify-end"><button type="button" className="button secondary-button" onClick={() => query.refetch()}><RefreshCw size={15} /> Refresh</button></div>
    {query.isLoading && <p className="card" role="status">Loading notifications…</p>}
    {query.isError && <p className="error" role="alert">{query.error?.response?.data?.error || 'Notifications could not be loaded.'} <button className="inline-action" onClick={() => query.refetch()}>Retry</button></p>}
    {!query.isLoading && !query.isError && (query.data?.data?.length ? <section className="card"><div className="divide-y">{query.data.data.map((item) => <Link key={`${item.type}-${item.id}`} to={item.href} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><span className={`notification-marker ${item.type}`} aria-hidden="true"><Bell size={14} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.title}</strong><small className="mt-1 block text-slate-500">{item.detail}</small></span><time className="shrink-0 text-xs text-slate-500">{formatDate(item.date)}</time></Link>)}</div><p className="mt-5 border-t pt-3 text-xs text-slate-500">These alerts are derived from current invoice and subscription records. Read status and notification preferences are not persisted yet.</p></section> : <div className="resource-empty"><Bell size={20} /><strong>No notifications need attention.</strong><span>Overdue invoices and upcoming renewals will appear here.</span></div>)}
  </>;
}
