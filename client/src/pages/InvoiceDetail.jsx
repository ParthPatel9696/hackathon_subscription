import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import PageHeader from '../components/PageHeader';
import { formatCurrency, formatDate, invoiceOutstanding } from '../utils/locale';
import { InvoiceStatusForm, PaymentForm } from '../components/WorkflowForms';
import { useAuthStore } from '../store';

export default function InvoiceDetail() {
  const { id } = useParams();
  const role = useAuthStore((state) => state.user?.role);
  const [actionMessage, setActionMessage] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const query = useQuery({ queryKey: ['invoice-detail', id], queryFn: async () => (await api.get(`/invoices/${id}`)).data.data });
  const sendInvoice = useMutation({ mutationFn: async () => (await api.post(`/invoices/${id}/send`)).data, onSuccess: (result) => setActionMessage(result.message || 'Invoice sent.') });
  const downloadPdf = async () => {
    setActionMessage('');
    try {
      const { data } = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${query.data?.invoiceNumber || 'invoice'}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch { setActionMessage('Unable to download this invoice PDF.'); }
  };
  if (query.isLoading) return <p className="card" role="status">Loading invoice…</p>;
  if (query.isError || !query.data) return <p className="error" role="alert">{query.error?.response?.data?.error || 'Invoice is unavailable.'} <button className="inline-action" onClick={() => query.refetch()}>Try again</button></p>;
  const invoice = query.data;
  const due = invoiceOutstanding(invoice);
  return <>
    {['admin', 'staff'].includes(role) && <div className="mb-3 flex flex-wrap gap-2 print-hidden">{!['Paid', 'Cancelled'].includes(invoice.status) && <button className="button secondary-button" onClick={() => setEditingStatus(true)}>Update invoice status</button>}{['Confirmed', 'Overdue'].includes(invoice.status) && due > 0 && <button className="button" onClick={() => setRecordingPayment(true)}>Record payment</button>}</div>}
    {editingStatus && <InvoiceStatusForm invoice={invoice} onClose={() => { setEditingStatus(false); query.refetch(); }} />}
    {recordingPayment && <PaymentForm initialInvoice={invoice} onClose={() => { setRecordingPayment(false); query.refetch(); }} />}
    <div className="mb-4 flex flex-wrap gap-2 print-hidden"><button className="button secondary-button" onClick={downloadPdf}>Download PDF</button>{['admin', 'staff'].includes(role) && <button className="button" disabled={sendInvoice.isPending || !['Confirmed', 'Overdue', 'Paid'].includes(invoice.status)} onClick={() => { setActionMessage(''); sendInvoice.mutate(); }}>{sendInvoice.isPending ? 'Sending...' : 'Email invoice'}</button>}</div>
    {(actionMessage || sendInvoice.isError) && <p className={`mb-4 ${sendInvoice.isError || actionMessage.startsWith('Unable') ? 'error' : 'success-message'}`} role="status">{sendInvoice.error?.response?.data?.error || actionMessage}</p>}
    <Link to="/app/invoices" className="back-link">← Invoices</Link>
    <div className="flex flex-wrap items-start justify-between gap-3"><PageHeader title={invoice.invoiceNumber} subtitle={`${invoice.customerName} · ${invoice.status}`} /><button className="button secondary-button print-hidden" onClick={() => window.print()}>Print / save PDF</button></div>
    <section className="card mb-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Issue date" value={formatDate(invoice.invoiceDate)} /><Info label="Due date" value={formatDate(invoice.dueDate)} /><Info label="Billing period" value={`${formatDate(invoice.billingPeriodStart)} – ${formatDate(invoice.billingPeriodEnd)}`} /><Info label="Payment terms" value={invoice.paymentTerms || 'Not specified'} /><Info label="Customer" value={invoice.customerName} /><Info label="Email" value={invoice.customerEmail} /><Info label="Subscription" value={invoice.subscriptionNumber} /><Info label="Status" value={invoice.status} /></div><div className="mt-4 grid gap-5 border-t pt-4 text-sm text-slate-600 sm:grid-cols-2"><div><strong>Company details snapshot</strong><p>{invoice.companySnapshot?.name || invoice.companySnapshot?.displayName || 'Brightloop'}</p><p>{invoice.companySnapshot?.address}</p><p>{[invoice.companySnapshot?.email, invoice.companySnapshot?.phone, invoice.companySnapshot?.taxId].filter(Boolean).join(' · ')}</p></div><div><strong>Billing address snapshot</strong><p>{[invoice.billingAddressSnapshot?.name, invoice.billingAddressSnapshot?.line1, invoice.billingAddressSnapshot?.line2, invoice.billingAddressSnapshot?.city, invoice.billingAddressSnapshot?.state, invoice.billingAddressSnapshot?.postalCode, invoice.billingAddressSnapshot?.country, invoice.billingAddressSnapshot?.taxId].filter(Boolean).join(' · ') || 'Address not captured for this historical invoice.'}</p></div></div></section>
    <section className="card overflow-hidden p-0"><div className="overflow-x-auto"><table className="resource-table"><thead><tr><th>Description</th><th>Variant</th><th>Quantity</th><th className="amount-cell">Unit price</th><th className="amount-cell">Discount</th><th className="amount-cell">Tax</th><th className="amount-cell">Line total</th></tr></thead><tbody>{(invoice.lines || []).map((line) => <tr key={line._id}><td>{line.productName}</td><td>{line.variantName || '—'}</td><td>{line.quantity}</td><td className="amount-cell">{formatCurrency(line.unitPrice)}</td><td className="amount-cell">{formatCurrency(line.discountAmount)}</td><td className="amount-cell">{formatCurrency(line.taxAmount)}{line.taxLabel ? <small>{line.taxLabel}</small> : null}</td><td className="amount-cell">{formatCurrency(line.total)}</td></tr>)}</tbody><tfoot><tr><th colSpan="6" className="text-right">Subtotal</th><td className="amount-cell">{formatCurrency(invoice.subtotal)}</td></tr><tr><th colSpan="6" className="text-right">Discount</th><td className="amount-cell">{formatCurrency(invoice.discountTotal)}</td></tr><tr><th colSpan="6" className="text-right">Tax</th><td className="amount-cell">{formatCurrency(invoice.taxTotal)}</td></tr><tr><th colSpan="6" className="text-right">Grand total</th><td className="amount-cell font-semibold">{formatCurrency(invoice.grandTotal)}</td></tr><tr><th colSpan="6" className="text-right">Paid / due</th><td className="amount-cell">{formatCurrency(invoice.paidAmount)} / {formatCurrency(due)}</td></tr></tfoot></table></div></section>
    <section className="card mt-5"><h2 className="font-semibold">Payment history</h2>{invoice.payments?.length ? <div className="mt-3 overflow-x-auto"><table className="resource-table"><thead><tr><th>Reference</th><th>Date</th><th>Method</th><th className="amount-cell">Amount</th><th>Status</th></tr></thead><tbody>{invoice.payments.map((payment) => <tr key={payment._id}><td><Link className="inline-action" to={`/app/payments/${payment._id}`}>{payment.referenceNote || payment._id}</Link></td><td>{formatDate(payment.paymentDate)}</td><td>{payment.method}</td><td className="amount-cell">{formatCurrency(payment.amount)}</td><td>{payment.status || 'posted'}</td></tr>)}</tbody></table></div> : <p className="empty-copy mt-3">No payments recorded against this invoice.</p>}</section>
  </>;
}
function Info({ label, value }) { return <div><small className="text-slate-500">{label}</small><p className="mt-1 text-sm">{value || '—'}</p></div>; }
