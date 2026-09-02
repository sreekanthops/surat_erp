import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import { Send, Bot, User, Download, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'area' | 'donut' | 'horizontal_bar' | 'composed';
  title: string;
  data: any[];
  keys?: string[];   // for multi-key line/area/bar
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  leadCards?: LeadCard[] | null;
  chartData?: ChartData | null;
}

interface LeadCard {
  name: string;
  phone: string;
  intent: string;
  product?: string;
  score: number;
  signals: string[];
  recommendation: string;
}

const suggestions = [
  'Aaj ki sale kitni hai?',
  'Is mahine ka profit chart dikhao',
  'Top products ka bar chart dikhao',
  'Payment status pie chart dikhao',
  'WhatsApp pe kaun customer ban sakta hai?',
  'Stock distribution dikhao',
];

// ── Chart colours ────────────────────────────────────────────────────────────
const CHAT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
const fmtK = (n: number) =>
  n >= 1_00_00_000 ? `₹${(n/1_00_00_000).toFixed(1)}Cr`
  : n >= 1_00_000 ? `₹${(n/1_00_000).toFixed(1)}L`
  : n >= 1000 ? `₹${(n/1000).toFixed(0)}K` : `₹${n}`;

// ── Export chart data ────────────────────────────────────────────────────────
function exportChartCSV(chart: ChartData) {
  if (!chart.data.length) return;
  const headers = Object.keys(chart.data[0]);
  const rows = chart.data.map(r => headers.map(h => String(r[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  saveAs(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }), `${chart.title.replace(/\s+/g,'_')}.csv`);
}

function exportChartExcel(chart: ChartData) {
  if (!chart.data.length) return;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(chart.data);
  XLSX.utils.book_append_sheet(wb, ws, chart.title.slice(0, 31));
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${chart.title.replace(/\s+/g,'_')}.xlsx`);
}

// ── Inline Chart Block ────────────────────────────────────────────────────────
function ChatInlineChart({ chart }: { chart: ChartData }) {
  const [showExport, setShowExport] = useState(false);

  // Determine data keys (everything except 'name')
  const dataKeys = chart.keys || (chart.data[0] ? Object.keys(chart.data[0]).filter(k => k !== 'name') : ['value']);

  const renderChart = () => {
    if (chart.type === 'pie' || chart.type === 'donut') {
      const inner = chart.type === 'donut' ? 38 : 0;
      return (
        <PieChart>
          <Pie data={chart.data} cx="50%" cy="45%" innerRadius={inner} outerRadius={68} paddingAngle={3} dataKey="value" nameKey="name">
            {chart.data.map((_: any, i: number) => <Cell key={i} fill={CHAT_COLORS[i % CHAT_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => fmtK(Number(v))} />
          <Legend iconType="circle" iconSize={7} formatter={(v: string) => <span style={{ fontSize: 10, color: '#475569' }}>{v}</span>} />
        </PieChart>
      );
    }

    if (chart.type === 'horizontal_bar') {
      return (
        <BarChart data={chart.data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={90} />
          <Tooltip formatter={(v: any) => fmtK(Number(v))} />
          <Bar dataKey="value" radius={[0,4,4,0]}>
            {chart.data.map((_: any, i: number) => <Cell key={i} fill={CHAT_COLORS[i % CHAT_COLORS.length]} />)}
          </Bar>
        </BarChart>
      );
    }

    if (chart.type === 'area') {
      return (
        <AreaChart data={chart.data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {dataKeys.map((k, i) => (
              <linearGradient key={k} id={`areaGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHAT_COLORS[i]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHAT_COLORS[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44} />
          <Tooltip formatter={(v: any) => fmtK(Number(v))} />
          <Legend iconType="circle" iconSize={7} formatter={(v: string) => <span style={{ fontSize: 10, color: '#475569' }}>{v}</span>} />
          {dataKeys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k} name={k} stroke={CHAT_COLORS[i]} fill={`url(#areaGrad${i})`} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </AreaChart>
      );
    }

    if (chart.type === 'composed') {
      const [k1, k2, ...rest] = dataKeys;
      return (
        <ComposedChart data={chart.data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44} />
          <Tooltip formatter={(v: any) => fmtK(Number(v))} />
          <Legend iconType="circle" iconSize={7} formatter={(v: string) => <span style={{ fontSize: 10, color: '#475569' }}>{v}</span>} />
          {k1 && <Bar dataKey={k1} name={k1} fill={CHAT_COLORS[0]} radius={[4,4,0,0]} />}
          {k2 && <Line type="monotone" dataKey={k2} name={k2} stroke={CHAT_COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />}
          {rest.map((k, i) => <Line key={k} type="monotone" dataKey={k} name={k} stroke={CHAT_COLORS[i+2]} strokeWidth={2} dot={{ r: 3 }} />)}
        </ComposedChart>
      );
    }

    if (chart.type === 'line') {
      return (
        <LineChart data={chart.data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44} />
          <Tooltip formatter={(v: any) => fmtK(Number(v))} />
          <Legend iconType="circle" iconSize={7} formatter={(v: string) => <span style={{ fontSize: 10, color: '#475569' }}>{v}</span>} />
          {dataKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} name={k} stroke={CHAT_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      );
    }

    // Default: bar
    return (
      <BarChart data={chart.data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44} />
        <Tooltip formatter={(v: any) => fmtK(Number(v))} />
        {dataKeys.length > 1 ? (
          <>
            <Legend iconType="circle" iconSize={7} formatter={(v: string) => <span style={{ fontSize: 10, color: '#475569' }}>{v}</span>} />
            {dataKeys.map((k, i) => <Bar key={k} dataKey={k} name={k} fill={CHAT_COLORS[i]} radius={[4,4,0,0]} />)}
          </>
        ) : (
          <Bar dataKey={dataKeys[0] || 'value'} radius={[4,4,0,0]}>
            {chart.data.map((_: any, i: number) => <Cell key={i} fill={CHAT_COLORS[i % CHAT_COLORS.length]} />)}
          </Bar>
        )}
      </BarChart>
    );
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 16px', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart2 size={13} color="#6366f1" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{chart.title}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExport(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, color: '#64748b', cursor: 'pointer' }}
          >
            <Download size={11} /> Export
          </button>
          {showExport && (
            <div style={{ position: 'absolute', right: 0, top: 28, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100, padding: '4px 0', minWidth: 130 }}>
              {[
                { label: 'Excel (.xlsx)', fn: () => { exportChartExcel(chart); setShowExport(false); } },
                { label: 'CSV (.csv)',    fn: () => { exportChartCSV(chart);   setShowExport(false); } },
              ].map(opt => (
                <button key={opt.label} onClick={opt.fn} style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 12, color: '#1e293b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >{opt.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

// ── WhatsApp icon ─────────────────────────────────────────────────────────────
const WA_ICON = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

// ── Score colour helpers ───────────────────────────────────────────────────────
const scoreColor = (s: number) => s >= 70 ? '#16a34a' : s >= 50 ? '#f97316' : '#64748b';
const scoreBg    = (s: number) => s >= 70 ? '#f0fdf4' : s >= 50 ? '#fff7ed' : '#f8fafc';
const intentLabel: Record<string, string> = {
  quote_request: 'Quote Request', order_confirm: 'Order Confirm',
  bulk_inquiry: 'Bulk Inquiry', catalogue_request: 'Catalogue',
  new_customer_inquiry: 'New Inquiry', sample_request: 'Sample Req',
  general: 'General',
};

// ── WhatsApp Lead Card ────────────────────────────────────────────────────────
function LeadCardBlock({ card, onConvert }: { card: LeadCard; onConvert: (card: LeadCard) => void }) {
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${scoreColor(card.score)}33`,
      borderLeft: `4px solid ${scoreColor(card.score)}`,
      borderRadius: 10, padding: '10px 12px', marginTop: 6, fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#16a34a' }}><WA_ICON /></span>
          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>{card.name}</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>{card.phone}</span>
        </div>
        <div style={{
          background: scoreBg(card.score), border: `1px solid ${scoreColor(card.score)}44`,
          borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: scoreColor(card.score),
        }}>
          {card.score}/100
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontWeight: 600 }}>
          {intentLabel[card.intent] || card.intent}
        </span>
        {card.product && (
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}>
            {card.product}
          </span>
        )}
        {card.signals.slice(0, 2).map(s => (
          <span key={s} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#fefce8', color: '#ca8a04', fontWeight: 500 }}>
            {s}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: scoreColor(card.score), fontWeight: 600 }}>{card.recommendation}</span>
        <button
          onClick={() => onConvert(card)}
          style={{
            padding: '4px 10px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: 'none', borderRadius: 7, color: '#fff', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          + Lead
        </button>
      </div>
    </div>
  );
}

// ── Convert Lead Modal ────────────────────────────────────────────────────────
function ConvertLeadModal({ card, onClose, onSuccess }: { card: LeadCard; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle]       = useState(`WhatsApp — ${card.product || card.intent} — ${new Date().toLocaleDateString('en-IN')}`);
  const [product, setProduct]   = useState(card.product || '');
  const [value, setValue]       = useState('');
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      api.get(`/api/v1/messages/inbox?limit=100`).then(async r => {
        const msg = (r.data?.data || []).find((m: any) => m.fromAddress === card.phone);
        if (!msg) throw new Error('Message not found in inbox');
        return api.patch(`/api/v1/messages/${msg.id}/convert-lead`, {
          title, productInterest: product, estimatedValue: value ? parseFloat(value) : undefined,
          notes: card.signals.length ? `Signals: ${card.signals.join(', ')}` : undefined,
        }).then(r => r.data);
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['potential-leads'] });
      onSuccess();
      onClose();
    },
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Convert to Lead</h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 18px' }}>
          <strong>{card.name}</strong> · {card.phone} via WhatsApp
        </p>
        {[
          { label: 'Lead Title', val: title, set: setTitle, ph: 'e.g. Ravi Gupta — Georgette inquiry' },
          { label: 'Product Interest', val: product, set: setProduct, ph: 'e.g. Georgette 4-Way' },
          { label: 'Estimated Value (₹)', val: value, set: setValue, ph: '50000' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
            <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
        {mut.isError && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>Could not find message in inbox — go to Inbox tab first.</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1.5px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {mut.isPending ? 'Creating...' : '🎯 Create Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ChatbotPage ──────────────────────────────────────────────────────────
export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Namaste! Main aapka AI business assistant hoon. Aap mujhse apne business ke baare mein kuch bhi pooch sakte hain.\n\n💡 Charts ke liye poochein: "Top products ka bar chart", "Payment status pie chart", "Monthly sales trend"\n💡 WhatsApp leads ke liye: "WhatsApp pe kaun customer ban sakta hai?"',
    },
  ]);
  const [input, setInput]         = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [convertCard, setConvertCard] = useState<LeadCard | null>(null);
  const [convertSuccess, setConvertSuccess] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/api/v1/ai/chat', {
        message,
        sessionId,
        history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      }).then((r) => r.data),
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, leadCards: data.leadCards, chartData: data.chartData },
      ]);
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
            <p className="text-xs text-gray-400 leading-tight">WhatsApp leads · Charts · Sales · Stock · Payments</p>
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
            <div style={{ maxWidth: '78%' }}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm shadow-sm'
                  : 'bg-white border border-gray-100 text-gray-900 rounded-tl-sm shadow-sm'
              }`} style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>

              {/* ── Inline Chart ── */}
              {msg.role === 'assistant' && msg.chartData && msg.chartData.data?.length > 0 && (
                <ChatInlineChart chart={msg.chartData} />
              )}

              {/* ── WhatsApp Lead Cards ── */}
              {msg.role === 'assistant' && msg.leadCards && msg.leadCards.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4, paddingLeft: 2 }}>
                    📱 {msg.leadCards.length} WhatsApp Lead{msg.leadCards.length > 1 ? 's' : ''} Detected
                  </div>
                  {msg.leadCards.map((card, ci) => (
                    <LeadCardBlock key={ci} card={card} onConvert={setConvertCard} />
                  ))}
                  {convertSuccess && (
                    <div style={{ marginTop: 6, padding: '6px 10px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                      ✅ {convertSuccess}
                    </div>
                  )}
                </div>
              )}
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
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
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
            placeholder="Kuch bhi poochein — charts, leads, sales, stock..."
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

      {/* Convert Lead Modal */}
      {convertCard && (
        <ConvertLeadModal
          card={convertCard}
          onClose={() => setConvertCard(null)}
          onSuccess={() => setConvertSuccess(`Lead created for ${convertCard.name}!`)}
        />
      )}
    </div>
  );
}
