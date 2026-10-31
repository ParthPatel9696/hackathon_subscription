import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import PageHeader from '../components/PageHeader';
import { formatDate } from '../utils/locale';

export default function ActivityLogPage() {
  const [resourceType, setResourceType] = useState(''); const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['activity-log', resourceType, page], queryFn: async () => (await api.get('/activity-log', { params: { resourceType: resourceType || undefined, page, limit: 50 } })).data });
  return <><PageHeader title="Activity log" subtitle="Append-only record of captured account, subscription, and billing operations."/><div className="resource-toolbar"><label className="sr-only" htmlFor="activity-type">Resource type</label><select id="activity-type" className="field w-auto" value={resourceType} onChange={(e) => { setResourceType(e.target.value); setPage(1); }}><option value="">All resources</option>{['Customer','Subscription','Payment','Invoice','Product','Plan','SubscriptionRequest'].map((type) => <option key={type}>{type}</option>)}</select></div>
    {query.isLoading && <p className="card" role="status">Loading activity…</p>}{query.isError && <p className="error" role="alert">Activity log unavailable. <button className="inline-action" onClick={() => query.refetch()}>Retry</button></p>}
    {!query.isLoading && !query.isError && (query.data.data.length ? <div className="card overflow-hidden p-0"><div className="overflow-x-auto"><table className="resource-table"><thead><tr><th>Date</th><th>Actor</th><th>Role</th><th>Action</th><th>Resource</th><th>Customer</th><th>Change details</th></tr></thead><tbody>{query.data.data.map((event) => <tr key={event._id}><td>{formatDate(event.createdAt)}</td><td>{event.actor?.name || event.actorName}</td><td>{event.actorRole}</td><td>{event.action}</td><td>{event.resourceType} · {event.resourceId}</td><td>{event.customer?.companyName || event.customer?.name || '—'}</td><td>{JSON.stringify({ previous: event.previousValue, next: event.newValue, ...event.metadata })}</td></tr>)}</tbody></table></div><div className="pagination-row"><span>{query.data.total} events</span><div><button className="pagination-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="pagination-button" disabled={page * query.data.pageSize >= query.data.total} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></div> : <div className="resource-empty"><strong>No recorded events</strong><span>Events appear as supported operations are captured.</span></div>)}
  </>;
}
