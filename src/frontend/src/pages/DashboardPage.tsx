import { useQuery } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import { TrendingUp, TrendingDown, MessageSquare, Users, Package, AlertCircle, ArrowUpRight } from 'lucide-react';

const kpiConfig = [
  {
    key: 'sales',
    title: "Today's Sales",
    sub: (d: any) => `${d?.today?.salesCount || 0} invoices`,
    value: (d: any, fmt: any) => fmt(d?.today?.salesAmount),
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    shadow: 'rgba(102,126,234,0.4)',
    iconBg: 'rgba(255,255,255,0.2)',
  },
  {
    key: 'profit',
    title: 'Month Profit',
    sub: (d: any) => `${d?.month?.profitMargin?.toFixed(1) || 0}% margin`,
    value: (d: any, fmt: any) => fmt(d?.month?.profitAmount),
    icon: TrendingDown,
    gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    shadow: 'rgba(17,153,142,0.4)',
    iconBg: 'rgba(255,255,255,0.2)',
  },
  {
    key: 'messages',
    title: 'Unread Messages',
    sub: () => 'WhatsApp + Gmail',
    value: (d: any) => String(d?.today?.newMessages || 0),
    icon: MessageSquare,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    shadow: 'rgba(240,147,251,0.4)',
    iconBg: 'rgba(255,255,255,0.2)',
  },
  {
    key: 'leads',
    title: 'New Leads Today',
    sub: () => 'From all channels',
    value: (d: any) => String(d?.today?.newLeads || 0),
    icon: Users,
    gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    shadow: 'rgba(247,151,30,0.4)',
    iconBg: 'rgba(255,255,255,0.2)',
  },
];

const S = {
  page: {
    padding: '32px',
    maxWidth: '1100px',
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,
  header: {
    marginBottom: '28px',
  } as React.CSSProperties,
  h1: {
    fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2,
  } as React.CSSProperties,
  sub: {
    fontSize: '13px', color: '#64748b', marginTop: '4px',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
    marginBottom: '28px',
  } as React.CSSProperties,
  card: (gradient: string, shadow: string): React.CSSProperties => ({
    background: gradient,
    borderRadius: '16px',
    padding: '22px',
    boxShadow: `0 8px 32px ${shadow}`,
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'default',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  }),
  cardTitle: {
    fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em',
    textTransform: 'uppercase' as const, opacity: 0.85, marginBottom: '8px',
  },
  cardValue: {
    fontSize: '26px', fontWeight: 800, lineHeight: 1, marginBottom: '6px',
  },
  cardSub: {
    fontSize: '12px', opacity: 0.75,
  },
  iconBox: (bg: string): React.CSSProperties => ({
    position: 'absolute', top: '18px', right: '18px',
    width: '40px', height: '40px', borderRadius: '10px',
    background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  }),
  arrowBox: {
    position: 'absolute' as const, bottom: '14px', right: '18px',
    opacity: 0.5,
  },
  section: {
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
    overflow: 'hidden',
    marginBottom: '20px',
    border: '1px solid rgba(226,232,240,0.8)',
  } as React.CSSProperties,
  sectionHead: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
    background: '#fafbff',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '13px', fontWeight: 700, color: '#1e293b', flex: 1,
  } as React.CSSProperties,
  badge: (color: string, bg: string): React.CSSProperties => ({
    fontSize: '11px', fontWeight: 700,
    padding: '2px 10px', borderRadius: '20px',
    color, background: bg,
  }),
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid #f8fafc',
    transition: 'background 0.12s',
  } as React.CSSProperties,
  rowLabel: {
    fontSize: '13.5px', fontWeight: 600, color: '#1e293b',
  } as React.CSSProperties,
  rowSub: {
    fontSize: '11.5px', color: '#94a3b8', marginTop: '2px',
  } as React.CSSProperties,
};

const SkeletonCard = () => (
  <div style={{ background: '#e2e8f0', borderRadius: '16px', height: '110px', animation: 'pulse 1.5s ease-in-out infinite' }} />
);

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/api/v1/dashboard/summary').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const { today, month, alerts } = data || {};

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.h1}>Dashboard</h1>
        <p style={S.sub}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={S.grid}>
        {isLoading
          ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          : kpiConfig.map(({ key, title, sub, value, icon: Icon, gradient, shadow, iconBg }) => (
            <div
              key={key}
              style={S.card(gradient, shadow)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 40px ${shadow}`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${shadow}`;
              }}
            >
              <div style={S.cardTitle}>{title}</div>
              <div style={S.cardValue}>{value(data, fmt)}</div>
              <div style={S.cardSub}>{sub(data)}</div>
              <div style={S.iconBox(iconBg)}>
                <Icon size={18} color="#fff" />
              </div>
              <div style={S.arrowBox}>
                <ArrowUpRight size={16} color="#fff" />
              </div>
            </div>
          ))
        }
      </div>

      {/* Overdue Payments */}
      {alerts?.overdueTransactions?.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionHead}>
            <AlertCircle size={15} color="#ef4444" />
            <span style={S.sectionTitle}>Overdue Payments</span>
            <span style={S.badge('#ef4444', '#fef2f2')}>{alerts.overdueTransactions.length}</span>
          </div>
          {alerts.overdueTransactions.map((t: any, i: number) => (
            <div
              key={t.id}
              style={{ ...S.row, borderBottom: i === alerts.overdueTransactions.length - 1 ? 'none' : '1px solid #f8fafc' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#fef9f9'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
            >
              <div>
                <div style={S.rowLabel}>{t.party}</div>
                <div style={S.rowSub}>{t.daysPastDue} days overdue</div>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>{fmt(t.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Low Stock */}
      {alerts?.lowStockProducts?.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionHead}>
            <Package size={15} color="#f97316" />
            <span style={S.sectionTitle}>Low Stock Alert</span>
            <span style={S.badge('#f97316', '#fff7ed')}>{alerts.lowStockProducts.length}</span>
          </div>
          {alerts.lowStockProducts.map((p: any, i: number) => (
            <div
              key={p.id}
              style={{ ...S.row, borderBottom: i === alerts.lowStockProducts.length - 1 ? 'none' : '1px solid #f8fafc' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#fffbf5'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
            >
              <div style={S.rowLabel}>{p.name}</div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f97316' }}>
                {p.currentStock} {p.unit} left
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
