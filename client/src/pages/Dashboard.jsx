import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowUpRight, CircleDollarSign, CreditCard } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api';
import { useAuthStore } from '../store';

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, error } = useQuery({ queryKey: ['metrics'], queryFn: async () => (await api.get('/dashboard/metrics')).data, enabled: user.role !== 'customer' });
  if (user.role === 'customer') return <CustomerOverview />;
  const metrics = data?.metrics;
  const cards = [
    ['Monthly recurring revenue', metrics?.mrr, CircleDollarSign, 'text-emerald-600'],
    ['Active subscriptions', metrics?.activeSubscriptionsCount, Activity, 'text-blue-600'],
    ['Collected revenue', metrics?.totalCollected, CreditCard, 'text-violet-600'],
    ['Outstanding balance', metrics?.pendingAmount, AlertTriangle, 'text-amber-600']
  ];
  return <><Header title="Executive overview" subtitle="A real-time view of your subscription business." />{error && <p className="error mb-5">{error.response?.data?.error || 'Metrics are unavailable.'}</p>}{isLoading ? <p>Loading metrics...</p> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon, color]) => <div className="card" key={label}><div className="flex justify-between"><p className="text-sm text-slate-500">{label}</p><Icon size={19} className={color} /></div><p className="mt-5 text-2xl font-bold">{typeof value === 'number' && label !== 'Active subscriptions' ? `$${value.toLocaleString()}` : value ?? 0}</p><p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><ArrowUpRight size={13} /> Live from MongoDB</p></div>)}</div><div className="card mt-6 h-80"><h2 className="mb-4 font-semibold">Subscription health</h2><ResponsiveContainer width="100%" height="90%"><AreaChart data={Object.entries(metrics?.statusPipeline || {}).map(([name, value]) => ({ name, value }))}><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#46d3b2" stopOpacity={0.45} /><stop offset="100%" stopColor="#46d3b2" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="value" stroke="#159a81" fill="url(#fill)" /></AreaChart></ResponsiveContainer></div></>}</>;
}

function CustomerOverview() {
  return <><Header title="My subscription hub" subtitle="Track your plans, invoices, and payment history." /><div className="card"><p className="font-semibold">Welcome to Brightloop</p><p className="mt-2 text-sm text-slate-500">Use the navigation to view your active subscriptions and account billing history.</p></div></>;
}

export function Header({ title, subtitle }) { return <header className="mb-7"><h1 className="text-2xl font-bold text-ink">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></header>; }
