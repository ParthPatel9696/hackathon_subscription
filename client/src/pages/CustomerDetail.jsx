import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, FileText, Wallet } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { CustomerForm } from '../components/WorkflowForms';
import { useAuthStore } from '../store';

const tabs = ['Overview', 'Subscriptions', 'Invoices', 'Payments'];
export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [tab, setTab] = useState('Overview');
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['customer', id], queryFn: async () => (await api.get(`/customers/${id}`)).data.data });
  const archive = useMutation({ mutationFn: async () => api.delete(`/customers/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); queryClient.invalidateQueries({ queryKey: ['customer'] }); navigate('/app/customers'); } });
  if (isLoading) return <div className="card" role="status">Loading customer record…</div>;
  if (error || !data) return <div className="error" role="alert">{error?.response?.data?.error || 'Customer record is unavailable.'} <button className="inline-action" onClick={() => refetch()}>Try again</button></div>;
  const { customer, summary, subscriptions, invoices, payments } = data;
  return <>
    <Link to="/app/customers" className="back-link"><ArrowLeft size={15}/> Customers</Link>
    <div className="flex flex-wrap items-start justify-between gap-3"><PageHeader title={customer.companyName || customer.name} subtitle={`${customer.name} · ${customer.email}`} />{currentUser?.role === 'admin' && <div className="flex gap-2"><button type="button" className="button secondary-button" onClick={() => setEditing(true)}>Edit customer</button>{customer.accountStatus !== 'Archived' && <button type="button" className="button danger-button" onClick={() => setConfirmArchive(true)}>Archive account</button>}</div>}</div>
    {customer.accountStatus === 'Archived' && <p className="notice-banner mb-4">This customer account is archived and cannot sign in.</p>}
    {editing && <CustomerForm customer={customer} onClose={() => setEditing(false)} />}
    {confirmArchive && <Modal title="Archive customer account" onClose={() => setConfirmArchive(false)}><p className="text-sm text-slate-600">Archiving prevents this customer from signing in. Their billing and subscription history stays available to the team. Accounts with active subscriptions or unpaid invoices cannot be archived.</p>{archive.isError && <p className="error mt-3" role="alert">{archive.error?.response?.data?.error || 'Unable to archive this account.'}</p>}<div className="mt-5 flex justify-end gap-2"><button className="button secondary-button" onClick={() => setConfirmArchive(false)}>Keep account</button><button className="button danger-button" disabled={archive.isPending} onClick={() => archive.mutate()}>{archive.isPending ? 'Archiving…' : 'Archive account'}</button></div></Modal>}
    <div className="customer-summary-grid">
      <Summary icon={Wallet} label="Subscriptions" value={summary.subscriptions} detail={`${summary.activeSubscriptions} active`} />
      <Summary icon={FileText} label="Total invoiced" value={currency(summary.invoiced)} />
      <Summary icon={CreditCard} label="Payments received" value={currency(summary.paid)} />
      <Summary icon={CreditCard} label="Outstanding" value={currency(summary.outstanding)} />
    </div>
    <div className="detail-tabs" role="tablist" aria-label="Customer details">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}<span>{item === 'Subscriptions' ? subscriptions.length : item === 'Invoices' ? invoices.length : item === 'Payments' ? payments.length : ''}</span></button>)}</div>
    {tab === 'Overview' && <div className="customer-detail-grid"><section className="card"><h2>Account information</h2><dl className="detail-dl"><dt>Customer name</dt><dd>{customer.name}</dd><dt>Company</dt><dd>{customer.companyName || 'Not provided'}</dd><dt>Email</dt><dd><a href={`mailto:${customer.email}`}>{customer.email}</a></dd><dt>Phone</dt><dd>{customer.phone || 'Not provided'}</dd><dt>Billing address</dt><dd>{customer.billingAddress || 'Not provided'}</dd><dt>Account status</dt><dd>{customer.accountStatus || 'Active'}</dd><dt>Account since</dt><dd>{new Date(customer.createdAt).toLocaleDateString()}</dd></dl></section><section className="card"><h2>Recent subscriptions</h2>{subscriptions.slice(0,4).map((row) => <div className="compact-record" key={row._id}><span><strong>{row.subscriptionNumber}</strong><small>{row.planName} · {row.billingFrequency}</small></span><span className={`status-text status-${row.status?.toLowerCase()}`}>{row.status}</span></div>)}{subscriptions.length === 0 && <p className="empty-copy">No subscriptions recorded.</p>}</section></div>}
    {tab === 'Subscriptions' && <RecordTable title="Subscriptions" rows={subscriptions} columns={['subscriptionNumber','planName','billingFrequency','recurringTotal','status','nextBillingDate']} />}
    {tab === 'Invoices' && <RecordTable title="Invoices" rows={invoices} columns={['invoiceNumber','invoiceDate','dueDate','grandTotal','paidAmount','status']} />}
    {tab === 'Payments' && <RecordTable title="Payments" rows={payments} columns={['invoiceNumber','paymentDate','amount','method','referenceNote']} />}
  </>;
}
function Summary({ icon: Icon, label, value, detail }) { return <div className="card customer-summary"><span className="summary-icon"><Icon size={16}/></span><small>{label}</small><strong>{value}</strong>{detail && <em>{detail}</em>}</div>; }
function RecordTable({ title, rows, columns }) {
  if (!rows.length) return <div className="card empty-copy">No {title.toLowerCase()} recorded for this customer.</div>;
  const label = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
  const value = (key, row) => {
    const cell = row[key];
    if (cell === undefined || cell === null || cell === '') return '—';
    if (/Date$/.test(key) || key === 'invoiceDate') return new Date(cell).toLocaleDateString();
    if (['grandTotal','paidAmount','amount','recurringTotal'].includes(key)) return currency(cell);
    return String(cell);
  };
  return <div className="card overflow-hidden p-0"><div className="table-scroll"><table className="detail-table"><caption className="sr-only">{title} for this customer</caption><thead><tr>{columns.map((key) => <th key={key}>{label(key)}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row._id}>{columns.map((key) => <td key={key}>{value(key,row)}</td>)}</tr>)}</tbody></table></div></div>;
}
function currency(amount) { return `$${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
