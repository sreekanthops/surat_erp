import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import { TrendingUp, TrendingDown, DollarSign, Percent, Package, Users, AlertCircle } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };
const today = () => new Date().toISOString().split('T')[0];

const TABS = ['P&L', 'Stock Summary', 'Outstanding'];

const kpiCards = [
  { key: 'sales',    label: 'Total Sales',    icon: TrendingUp,   gradient: 'linear-gradient(135deg,#667eea,#764ba2)', shadow: 'rgba(102,126,234,0.35)' },
  { key: 'purchases',label: 'Total Purchases',icon: TrendingDown, gradient: 'linear-gradient(135deg,#f093fb,#f5576c)', shadow: 'rgba(240,147,251,0.35)' },
  { key: 'profit',   label: 'Gross Profit',   icon: DollarSign,   gradient: 'linear-gradient(135deg,#11998e,#38ef7d)', shadow: 'rgba(17,153,142,0.35)' },
  { key: 'margin',   label: 'Gross Margin',   icon: Percent,      gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', shadow: 'rgba(247,151,30,0.35)' },
];

export default function ReportsPage() {
  const [tab, setTab]     = useState('P&L');
  const [from, setFrom]   = useState(startOfMonth);
  const [to, setTo]       = useState(today);
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

  const pl = plQuery.data;
  const kpiValues: Record<string, string> = {
    sales:     fmt(pl?.sales || 0),
    purchases: fmt(pl?.purchases || 0),
    profit:    fmt(pl?.grossProfit || 0),
    margin:    `${(pl?.grossMargin || 0).toFixed(1)}%`,
  };

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter,sans-serif', background: '#f1f5f9', minHeight: '100vh' }}>
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

      {/* P&L Tab */}
      {tab === 'P&L' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 24 }}>
            {kpiCards.map(c => (
              <div key={c.key} style={{ background: c.gradient, borderRadius: 16, padding: '22px 20px', boxShadow: `0 8px 28px ${c.shadow}`, color: '#fff', position: 'relative', overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>{c.label}</div>
                {plQuery.isLoading
                  ? <div style={{ height: 32, background: 'rgba(255,255,255,0.25)', borderRadius: 8 }} />
                  : <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{kpiValues[c.key]}</div>
                }
                <div style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.icon size={18} color="#fff" />
                </div>
              </div>
            ))}
          </div>
          {!plQuery.isLoading && pl && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 16px rgba(15,23,42,0.06)', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Period Summary</h3>
              {[
                { label: 'Period', value: `${from} → ${to}` },
                { label: 'Sales Invoices', value: fmtNum(pl.salesCount) },
                { label: 'Total Revenue', value: fmt(pl.sales) },
                { label: 'Total Cost (Purchases)', value: fmt(pl.purchases) },
                { label: 'Gross Profit', value: fmt(pl.grossProfit), bold: true, color: pl.grossProfit >= 0 ? '#16a34a' : '#ef4444' },
                { label: 'Gross Margin %', value: `${(pl.grossMargin || 0).toFixed(2)}%`, bold: true },
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

      {/* Stock Summary Tab */}
      {tab === 'Stock Summary' && (
        <div>
          {stockQuery.isLoading ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 24 }}>
                {[
                  { label: 'Total Products', value: stockQuery.data?.data?.length || 0, icon: Package, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                  { label: 'Total Stock Value', value: fmt(stockQuery.data?.totalValue || 0), icon: DollarSign, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
                  { label: 'Low / Out of Stock', value: stockQuery.data?.data?.filter((p: any) => p.status !== 'ok').length || 0, icon: AlertCircle, color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
                ].map((c, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 16px rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', gap: 16, border: '1px solid #e2e8f0' }}>
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
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(15,23,42,0.06)', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Product', 'Category', 'Unit', 'Stock', 'Reorder', 'Buy Rate', 'Sell Rate', 'Stock Value', 'Status'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockQuery.data?.data?.map((p: any) => {
                      const statusStyle = p.status === 'ok' ? { bg: '#dcfce7', color: '#16a34a', label: 'OK' } : p.status === 'low' ? { bg: '#fff7ed', color: '#f97316', label: 'LOW' } : { bg: '#fef2f2', color: '#ef4444', label: 'OUT' };
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.name}</td>
                          <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b' }}>{p.category || '—'}</td>
                          <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b' }}>{p.unit}</td>
                          <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{fmtNum(Number(p.currentStock))}</td>
                          <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b' }}>{fmtNum(Number(p.reorderLevel))}</td>
                          <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b' }}>{fmt(Number(p.purchaseRate || 0))}</td>
                          <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b' }}>{fmt(Number(p.saleRate || 0))}</td>
                          <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{fmt(p.stockValue)}</td>
                          <td style={{ padding: '13px 16px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Outstanding Tab */}
      {tab === 'Outstanding' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['CUSTOMER', 'SUPPLIER'] as const).map(t => (
              <button key={t} onClick={() => setOutType(t)} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: outType === t ? 700 : 500, background: outType === t ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#fff', color: outType === t ? '#fff' : '#64748b', boxShadow: outType === t ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}>
                {t === 'CUSTOMER' ? '📥 Receivables (Customers)' : '📤 Payables (Suppliers)'}
              </button>
            ))}
          </div>
          {outQuery.isLoading ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(15,23,42,0.06)', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Name', 'City', 'Phone', 'Balance', 'Credit Limit', '% Used'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outQuery.data?.data?.map((p: any) => {
                    const pct = p.creditLimit > 0 ? Math.min(100, Math.round((p.currentBalance / p.creditLimit) * 100)) : 0;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.name}</td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b' }}>{p.city || '—'}</td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b' }}>{p.phone || '—'}</td>
                        <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 700, color: outType === 'CUSTOMER' ? '#ef4444' : '#16a34a' }}>{fmt(Number(p.currentBalance))}</td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: '#64748b' }}>{fmt(Number(p.creditLimit))}</td>
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#ef4444' : pct > 50 ? '#f97316' : '#6366f1', borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: pct > 80 ? '#ef4444' : '#64748b', minWidth: 32 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  {outQuery.data?.data?.length > 0 && (
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                      <td colSpan={3} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>TOTAL ({outQuery.data.data.length} parties)</td>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: outType === 'CUSTOMER' ? '#ef4444' : '#16a34a' }}>
                        {fmt(outQuery.data.data.reduce((s: number, p: any) => s + Number(p.currentBalance), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </tbody>
              </table>
              {(!outQuery.data?.data?.length) && (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No outstanding {outType === 'CUSTOMER' ? 'receivables' : 'payables'} found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
