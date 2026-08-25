import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import { Send, Bot, User } from 'lucide-react';

interface Message { role: 'user' | 'assistant'; content: string; }

const suggestions = [
  'Aaj ki sale kitni hai?',
  'Is mahine ka profit kya hai?',
  'Georgette ka stock kitna hai?',
  'Top 5 customers this month?',
  'Pending payments list karo',
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Namaste! Main aapka AI business assistant hoon. Aap mujhse apne business ke baare mein kuch bhi pooch sakte hain — Hindi ya English mein. 🙏' },
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/api/v1/ai/chat', { message, sessionId }).then((r) => r.data),
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, kuch error hua. Please dobara try karein.' }]);
    },
  });

  const send = (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    mutation.mutate(msg);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Bot size={16} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">AI Business Assistant</h1>
            <p className="text-xs text-gray-500">Hindi / English mein poochein</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-blue-600' : 'bg-white border border-gray-200'
            }`}>
              {msg.role === 'user'
                ? <User size={14} className="text-white" />
                : <Bot size={14} className="text-blue-600" />
              }
            </div>
            <div className={`max-w-[75%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center">
              <Bot size={14} className="text-blue-600" />
            </div>
            <div className="bg-white border border-gray-200 px-4 py-3 rounded-xl rounded-tl-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div className="px-4 py-2 bg-white border-t border-gray-100">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Kuch bhi poochein apne business ke baare mein..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
