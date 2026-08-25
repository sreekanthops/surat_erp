import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, Receipt, MessageSquare,
  Users, FileBarChart, Bot, Settings, TrendingUp, LogOut
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">🧵 Textile ERP</p>
          <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{user?.tenant?.name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 uppercase">
            {user?.tenant?.plan}
          </span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-4 border-t border-gray-200">
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
