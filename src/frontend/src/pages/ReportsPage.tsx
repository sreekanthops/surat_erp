import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, AreaChart, Area, ComposedChart, RadialBarChart, RadialBar,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Package, Users,
  AlertCircle, Download, FileText, FileSpreadsheet, Code,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n: number) =>
  n >= 1_00_00_000 ? `₹${(n/1_00_00_000).toFixed(1)}Cr`
  : n >= 1_00_000 ? `₹${(n/1_00_000).toFixed(1)}L`
  : n >= 1000 ? `₹${(n/1000).toFixed(0)}K` : `₹${n}`;
const fmtNum = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };
const today = () => new Date().toISOString().split('T')[0];

const TABS = ['P&L', 'Stock Summary', 'Outstanding'];
const PIE_COLORS = ['#5b5bd6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
const STATUS_COLORS: Record<string, string> = { ok: '#10b981', low: '#f59e0b', out: '#ef4444' };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a2235', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#fff' }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#9ca3af' }}>{label}</div>
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

// ── Export helpers ───────────────────────────────────────────────────────────

function exportToExcel(sheets: { name: string; data: any[] }[], filename: string) {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    if (!sh.data.length) continue;
    const ws = XLSX.utils.json_to_sheet(sh.data);
    // Auto column widths
    const maxW = Object.keys(sh.data[0] || {}).map(k => ({
      wch: Math.max(k.length, ...sh.data.slice(0, 50).map(r => String(r[k] ?? '').length)) + 2,
    }));
    ws['!cols'] = maxW;
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${filename}.xlsx`);
}

function exportToCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(r => headers.map(h => {
    const v = String(r[h] ?? '');
    return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  saveAs(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
}

function exportToJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  saveAs(blob, `${filename}.json`);
}

function exportToTXT(data: any, filename: string, title: string) {
  const lines: string[] = [];
  const sep = '─'.repeat(64);
  lines.push(sep);
  lines.push(`  ${title}`);
  lines.push(`  Generated: ${new Date().toLocaleString('en-IN')}`);
  lines.push(sep);

  if (Array.isArray(data) && data.length) {
    const keys = Object.keys(data[0]);
    const colW = keys.map(k => Math.max(k.length, ...data.slice(0, 100).map((r: any) => String(r[k] ?? '').length)) + 2);
    const header = keys.map((k, i) => k.toUpperCase().padEnd(colW[i])).join(' | ');
    lines.push(header);
    lines.push('─'.repeat(header.length));
    for (const r of data) {
      lines.push(keys.map((k, i) => String(r[k] ?? '').padEnd(colW[i])).join(' | '));
    }
  } else if (typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      lines.push(`  ${String(k).padEnd(30)} ${v}`);
    }
  }
  lines.push(sep);
  saveAs(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' }), `${filename}.txt`);
}

// ── Export Buttons ───────────────────────────────────────────────────────────
function ExportBar({ onExcel, onCSV, onJSON, onTXT }: {
  onExcel: () => void; onCSV: () => void; onJSON: () => void; onTXT: () => void;
}) {
  const btn = (label: string, icon: React.ReactNode, onClick: () => void, color: string) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${color}22`,
        background: `${color}0d`, color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = `${color}22`)}
      onMouseLeave={e => (e.currentTarget.style.background = `${color}0d`)}
    >
      {icon} {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600, marginRight: 4 }}>
        <Download size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
        Export:
      </span>
      {btn('Excel', <FileSpreadsheet size={13} />, onExcel, '#16a34a')}
      {btn('CSV',   <FileText size={13} />,        onCSV,   '#2563eb')}
      {btn('JSON',  <Code size={13} />,             onJSON,  '#7c3aed')}
      {btn('TXT',   <FileText size={13} />,         onTXT,   '#9333ea')}
    </div>
  );
}

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

  // ── Export handlers ──────────────────────────────────────────────────────
  const handlePLExcel = () => {
    const summary = [{ Period: `${from} to ${to}`, 'Sales (₹)': pl?.sales, 'Purchases (₹)': pl?.purchases, 'Gross Profit (₹)': pl?.grossProfit, 'Margin %': pl?.grossMargin }];
    const trend = (trendQuery.data?.monthlyTrend ?? []).map((r: any) => ({ Month: r.month, 'Sales (₹)': r.sales, 'Purchases (₹)': r.purchases, 'Profit (₹)': (r.sales || 0) - (r.purchases || 0) }));
    const topProds = (trendQuery.data?.topProducts ?? []).map((r: any) => ({ Product: r.name, 'Revenue (₹)': r.revenue, 'Qty Sold': r.qty }));
    exportToExcel([
      { name: 'P&L Summary', data: summary },
      { name: '6-Month Trend', data: trend },
      { name: 'Top Products', data: topProds },
    ], `PL_Report_${from}_${to}`);
  };

  const handleStockExcel = () => {
    const rows = (stockQuery.data?.data ?? []).map((p: any) => ({
      Product: p.name, Category: p.category, Unit: p.unit,
      'Stock': Number(p.currentStock), 'Reorder Level': Number(p.reorderLevel),
      'Buy Rate (₹)': Number(p.purchaseRate), 'Sell Rate (₹)': Number(p.saleRate),
      'Stock Value (₹)': Number(p.stockValue.toFixed(2)), Status: p.status.toUpperCase(),
    }));
    exportToExcel([{ name: 'Stock Summary', data: rows }], `Stock_Report_${today()}`);
  };

  const handleOutExcel = () => {
    const rows = (outQuery.data?.data ?? []).map((p: any) => ({
      Name: p.name, City: p.city || '', Type: outType,
      'Balance (₹)': Number(p.currentBalance), 'Credit Limit (₹)': Number(p.creditLimit),
      'Used %': p.creditLimit > 0 ? Math.round((Number(p.currentBalance) / Number(p.creditLimit)) * 100) : 0,
    }));
    exportToExcel([{ name: `${outType} Outstanding`, data: rows }], `Outstanding_${outType}_${today()}`);
  };

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter,sans-serif', background: '#f8f9fc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Reports</h1>
          <p style={{ fontSize: 13, color: '#4b5563', marginTop: 4 }}>P&L, stock valuation & outstanding balances</p>
        </div>
        {tab === 'P&L' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #e4e7ef', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff' }} />
            <span style={{ color: '#9ca3af', fontSize: 13 }}>to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid #e4e7ef', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff' }} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 6, boxShadow: '0 2px 12px rgba(15,23,42,0.06)', marginBottom: 24, width: 'fit-content', border: '1px solid #e4e7ef' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 500, background: tab === t ? 'linear-gradient(135deg,#5b5bd6,#8b5cf6)' : 'transparent', color: tab === t ? '#fff' : '#4b5563', transition: 'all 0.15s', boxShadow: tab === t ? '0 2px 8px rgba(99,102,241,0.3)' : 'none' }}>
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

          {/* Export Bar */}
          <div style={{ ...card(), marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
            <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>P&L Report — {from} to {to}</span>
            <ExportBar
              onExcel={handlePLExcel}
              onCSV={() => exportToCSV(
                (trendQuery.data?.monthlyTrend ?? []).map((r: any) => ({ Month: r.month, Sales: r.sales, Purchases: r.purchases })),
                `PL_Trend_${from}_${to}`
              )}
              onJSON={() => exportToJSON({ period: { from, to }, pl, monthlyTrend: trendQuery.data?.monthlyTrend, topProducts: trendQuery.data?.topProducts }, `PL_Report_${from}_${to}`)}
              onTXT={() => {
                const d = [
                  { Field: 'Period', Value: `${from} to ${to}` },
                  { Field: 'Total Sales (₹)', Value: fmt(pl?.sales || 0) },
                  { Field: 'Total Purchases (₹)', Value: fmt(pl?.purchases || 0) },
                  { Field: 'Gross Profit (₹)', Value: fmt(pl?.grossProfit || 0) },
                  { Field: 'Gross Margin', Value: `${(pl?.grossMargin || 0).toFixed(2)}%` },
                  { Field: 'Sales Invoices', Value: String(pl?.salesCount || 0) },
                ];
                exportToTXT(d, `PL_Report_${from}_${to}`, 'Profit & Loss Report');
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18, marginBottom: 18 }}>
            {/* Sales vs Purchases — Area Chart */}
            <div style={card()}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Sales vs Purchases — 6 Months</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Monthly area comparison</div>
              {trendQuery.isLoading
                ? <div style={{ height: 200, background: '#f5f6fa', borderRadius: 10 }} />
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendQuery.data?.monthlyTrend ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesAreaG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5b5bd6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#5b5bd6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="purAreaG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f6fa" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={52} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#4b5563', textTransform: 'capitalize' }}>{v}</span>} />
                      <Area type="monotone" dataKey="sales" name="Sales" stroke="#5b5bd6" fill="url(#salesAreaG)" strokeWidth={2.5} dot={{ r: 4, fill: '#5b5bd6' }} />
                      <Area type="monotone" dataKey="purchases" name="Purchases" stroke="#f59e0b" fill="url(#purAreaG)" strokeWidth={2.5} dot={{ r: 4, fill: '#f59e0b' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
            </div>

            {/* Top Products Pie (Donut) */}
            <div style={card()}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Top Products</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>By revenue this month</div>
              {trendQuery.isLoading
                ? <div style={{ height: 200, background: '#f5f6fa', borderRadius: 10 }} />
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={trendQuery.data?.topProducts ?? []} cx="50%" cy="45%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="revenue" nameKey="name">
                        {(trendQuery.data?.topProducts ?? []).map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtK(v)} />
                      <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 10, color: '#4b5563' }}>{v?.slice(0,15)}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
            </div>
          </div>

          {/* Profit Bar Chart */}
          <div style={{ ...card(), marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Monthly Profit Trend</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Gross profit per month (Sales − Purchases)</div>
            {trendQuery.isLoading
              ? <div style={{ height: 160, background: '#f5f6fa', borderRadius: 10 }} />
              : (
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={(trendQuery.data?.monthlyTrend ?? []).map((r: any) => ({ ...r, profit: (r.sales || 0) - (r.purchases || 0) }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f6fa" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={52} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#4b5563', textTransform: 'capitalize' }}>{v}</span>} />
                    <Bar dataKey="profit" name="Profit" radius={[6,6,0,0]}>
                      {(trendQuery.data?.monthlyTrend ?? []).map((r: any, i: number) => (
                        <Cell key={i} fill={(r.sales || 0) - (r.purchases || 0) >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="sales" name="Sales" stroke="#5b5bd6" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Period Summary Table */}
          {!plQuery.isLoading && pl && (
            <div style={card()}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Period Summary</div>
              {[
                { label: 'Period',             value: `${from} → ${to}` },
                { label: 'Sales Invoices',     value: fmtNum(pl.salesCount) },
                { label: 'Total Revenue',      value: fmt(pl.sales) },
                { label: 'Total Cost (Purchases)', value: fmt(pl.purchases) },
                { label: 'Gross Profit',       value: fmt(pl.grossProfit), bold: true, color: pl.grossProfit >= 0 ? '#16a34a' : '#ef4444' },
                { label: 'Gross Margin %',     value: `${(pl.grossMargin || 0).toFixed(2)}%`, bold: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 5 ? '1px solid #f5f6fa' : 'none' }}>
                  <span style={{ fontSize: 13, color: '#4b5563' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 500, color: row.color || '#1a2235' }}>{row.value}</span>
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
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 24 }}>
                {[
                  { label: 'Total Products',     value: stockQuery.data?.data?.length || 0,                                                          icon: Package,    color: '#5b5bd6', bg: 'rgba(99,102,241,0.1)' },
                  { label: 'Total Stock Value',   value: fmt(stockQuery.data?.totalValue || 0),                                                       icon: DollarSign, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
                  { label: 'Low / Out of Stock',  value: stockQuery.data?.data?.filter((p: any) => p.status !== 'ok').length || 0,                    icon: AlertCircle,color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
                ].map((c, i) => (
                  <div key={i} style={card({ display: 'flex', alignItems: 'center', gap: 16 })}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <c.icon size={20} color={c.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 2 }}>{typeof c.value === 'number' ? fmtNum(c.value) : c.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Export Bar */}
              <div style={{ ...card(), marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>Stock Report — {today()}</span>
                <ExportBar
                  onExcel={handleStockExcel}
                  onCSV={() => exportToCSV((stockQuery.data?.data ?? []).map((p: any) => ({
                    Product: p.name, Category: p.category, Unit: p.unit,
                    Stock: Number(p.currentStock), ReorderLevel: Number(p.reorderLevel),
                    StockValue: Number(p.stockValue.toFixed(2)), Status: p.status,
                  })), `Stock_${today()}`)}
                  onJSON={() => exportToJSON(stockQuery.data, `Stock_${today()}`)}
                  onTXT={() => exportToTXT((stockQuery.data?.data ?? []).map((p: any) => ({
                    Product: p.name, Category: p.category, Stock: fmtNum(Number(p.currentStock)),
                    Value: fmt(p.stockValue), Status: p.status.toUpperCase(),
                  })), `Stock_${today()}`, 'Stock Summary Report')}
                />
              </div>

              {/* Stock Bar Chart */}
              <div style={{ ...card(), marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Stock Levels vs Reorder Level</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stockQuery.data?.data ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 40 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f6fa" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
                    <YAxis tickFormatter={(v) => fmtNum(v)} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#4b5563' }}>{v}</span>} />
                    <Bar dataKey="currentStock" name="Current Stock" radius={[6,6,0,0]}>
                      {(stockQuery.data?.data ?? []).map((p: any, i: number) => (
                        <Cell key={i} fill={STATUS_COLORS[p.status] ?? '#5b5bd6'} />
                      ))}
                    </Bar>
                    <Bar dataKey="reorderLevel" name="Reorder Level" fill="#e4e7ef" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Row: Donut + Radial Bar + Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 18 }}>
                {/* Stock Value Donut */}
                <div style={card()}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Stock Value Share</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stockQuery.data?.data ?? []} cx="50%" cy="45%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="stockValue" nameKey="name">
                        {(stockQuery.data?.data ?? []).map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtK(v)} />
                      <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 10, color: '#4b5563' }}>{v?.slice(0,14)}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Stock Status Radial */}
                <div style={card()}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Stock Status</div>
                  {(() => {
                    const d = stockQuery.data?.data ?? [];
                    const ok = d.filter((p: any) => p.status === 'ok').length;
                    const low = d.filter((p: any) => p.status === 'low').length;
                    const out = d.filter((p: any) => p.status === 'out').length;
                    const radialData = [
                      { name: 'OK', value: ok, fill: '#10b981' },
                      { name: 'Low', value: low, fill: '#f59e0b' },
                      { name: 'Out', value: out, fill: '#ef4444' },
                    ].filter(r => r.value > 0);
                    return (
                      <ResponsiveContainer width="100%" height={200}>
                        <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={radialData} startAngle={90} endAngle={-270}>
                          <RadialBar dataKey="value" label={{ position: 'insideStart', fill: '#fff', fontSize: 11, fontWeight: 700 }} />
                          <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11, color: '#4b5563' }}>{v}</span>} />
                          <Tooltip formatter={(v: any) => `${v} products`} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                {/* Stock Table */}
                <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fc' }}>
                        {['Product','Unit','Stock','Reorder','Value','Status'].map(h => (
                          <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stockQuery.data?.data?.map((p: any) => {
                        const s = p.status === 'ok' ? { bg:'#dcfce7', color:'#16a34a', label:'OK' } : p.status === 'low' ? { bg:'#fff7ed', color:'#f97316', label:'LOW' } : { bg:'#fef2f2', color:'#ef4444', label:'OUT' };
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f5f6fa' }}>
                            <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600, color:'#1a2235' }}>{p.name}</td>
                            <td style={{ padding:'11px 14px', fontSize:12, color:'#4b5563' }}>{p.unit}</td>
                            <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600 }}>{fmtNum(Number(p.currentStock))}</td>
                            <td style={{ padding:'11px 14px', fontSize:12, color:'#9ca3af' }}>{fmtNum(Number(p.reorderLevel))}</td>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['CUSTOMER','SUPPLIER'] as const).map(t => (
                <button key={t} onClick={() => setOutType(t)} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: outType === t ? 700 : 500, background: outType === t ? 'linear-gradient(135deg,#5b5bd6,#8b5cf6)' : '#fff', color: outType === t ? '#fff' : '#4b5563', boxShadow: outType === t ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}>
                  {t === 'CUSTOMER' ? '📥 Receivables' : '📤 Payables'}
                </button>
              ))}
            </div>
            <ExportBar
              onExcel={handleOutExcel}
              onCSV={() => exportToCSV((outQuery.data?.data ?? []).map((p: any) => ({
                Name: p.name, City: p.city || '', Balance: Number(p.currentBalance), CreditLimit: Number(p.creditLimit),
              })), `Outstanding_${outType}_${today()}`)}
              onJSON={() => exportToJSON(outQuery.data, `Outstanding_${outType}_${today()}`)}
              onTXT={() => exportToTXT((outQuery.data?.data ?? []).map((p: any) => ({
                Name: p.name, City: p.city || '—', Balance: fmt(Number(p.currentBalance)), Limit: fmt(Number(p.creditLimit)),
              })), `Outstanding_${outType}_${today()}`, `${outType} Outstanding Report`)}
            />
          </div>

          {outQuery.isLoading ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : (
            <>
              {/* KPI Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 18 }}>
                {[
                  {
                    label: outType === 'CUSTOMER' ? 'Total Receivable' : 'Total Payable',
                    value: fmt(outQuery.data?.data?.reduce((s: number, p: any) => s + Number(p.currentBalance), 0) || 0),
                    color: outType === 'CUSTOMER' ? '#ef4444' : '#16a34a', bg: outType === 'CUSTOMER' ? 'rgba(239,68,68,0.08)' : 'rgba(22,163,74,0.08)',
                  },
                  {
                    label: `${outType === 'CUSTOMER' ? 'Customers' : 'Suppliers'} with Balance`,
                    value: fmtNum(outQuery.data?.data?.length || 0),
                    color: '#5b5bd6', bg: 'rgba(99,102,241,0.08)',
                  },
                  {
                    label: 'Over Credit Limit',
                    value: fmtNum(outQuery.data?.data?.filter((p: any) => Number(p.currentBalance) > Number(p.creditLimit)).length || 0),
                    color: '#f97316', bg: 'rgba(249,115,22,0.08)',
                  },
                ].map((kpi, i) => (
                  <div key={i} style={{ ...card(), display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={20} color={kpi.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, marginTop: 2 }}>{kpi.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18, marginBottom: 18 }}>
                {/* Table */}
                <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fc' }}>
                        {['Name','City','Balance','Credit Limit','% Used'].map(h => (
                          <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {outQuery.data?.data?.map((p: any) => {
                        const pct = p.creditLimit > 0 ? Math.min(100, Math.round((Number(p.currentBalance)/Number(p.creditLimit))*100)) : 0;
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f5f6fa' }}>
                            <td style={{ padding:'12px 14px', fontSize:13, fontWeight:600, color:'#1a2235' }}>{p.name}</td>
                            <td style={{ padding:'12px 14px', fontSize:12, color:'#4b5563' }}>{p.city||'—'}</td>
                            <td style={{ padding:'12px 14px', fontSize:14, fontWeight:700, color: outType==='CUSTOMER'?'#ef4444':'#16a34a' }}>{fmt(Number(p.currentBalance))}</td>
                            <td style={{ padding:'12px 14px', fontSize:12, color:'#4b5563' }}>{fmt(Number(p.creditLimit))}</td>
                            <td style={{ padding:'12px 14px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ flex:1, height:6, background:'#f5f6fa', borderRadius:99, overflow:'hidden' }}>
                                  <div style={{ height:'100%', width:`${pct}%`, background:pct>80?'#ef4444':pct>50?'#f97316':'#5b5bd6', borderRadius:99 }} />
                                </div>
                                <span style={{ fontSize:12, fontWeight:600, color:pct>80?'#ef4444':'#4b5563', minWidth:32 }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {outQuery.data?.data?.length > 0 && (
                        <tr style={{ background:'#f8f9fc', borderTop:'2px solid #e4e7ef' }}>
                          <td colSpan={2} style={{ padding:'11px 14px', fontSize:13, fontWeight:700, color:'#1a2235' }}>TOTAL ({outQuery.data.data.length})</td>
                          <td style={{ padding:'11px 14px', fontSize:14, fontWeight:800, color:outType==='CUSTOMER'?'#ef4444':'#16a34a' }}>
                            {fmt(outQuery.data.data.reduce((s: number, p: any) => s+Number(p.currentBalance), 0))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {!outQuery.data?.data?.length && (
                    <div style={{ padding:40, textAlign:'center', color:'#9ca3af', fontSize:14 }}>No outstanding {outType==='CUSTOMER'?'receivables':'payables'} found</div>
                  )}
                </div>

                {/* Charts column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {/* Horizontal Bar */}
                  <div style={card()}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
                      {outType === 'CUSTOMER' ? 'Top Receivables' : 'Top Payables'}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={outQuery.data?.data?.slice(0,6) ?? []} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f5f6fa" horizontal={false} />
                        <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} width={100} />
                        <Tooltip formatter={(v: any) => fmtK(Number(v))} />
                        <Bar dataKey="currentBalance" name="Balance" fill={outType === 'CUSTOMER' ? '#ef4444' : '#10b981'} radius={[0,6,6,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Credit Usage Pie */}
                  <div style={card()}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Credit Utilisation</div>
                    {(() => {
                      const d = outQuery.data?.data ?? [];
                      const over80 = d.filter((p: any) => Number(p.currentBalance) / Math.max(Number(p.creditLimit), 1) > 0.8).length;
                      const mid = d.filter((p: any) => { const r = Number(p.currentBalance) / Math.max(Number(p.creditLimit), 1); return r > 0.5 && r <= 0.8; }).length;
                      const low = d.length - over80 - mid;
                      const pieData = [
                        { name: '>80% used', value: over80, fill: '#ef4444' },
                        { name: '50-80%', value: mid, fill: '#f59e0b' },
                        { name: '<50%', value: low, fill: '#10b981' },
                      ].filter(r => r.value > 0);
                      return (
                        <ResponsiveContainer width="100%" height={150}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="45%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value">
                              {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                            </Pie>
                            <Tooltip formatter={(v: any) => `${v} parties`} />
                            <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 10, color: '#4b5563' }}>{v}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
