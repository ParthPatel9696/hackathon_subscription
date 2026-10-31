import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useAuthStore } from '../store';
import { BillingBatch, CustomerForm, DiscountForm, InvoiceStatusForm, PaymentForm, PlanForm, ProductForm, SubscriptionForm, TransitionForm, useTableFilters } from '../components/WorkflowForms';

export default function ResourcePage({ title, endpoint, resource }) {
  const currentUser = useAuthStore((state) => state.user);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (resource !== 'customers') return undefined;
    const timer = window.setTimeout(() => setDebouncedSearch(customerSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [customerSearch, resource]);

  const requestUrl = resource === 'customers'
    ? `/customers?search=${encodeURIComponent(debouncedSearch)}&page=${customerPage}&limit=50&status=${status}`
    : endpoint;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [resource === 'customers' ? 'customers' : requestUrl, requestUrl],
    queryFn: async () => (await api.get(requestUrl)).data
  });
  const rows = Array.isArray(data?.data) ? data.data : [];
  const { search, setSearch, status, setStatus, filtered } = useTableFilters(rows);
  const statuses = [...new Set(rows.map((row) => row.status || row.accountStatus).filter(Boolean))];

  const onSearch = (value) => {
    setSearch(value);
    if (resource === 'customers') { setCustomerSearch(value); setCustomerPage(1); }
  };
  const exportCsv = () => {
    const keys = [...new Set(filtered.flatMap((row) => Object.keys(row)))].filter((key) => !['_id', '__v', 'lines', 'variants'].includes(key));
    const csvCell = (value) => {
      const raw = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [keys.map(csvCell).join(','), ...filtered.map((row) => keys.map((key) => csvCell(row[key])).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `${title.toLowerCase().replaceAll(' ', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <>
    <PageHeader title={title} subtitle="Records from the Brightloop workspace." />
    <div className="resource-toolbar">
      <label className="sr-only" htmlFor="record-search">Search records</label>
      <input id="record-search" className="field resource-search" placeholder={resource === 'customers' ? 'Search name, company, or email…' : 'Search records…'} value={search} onChange={(event) => onSearch(event.target.value)} />
      {statuses.length > 0 && <><label className="sr-only" htmlFor="status-filter">Filter by status</label><select id="status-filter" className="field resource-status-filter" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></>}
      <button type="button" className="button secondary-button" onClick={() => refetch()}><RefreshCw size={15}/> Refresh</button>
      <button type="button" className="button secondary-button" onClick={exportCsv}><Download size={15}/> Export CSV</button>
      {resource === 'subscriptions' && <button type="button" className="button" onClick={() => setModal('subscription')}><Plus size={15}/> New quotation</button>}
      {resource === 'customers' && currentUser?.role === 'admin' && <button type="button" className="button" onClick={() => setModal('customer')}><Plus size={15}/> Add customer</button>}
      {resource === 'products' && <button type="button" className="button" onClick={() => setModal('product')}><Plus size={15}/> Add product</button>}
      {resource === 'plans' && <button type="button" className="button" onClick={() => setModal('plan')}><Plus size={15}/> Create plan</button>}
      {resource === 'payments' && <button type="button" className="button" onClick={() => setModal('payment')}><Plus size={15}/> Record payment</button>}
      {resource === 'discounts' && <button type="button" className="button" onClick={() => setModal('discount')}><Plus size={15}/> New discount</button>}
      {resource === 'invoices' && <button type="button" className="button" onClick={() => setModal('billing')}><RefreshCw size={15}/> Run billing</button>}
    </div>
    {error && <p className="error mb-5" role="alert">{error.response?.data?.error || 'Unable to load records.'} <button className="inline-action" onClick={() => refetch()}>Try again</button></p>}
    <div className="card overflow-hidden p-0">
      {isLoading ? <p className="p-6" role="status">Loading records…</p> : filtered.length === 0 ? <div className="resource-empty"><strong>{search ? 'No matching records' : `No ${title.toLowerCase()} yet`}</strong><span>{search ? 'Try another search term or clear the filter.' : 'Records will appear here when they are available.'}</span></div> :
        <div className="overflow-x-auto"><table className="resource-table"><caption className="sr-only">{title} records</caption><thead><tr><th>Name / number</th><th>Status</th><th className="amount-cell">Amount</th><th>Details</th><th>Actions</th></tr></thead><tbody>
          {filtered.map((row) => <tr key={row._id || row.id || row.code || row.invoiceNumber}>
            <td className="record-primary">{row.name || row.subscriptionNumber || row.invoiceNumber || row.email || row.code || 'Record'}{row.email && row.name && <small>{row.email}</small>}</td>
            <td><span className="badge">{row.status || row.accountStatus || row.role || '—'}</span></td>
            <td className="amount-cell">{formatAmount(row, resource)}</td>
            <td className="record-detail">{row.customerName || row.description || row.companyName || row.planName || row.product?.name || row.type || '—'}</td>
            <td className="record-actions">
              {resource === 'customers' && row._id ? <Link to={`/app/customers/${row._id}`}>Open customer</Link> : row._id && <button onClick={() => setModal({ detail: row })}>View details</button>}
              {resource === 'products' && row._id && <button onClick={() => setModal({ editProduct: row })}>Edit</button>}
              {resource === 'plans' && row._id && <button onClick={() => setModal({ editPlan: row })}>Edit</button>}
              {resource === 'subscriptions' && row._id && <button onClick={() => setModal({ transition: row })}>Change status</button>}
              {resource === 'invoices' && row._id && !['Paid', 'Cancelled'].includes(row.status) && <button onClick={() => setModal({ invoiceStatus: row })}>Update status</button>}
            </td>
          </tr>)}
        </tbody></table></div>}
    </div>
    {resource === 'customers' && (data?.total || 0) > (data?.pageSize || 50) && <div className="pagination-row"><span>Showing {((customerPage - 1) * data.pageSize) + 1}–{Math.min(customerPage * data.pageSize, data.total)} of {data.total}</span><div><button className="pagination-button" disabled={customerPage === 1} onClick={() => setCustomerPage((page) => page - 1)}>Previous</button><button className="pagination-button" disabled={customerPage * data.pageSize >= data.total} onClick={() => setCustomerPage((page) => page + 1)}>Next</button></div></div>}
    {modal === 'subscription' && <SubscriptionForm onClose={() => setModal(null)} />}
    {modal === 'customer' && <CustomerForm onClose={() => setModal(null)} />}
    {modal === 'product' && <ProductForm onClose={() => setModal(null)} />}
    {modal?.editProduct && <ProductForm key={modal.editProduct._id} product={modal.editProduct} onClose={() => setModal(null)} />}
    {modal === 'plan' && <PlanForm onClose={() => setModal(null)} />}
    {modal?.editPlan && <PlanForm key={modal.editPlan._id} plan={modal.editPlan} onClose={() => setModal(null)} />}
    {modal === 'payment' && <PaymentForm onClose={() => setModal(null)} />}
    {modal === 'discount' && <DiscountForm onClose={() => setModal(null)} />}
    {modal === 'billing' && <BillingBatch onClose={() => setModal(null)} />}
    {modal?.transition && <TransitionForm subscription={modal.transition} onClose={() => setModal(null)} />}
    {modal?.invoiceStatus && <InvoiceStatusForm invoice={modal.invoiceStatus} onClose={() => setModal(null)} />}
    {modal?.detail && <RecordDetails row={modal.detail} onClose={() => setModal(null)} />}
  </>;
}

function formatAmount(row, resource) {
  const amount = resource === 'products' ? row.salesPrice : resource === 'plans' ? row.basePrice : row.grandTotal ?? row.recurringTotal ?? row.amount;
  return amount === undefined ? '—' : `$${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RecordDetails({ row, onClose }) {
  return <Modal title="Record details" onClose={onClose}><dl className="grid gap-3 sm:grid-cols-2">{Object.entries(row).filter(([key]) => !['_id', '__v', 'lines', 'variants', 'password', 'resetPasswordToken', 'resetPasswordExpires'].includes(key)).map(([key, value]) => <div key={key} className="record-detail-pair"><dt>{key.replaceAll(/([A-Z])/g, ' $1')}</dt><dd>{typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '—')}</dd></div>)}</dl></Modal>;
}
