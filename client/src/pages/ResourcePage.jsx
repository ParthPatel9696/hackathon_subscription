import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useAuthStore } from '../store';
import { BillingBatch, CustomerForm, DiscountForm, InvoiceStatusForm, PaymentForm, PlanChangeForm, PlanForm, ProductForm, SubscriptionForm, TransitionForm, useTableFilters } from '../components/WorkflowForms';
import { formatCurrency, formatDate } from '../utils/locale';
import AdvancedTableTools from '../components/AdvancedTableTools';

export default function ResourcePage({ title, endpoint, resource }) {
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isInternal = ['admin', 'staff'].includes(currentUser?.role);
  const isAdmin = currentUser?.role === 'admin';
  const pageTitle = currentUser?.role === 'customer'
    ? ({ plans: 'Browse plans', subscriptions: 'My subscriptions', invoices: 'My invoices', payments: 'My payments' }[resource] || title)
    : title;
  const [searchParams, setSearchParams] = useSearchParams();
  const [customerSearch, setCustomerSearch] = useState(() => searchParams.get('search') || '');
  const [customerPage, setCustomerPage] = useState(1);
  const [serverPage, setServerPage] = useState(1);
  const [serverStatus, setServerStatus] = useState('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerStatus, setCustomerStatus] = useState('ALL');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') || '');
  const [modal, setModal] = useState(null);
  const [exportError, setExportError] = useState('');
  const preferenceKey = `brightloop_table_${currentUser?.id || 'user'}_${resource}`;
  const [preferences, setPreferences] = useState(() => readPreferences(preferenceKey));
  const tableColumns = resource === 'customers'
    ? [{ key: 'record', label: 'Customer' }, { key: 'status', label: 'Status' }, { key: 'activeSubscriptionCount', label: 'Active subs' }, { key: 'totalInvoiced', label: 'Invoiced' }, { key: 'totalPaid', label: 'Paid' }, { key: 'outstanding', label: 'Outstanding' }, { key: 'lastPaymentDate', label: 'Last payment' }, { key: 'assignedStaff', label: 'Assigned staff' }, { key: 'details', label: 'Company / tags' }, { key: 'actions', label: 'Actions' }]
    : [{ key: 'record', label: 'Name / number' }, { key: 'status', label: 'Status' }, { key: 'amount', label: 'Amount' }, { key: 'details', label: 'Details' }, { key: 'actions', label: 'Actions' }];
  const [visibleColumns, setVisibleColumns] = useState(() => preferences.visible || tableColumns.map((column) => column.key));
  const [columnOrder, setColumnOrder] = useState(() => preferences.order || tableColumns.map((column) => column.key));
  const [density, setDensity] = useState(() => preferences.density || 'comfortable');
  const [sorts, setSorts] = useState(() => preferences.sorts || []);
  const [selectedRows, setSelectedRows] = useState({});
  const [savedViews, setSavedViews] = useState(() => readPreferences(`${preferenceKey}_views`).views || []);

  useEffect(() => {
    if (searchParams.get('action') !== 'create') return;
    const allowed = (resource === 'customers' && currentUser?.role === 'admin') ||
      (resource === 'products' && currentUser?.role === 'admin') ||
      (resource === 'plans' && currentUser?.role === 'admin') ||
      (resource === 'subscriptions' && ['admin', 'staff'].includes(currentUser?.role)) ||
      (resource === 'payments' && ['admin', 'staff'].includes(currentUser?.role));
    if (allowed) setModal(({ customers: 'customer', products: 'product', plans: 'plan', subscriptions: 'subscription', payments: 'payment' })[resource]);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, resource, currentUser?.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(customerSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  const sortQuery = sorts.map(({ key, direction }) => `${key}:${direction}`).join(',');
  const requestUrl = resource === 'customers'
    ? `/customers?search=${encodeURIComponent(debouncedSearch)}&page=${customerPage}&limit=50&status=${customerStatus}&startDate=${dateFrom}&endDate=${dateTo}${sortQuery ? `&sort=${encodeURIComponent(sortQuery)}` : ''}`
    : `${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${serverPage}&limit=50&search=${encodeURIComponent(debouncedSearch)}&minAmount=${minAmount}&maxAmount=${maxAmount}&startDate=${dateFrom}&endDate=${dateTo}${serverStatus !== 'ALL' ? `&status=${encodeURIComponent(serverStatus)}` : ''}${sortQuery ? `&sort=${encodeURIComponent(sortQuery)}` : ''}`;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [resource === 'quotations' ? 'subscriptions' : resource, requestUrl],
    queryFn: async () => (await api.get(requestUrl)).data
  });
  const discountStatus = useMutation({
    mutationFn: async ({ id, isActive }) => (await api.patch(`/discounts/${id}/status`, { isActive })).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discounts'] })
  });
  const rows = Array.isArray(data?.data) ? data.data : [];
  const { search, setSearch, status, setStatus, filtered } = useTableFilters(rows, searchParams.get('search') || '');
  useEffect(() => {
    const incomingSearch = searchParams.get('search');
    if (incomingSearch === null || incomingSearch === search) return;
    setSearch(incomingSearch);
    setCustomerSearch(incomingSearch);
    setCustomerPage(1);
    setServerPage(1);
  }, [searchParams, search, setSearch]);
  useEffect(() => { localStorage.setItem(preferenceKey, JSON.stringify({ visible: visibleColumns, order: columnOrder, density, sorts })); }, [preferenceKey, visibleColumns, columnOrder, density, sorts]);
  const statuses = resource === 'customers' ? ['Active', 'Archived'] : resource === 'discounts' ? ['Active', 'Inactive'] : [...new Set(rows.map((row) => row.status || row.accountStatus).filter(Boolean))];

  const onSearch = (value) => {
    setSearch(value);
    setCustomerSearch(value);
    setServerPage(1);
    if (resource === 'customers') { setCustomerSearch(value); setCustomerPage(1); }
  };
  const exportCsv = async (sourceRows) => {
    setExportError('');
    try {
    let rowsToExport = sourceRows;
    if (!rowsToExport) {
      rowsToExport = [...rows];
      const total = Number(data?.total || rowsToExport.length);
      const pageSize = Number(data?.pageSize || 50);
      const exportUrl = new URL(requestUrl, window.location.origin);
      for (let page = 2; rowsToExport.length < total; page += 1) {
        exportUrl.searchParams.set('page', String(page));
        exportUrl.searchParams.set('limit', String(pageSize));
        const response = await api.get(`${exportUrl.pathname}${exportUrl.search}`);
        const nextRows = response.data?.data || [];
        if (!nextRows.length) break;
        rowsToExport.push(...nextRows);
      }
      if (rowsToExport.length < total) { setExportError('Some filtered records could not be loaded. Retry the export.'); return; }
    }
    const keys = [...new Set([...rowsToExport.flatMap((row) => Object.keys(row)), ...(['products','plans','subscriptions','quotations','invoices','payments','discounts'].includes(resource) ? ['currency'] : [])])].filter((key) => !['_id', '__v', 'lines', 'variants'].includes(key));
    const csvCell = (value) => {
      const raw = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [keys.map(csvCell).join(','), ...rowsToExport.map((row) => keys.map((key) => csvCell(key === 'currency' ? row.currency || 'INR' : row[key])).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `${title.toLowerCase().replaceAll(' ', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    } catch {
      setExportError('CSV export failed. Check your connection and retry.');
    }
  };
  const sortedRows = [...filtered].sort((a, b) => {
    for (const { key, direction } of sorts) {
      const pick = (row) => key === 'amount' ? Number(row.salesPrice ?? row.basePrice ?? row.grandTotal ?? row.recurringTotal ?? row.amount ?? 0) : key === 'record' ? String(row.name || row.subscriptionNumber || row.invoiceNumber || row.email || row.code || '') : String(row[key] || '');
      const left = pick(a); const right = pick(b); const cmp = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'en-IN', { numeric: true });
      if (cmp) return direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
  const saveView = (name) => { const views = [...savedViews.filter((view) => view.name !== name), { name, search, status: resource === 'customers' ? customerStatus : serverStatus, minAmount, maxAmount, dateFrom, dateTo, visible: visibleColumns, order: columnOrder, density, sorts }]; setSavedViews(views); localStorage.setItem(`${preferenceKey}_views`, JSON.stringify({ views })); };
  const loadView = (name) => { const view = savedViews.find((item) => item.name === name); if (!view) return; setSearch(view.search || ''); setCustomerSearch(view.search || ''); setServerPage(1); setStatus(view.status || 'ALL'); setServerStatus(view.status || 'ALL'); setCustomerStatus(view.status || 'ALL'); setMinAmount(view.minAmount || ''); setMaxAmount(view.maxAmount || ''); setDateFrom(view.dateFrom || ''); setDateTo(view.dateTo || ''); setVisibleColumns(view.visible || tableColumns.map((column) => column.key)); setColumnOrder(view.order || tableColumns.map((column) => column.key)); setDensity(view.density || 'comfortable'); setSorts(view.sorts || []); };
  const toggleSelected = (row, checked) => setSelectedRows((current) => { const next = { ...current }; if (checked) next[row._id] = row; else delete next[row._id]; return next; });

  return <>
    <PageHeader title={pageTitle} subtitle={currentUser?.role === 'customer' ? 'Your Brightloop account records.' : 'Records from the Brightloop workspace.'} />
    <div className="resource-toolbar">
      <label className="sr-only" htmlFor="record-search">Search records</label>
      <input id="record-search" className="field resource-search" placeholder={resource === 'customers' ? 'Search name, company, or email…' : 'Search records…'} value={search} onChange={(event) => onSearch(event.target.value)} />
      {resource !== 'customers' && <><label className="sr-only" htmlFor="min-amount">Minimum amount</label><input id="min-amount" className="field w-32" type="number" min="0" step="0.01" value={minAmount} onChange={(e) => { setMinAmount(e.target.value); setServerPage(1); }} placeholder="Min amount"/><label className="sr-only" htmlFor="max-amount">Maximum amount</label><input id="max-amount" className="field w-32" type="number" min="0" step="0.01" value={maxAmount} onChange={(e) => { setMaxAmount(e.target.value); setServerPage(1); }} placeholder="Max amount"/></>}
      <label className="sr-only" htmlFor="filter-start-date">From date</label><input id="filter-start-date" className="field w-36" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setServerPage(1); setCustomerPage(1); }} />
      <label className="sr-only" htmlFor="filter-end-date">To date</label><input id="filter-end-date" className="field w-36" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setServerPage(1); setCustomerPage(1); }} />
      {statuses.length > 0 && <><label className="sr-only" htmlFor="status-filter">Filter by status</label><select id="status-filter" className="field resource-status-filter" value={resource === 'customers' ? customerStatus : serverStatus} onChange={(event) => { setStatus(event.target.value); if (resource === 'customers') setCustomerStatus(event.target.value); else { setServerStatus(event.target.value); setServerPage(1); } }}><option value="ALL">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></>}
      <button type="button" className="button secondary-button" onClick={() => refetch()}><RefreshCw size={15}/> Refresh</button>
      <button type="button" className="button secondary-button" onClick={exportCsv}><Download size={15}/> Export CSV</button>
      {resource === 'subscriptions' && isInternal && <button type="button" className="button" onClick={() => setModal('subscription')}><Plus size={15}/> New quotation</button>}
      {resource === 'customers' && isAdmin && <button type="button" className="button" onClick={() => setModal('customer')}><Plus size={15}/> Add customer</button>}
      {resource === 'products' && isAdmin && <button type="button" className="button" onClick={() => setModal('product')}><Plus size={15}/> Add product</button>}
      {resource === 'plans' && isAdmin && <button type="button" className="button" onClick={() => setModal('plan')}><Plus size={15}/> Create plan</button>}
      {resource === 'payments' && isInternal && <button type="button" className="button" onClick={() => setModal('payment')}><Plus size={15}/> Record payment</button>}
      {resource === 'discounts' && isAdmin && <button type="button" className="button" onClick={() => setModal('discount')}><Plus size={15}/> New discount</button>}
      {resource === 'invoices' && isInternal && <button type="button" className="button" onClick={() => setModal('billing')}><RefreshCw size={15}/> Run billing</button>}
    </div>
    {exportError && <p className="error mb-4" role="alert">{exportError}</p>}
    <AdvancedTableTools columns={tableColumns} visible={visibleColumns} setVisible={setVisibleColumns} order={columnOrder} setOrder={setColumnOrder} density={density} setDensity={setDensity} views={savedViews} onSaveView={saveView} onLoadView={loadView} selectedCount={Object.keys(selectedRows).length} onExportSelected={() => exportCsv(Object.values(selectedRows))} />
    {resource !== 'customers' && (data?.total || 0) > (data?.pageSize || 50) && <div className="pagination-row"><span>Showing {((serverPage - 1) * (data.pageSize || 50)) + 1}–{Math.min(serverPage * (data.pageSize || 50), data.total)} of {data.total}</span><div><button className="pagination-button" disabled={serverPage <= 1} onClick={() => setServerPage((p) => p - 1)}>Previous</button><button className="pagination-button" disabled={serverPage * (data.pageSize || 50) >= data.total} onClick={() => setServerPage((p) => p + 1)}>Next</button></div></div>}
    {error && <p className="error mb-5" role="alert">{error.response?.data?.error || 'Unable to load records.'} <button className="inline-action" onClick={() => refetch()}>Try again</button></p>}
    <div className="card overflow-hidden p-0">
      {isLoading ? <p className="p-6" role="status">Loading records…</p> : filtered.length === 0 ? <div className="resource-empty"><strong>{search ? 'No matching records' : `No ${title.toLowerCase()} yet`}</strong><span>{search ? 'Try another search term or clear the filter.' : 'Records will appear here when they are available.'}</span></div> :
        <div className="overflow-x-auto"><table className={`resource-table ${density}`}><caption className="sr-only">{title} records</caption><thead><tr><th><input type="checkbox" aria-label="Select all rows on this page" checked={sortedRows.length > 0 && sortedRows.every((row) => selectedRows[row._id])} onChange={(e) => sortedRows.forEach((row) => toggleSelected(row, e.target.checked))}/></th>{columnOrder.filter((key) => visibleColumns.includes(key)).map((key) => { const column = tableColumns.find((item) => item.key === key); return <th key={key} className={key === 'amount' ? 'amount-cell' : ''}><button className="table-sort-button" onClick={(event) => setSorts((current) => { const old = current.find((sort) => sort.key === key); const next = { key, direction: old?.direction === 'asc' ? 'desc' : 'asc' }; return event.shiftKey ? [...current.filter((sort) => sort.key !== key), next] : [next]; })}>{column.label}{sorts.find((sort) => sort.key === key) && (sorts.find((sort) => sort.key === key).direction === 'asc' ? ' ↑' : ' ↓')}</button></th>; })}</tr></thead><tbody>
          {sortedRows.map((row) => <tr key={row._id || row.id || row.code || row.invoiceNumber}>
            <td><input type="checkbox" aria-label={`Select ${row.name || row.subscriptionNumber || row.invoiceNumber || 'record'}`} checked={Boolean(selectedRows[row._id])} onChange={(e) => toggleSelected(row, e.target.checked)}/></td>
            {columnOrder.filter((key) => visibleColumns.includes(key)).map((key) => <td key={key} className={`${key === 'amount' ? 'amount-cell' : ''} ${key === 'record' ? 'record-primary' : ''} ${key === 'details' ? 'record-detail' : ''} ${key === 'actions' ? 'record-actions' : ''}`}>
            {key === 'record' && <>{recordHref(resource, row) ? <Link to={recordHref(resource, row)}>{row.name || row.subscriptionNumber || row.invoiceNumber || row.email || row.code || 'Record'}</Link> : row.name || row.subscriptionNumber || row.invoiceNumber || row.email || row.code || 'Record'}{row.email && row.name && <small>{row.email}</small>}</>}
            {key === 'status' && <span className="badge">{resource === 'discounts' ? row.isActive ? 'Active' : 'Inactive' : row.status || row.accountStatus || row.role || '—'}</span>}
              {key === 'amount' && formatAmount(row, resource)}
            {['totalInvoiced','totalPaid','outstanding','activeRecurring'].includes(key) && <span className="tabular-nums">{formatCurrency(row[key] || 0)}</span>}
            {key === 'activeSubscriptionCount' && row.activeSubscriptionCount}
            {key === 'lastPaymentDate' && formatDate(row.lastPaymentDate)}
            {key === 'assignedStaff' && (row.assignedStaff?.name || 'Unassigned')}
            {key === 'details' && (resource === 'customers' ? [row.companyName, row.tags?.join(', ')].filter(Boolean).join(' · ') || '—' : row.customerName || row.description || row.companyName || row.planName || row.product?.name || row.type || '—')}
            {key === 'actions' && <>
              {resource === 'customers' && row._id ? <Link to={`/app/customers/${row._id}`}>Open customer</Link> : row._id && <button onClick={() => setModal({ detail: row })}>View details</button>}
              {resource === 'products' && isAdmin && row._id && <button onClick={() => setModal({ editProduct: row })}>Edit</button>}
              {resource === 'plans' && isAdmin && row._id && <button onClick={() => setModal({ editPlan: row })}>Edit</button>}
              {resource === 'subscriptions' && isInternal && row._id && <button onClick={() => setModal({ transition: row })}>Change status</button>}
              {resource === 'subscriptions' && isInternal && row._id && row.status === 'Active' && <button onClick={() => setModal({ planChange: row })}>Change plan</button>}
              {resource === 'invoices' && isInternal && row._id && !['Paid', 'Cancelled'].includes(row.status) && <button onClick={() => setModal({ invoiceStatus: row })}>Update status</button>}
              {resource === 'discounts' && isAdmin && row._id && <button disabled={discountStatus.isPending} onClick={() => discountStatus.mutate({ id: row._id, isActive: !row.isActive })}>{row.isActive ? 'Deactivate' : 'Activate'}</button>}
            </>}
            </td>)}
          </tr>)}
        </tbody></table></div>}
    </div>
    {discountStatus.isError && <p className="error mt-3" role="alert">{discountStatus.error?.response?.data?.error || 'Unable to update discount status.'}</p>}
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
    {modal?.planChange && <PlanChangeForm subscription={modal.planChange} onClose={() => setModal(null)} />}
    {modal?.invoiceStatus && <InvoiceStatusForm invoice={modal.invoiceStatus} onClose={() => setModal(null)} />}
    {modal?.detail && <RecordDetails row={modal.detail} onClose={() => setModal(null)} />}
  </>;
}

function formatAmount(row, resource) {
  if (resource === 'discounts') return row.discountType === 'fixed' ? formatCurrency(row.value) : `${Number(row.value || 0)}%`;
  const amount = resource === 'products' ? row.salesPrice : resource === 'plans' ? row.basePrice : row.grandTotal ?? row.recurringTotal ?? row.amount;
  return amount === undefined ? '—' : formatCurrency(amount);
}

function recordHref(resource, row) {
  if (!row._id) return null;
  const routes = { products: 'products', plans: 'plans', subscriptions: 'subscriptions', quotations: 'quotations', invoices: 'invoices', payments: 'payments' };
  return routes[resource] ? `/app/${routes[resource]}/${row._id}` : null;
}

function readPreferences(key) { try { const result = JSON.parse(localStorage.getItem(key) || '{}'); return result && typeof result === 'object' ? result : {}; } catch { return {}; } }

function RecordDetails({ row, onClose }) {
  return <Modal title="Record details" onClose={onClose}><dl className="grid gap-3 sm:grid-cols-2">{Object.entries(row).filter(([key]) => !['_id', '__v', 'lines', 'variants', 'password', 'resetPasswordToken', 'resetPasswordExpires'].includes(key)).map(([key, value]) => <div key={key} className="record-detail-pair"><dt>{key.replaceAll(/([A-Z])/g, ' $1')}</dt><dd>{/Date$|At$/.test(key) && value ? formatDate(value) : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '—')}</dd></div>)}</dl></Modal>;
}
