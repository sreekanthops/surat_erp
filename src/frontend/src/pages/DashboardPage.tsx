import { useQuery } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, MessageSquare, Users,
  Package, AlertCircle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n: number) =>
  n >= 1_00_00_000 ? `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  : n >= 1_00_000 ? `₹${(n / 1_00_000).toFixed(1)}L`
  : n >= 1000 ? `₹${(n / 1000).toFixed(0)}K`
  : `₹${n}`;

const PIE_COLORS: Record<string, string> = {
  PAID: '#10b981', PARTIAL: '#f59e0b', PENDING: '#6366f1', CANCELLED: '#94a3b8', DRAFT: '#cbd5e1',
};
const CAT_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#84cc16'];

const card = (style?: React.CSSProperties): React.CSSProperties => ({
  background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
  boxShadow: '0 2px 12px rgba(15,23,42,0.05)', padding: '20px 22px', ...style,
});

const sectionTitle = (title: string, sub?: string) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</div>
    {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#94a3b8' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span>{p.name}: <b>{fmtK(p.value)}</b></span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#fff' }}>
      <b>{p.name}</b>: {fmtK(p.value)} ({p.payload.count} invoices)
    </div>
  );
};

const Skeleton = ({ h = 200 }: { h?: number }) => (
  <div style={{ height: h, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', borderRadius: 12, backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite' }} />
);

export default function DashboardPage() {
  const { data: summary, isLoading: loadSum } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/api/v1/dashboard/summary').then(r => r.data),
    refetchInterval: 60_000,
  });
  const { data: charts, isLoading: loadCharts } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: () => api.get('/api/v1/dashboard/charts').then(r => r.data),
    refetchInterval: 120_000,
  });

  const { today, month, alerts } = summary || {};
  const mom = charts?.momGrowth ?? 0;
  const momUp = mom >= 0;

  const kpis = [
    {
      title: "Today's Sales", value: fmt(today?.salesAmount ?? 0),
      sub: `${today?.salesCount ?? 0} invoices`,
      gradient: 'linear-gradient(135deg,#667eea,#764ba2)', shadow: 'rgba(102,126,234,0.35)',
    },
    {
      title: 'Month Sales', value: fmt(month?.salesAmount ?? 0),
      sub: <span style={{ display:'flex', alignItems:'center', gap:3 }}>
        {momUp ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
        {Math.abs(mom)}% vs last month
      </span>,
      gradient: 'linear-gradient(135deg,#11998e,#38ef7d)', shadow: 'rgba(17,153,142,0.35)',
    },
    {
      title: 'Month Profit', value: fmt(month?.profitAmount ?? 0),
      sub: `${month?.profitMargin ?? 0}% margin`,
      gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', shadow: 'rgba(247,151,30,0.35)',
    },
    {
      title: 'Unread Messages', value: String(today?.newMessages ?? 0),
      sub: 'WhatsApp + Gmail',
      gradient: 'linear-gradient(135deg,#f093fb,#f5576c)', shadow: 'rgba(240,147,251,0.35)',
    },
  ];

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter,sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 24 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: k.gradient, borderRadius: 16, padding: '22px', boxShadow: `0 8px 28px ${k.shadow}`, color: '#fff', position: 'relative', overflow: 'hidden', cursor: 'default' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 8 }}>{k.title}</div>
            {loadSum ? <div style={{ height: 30, background: 'rgba(255,255,255,0.25)', borderRadius: 8 }} /> : (
              <>
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{k.sub}</div>
              </>
            )}
            <div style={{ position: 'absolute', top: 18, right: 18, opacity: 0.3 }}>
              <ArrowUpRight size={28} />
            </div>
          </div>
        ))}
      </div>

      {/* Row 1: Daily Sales Area + Payment Status Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>

        {/* Daily Sales — Area Chart */}
        <div style={card()}>
          {sectionTitle('Daily Sales — Last 30 Days', 'Revenue trend')}
          {loadCharts ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={charts?.daily30 ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={4} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" name="Sales" stroke="#6366f1" strokeWidth={2.5} fill="url(#salesGrad)" dot={false} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment Status Pie */}
        <div style={card()}>
          {sectionTitle('Invoice Status', 'Last 90 days')}
          {loadCharts ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={charts?.statusPie ?? []} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {(charts?.statusPie ?? []).map((entry: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[entry.name] ?? CAT_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Monthly Trend Bar + Category Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18, marginBottom: 18 }}>

        {/* Monthly Sales vs Purchases Bar */}
        <div style={card()}>
          {sectionTitle('Monthly Sales vs Purchases', 'Last 6 months')}
          {loadCharts ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts?.monthlyTrend ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#475569', textTransform: 'capitalize' }}>{v}</span>} />
                <Bar dataKey="sales" name="Sales" fill="#6366f1" radius={[6,6,0,0]} />
                <Bar dataKey="purchases" name="Purchases" fill="#f59e0b" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category Donut */}
        <div style={card()}>
          {sectionTitle('Sales by Category', 'This month')}
          {loadCharts ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={charts?.categoryPie ?? []} cx="50%" cy="45%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="revenue" nameKey="category">
                  {(charts?.categoryPie ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmtK(v)} />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Top Products Bar */}
      <div style={{ ...card(), marginBottom: 18 }}>
        {sectionTitle('Top Products by Revenue', 'This month')}
        {loadCharts ? <Skeleton h={200} /> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts?.topProducts ?? []} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} width={130} />
              <Tooltip formatter={(v: any) => fmtK(v)} />
              <Bar dataKey="revenue" name="Revenue" radius={[0,6,6,0]}>
                {(charts?.topProducts ?? []).map((_: any, i: number) => (
                  <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Alerts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

        {/* Overdue */}
        {(alerts?.overdueTransactions?.length > 0) && (
          <div style={card({ padding: 0, overflow: 'hidden' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafbff' }}>
              <AlertCircle size={14} color="#ef4444" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', flex: 1 }}>Overdue Payments</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#fef2f2', color: '#ef4444' }}>{alerts.overdueTransactions.length}</span>
            </div>
            {alerts.overdueTransactions.map((t: any, i: number) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: i < alerts.overdueTransactions.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.party}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.daysPastDue} days overdue</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Low Stock */}
        {(alerts?.lowStockProducts?.length > 0) && (
          <div style={card({ padding: 0, overflow: 'hidden' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafbff' }}>
              <Package size={14} color="#f97316" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', flex: 1 }}>Low Stock</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#fff7ed', color: '#f97316' }}>{alerts.lowStockProducts.length}</span>
            </div>
            {alerts.lowStockProducts.map((p: any, i: number) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: i < alerts.lowStockProducts.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f97316' }}>{Number(p.currentStock).toFixed(0)} {p.unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
