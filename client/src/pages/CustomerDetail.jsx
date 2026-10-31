import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, FileText, Wallet } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { CustomerForm, SubscriptionForm } from '../components/WorkflowForms';
import { useAuthStore } from '../store';
import { formatCurrency, formatDate } from '../utils/locale';

const tabs = ['Overview', 'Subscriptions', 'Quotations', 'Invoices', 'Payments', 'Activity', 'Notes'];
export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [tab, setTab] = useState('Overview');
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [editNoteId, setEditNoteId] = useState(null);
  const [editNoteBody, setEditNoteBody] = useState('');
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['customer', id], queryFn: async () => (await api.get(`/customers/${id}`)).data.data });
  const notes = useQuery({ queryKey: ['customer-notes', id], queryFn: async () => (await api.get(`/customers/${id}/notes`)).data.data });
  const activity = useQuery({ queryKey: ['customer-activity', id], queryFn: async () => (await api.get(`/customers/${id}/activity`)).data.data });
  const saveNote = useMutation({ mutationFn: (body) => api.post(`/customers/${id}/notes`, { body }), onSuccess: () => { setNoteBody(''); queryClient.invalidateQueries({ queryKey: ['customer-notes', id] }); queryClient.invalidateQueries({ queryKey: ['customer-activity', id] }); } });
  const saveTags = useMutation({ mutationFn: (tags) => api.patch(`/customers/${id}/tags`, { tags }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', id] }) });
  const deleteNote = useMutation({ mutationFn: (noteId) => api.delete(`/customers/${id}/notes/${noteId}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customer-notes', id] }); queryClient.invalidateQueries({ queryKey: ['customer-activity', id] }); } });
  const updateNote = useMutation({ mutationFn: ({ noteId, body }) => api.patch(`/customers/${id}/notes/${noteId}`, { body }), onSuccess: () => { setEditNoteId(null); queryClient.invalidateQueries({ queryKey: ['customer-notes', id] }); queryClient.invalidateQueries({ queryKey: ['customer-activity', id] }); } });
  const archive = useMutation({ mutationFn: async () => api.delete(`/customers/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); queryClient.invalidateQueries({ queryKey: ['customer'] }); navigate('/app/customers'); } });
  if (isLoading) return <div className="card" role="status">Loading customer record…</div>;
  if (error || !data) return <div className="error" role="alert">{error?.response?.data?.error || 'Customer record is unavailable.'} <button className="inline-action" onClick={() => refetch()}>Try again</button></div>;
  const { customer, summary, subscriptions, invoices, payments } = data;
  return <>
    <Link to="/app/customers" className="back-link"><ArrowLeft size={15}/> Customers</Link>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <PageHeader title={customer.companyName || customer.name} subtitle={`${customer.name} · ${customer.email}`} />
      <div className="flex flex-wrap gap-2">
        {['admin','staff'].includes(currentUser?.role) && <>
          <button type="button" className="button" onClick={() => setCreatingQuote(true)}>Create quotation</button>
          <button type="button" className="button secondary-button" onClick={() => setTab('Notes')}>Add internal note</button>
        </>}
        {currentUser?.role === 'admin' && <>
          <button type="button" className="button secondary-button" onClick={() => setEditing(true)}>Edit customer</button>
          {customer.accountStatus !== 'Archived' && <button type="button" className="button danger-button" onClick={() => setConfirmArchive(true)}>Archive account</button>}
        </>}
      </div>
    </div>
    {customer.accountStatus === 'Archived' && <p className="notice-banner mb-4">This customer account is archived and cannot sign in.</p>}
    {editing && <CustomerForm customer={customer} onClose={() => setEditing(false)} />}
    {creatingQuote && <SubscriptionForm initialCustomer={customer} onClose={() => { setCreatingQuote(false); refetch(); }} />}
    {confirmArchive && <Modal title="Archive customer account" onClose={() => setConfirmArchive(false)}><p className="text-sm text-slate-600">Archiving prevents this customer from signing in. Their billing and subscription history stays available to the team. Accounts with active subscriptions or unpaid invoices cannot be archived.</p>{archive.isError && <p className="error mt-3" role="alert">{archive.error?.response?.data?.error || 'Unable to archive this account.'}</p>}<div className="mt-5 flex justify-end gap-2"><button className="button secondary-button" onClick={() => setConfirmArchive(false)}>Keep account</button><button className="button danger-button" disabled={archive.isPending} onClick={() => archive.mutate()}>{archive.isPending ? 'Archiving…' : 'Archive account'}</button></div></Modal>}
    <div className="customer-summary-grid">
      <Summary icon={Wallet} label="Active recurring" value={formatCurrency(summary.activeRecurring)} detail={`${summary.activeSubscriptions} active`} />
      <Summary icon={Wallet} label="Lifetime collected" value={formatCurrency(summary.lifetimeRevenue)} />
      <Summary icon={FileText} label="Total invoiced" value={formatCurrency(summary.invoiced)} />
      <Summary icon={CreditCard} label="Payments received" value={formatCurrency(summary.paid)} />
      <Summary icon={CreditCard} label="Outstanding" value={formatCurrency(summary.outstanding)} />
    </div>
    <div className="detail-tabs" role="tablist" aria-label="Customer details">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}<span>{item === 'Subscriptions' ? subscriptions.filter((row) => row.status !== 'Quotation' && row.status !== 'Draft').length : item === 'Quotations' ? subscriptions.filter((row) => ['Quotation', 'Draft'].includes(row.status)).length : item === 'Invoices' ? invoices.length : item === 'Payments' ? payments.length : ''}</span></button>)}</div>
    {tab === 'Overview' && <div className="customer-detail-grid"><section className="card"><h2>Account information</h2><dl className="detail-dl"><dt>Customer name</dt><dd>{customer.name}</dd><dt>Legal / display company</dt><dd>{customer.companyName || 'Not provided'}</dd><dt>Customer type</dt><dd>{customer.customerType || 'Business'}</dd><dt>Primary / alternate email</dt><dd><a href={`mailto:${customer.email}`}>{customer.email}</a>{customer.alternateEmail ? ` · ${customer.alternateEmail}` : ''}</dd><dt>Phone</dt><dd>{[customer.phone, customer.alternatePhone].filter(Boolean).join(' · ') || 'Not provided'}</dd><dt>Website</dt><dd>{customer.website || 'Not provided'}</dd><dt>Tax ID</dt><dd>{customer.taxId || 'Not provided'}</dd><dt>Billing contact</dt><dd>{[customer.billingContactName, customer.billingContactEmail, customer.billingContactPhone].filter(Boolean).join(' · ') || 'Not provided'}</dd><dt>Billing address</dt><dd>{[customer.billingAddress, customer.billingAddressLine2, customer.billingCity, customer.billingState, customer.billingPostalCode, customer.billingCountry].filter(Boolean).join(', ') || 'Not provided'}</dd><dt>Shipping address</dt><dd>{customer.shippingAddress || 'Not provided'}</dd><dt>Payment terms / method</dt><dd>{customer.paymentTerms || 'Net 30 Days'} · {customer.preferredPaymentMethod || 'Not specified'}</dd><dt>Assigned staff</dt><dd>{customer.assignedStaff?.name || 'Unassigned'}</dd><dt>Currency</dt><dd>INR</dd><dt>Account status</dt><dd>{customer.accountStatus || 'Active'}</dd><dt>Account since</dt><dd>{formatDate(customer.createdAt)}</dd><dt>Tags</dt><dd>{customer.tags?.join(', ') || 'No tags'}</dd></dl>{currentUser?.role === 'admin' && <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); saveTags.mutate(tagsText.split(',').map((x) => x.trim()).filter(Boolean)); }}><label className="sr-only" htmlFor="customer-tags">Customer tags separated by commas</label><input id="customer-tags" className="field" value={tagsText || (customer.tags || []).join(', ')} onChange={(e) => setTagsText(e.target.value)} placeholder="VIP, High Value"/><button className="button secondary-button" disabled={saveTags.isPending}>Save tags</button></form>}</section><section className="card"><h2>Recent subscriptions</h2>{subscriptions.slice(0,4).map((row) => <div className="compact-record" key={row._id}><span><strong><Link className="inline-action" to={`/app/subscriptions/${row._id}`}>{row.subscriptionNumber}</Link></strong><small>{row.planName} · {row.billingFrequency}</small></span><span className={`status-text status-${row.status?.toLowerCase()}`}>{row.status}</span></div>)}{subscriptions.length === 0 && <p className="empty-copy">No subscriptions recorded.</p>}</section></div>}
    {tab === 'Subscriptions' && <RecordTable title="Subscriptions" rows={subscriptions.filter((row) => !['Quotation', 'Draft'].includes(row.status))} columns={['subscriptionNumber','planName','billingFrequency','recurringTotal','status','nextBillingDate']} />}
    {tab === 'Quotations' && <RecordTable title="Quotations" rows={subscriptions.filter((row) => ['Quotation', 'Draft'].includes(row.status))} columns={['subscriptionNumber','planName','billingFrequency','recurringTotal','status','quotationValidUntil']} />}
    {tab === 'Invoices' && <RecordTable title="Invoices" rows={invoices} columns={['invoiceNumber','invoiceDate','dueDate','grandTotal','paidAmount','outstanding','status']} />}
    {tab === 'Payments' && <RecordTable title="Payments" rows={payments} columns={['invoiceNumber','paymentDate','amount','method','referenceNote']} />}
    {tab === 'Activity' && <section className="card"><h2 className="font-semibold">Customer activity</h2>{activity.isLoading ? <p role="status">Loading activity…</p> : activity.isError ? <p className="error">Could not load activity. <button className="inline-action" onClick={() => activity.refetch()}>Retry</button></p> : activity.data?.length ? <ol className="mt-4 space-y-3">{activity.data.map((event) => <li key={event.id} className="compact-record"><span><strong>{event.title}</strong><small>{event.detail}</small></span><time>{formatDate(event.at)}</time></li>)}</ol> : <p className="empty-copy">No recorded activity.</p>}</section>}
    {tab === 'Notes' && <section className="card"><h2 className="font-semibold">Internal notes</h2><p className="mt-1 text-sm text-slate-500">Visible only to the Brightloop team.</p><form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); saveNote.mutate(noteBody); }}><label className="sr-only" htmlFor="new-customer-note">Add an internal note</label><textarea id="new-customer-note" className="field min-h-24" maxLength={5000} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add context for your team" required/><button className="button justify-self-start" disabled={saveNote.isPending || !noteBody.trim()}>Add note</button>{saveNote.isError && <p className="error">{saveNote.error?.response?.data?.error || 'Unable to save note.'}</p>}</form>{notes.isLoading ? <p className="mt-4" role="status">Loading notes…</p> : notes.isError ? <p className="error mt-4">Could not load notes. <button className="inline-action" onClick={() => notes.refetch()}>Retry</button></p> : <div className="mt-4 space-y-3">{notes.data?.map((note) => <article className="compact-record items-start" key={note._id}><span><strong>{note.authorName} · {formatDate(note.createdAt)}</strong>{editNoteId === note._id ? <form className="mt-2 grid gap-2" onSubmit={(event) => { event.preventDefault(); updateNote.mutate({ noteId: note._id, body: editNoteBody }); }}><textarea className="field min-h-20" maxLength={5000} value={editNoteBody} onChange={(e) => setEditNoteBody(e.target.value)} required/><div className="flex gap-2"><button className="button secondary-button">Save edit</button><button type="button" className="button secondary-button" onClick={() => setEditNoteId(null)}>Cancel</button></div></form> : <p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>}</span><div className="flex gap-2">{editNoteId !== note._id && <button className="inline-action" onClick={() => { setEditNoteId(note._id); setEditNoteBody(note.body); }}>Edit</button>}<button className="inline-action text-rose-700" onClick={() => setNoteToDelete(note)}>Delete</button></div></article>)}</div>}{deleteNote.isError && <p className="error mt-3">Unable to delete note.</p>}</section>}
    {noteToDelete && <Modal title="Delete internal note?" onClose={() => setNoteToDelete(null)}><p className="text-sm text-slate-600">This permanently removes the selected internal note.</p><div className="mt-5 flex justify-end gap-2"><button className="button secondary-button" onClick={() => setNoteToDelete(null)}>Cancel</button><button className="button danger-button" disabled={deleteNote.isPending} onClick={() => deleteNote.mutate(noteToDelete._id, { onSuccess: () => setNoteToDelete(null) })}>Delete note</button></div></Modal>}
  </>;
}
function Summary({ icon: Icon, label, value, detail }) { return <div className="card customer-summary"><span className="summary-icon"><Icon size={16}/></span><small>{label}</small><strong>{value}</strong>{detail && <em>{detail}</em>}</div>; }
function RecordTable({ title, rows, columns }) {
  if (!rows.length) return <div className="card empty-copy">No {title.toLowerCase()} recorded for this customer.</div>;
  const label = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
  const value = (key, row) => {
    const cell = key === 'outstanding' ? Math.max(0, Number(row.grandTotal || 0) - Number(row.paidAmount || 0)) : row[key];
    if (cell === undefined || cell === null || cell === '') return '—';
    if (/Date$|Until$/.test(key) || key === 'invoiceDate') return formatDate(cell);
    if (key === 'subscriptionNumber') return <Link className="inline-action" to={`/app/subscriptions/${row._id}`}>{cell}</Link>;
    if (key === 'invoiceNumber' && row._id) return <Link className="inline-action" to={title === 'Payments' ? `/app/payments/${row._id}` : `/app/invoices/${row._id}`}>{cell}</Link>;
    if (['grandTotal','paidAmount','outstanding','amount','recurringTotal'].includes(key)) return formatCurrency(cell);
    return String(cell);
  };
  return <div className="card overflow-hidden p-0"><div className="table-scroll"><table className="detail-table"><caption className="sr-only">{title} for this customer</caption><thead><tr>{columns.map((key) => <th key={key}>{label(key)}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row._id}>{columns.map((key) => <td key={key}>{value(key,row)}</td>)}</tr>)}</tbody></table></div></div>;
}
