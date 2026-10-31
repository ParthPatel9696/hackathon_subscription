import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export default function QuotationActions({ subscription, user }) {
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const response = useMutation({ mutationFn: async (decision) => (await api.post(`/subscriptions/${subscription._id}/respond`, { decision })).data, onSuccess: async (result) => { setMessage(result.message || 'Quotation updated.'); await Promise.all([client.invalidateQueries({ queryKey: ['subscription', subscription._id] }), client.invalidateQueries({ queryKey: ['subscriptions'] }), client.invalidateQueries({ queryKey: ['/subscriptions'] })]); } });
  const send = useMutation({ mutationFn: async () => (await api.post(`/subscriptions/${subscription._id}/send`)).data, onSuccess: (result) => setMessage(result.message || 'Quotation sent.') });
  const renew = useMutation({ mutationFn: async () => (await api.post(`/subscriptions/${subscription._id}/renew`)).data, onSuccess: async (result) => { setMessage(result.message || 'Subscription renewed.'); await Promise.all([client.invalidateQueries({ queryKey: ['subscription', subscription._id] }), client.invalidateQueries({ queryKey: ['subscriptions'] }), client.invalidateQueries({ queryKey: ['/subscriptions'] })]); } });
  const download = async () => {
    setMessage('');
    try {
      const { data } = await api.get(`/subscriptions/${subscription._id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${subscription.subscriptionNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch { setMessage('Unable to download this quotation PDF.'); }
  };
  if (subscription.status === 'Closed' && ['admin', 'staff'].includes(user?.role)) return <section className="card mb-4"><button className="button" disabled={renew.isPending} onClick={() => { setMessage(''); renew.mutate(); }}>{renew.isPending ? 'Renewing...' : 'Renew subscription'}</button>{(message || renew.isError) && <p className={`mt-3 ${renew.isError ? 'error' : 'success-message'}`} role="status">{renew.error?.response?.data?.error || message}</p>}</section>;
  if (subscription.status !== 'Quotation') return null;
  return <section className="card mb-4"><div className="flex flex-wrap gap-2"><button className="button secondary-button" onClick={download}>Download quotation PDF</button>{['admin', 'staff'].includes(user?.role) && <button className="button" disabled={send.isPending} onClick={() => { setMessage(''); send.mutate(); }}>{send.isPending ? 'Sending...' : 'Email quotation'}</button>}{user?.role === 'customer' && <><button className="button" disabled={response.isPending} onClick={() => { setMessage(''); response.mutate('accept'); }}>{response.isPending ? 'Saving...' : 'Accept quotation'}</button><button className="button secondary-button" disabled={response.isPending} onClick={() => { setMessage(''); response.mutate('reject'); }}>Decline</button></>}</div>{(message || response.isError || send.isError) && <p className={`mt-3 ${response.isError || send.isError || message.startsWith('Unable') ? 'error' : 'success-message'}`} role="status">{response.error?.response?.data?.error || send.error?.response?.data?.error || message}</p>}</section>;
}
