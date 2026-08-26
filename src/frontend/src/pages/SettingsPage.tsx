import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 leading-tight">Settings</h1>
      <p className="text-sm text-gray-400 mt-0.5">Integrations, users and billing</p>
      <div className="mt-10 flex flex-col items-center text-center bg-white rounded-2xl border border-gray-100 p-12">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Settings size={22} className="text-gray-500" />
        </div>
        <h2 className="text-base font-semibold text-gray-800">Settings coming soon</h2>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">Connect WhatsApp, Gmail, Razorpay, manage users and billing — available in Phase 4 build.</p>
      </div>
    </div>
  );
}
