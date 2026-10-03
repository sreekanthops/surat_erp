import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Receipt, MessageSquare,
  Users, FileBarChart, Bot, Settings, TrendingUp, LogOut,
  ShieldCheck, Zap, Mail, Menu, X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

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

export default function Layout() {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Escape closes drawer
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const currentPage = [...nav, ...adminNav].find(n => location.pathname.startsWith(n.to))?.label ?? '';

  /* ── Shared nav items renderer ───────────────────────────────── */
  const renderNavItems = () => (
    <>
      <div style={{
        fontSize: '9.5px', fontWeight: 700, color: 'rgba(148,163,184,0.45)',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        padding: '0 10px', marginBottom: '6px',
      }}>Menu</div>

      {nav.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} style={{ textDecoration: 'none', display: 'block', marginBottom: '1px' }}>
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
      ))}

      {isAdmin && (
        <>
          <div style={{
            fontSize: '9.5px', fontWeight: 700, color: 'rgba(148,163,184,0.45)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '0 10px', margin: '14px 0 6px',
          }}>Admin</div>
          {adminNav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={{ textDecoration: 'none', display: 'block', marginBottom: '1px' }}>
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
          {/* Close button — mobile drawer only */}
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
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(o => !o)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(148,163,184,0.85)', padding: '6px',
              display: 'flex', alignItems: 'center', borderRadius: '8px',
              flexShrink: 0,
            }}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* Logo + tenant name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
              background: 'linear-gradient(135deg, #5b5bd6 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px',
            }}>🧵</div>
            <span style={{
              fontSize: '14px', fontWeight: 700, color: '#f1f5f9',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentPage || user?.tenant?.name || 'TextileIQ'}
            </span>
          </div>

          {/* Avatar */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #5b5bd6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: '#fff',
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        </header>

        {/* Page content — full width */}
        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          <Outlet />
        </main>

        {/* Drawer overlay */}
        {drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.6)',
            }}
          />
        )}

        {/* Slide-in drawer */}
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
    </div>
  );
}
