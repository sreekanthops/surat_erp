import { Routes, Route, Navigate } from 'react-router-dom';
import { Component, ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import InventoryPage from '@/pages/InventoryPage';
import SalesPage from '@/pages/SalesPage';
import WhatsAppPage from '@/pages/WhatsAppPage';
import GmailPage from '@/pages/GmailPage';
import LeadsPage from '@/pages/LeadsPage';
import PartiesPage from '@/pages/PartiesPage';
import ReportsPage from '@/pages/ReportsPage';
import ChatbotPage from '@/pages/ChatbotPage';
import SettingsPage from '@/pages/SettingsPage';
import AdminPage from '@/pages/AdminPage';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#ef4444' }}>Something went wrong</h2>
        <pre style={{ color: '#6b7280', fontSize: '13px', marginTop: '12px' }}>{this.state.error}</pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '8px 20px', cursor: 'pointer' }}>Reload</button>
      </div>
    );
    return this.props.children;
  }
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  return isAdmin ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
        <Route path="inbox" element={<WhatsAppPage />} />
        <Route path="gmail" element={<GmailPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="parties" element={<PartiesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="chatbot" element={<ChatbotPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Route>
    </Routes>
    </ErrorBoundary>
  );
}
