import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/api/v1/ai/chat', {
        message,
        sessionId,
        history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      }).then((r) => r.data),
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error || err?.response?.data?.detail || err?.message;
      const msg = status === 401
        ? 'Session expire ho gayi. Please refresh karein aur dobara login karein.'
        : status === 503 || !status
        ? 'AI service abhi available nahi hai. Backend check karein.'
        : `Error: ${detail || 'Kuch gadbad ho gayi, dobara try karein.'}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    },
  });

  const send = (text?: string) => {
    const msg = text || input.trim();
    if (!msg || mutation.isPending) return;
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    mutation.mutate(msg);
    inputRef.current?.focus();
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">AI Business Assistant</h1>
            <p className="text-xs text-gray-400 leading-tight">Hindi / English mein poochein</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <span className="text-xs text-gray-400">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-gray-50/60">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-blue-600' : 'bg-white border border-gray-200 shadow-sm'
            }`}>
              {msg.role === 'user'
                ? <User size={13} className="text-white" />
                : <Bot size={13} className="text-blue-600" />
              }
            </div>
            <div className={`max-w-[76%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm shadow-sm'
                : 'bg-white border border-gray-100 text-gray-900 rounded-tl-sm shadow-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {mutation.isPending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0">
              <Bot size={13} className="text-blue-600" />
            </div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div className="px-4 py-2.5 bg-white border-t border-gray-100 flex-shrink-0">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={mutation.isPending}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors duration-150 whitespace-nowrap disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-3.5 bg-white border-t border-gray-100 flex-shrink-0">
        <div className="flex gap-2.5 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Kuch bhi poochein apne business ke baare mein..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150 bg-gray-50 hover:bg-white"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || mutation.isPending}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors duration-150 flex-shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
