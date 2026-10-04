import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Receipt, MessageSquare,
  Users, FileBarChart, Bot, Settings, TrendingUp, LogOut,
  ShieldCheck, Zap, Mail, Menu, X, HelpCircle, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

// ── Doc content for each page ────────────────────────────────────────────────
const PAGE_DOCS: Record<string, { emoji: string; title: string; summary: string; bullets: string[]; tip?: string }> = {
  Dashboard: {
    emoji: '📊',
    title: 'Dashboard',
    summary: 'Your live business overview — sales, stock, payments and AI-detected messages, all in one place.',
    bullets: [
      'Top cards show today\'s revenue, pending payments, low-stock alerts and new leads',
      'Sales chart plots the last 30 days of daily revenue',
      'Recent transactions list the latest invoices with status badges',
      'AI inbox preview shows the latest WhatsApp & Gmail messages with intent tags',
    ],
    tip: 'Data refreshes automatically every 30 seconds. Click any card to jump to that module.',
  },
  Inventory: {
    emoji: '📦',
    title: 'Inventory',
    summary: 'Manage all your fabric stock — products, godowns, movements, transfers and bulk imports.',
    bullets: [
      'Products tab: add/edit fabrics with HSN code, GST rate, purchase & sale rates',
      'Stock tab: record inward (purchase), adjustments, damages and returns',
      'Godowns tab: manage warehouse locations and transfer stock between them',
      'Bulk Import tab: upload a CSV to create many products at once',
      'Aging Report: see which stock has been sitting too long',
    ],
    tip: 'MANAGER+ can add/edit products. STAFF can record stock movements.',
  },
  Sales: {
    emoji: '🧾',
    title: 'Sales',
    summary: 'Create invoices, track payments and manage your full order pipeline.',
    bullets: [
      'New Invoice: pick a party, add line items with auto GST calculation',
      'Invoice list shows status — Pending, Partial, Paid, Cancelled',
      'Record Payment marks invoices as partially or fully paid',
      'Delete is restricted to MANAGER+ only',
      'Export to PDF coming soon',
    ],
    tip: 'STAFF can create invoices. Only ACCOUNTANT+ can record payments.',
  },
  WhatsApp: {
    emoji: '💬',
    title: 'WhatsApp',
    summary: 'Unified WhatsApp Business inbox — read, reply and let AI handle intent detection.',
    bullets: [
      'All inbound WhatsApp messages appear here in real time via webhook',
      'AI automatically tags each message: quote_request, payment_info, complaint, etc.',
      'Click a conversation to reply directly from the app',
      'Conversations are linked to Parties automatically by phone number',
      'Connect your WhatsApp Business number in Settings → Integrations',
    ],
    tip: 'WhatsApp requires a Meta Business API account. Configure in Settings.',
  },
  Gmail: {
    emoji: '📧',
    title: 'Gmail',
    summary: 'Your group\'s Gmail inbox — read, compose, reply and sync emails from customers.',
    bullets: [
      'Each group has its own Gmail account — members of other groups cannot see your emails',
      'MANAGER+ can connect, disconnect and sync Gmail via Settings or the Connect button',
      'All roles can read, compose and reply to emails once Gmail is connected',
      'Unread filter quickly shows only unseen messages',
      'Emails are linked to Parties by sender address automatically',
    ],
    tip: 'Click "Sync" to pull the latest 200 emails from Gmail into the inbox.',
  },
  Leads: {
    emoji: '🎯',
    title: 'Leads / CRM',
    summary: 'Track potential orders from inquiry to win — your sales pipeline.',
    bullets: [
      'Lead statuses: New → Contacted → Quoted → Negotiating → Won / Lost',
      'Each lead tracks product interest, estimated quantity and value',
      'Assign leads to team members and set follow-up dates',
      'Won leads can be linked to an invoice',
      'Source tags: WhatsApp, Gmail, Referral, Walk-in, Cold Call, Exhibition',
    ],
    tip: 'Use the follow-up date to get a reminder on the Dashboard.',
  },
  Parties: {
    emoji: '🤝',
    title: 'Parties',
    summary: 'Your customers and suppliers — contacts, balances and transaction history.',
    bullets: [
      'Party types: Customer, Supplier, or Both',
      'Each party has a credit limit and running balance',
      'View full transaction history per party',
      'Phone / WhatsApp number links directly to WhatsApp chat',
      'GSTIN stored for GST invoice generation',
    ],
    tip: 'STAFF can add/edit parties. Only MANAGER+ can delete.',
  },
  Reports: {
    emoji: '📈',
    title: 'Reports',
    summary: 'Financial and inventory reports — profit & loss, outstanding, stock valuation.',
    bullets: [
      'Sales report: date-range filter, party-wise and product-wise breakdown',
      'Outstanding report: all pending and partial invoices with aging',
      'Stock valuation: current inventory value at purchase rate',
      'Cash flow: daily opening, cash-in, cash-out and closing balance',
    ],
    tip: 'ACCOUNTANT+ can view reports. Export to CSV available on most reports.',
  },
  'AI Chatbot': {
    emoji: '🤖',
    title: 'AI Chatbot',
    summary: 'Ask questions about your business in plain English or Hindi — powered by OpenRouter.',
    bullets: [
      'Ask things like "Aaj ki total sale kitni hai?" or "Which customers have overdue payments?"',
      'The AI queries your live database to give accurate, real-time answers',
      'Understands both English and Hindi (Hinglish)',
      'Conversation history is saved per session',
      'Uses a chain of free AI models as fallback for reliability',
    ],
    tip: 'Try: "Top 5 selling products this month" or "Show pending invoices above ₹50,000".',
  },
  Settings: {
    emoji: '⚙️',
    title: 'Settings',
    summary: 'Configure integrations, manage your team and update your profile.',
    bullets: [
      'Integrations tab (MANAGER+): connect Gmail and WhatsApp Business',
      'Team tab (MANAGER+): add team members, assign roles and groups',
      'Profile tab: update your name, email and password',
      'Roles available: Owner, Manager, Accountant, Staff, Read-only',
    ],
    tip: 'Login format for new members: groupname/username  e.g. textileiq/sri',
  },
  Admin: {
    emoji: '🛡️',
    title: 'Admin Panel',
    summary: 'Platform-level controls — visible only to OWNER and SUPER_ADMIN.',
    bullets: [
      'Clients tab: create new client tenants with their own group and owner login',
      'Users tab: see all users across the platform',
      'Groups tab: manage groups within the current tenant',
      'Suspend or reactivate any client tenant',
      'Each new client gets an isolated workspace — data never crosses tenants',
    ],
    tip: 'New client login will be: groupname/username as defined during creation.',
  },
};

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory',  icon: Package,         label: 'Inventory' },
  { to: '/sales',      icon: Receipt,         label: 'Sales' },
  { to: '/whatsapp',   icon: MessageSquare,   label: 'WhatsApp' },
  { to: '/gmail',      icon: Mail,            label: 'Gmail' },
  { to: '/leads',      icon: TrendingUp,      label: 'Leads' },
  { to: '/parties',    icon: Users,           label: 'Parties' },
  { to: '/reports',    icon: FileBarChart,    label: 'Reports' },
  { to: '/chatbot',    icon: Bot,             label: 'AI Chatbot' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
];

