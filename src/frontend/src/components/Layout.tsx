import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Receipt, MessageSquare,
  Users, FileBarChart, Bot, Settings, TrendingUp, LogOut,
  ShieldCheck, Zap, Mail,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory',  icon: Package,         label: 'Inventory' },
  { to: '/sales',      icon: Receipt,         label: 'Sales' },
  { to: '/inbox',      icon: MessageSquare,   label: 'Inbox' },
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

const SIDEBAR_W = 232;

export default function Layout() {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const location = useLocation();

  // Page title from current route
  const currentPage = [...nav, ...adminNav].find(n => location.pathname.startsWith(n.to))?.label ?? '';

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ══ Sidebar ══ */}
      <aside style={{
        width: `${SIDEBAR_W}px`,
        flexShrink: 0,
        background: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        zIndex: 20,
        position: 'relative',
      }}>

        {/* Subtle top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, #5b5bd6, #8b5cf6, #06b6d4)',
          opacity: 0.9,
        }} />

        {/* ── Brand ── */}
        <div style={{
          padding: '22px 16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #5b5bd6 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', flexShrink: 0,
              boxShadow: '0 4px 14px rgba(91,91,214,0.45)',
            }}>🧵</div>
            <div style={{ minWidth: 0 }}>
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
                  background: 'rgba(91,91,214,0.25)',
                  color: '#a5b4fc', textTransform: 'uppercase',
                  border: '1px solid rgba(91,91,214,0.3)',
                }}>
                  <Zap size={9} />
                  {user.tenant.plan}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }} className="scrollbar-hide">
          <div style={{
            fontSize: '9.5px', fontWeight: 700, color: 'rgba(148,163,184,0.45)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '0 10px', marginBottom: '6px',
          }}>Menu</div>

          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={{ textDecoration: 'none', display: 'block', marginBottom: '1px' }}
            >
              {({ isActive }) => (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '9px',
                  padding: '8.5px 10px', borderRadius: '9px',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(255,255,255,0.09)' : 'transparent',
                  border: isActive ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
                  color: isActive ? '#fff' : 'rgba(148,163,184,0.75)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '13.5px',
                  letterSpacing: '-0.01em',
                  transition: 'all 0.14s ease',
                  position: 'relative',
                }}>
                  {isActive && (
                    <div style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: '3px', height: '18px', borderRadius: '0 3px 3px 0',
                      background: 'linear-gradient(180deg, #5b5bd6, #8b5cf6)',
                    }} />
                  )}
                  <Icon size={15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.55 }} />
                  <span style={{ flex: 1 }}>{label}</span>
                </div>
              )}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div style={{
                fontSize: '9.5px', fontWeight: 700, color: 'rgba(148,163,184,0.45)',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '0 10px', margin: '14px 0 6px',
              }}>Admin</div>
              {adminNav.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  style={{ textDecoration: 'none', display: 'block', marginBottom: '1px' }}
                >
                  {({ isActive }) => (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '8.5px 10px', borderRadius: '9px',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(255,255,255,0.09)' : 'transparent',
                      border: isActive ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
                      color: isActive ? '#fff' : 'rgba(148,163,184,0.75)',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: '13.5px',
                      letterSpacing: '-0.01em',
                      transition: 'all 0.14s ease',
                      position: 'relative',
                    }}>
                      {isActive && (
                        <div style={{
                          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                          width: '3px', height: '18px', borderRadius: '0 3px 3px 0',
                          background: 'linear-gradient(180deg, #5b5bd6, #8b5cf6)',
                        }} />
                      )}
                      <Icon size={15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.55 }} />
                      <span style={{ flex: 1 }}>{label}</span>
                    </div>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* ── User footer ── */}
        <div style={{
          padding: '10px 10px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
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
              }}>
                {user?.name}
              </div>
              <div style={{
                fontSize: '10.5px', color: 'rgba(148,163,184,0.6)', textTransform: 'capitalize',
              }}>
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
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ══ Main content ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* ── Top bar ── */}
        <header style={{
          height: '52px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
          flexShrink: 0,
          gap: '12px',
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            {currentPage}
          </div>
          <div style={{ flex: 1 }} />
          {/* Date pill */}
          <div style={{
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            padding: '4px 12px',
            borderRadius: '20px',
            fontWeight: 500,
          }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          {/* Avatar */}
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #5b5bd6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: '#fff', cursor: 'default',
            flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        </header>

        {/* ── Page content ── */}
        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
