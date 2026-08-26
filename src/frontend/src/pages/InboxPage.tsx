import { useQuery } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import { MessageSquare, Mail } from 'lucide-react';

const intentColors: Record<string, string> = {
  quote_request:  'bg-blue-50 text-blue-600 border border-blue-100',
  order_confirm:  'bg-green-50 text-green-600 border border-green-100',
  payment_info:   'bg-yellow-50 text-yellow-600 border border-yellow-100',
  complaint:      'bg-red-50 text-red-600 border border-red-100',
  delivery_query: 'bg-violet-50 text-violet-600 border border-violet-100',
  general:        'bg-gray-50 text-gray-500 border border-gray-100',
};

export default function InboxPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => api.get('/api/v1/messages/inbox?limit=50').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const unreadCount = data?.data?.filter((m: any) => !m.isRead).length || 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Inbox</h1>
          {!isLoading && (
            <p className="text-sm text-gray-400 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread messages` : 'All caught up'}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
            {unreadCount} new
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-1.5">
          {data?.data?.map((msg: any) => (
            <div
              key={msg.id}
              className={`bg-white rounded-xl border p-4 flex gap-3 cursor-pointer hover:shadow-sm transition-all duration-150 ${
                !msg.isRead ? 'border-blue-200 bg-blue-50/20' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              {/* Channel icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                msg.channel === 'WHATSAPP' ? 'bg-green-50' : 'bg-blue-50'
              }`}>
                {msg.channel === 'WHATSAPP'
                  ? <MessageSquare size={14} className="text-green-600" />
                  : <Mail size={14} className="text-blue-600" />
                }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {msg.party?.name || msg.fromAddress}
                  </span>
                  {!msg.isRead && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-auto" />
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate leading-snug">{msg.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-gray-400">
                    {new Date(msg.createdAt).toLocaleString('en-IN')}
                  </p>
                  {msg.aiIntent && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${intentColors[msg.aiIntent] || intentColors.general}`}>
                      {msg.aiIntent.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