const adminNav = [
  { to: '/admin', icon: ShieldCheck, label: 'Admin' },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// ── Doc panel ────────────────────────────────────────────────────────────────
function DocPanel({ label, onClose }: { label: string; onClose: () => void }) {
  const doc = PAGE_DOCS[label];
  if (!doc) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: '340px', zIndex: 60,
      background: '#fff',
      borderLeft: '1px solid #e4e7ef',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.10)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 20px 16px',
        borderBottom: '1px solid #f0f1f5',
        background: 'linear-gradient(135deg, #f8f7ff 0%, #f0f4ff 100%)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px', lineHeight: 1 }}>{doc.emoji}</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
                {doc.title}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Help & Guide
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', padding: '4px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', flexShrink: 0,
              transition: 'all 0.13s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af'; }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Summary */}
        <p style={{
          fontSize: '13.5px', color: '#374151', lineHeight: 1.7,
          margin: '0 0 20px', padding: '14px 16px',
          background: '#f8f9fc', borderRadius: '10px',
          border: '1px solid #e9eaf2',
        }}>
          {doc.summary}
        </p>

        {/* Features */}
        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
          Features
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {doc.bullets.map((b, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '10px 12px', borderRadius: '9px',
              background: '#fafbff', border: '1px solid #eef0f8',
            }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                background: 'linear-gradient(135deg, #5b5bd6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: '1px',
              }}>
                <ChevronRight size={11} color="#fff" />
              </div>
              <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.55 }}>{b}</span>
            </div>
          ))}
        </div>

        {/* Tip */}
        {doc.tip && (
          <div style={{
            padding: '12px 14px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
            border: '1px solid #fde68a',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0, lineHeight: 1.2 }}>💡</span>
            <span style={{ fontSize: '12.5px', color: '#92400e', lineHeight: 1.6 }}>{doc.tip}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid #f0f1f5',
        background: '#fafbff',
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '9px', borderRadius: '9px',
            border: '1.5px solid #e4e7ef', background: '#fff',
            fontSize: '13px', fontWeight: 600, color: '#374151',
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.13s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#c4b5fd'; (e.currentTarget as HTMLButtonElement).style.color = '#5b5bd6'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e4e7ef'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; }}
        >
          Close Guide
        </button>
      </div>
    </div>
  );
}

