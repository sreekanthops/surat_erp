import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Line,
} from 'recharts';
import {
  ArrowUpRight, ArrowDownRight, Download,
  AlertCircle, Package, CalendarDays,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n: number) =>
  n >= 1_00_00_000 ? `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  : n >= 1_00_000   ? `₹${(n / 1_00_000).toFixed(1)}L`
  : n >= 1000        ? `₹${(n / 1000).toFixed(0)}K`
  : `₹${n}`;

const PIE_COLORS: Record<string, string> = {
  PAID: '#10b981', PARTIAL: '#f59e0b', PENDING: '#5b5bd6', CANCELLED: '#94a3b8', DRAFT: '#cbd5e1',
};
const CAT_COLORS = ['#5b5bd6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#84cc16'];

const card = (style?: React.CSSProperties): React.CSSProperties => ({
  background: '#fff',
  borderRadius: '14px',
  border: '1px solid #e4e7ef',
  boxShadow: '0 2px 8px rgba(17,24,39,0.05)',
  padding: '20px 22px',
  ...style,
});

const ChartTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>{title}</div>
    {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0d1117', borderRadius: 10, padding: '9px 14px',
      fontSize: 12, color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 5, color: '#9ca3af', fontSize: 11 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#d1d5db' }}>{p.name}:</span>
          <b style={{ color: '#fff' }}>{fmtK(p.value)}</b>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{
      background: '#0d1117', borderRadius: 10, padding: '9px 14px',
      fontSize: 12, color: '#fff', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <b>{p.name}</b>: {fmtK(p.value)} <span style={{ color: '#9ca3af' }}>({p.payload.count} invoices)</span>
    </div>
  );
};

const Skeleton = ({ h = 200 }: { h?: number }) => (
  <div style={{
    height: h, background: 'linear-gradient(90deg, #f0f2f8 25%, #e8eaf2 50%, #f0f2f8 75%)',
    borderRadius: 10, backgroundSize: '400% 100%', animation: 'skeleton-shimmer 1.5s ease infinite',
  }} />
);

const exportDashboardExcel = (charts: any) => {
  if (!charts) return;
  const wb = XLSX.utils.book_new();
  if (charts.daily30?.length) {
    const ws = XLSX.utils.json_to_sheet(charts.daily30.map((r: any) => ({ Date: r.day, 'Amount (₹)': r.amount, Orders: r.count })));
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Sales');
  }
  if (charts.monthlyTrend?.length) {
    const ws2 = XLSX.utils.json_to_sheet(charts.monthlyTrend.map((r: any) => ({ Month: r.month, 'Sales (₹)': r.sales, 'Purchases (₹)': r.purchases })));
    XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Trend');
  }
  if (charts.topProducts?.length) {
    const ws3 = XLSX.utils.json_to_sheet(charts.topProducts.map((r: any) => ({ Product: r.name, 'Revenue (₹)': r.revenue, Qty: r.qty })));
    XLSX.utils.book_append_sheet(wb, ws3, 'Top Products');
  }
  if (charts.statusPie?.length) {
    const ws4 = XLSX.utils.json_to_sheet(charts.statusPie.map((r: any) => ({ Status: r.name, 'Amount (₹)': r.value, Count: r.count })));
    XLSX.utils.book_append_sheet(wb, ws4, 'Invoice Status');
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);
};

const isoDate = (d: Date) => d.toISOString().split('T')[0];
const todayStr = () => isoDate(new Date());
const daysAgoStr = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d); };

export default function DashboardPage() {
  const [from, setFrom] = useState(() => daysAgoStr(29));
  const [to,   setTo]   = useState(todayStr);

  const { data: summary, isLoading: loadSum } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/api/v1/dashboard/summary').then(r => r.data),
    refetchInterval: 60_000,
  });
  const { data: charts, isLoading: loadCharts } = useQuery({
    queryKey: ['dashboard-charts', from, to],
    queryFn: () => api.get('/api/v1/dashboard/charts', { params: { from, to } }).then(r => r.data),
    refetchInterval: 120_000,
  });

  const { today: todayData, month, alerts } = summary || {};
  const mom = charts?.momGrowth ?? 0;
  const momUp = mom >= 0;

  const setRange = (days: number) => { setFrom(daysAgoStr(days - 1)); setTo(todayStr()); };
  const setMTD = () => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    setFrom(isoDate(start)); setTo(todayStr());
  };

  const presets = [
    { label: '7D',  days: 7  },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
    { label: 'MTD', days: 0  },
  ];

  const isPresetActive = (days: number) =>
    days === 0
      ? from === isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) && to === todayStr()
      : from === daysAgoStr(days - 1) && to === todayStr();

  const kpis = [
    {
      title: "Today's Sales",
      value: fmt(todayData?.salesAmount ?? 0),
      sub: `${todayData?.salesCount ?? 0} invoices`,
      bg: 'linear-gradient(135deg, #5b5bd6 0%, #7c3aed 100%)',
      glow: 'rgba(91,91,214,0.4)',
    },
    {
      title: 'Period Sales',
      value: fmt(charts?.currentMonthSales ?? 0),
      sub: <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {momUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(mom)}% vs prev period
      </span>,
      bg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      glow: 'rgba(16,185,129,0.4)',
    },
    {
      title: 'Month Profit',
      value: fmt(month?.profitAmount ?? 0),
      sub: `${month?.profitMargin ?? 0}% margin`,
      bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
      glow: 'rgba(245,158,11,0.4)',
    },
    {
      title: 'Unread Messages',
      value: String(todayData?.newMessages ?? 0),
      sub: 'WhatsApp + Gmail',
      bg: 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)',
      glow: 'rgba(236,72,153,0.4)',
    },
  ];

  return (
    <div style={{ padding: '24px 28px', background: '#f5f6fa', minHeight: '100vh', fontFamily: "Inter, -apple-system, sans-serif" }}>
      <style>{`@keyframes skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 22,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.03em' }}>
            Overview
          </h1>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3, margin: '3px 0 0' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Preset buttons */}
          <div style={{
            display: 'flex', background: '#f0f2f8', borderRadius: 9, padding: '3px', gap: '2px',
            border: '1px solid #e4e7ef',
          }}>
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => p.days === 0 ? setMTD() : setRange(p.days)}
                style={{
                  padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  background: isPresetActive(p.days) ? '#fff' : 'transparent',
                  color: isPresetActive(p.days) ? '#111827' : '#6b7280',
                  boxShadow: isPresetActive(p.days) ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.12s',
                }}
              >{p.label}</button>
            ))}
          </div>

          {/* Date inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #e4e7ef', borderRadius: 9, padding: '5px 10px 5px 8px' }}>
              <CalendarDays size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 12, color: '#374151', fontFamily: 'inherit', background: 'transparent', cursor: 'pointer' }} />
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>–</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #e4e7ef', borderRadius: 9, padding: '5px 10px 5px 8px' }}>
              <CalendarDays size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />
              <input type="date" value={to} min={from} max={todayStr()} onChange={e => setTo(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 12, color: '#374151', fontFamily: 'inherit', background: 'transparent', cursor: 'pointer' }} />
            </div>
          </div>

          {/* Export */}
          <button
            onClick={() => exportDashboardExcel(charts)}
            disabled={loadCharts || !charts}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 9,
              border: '1px solid #bbf7d0', background: '#f0fdf4',
              color: '#15803d', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            <Download size={13} /> Excel
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{
            background: k.bg,
            borderRadius: 14, padding: '20px 22px',
            boxShadow: `0 6px 24px ${k.glow}`,
            color: '#fff', position: 'relative', overflow: 'hidden',
          }}>
            {/* Decorative circle */}
            <div style={{
              position: 'absolute', top: -20, right: -20,
              width: 90, height: 90, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
            }} />
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 10 }}>{k.title}</div>
            {loadSum
              ? <div style={{ height: 28, background: 'rgba(255,255,255,0.2)', borderRadius: 7, marginBottom: 8 }} />
              : <>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, marginBottom: 7, letterSpacing: '-0.03em' }}>{k.value}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, display: 'flex', alignItems: 'center', gap: 3 }}>{k.sub}</div>
                </>
            }
          </div>
        ))}
      </div>

      {/* ── Row 1: Daily Area + Pie ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>

        <div style={card()}>
          <ChartTitle title={`Daily Sales — ${from} to ${to}`} sub="Revenue trend over selected period" />
          {loadCharts ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={charts?.daily30 ?? []} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#5b5bd6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#5b5bd6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={Math.max(Math.floor((charts?.daily30?.length ?? 30) / 8) - 1, 0)} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" name="Sales" stroke="#5b5bd6" strokeWidth={2.5} fill="url(#salesGrad)" dot={false} activeDot={{ r: 5, fill: '#5b5bd6', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={card()}>
          <ChartTitle title="Invoice Status" sub={`${from} to ${to}`} />
          {loadCharts ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={charts?.statusPie ?? []} cx="50%" cy="45%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                  {(charts?.statusPie ?? []).map((entry: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[entry.name] ?? CAT_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#4b5563' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 2: Monthly Bar + Category Donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>

        <div style={card()}>
          <ChartTitle title="Monthly Sales vs Purchases" sub="Last 6 months" />
          {loadCharts ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts?.monthlyTrend ?? []} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#4b5563', textTransform: 'capitalize' }}>{v}</span>} />
                <Bar dataKey="sales"     name="Sales"     fill="#5b5bd6" radius={[5,5,0,0]} />
                <Bar dataKey="purchases" name="Purchases" fill="#f59e0b" radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={card()}>
          <ChartTitle title="Sales by Category" sub="This month" />
          {loadCharts ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={charts?.categoryPie ?? []} cx="50%" cy="45%" innerRadius={46} outerRadius={74} paddingAngle={3} dataKey="revenue" nameKey="category">
                  {(charts?.categoryPie ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmtK(v)} />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#4b5563' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 3: Top Products + Radar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>

        <div style={card()}>
          <ChartTitle title="Top Products by Revenue" sub="This month" />
          {loadCharts ? <Skeleton h={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts?.topProducts ?? []} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} width={130} />
                <Tooltip formatter={(v: any) => fmtK(v)} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 5, 5, 0]}>
                  {(charts?.topProducts ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={card()}>
          <ChartTitle title="Product Radar" sub="Revenue vs Qty ratio" />
          {loadCharts ? <Skeleton h={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={(charts?.topProducts ?? []).map((p: any) => ({
                product: (p.name || '').split(' ').slice(0, 2).join(' '),
                revenue: Math.round((p.revenue || 0) / 1000),
                qty: Math.round((p.qty || 0) / 10),
              }))}>
                <PolarGrid stroke="#e4e7ef" />
                <PolarAngleAxis dataKey="product" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="Revenue (K)" dataKey="revenue" stroke="#5b5bd6" fill="#5b5bd6" fillOpacity={0.2} />
                <Radar name="Qty (×10)"   dataKey="qty"     stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                <Legend iconType="circle" iconSize={7} formatter={(v: string) => <span style={{ fontSize: 10, color: '#4b5563' }}>{v}</span>} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 4: Composed ── */}
      <div style={{ ...card(), marginBottom: 16 }}>
        <ChartTitle title="Sales & Profit Trend" sub="Monthly composed view" />
        {loadCharts ? <Skeleton h={180} /> : (
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart
              data={(charts?.monthlyTrend ?? []).map((r: any) => ({
                ...r,
                profit: (r.sales || 0) - (r.purchases || 0),
              }))}
              margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#5b5bd6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#5b5bd6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#4b5563', textTransform: 'capitalize' }}>{v}</span>} />
              <Bar dataKey="profit" name="Profit" fill="#10b981" opacity={0.75} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="sales"     name="Sales"     stroke="#5b5bd6" strokeWidth={2.5} dot={{ r: 3.5, fill: '#5b5bd6', stroke: '#fff', strokeWidth: 2 }} />
              <Line type="monotone" dataKey="purchases" name="Purchases" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Alerts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {(alerts?.overdueTransactions?.length > 0) && (
          <div style={{ ...card({ padding: 0 }), overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 18px', borderBottom: '1px solid #eff0f6',
              background: '#fafbff',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={14} color="#ef4444" />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', flex: 1, letterSpacing: '-0.01em' }}>Overdue Payments</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px',
                borderRadius: 20, background: '#fef2f2', color: '#ef4444',
              }}>{alerts.overdueTransactions.length}</span>
            </div>
            {alerts.overdueTransactions.map((t: any, i: number) => (
              <div key={t.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 18px',
                borderBottom: i < alerts.overdueTransactions.length - 1 ? '1px solid #f5f6fa' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>{t.party}</div>
                  <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>{t.daysPastDue}d overdue</div>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#ef4444' }}>{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {(alerts?.lowStockProducts?.length > 0) && (
          <div style={{ ...card({ padding: 0 }), overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 18px', borderBottom: '1px solid #eff0f6',
              background: '#fafbff',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={14} color="#f97316" />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', flex: 1, letterSpacing: '-0.01em' }}>Low Stock</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px',
                borderRadius: 20, background: '#fff7ed', color: '#f97316',
              }}>{alerts.lowStockProducts.length}</span>
            </div>
            {alerts.lowStockProducts.map((p: any, i: number) => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 18px',
                borderBottom: i < alerts.lowStockProducts.length - 1 ? '1px solid #f5f6fa' : 'none',
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>{p.name}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#f97316' }}>{Number(p.currentStock).toFixed(0)} {p.unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
