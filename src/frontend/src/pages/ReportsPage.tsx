import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, Package, Users, AlertCircle } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n: number) =>
  n >= 1_00_00_000 ? `₹${(n/1_00_00_000).toFixed(1)}Cr`
  : n >= 1_00_000 ? `₹${(n/1_00_000).toFixed(1)}L`
  : n >= 1000 ? `₹${(n/1000).toFixed(0)}K` : `₹${n}`;
const fmtNum = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };
const today = () => new Date().toISOString().split('T')[0];

const TABS = ['P&L', 'Stock Summary', 'Outstanding'];
const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
const STATUS_COLORS: Record<string, string> = { ok: '#10b981', low: '#f59e0b', out: '#ef4444' };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#fff' }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#94a3b8' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill }} />
          <span>{p.name}: <b>{typeof p.value === 'number' ? fmtK(p.value) : p.value}</b></span>
        </div>
      ))}
    </div>
  );
};

const card = (style?: React.CSSProperties): React.CSSProperties => ({
  background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
  boxShadow: '0 2px 12px rgba(15,23,42,0.05)', padding: '20px 22px', ...style,
});

const kpiCards = [
  { key: 'sales',     label: 'Total Sales',     icon: TrendingUp,   gradient: 'linear-gradient(135deg,#667eea,#764ba2)', shadow: 'rgba(102,126,234,0.35)' },
  { key: 'purchases', label: 'Total Purchases',  icon: TrendingDown, gradient: 'linear-gradient(135deg,#f093fb,#f5576c)', shadow: 'rgba(240,147,251,0.35)' },
  { key: 'profit',    label: 'Gross Profit',     icon: DollarSign,   gradient: 'linear-gradient(135deg,#11998e,#38ef7d)', shadow: 'rgba(17,153,142,0.35)' },
  { key: 'margin',    label: 'Gross Margin',     icon: Percent,      gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', shadow: 'rgba(247,151,30,0.35)' },
];

export default function ReportsPage() {
  const [tab, setTab]         = useState('P&L');
  const [from, setFrom]       = useState(startOfMonth);
  const [to, setTo]           = useState(today);
  const [outType, setOutType] = useState<'CUSTOMER'|'SUPPLIER'>('CUSTOMER');

  const plQuery = useQuery({
    queryKey: ['report-pl', from, to],
    queryFn: () => api.get(`/api/v1/reports/profit-loss?from=${from}&to=${to}`).then(r => r.data),
    enabled: tab === 'P&L',
  });
  const stockQuery = useQuery({
    queryKey: ['report-stock'],
    queryFn: () => api.get('/api/v1/reports/stock-summary').then(r => r.data),
    enabled: tab === 'Stock Summary',
  });
  const outQuery = useQuery({
    queryKey: ['report-outstanding', outType],
    queryFn: () => api.get(`/api/v1/reports/party-outstanding?type=${outType}`).then(r => r.data),
    enabled: tab === 'Outstanding',
  });
  // 6-month trend for P&L tab
  const trendQuery = useQuery({
    queryKey: ['report-trend'],
    queryFn: () => api.get('/api/v1/dashboard/charts').then(r => r.data),
    enabled: tab === 'P&L',
  });

  const pl = plQuery.data;
  const kpiValues: Record<string, string> = {
    sales:     fmt(pl?.sales || 0),
    purchases: fmt(pl?.purchases || 0),
    profit:    fmt(pl?.grossProfit || 0),
    margin:    `${(pl?.grossMargin || 0).toFixed(1)}%`,
  };

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter,sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Reports</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>P&L, stock valuation & outstanding balances</p>
        </div>
        {tab === 'P&L' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff' }} />
            <span style={{ color: '#94a3b8', fontSize: 13 }}>to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff' }} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 6, boxShadow: '0 2px 12px rgba(15,23,42,0.06)', marginBottom: 24, width: 'fit-content', border: '1px solid #e2e8f0' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 500, background: tab === t ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent', color: tab === t ? '#fff' : '#64748b', transition: 'all 0.15s', boxShadow: tab === t ? '0 2px 8px rgba(99,102,241,0.3)' : 'none' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── P&L Tab ── */}
      {tab === 'P&L' && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 24 }}>
            {kpiCards.map(c => (
              <div key={c.key} style={{ background: c.gradient, borderRadius: 16, padding: '22px 20px', boxShadow: `0 8px 28px ${c.shadow}`, color: '#fff', position: 'relative', overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>{c.label}</div>
                {plQuery.isLoading
                  ? <div style={{ height: 32, background: 'rgba(255,255,255,0.25)', borderRadius: 8 }} />
                  : <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{kpiValues[c.key]}</div>}
                <div style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.icon size={18} color="#fff" />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18, marginBottom: 18 }}>
            {/* Sales vs Purchases Line Chart */}
            <div style={card()}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Sales vs Purchases — 6 Months</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Monthly comparison</div>
              {trendQuery.isLoading
                ? <div style={{ height: 200, background: '#f1f5f9', borderRadius: 10 }} />
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendQuery.data?.monthlyTrend ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#475569', textTransform: 'capitalize' }}>{v}</span>} />
                      <Line type="monotone" dataKey="sales" name="Sales" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} />
                      <Line type="monotone" dataKey="purchases" name="Purchases" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: '#f59e0b' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
            </div>

            {/* Top Products Pie */}
            <div style={card()}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Top Products</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>By revenue this month</div>
              {trendQuery.isLoading
                ? <div style={{ height: 200, background: '#f1f5f9', borderRadius: 10 }} />
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={trendQuery.data?.topProducts ?? []} cx="50%" cy="45%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="revenue" nameKey="name">
                        {(trendQuery.data?.topProducts ?? []).map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtK(v)} />
                      <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 10, color: '#475569' }}>{v?.slice(0,15)}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
            </div>
          </div>

          {/* Period Summary Table */}
          {!plQuery.isLoading && pl && (
            <div style={card()}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Period Summary</div>
              {[
                { label: 'Period',             value: `${from} → ${to}` },
                { label: 'Sales Invoices',     value: fmtNum(pl.salesCount) },
                { label: 'Total Revenue',      value: fmt(pl.sales) },
                { label: 'Total Cost (Purchases)', value: fmt(pl.purchases) },
                { label: 'Gross Profit',       value: fmt(pl.grossProfit), bold: true, color: pl.grossProfit >= 0 ? '#16a34a' : '#ef4444' },
                { label: 'Gross Margin %',     value: `${(pl.grossMargin || 0).toFixed(2)}%`, bold: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 5 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 500, color: row.color || '#1e293b' }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stock Summary Tab ── */}
      {tab === 'Stock Summary' && (
        <div>
          {stockQuery.isLoading ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 24 }}>
                {[
                  { label: 'Total Products',     value: stockQuery.data?.data?.length || 0,                                                          icon: Package,    color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                  { label: 'Total Stock Value',   value: fmt(stockQuery.data?.totalValue || 0),                                                       icon: DollarSign, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
                  { label: 'Low / Out of Stock',  value: stockQuery.data?.data?.filter((p: any) => p.status !== 'ok').length || 0,                    icon: AlertCircle,color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
                ].map((c, i) => (
                  <div key={i} style={card({ display: 'flex', alignItems: 'center', gap: 16 })}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <c.icon size={20} color={c.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{typeof c.value === 'number' ? fmtNum(c.value) : c.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stock Bar Chart */}
              <div style={{ ...card(), marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Stock Levels vs Reorder Level</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stockQuery.data?.data ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 40 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
                    <YAxis tickFormatter={(v) => fmtNum(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                    <Bar dataKey="currentStock" name="Current Stock" radius={[6,6,0,0]}>
                      {(stockQuery.data?.data ?? []).map((p: any, i: number) => (
                        <Cell key={i} fill={STATUS_COLORS[p.status] ?? '#6366f1'} />
                      ))}
                    </Bar>
                    <Bar dataKey="reorderLevel" name="Reorder Level" fill="#e2e8f0" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stock Value Pie */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 18 }}>
                <div style={card()}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Stock Value Share</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stockQuery.data?.data ?? []} cx="50%" cy="45%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="stockValue" nameKey="name">
                        {(stockQuery.data?.data ?? []).map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtK(v)} />
                      <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 10, color: '#475569' }}>{v?.slice(0,15)}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Stock Table */}
                <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Product','Unit','Stock','Reorder','Value','Status'].map(h => (
                          <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stockQuery.data?.data?.map((p: any) => {
                        const s = p.status === 'ok' ? { bg:'#dcfce7', color:'#16a34a', label:'OK' } : p.status === 'low' ? { bg:'#fff7ed', color:'#f97316', label:'LOW' } : { bg:'#fef2f2', color:'#ef4444', label:'OUT' };
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600, color:'#1e293b' }}>{p.name}</td>
                            <td style={{ padding:'11px 14px', fontSize:12, color:'#64748b' }}>{p.unit}</td>
                            <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600 }}>{fmtNum(Number(p.currentStock))}</td>
                            <td style={{ padding:'11px 14px', fontSize:12, color:'#94a3b8' }}>{fmtNum(Number(p.reorderLevel))}</td>
                            <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600 }}>{fmtK(p.stockValue)}</td>
                            <td style={{ padding:'11px 14px' }}>
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, background:s.bg, color:s.color }}>{s.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Outstanding Tab ── */}
      {tab === 'Outstanding' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['CUSTOMER','SUPPLIER'] as const).map(t => (
              <button key={t} onClick={() => setOutType(t)} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: outType === t ? 700 : 500, background: outType === t ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#fff', color: outType === t ? '#fff' : '#64748b', boxShadow: outType === t ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}>
                {t === 'CUSTOMER' ? '📥 Receivables' : '📤 Payables'}
              </button>
            ))}
          </div>

          {outQuery.isLoading ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18 }}>
              {/* Table */}
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Name','City','Balance','Credit Limit','% Used'].map(h => (
                        <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {outQuery.data?.data?.map((p: any) => {
                      const pct = p.creditLimit > 0 ? Math.min(100, Math.round((p.currentBalance/p.creditLimit)*100)) : 0;
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding:'12px 14px', fontSize:13, fontWeight:600, color:'#1e293b' }}>{p.name}</td>
                          <td style={{ padding:'12px 14px', fontSize:12, color:'#64748b' }}>{p.city||'—'}</td>
                          <td style={{ padding:'12px 14px', fontSize:14, fontWeight:700, color: outType==='CUSTOMER'?'#ef4444':'#16a34a' }}>{fmt(Number(p.currentBalance))}</td>
                          <td style={{ padding:'12px 14px', fontSize:12, color:'#64748b' }}>{fmt(Number(p.creditLimit))}</td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ flex:1, height:6, background:'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${pct}%`, background:pct>80?'#ef4444':pct>50?'#f97316':'#6366f1', borderRadius:99 }} />
                              </div>
                              <span style={{ fontSize:12, fontWeight:600, color:pct>80?'#ef4444':'#64748b', minWidth:32 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {outQuery.data?.data?.length > 0 && (
                      <tr style={{ background:'#f8fafc', borderTop:'2px solid #e2e8f0' }}>
                        <td colSpan={2} style={{ padding:'11px 14px', fontSize:13, fontWeight:700, color:'#1e293b' }}>TOTAL ({outQuery.data.data.length})</td>
                        <td style={{ padding:'11px 14px', fontSize:14, fontWeight:800, color:outType==='CUSTOMER'?'#ef4444':'#16a34a' }}>
                          {fmt(outQuery.data.data.reduce((s: number, p: any) => s+Number(p.currentBalance), 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    )}
                  </tbody>
                </table>
                {!outQuery.data?.data?.length && (
                  <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:14 }}>No outstanding {outType==='CUSTOMER'?'receivables':'payables'} found</div>
                )}
              </div>

              {/* Horizontal Bar Chart */}
              <div style={card()}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
                  {outType === 'CUSTOMER' ? 'Top Receivables' : 'Top Payables'}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={outQuery.data?.data?.slice(0,8) ?? []} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip formatter={(v: any) => fmtK(v)} />
                    <Bar dataKey="currentBalance" name="Balance" fill={outType === 'CUSTOMER' ? '#ef4444' : '#10b981'} radius={[0,6,6,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
