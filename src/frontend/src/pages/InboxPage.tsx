import { useQuery } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import { MessageSquare, Mail } from 'lucide-react';

const intentColors: Record<string, string> = {
  quote_request: 'bg-blue-100 text-blue-700',
  order_confirm: 'bg-green-100 text-green-700',
  payment_info: 'bg-yellow-100 text-yellow-700',
  complaint: 'bg-red-100 text-red-700',
  delivery_query: 'bg-purple-100 text-purple-700',
  general: 'bg-gray-100 text-gray-600',
};

export default function InboxPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => api.get('/api/v1/messages/inbox?limit=50').then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
        <span className="text-sm text-gray-500">
          {data?.data?.filter((m: any) => !m.isRead).length || 0} unread
        </span>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 h-20 animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {data?.data?.map((msg: any) => (
          <div
            key={msg.id}
            className={`bg-white rounded-lg border p-4 flex gap-3 cursor-pointer hover:border-blue-300 transition-colors ${
              !msg.isRead ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.channel === 'WHATSAPP' ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {msg.channel === 'WHATSAPP'
                ? <MessageSquare size={14} className="text-green-600" />
                : <Mail size={14} className="text-blue-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900">
                  {msg.party?.name || msg.fromAddress}
                </span>
                {msg.aiIntent && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${intentColors[msg.aiIntent] || intentColors.general}`}>
                    {msg.aiIntent.replace('_', ' ')}
                  </span>
                )}
                {!msg.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full ml-auto" />}
              </div>
              <p className="text-sm text-gray-600 truncate">{msg.content}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(msg.createdAt).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
