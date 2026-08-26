import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, Receipt, MessageSquare,
  Users, FileBarChart, Bot, Settings, TrendingUp, LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/sales', icon: Receipt, label: 'Sales' },
  { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { to: '/leads', icon: TrendingUp, label: 'Leads' },
  { to: '/parties', icon: Users, label: 'Parties' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
  { to: '/chatbot', icon: Bot, label: 'AI Chatbot' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Dark Sidebar ── */}
      <aside style={{
        width: '240px',
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
        zIndex: 10,
      }}>

        {/* Brand */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}>🧵</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '13px', fontWeight: 700, color: '#f8fafc',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user?.tenant?.name || 'GSpaces AI CRM'}
              </div>
              {user?.tenant?.plan && (
                <div style={{
                  display: 'inline-block', marginTop: '4px',
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                  padding: '2px 8px', borderRadius: '20px',
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  color: '#fff', textTransform: 'uppercase',
                }}>
                  {user.tenant.plan}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 8px', marginBottom: '8px' }}>
            Main Menu
          </div>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={{ textDecoration: 'none', display: 'block', marginBottom: '2px' }}
            >
              {({ isActive }) => (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px',
                  cursor: 'pointer', transition: 'all 0.18s ease',
                  background: isActive
                    ? 'linear-gradient(90deg, rgba(99,102,241,0.9), rgba(139,92,246,0.8))'
                    : 'transparent',
                  boxShadow: isActive ? '0 2px 12px rgba(99,102,241,0.35)' : 'none',
                  color: isActive ? '#fff' : 'rgba(148,163,184,0.85)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '13.5px',
                }}>
                  <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {isActive && <ChevronRight size={14} style={{ opacity: 0.7 }} />}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)', marginBottom: '6px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: '#fff',
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(148,163,184,0.7)', textTransform: 'capitalize' }}>
                {user?.role?.toLowerCase()}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '8px 12px', borderRadius: '8px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: '13px', color: 'rgba(148,163,184,0.7)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)';
              (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.7)';
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
