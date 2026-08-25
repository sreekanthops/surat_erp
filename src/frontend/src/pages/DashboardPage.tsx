import { useQuery } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import { TrendingUp, TrendingDown, MessageSquare, Users, Package, AlertCircle } from 'lucide-react';

const KPICard = ({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string; icon: any; color: string;
}) => (
  <div className="bg-white rounded-lg border border-gray-200 p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
    </div>
  </div>
);

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/api/v1/dashboard/summary').then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { today, month, alerts } = data || {};

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Today's Sales"
          value={fmt(today?.salesAmount)}
          sub={`${today?.salesCount || 0} invoices`}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <KPICard
          title="Month Profit"
          value={fmt(month?.profitAmount)}
          sub={`${month?.profitMargin?.toFixed(1) || 0}% margin`}
          icon={TrendingDown}
          color="bg-green-500"
        />
        <KPICard
          title="Unread Messages"
          value={String(today?.newMessages || 0)}
          sub="WhatsApp + Gmail"
          icon={MessageSquare}
          color="bg-purple-500"
        />
        <KPICard
          title="New Leads Today"
          value={String(today?.newLeads || 0)}
          sub="From all channels"
          icon={Users}
          color="bg-orange-500"
        />
      </div>

      {/* Alerts */}
      {alerts?.overdueTransactions?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold text-gray-900">Overdue Payments</h2>
          </div>
          <div className="space-y-2">
            {alerts.overdueTransactions.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.party}</p>
                  <p className="text-xs text-gray-500">{t.daysPastDue} days overdue</p>
                </div>
                <span className="text-sm font-semibold text-red-600">{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock */}
      {alerts?.lowStockProducts?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900">Low Stock Alert</h2>
          </div>
          <div className="space-y-2">
            {alerts.lowStockProducts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <span className="text-sm text-orange-600 font-medium">
                  {p.currentStock} {p.unit} left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