// ── Main Layout ──────────────────────────────────────────────────────────────
export default function Layout() {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [docLabel, setDocLabel] = useState<string | null>(null);  // which doc panel is open

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Escape closes both drawer and doc panel
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawerOpen(false); setDocLabel(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const toggleDoc = (label: string) => setDocLabel(prev => prev === label ? null : label);

  const currentPage = [...nav, ...adminNav].find(n => location.pathname.startsWith(n.to))?.label ?? '';

  /* ── Nav items renderer ──────────────────────────────────────── */
  const renderNavItems = () => (
    <>
      <div style={{
        fontSize: '9.5px', fontWeight: 700, color: 'rgba(148,163,184,0.45)',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        padding: '0 10px', marginBottom: '6px',
      }}>Menu</div>

      {nav.map(({ to, icon: Icon, label }) => (
        <div key={to} style={{ display: 'flex', alignItems: 'center', marginBottom: '1px', gap: '2px' }}>
          {/* Nav link — takes up all remaining width */}
          <NavLink to={to} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '9px 10px', borderRadius: '9px', cursor: 'pointer',
                background: isActive ? 'rgba(255,255,255,0.09)' : 'transparent',
                border: isActive ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
                color: isActive ? '#fff' : 'rgba(148,163,184,0.75)',
                fontWeight: isActive ? 600 : 400,
                fontSize: isMobile ? '15px' : '13.5px',
                letterSpacing: '-0.01em',
                transition: 'all 0.14s ease',
                position: 'relative',
              }}>
                {isActive && <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '18px', borderRadius: '0 3px 3px 0',
                  background: 'linear-gradient(180deg, #5b5bd6, #8b5cf6)',
                }} />}
                <Icon size={isMobile ? 17 : 15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.55 }} />
                <span style={{ flex: 1 }}>{label}</span>
              </div>
            )}
          </NavLink>

          {/* ? doc button */}
          <button
            onClick={() => toggleDoc(label)}
            title={`${label} guide`}
            style={{
              flexShrink: 0,
              width: '26px', height: '26px', borderRadius: '7px',
              border: docLabel === label ? '1px solid rgba(165,180,252,0.5)' : '1px solid transparent',
              background: docLabel === label ? 'rgba(91,91,214,0.25)' : 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: docLabel === label ? '#a5b4fc' : 'rgba(148,163,184,0.35)',
              transition: 'all 0.14s ease',
              padding: 0,
            }}
            onMouseEnter={e => {
              if (docLabel !== label) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(91,91,214,0.15)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(165,180,252,0.8)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(165,180,252,0.3)';
              }
            }}
            onMouseLeave={e => {
              if (docLabel !== label) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.35)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
              }
            }}
          >
            <HelpCircle size={13} />
          </button>
        </div>
      ))}

      {isAdmin && (
        <>
          <div style={{
            fontSize: '9.5px', fontWeight: 700, color: 'rgba(148,163,184,0.45)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '0 10px', margin: '14px 0 6px',
          }}>Admin</div>
          {adminNav.map(({ to, icon: Icon, label }) => (
            <div key={to} style={{ display: 'flex', alignItems: 'center', marginBottom: '1px', gap: '2px' }}>
              <NavLink to={to} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
                {({ isActive }) => (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '9px 10px', borderRadius: '9px', cursor: 'pointer',
                    background: isActive ? 'rgba(255,255,255,0.09)' : 'transparent',
                    border: isActive ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
                    color: isActive ? '#fff' : 'rgba(148,163,184,0.75)',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: isMobile ? '15px' : '13.5px',
                    letterSpacing: '-0.01em',
                    transition: 'all 0.14s ease',
                    position: 'relative',
                  }}>
                    {isActive && <div style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: '3px', height: '18px', borderRadius: '0 3px 3px 0',
                      background: 'linear-gradient(180deg, #5b5bd6, #8b5cf6)',
                    }} />}
                    <Icon size={isMobile ? 17 : 15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.55 }} />
                    <span style={{ flex: 1 }}>{label}</span>
                  </div>
                )}
              </NavLink>
              <button
                onClick={() => toggleDoc(label)}
                title={`${label} guide`}
                style={{
                  flexShrink: 0,
                  width: '26px', height: '26px', borderRadius: '7px',
                  border: docLabel === label ? '1px solid rgba(165,180,252,0.5)' : '1px solid transparent',
                  background: docLabel === label ? 'rgba(91,91,214,0.25)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: docLabel === label ? '#a5b4fc' : 'rgba(148,163,184,0.35)',
                  transition: 'all 0.14s ease',
                  padding: 0,
                }}
                onMouseEnter={e => {
                  if (docLabel !== label) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(91,91,214,0.15)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(165,180,252,0.8)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(165,180,252,0.3)';
                  }
                }}
                onMouseLeave={e => {
                  if (docLabel !== label) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.35)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                  }
                }}
              >
                <HelpCircle size={13} />
              </button>
            </div>
          ))}
        </>
      )}
    </>
  );

  /* ── Sidebar inner content ───────────────────────────────────── */
  const sidebarInner = (onClose?: () => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Top gradient accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: 'linear-gradient(90deg, #5b5bd6, #8b5cf6, #06b6d4)', opacity: 0.9,
      }} />

      {/* Brand header */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, #5b5bd6 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', boxShadow: '0 4px 14px rgba(91,91,214,0.45)',
          }}>🧵</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: '13.5px', fontWeight: 700, color: '#f1f5f9',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              letterSpacing: '-0.01em',
            }}>
              {user?.tenant?.name || 'TextileIQ'}
            </div>
            {user?.tenant?.plan && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '3px',
                fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em',
                padding: '2px 8px', borderRadius: '20px',
                background: 'rgba(91,91,214,0.25)', color: '#a5b4fc', textTransform: 'uppercase',
                border: '1px solid rgba(91,91,214,0.3)',
              }}>
                <Zap size={9} />{user.tenant.plan}
              </div>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(148,163,184,0.7)', padding: '6px', flexShrink: 0,
              display: 'flex', alignItems: 'center', borderRadius: '6px',
            }}>
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }} className="scrollbar-hide">
        {renderNavItems()}
      </nav>

      {/* User footer */}
      <div style={{ padding: '10px 10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '9px 10px', borderRadius: '9px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.06)',
          marginBottom: '6px',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #5b5bd6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: '#fff',
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: '12.5px', fontWeight: 600, color: '#e2e8f0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            }}>{user?.name}</div>
            <div style={{ fontSize: '10.5px', color: 'rgba(148,163,184,0.6)', textTransform: 'capitalize' }}>
              {user?.role?.toLowerCase()}{user?.group ? ` · ${user.group.name}` : ''}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            width: '100%', padding: '7px 10px', borderRadius: '8px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '12.5px', color: 'rgba(148,163,184,0.55)',
            transition: 'all 0.15s ease', fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)';
            (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.55)';
          }}
        >
          <LogOut size={13} />Sign out
        </button>
      </div>
    </div>
  );

  /* ── Mobile layout ───────────────────────────────────────────── */
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif" }}>

        {/* Mobile top bar */}
        <header style={{
          height: '56px', flexShrink: 0,
          background: '#0d1117',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: '12px',
        }}>
          <button
            onClick={() => setDrawerOpen(o => !o)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(148,163,184,0.85)', padding: '6px',
              display: 'flex', alignItems: 'center', borderRadius: '8px', flexShrink: 0,
            }}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
              background: 'linear-gradient(135deg, #5b5bd6 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
            }}>🧵</div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentPage || user?.tenant?.name || 'TextileIQ'}
            </span>
          </div>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #5b5bd6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: '#fff',
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          <Outlet />
        </main>

        {/* Drawer overlay */}
        {drawerOpen && (
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.6)' }} />
        )}

        {/* Slide-in nav drawer */}
        <div style={{
          position: 'fixed', top: 0, left: 0, height: '100vh',
          width: '280px', zIndex: 50,
          background: '#0d1117',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.26s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: drawerOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
        }}>
          {sidebarInner(() => setDrawerOpen(false))}
        </div>

        {/* Doc panel overlay on mobile */}
        {docLabel && (
          <div onClick={() => setDocLabel(null)} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.4)' }} />
        )}
        {/* Doc panel — full width on mobile */}
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 60,
          width: docLabel ? '100vw' : '0',
          maxWidth: '360px',
          overflow: 'hidden',
          transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {docLabel && <DocPanel label={docLabel} onClose={() => setDocLabel(null)} />}
        </div>
      </div>
    );
  }

  /* ── Desktop layout ──────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* Desktop sidebar */}
      <aside style={{
        width: '232px', flexShrink: 0,
        background: '#0d1117',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        zIndex: 20,
      }}>
        {sidebarInner()}
      </aside>

      {/* Desktop main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <header style={{
          height: '52px', flexShrink: 0,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 28px', gap: '12px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {currentPage}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            fontSize: '11.5px', color: 'var(--text-muted)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            padding: '4px 12px', borderRadius: '20px', fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #5b5bd6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: '#fff',
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>

      {/* Doc panel — slides in from the right, overlays the main content */}
      {docLabel && (
        <div
          onClick={() => setDocLabel(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.15)' }}
        />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 60,
        width: '340px',
        transform: docLabel ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: docLabel ? 'all' : 'none',
      }}>
        {docLabel && <DocPanel label={docLabel} onClose={() => setDocLabel(null)} />}
      </div>
    </div>
  );
}
