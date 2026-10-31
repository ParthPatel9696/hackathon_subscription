import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import { useAuthStore } from '../store';
import { formatDate } from '../utils/locale';

export default function SubscriptionRequestsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('Pending');
  const query = useQuery({ queryKey: ['subscription-requests', status], queryFn: async () => (await api.get('/subscription-requests', { params: { status, page: 1, limit: 50 } })).data });
  const review = useMutation({ mutationFn: ({ id, decision }) => api.patch(`/subscription-requests/${id}/review`, { status: decision }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription-requests'] }) });
  return <><PageHeader title={role === 'customer' ? 'My requests' : 'Subscription requests'} subtitle={role === 'customer' ? 'Track questions and requested changes for your subscriptions.' : 'Review customer submitted subscription changes, cancellations, and support requests.'} />
    <div className="resource-toolbar"><label className="sr-only" htmlFor="request-status">Request status</label><select id="request-status" className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option>Pending</option><option>Approved</option><option>Rejected</option></select><button className="button secondary-button" onClick={() => query.refetch()}>Refresh</button></div>
    {query.isLoading && <p className="card" role="status">Loading requests…</p>}
    {query.isError && <p className="error" role="alert">{query.error?.response?.data?.error || 'Requests could not be loaded.'} <button className="inline-action" onClick={() => query.refetch()}>Retry</button></p>}
    {!query.isLoading && !query.isError && (query.data?.data?.length ? <div className="card overflow-hidden p-0"><div className="overflow-x-auto"><table className="resource-table"><thead><tr><th>Request</th>{role !== 'customer' && <th>Customer</th>}<th>Subscription</th><th>Requested change</th><th>Submitted</th><th>Status</th>{role !== 'customer' && <th>Review</th>}</tr></thead><tbody>{query.data.data.map((item) => <tr key={item._id}><td>{item.requestType.replaceAll('_', ' ') }<small>{item.message}</small>{item.reviewNote && <small>Review: {item.reviewNote}</small>}</td>{role !== 'customer' && <td>{item.customer?.companyName || item.customer?.name}<small>{item.customer?.email}</small></td>}<td>{item.subscription ? <Link className="inline-action" to={`/app/subscriptions/${item.subscription._id}`}>{item.subscription.subscriptionNumber}</Link> : '—'}</td><td>{item.targetPlan?.name || (item.targetQuantity ? `Quantity ${item.targetQuantity}` : '—')}</td><td>{formatDate(item.createdAt)}</td><td><span className="badge">{item.status}</span></td>{role !== 'customer' && <td>{item.status === 'Pending' ? <div className="flex gap-2"><button className="inline-action" disabled={review.isPending} onClick={() => review.mutate({ id: item._id, decision: 'Approved' })}>Approve</button><button className="inline-action text-rose-700" disabled={review.isPending} onClick={() => review.mutate({ id: item._id, decision: 'Rejected' })}>Reject</button></div> : 'Reviewed'}</td>}</tr>)}</tbody></table></div><p className="p-3 text-xs text-slate-500">Approved plan and quantity changes are scheduled for the next billing cycle. Approved cancellations close eligible subscriptions. Approval does not collect or refund money.</p></div> : <div className="resource-empty"><strong>No {status.toLowerCase()} requests</strong><span>{role === 'customer' ? 'You can submit a request from an active subscription.' : 'Customer requests will appear here.'}</span></div>)}
    {review.isError && <p className="error mt-3" role="alert">{review.error?.response?.data?.error || 'Unable to review this request.'}</p>}
  </>;
}
