import { CreditCard, Users, TrendingUp } from 'lucide-react';
export function DashboardPage() {
  return <div><h1 className="text-3xl font-bold">Good morning</h1><p className="mt-1 text-slate-500">Here’s your subscription business at a glance.</p>
    <div className="mt-8 grid gap-5 md:grid-cols-3">{[['Active subscriptions', '0', CreditCard], ['Customers', '0', Users], ['Monthly recurring revenue', '$0', TrendingUp]].map(([label, value, Icon]) =>
      <div key={label} className="rounded-xl border border-slate-200 bg-white p-6"><Icon className="mb-6 text-blue-700" size={22} /><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div>
  </div>;
}
