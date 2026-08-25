import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import InventoryPage from '@/pages/InventoryPage';
import SalesPage from '@/pages/SalesPage';
import InboxPage from '@/pages/InboxPage';
import LeadsPage from '@/pages/LeadsPage';
import PartiesPage from '@/pages/PartiesPage';
import ReportsPage from '@/pages/ReportsPage';
import ChatbotPage from '@/pages/ChatbotPage';
import SettingsPage from '@/pages/SettingsPage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

export default function App() {
  return (
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
        <Route path="inbox" element={<InboxPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="parties" element={<PartiesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="chatbot" element={<ChatbotPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
