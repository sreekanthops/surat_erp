import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import {
  MessageSquare, Send, Check, CheckCheck, Clock, AlertTriangle,
  Plus, Settings, RefreshCw, Sparkles, User, UserPlus, FileText,
  Search, ShieldAlert, Phone, Bot, CheckCircle2, X, ChevronRight,
  ExternalLink
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface WaConv {
  id: string;
  phoneNumber: string;
  contactName?: string;
  latestContent?: string;
  lastMessageAt?: string;
  windowExpiresAt?: string;
  isWindowOpen: boolean;
  windowRemainingSeconds: number;
  unreadCount: number;
  status: string;
  aiIntent?: string;
  aiSentiment?: string;
  customerScore?: number;
  customerSignals?: string[];
  party?: { id: string; name: string; phone?: string; type?: string };
  assignedAgent?: { id: string; name: string };
}

interface WaMsg {
  id: string;
  waMessageId?: string;
  direction: 'INBOUND' | 'OUTBOUND';
  messageType: string;
  content?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  errorMessage?: string;
  templateName?: string;
  createdAt: string;
  sentByAgent?: { id: string; name: string };
}

interface TemplateItem {
  id?: string;
  metaTemplateName: string;
  category?: string;
  language: string;
  body?: string;
  header?: string;
  footer?: string;
  status?: string;
}

// ── Formatting Helpers ────────────────────────────────────────────────────────
const formatWindowTime = (seconds: number) => {
  if (seconds <= 0) return 'Window Closed';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins}m left`;
};

const fmtTime = (d: string) => {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const fmtDate = (d: string) => {
  const dt = new Date(d);
  const today = new Date();
  if (dt.toDateString() === today.toDateString()) return fmtTime(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const intentBadges: Record<string, { label: string; bg: string; color: string }> = {
  quote_request:     { label: 'Quote Request',   bg: '#eff6ff', color: '#2563eb' },
  order_confirm:     { label: 'Order Intent',    bg: '#f0fdf4', color: '#16a34a' },
  catalogue_request: { label: 'Catalogue',       bg: '#fff7ed', color: '#ea580c' },
  bulk_inquiry:      { label: 'Bulk Inquiry',    bg: '#f0f9ff', color: '#0284c7' },
  payment_info:      { label: 'Payment',         bg: '#fefce8', color: '#ca8a04' },
  general:           { label: 'General',         bg: '#f8f9fa', color: '#4b5563' },
};

export default function WhatsAppPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'open' | 'leads'>('all');
  const [messageText, setMessageText] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [templatePhone, setTemplatePhone] = useState('');
  const [templateContactName, setTemplateContactName] = useState('');
  const [templateParams, setTemplateParams] = useState<string[]>(['', '', '', '']);

  // Simulation state
  const [simPhone, setSimPhone] = useState('919876543210');
  const [simName, setSimName] = useState('Ramesh Cloth Store');
  const [simMsg, setSimMsg] = useState('Bhai Cotton 60x60 ka rate list bhejo, 5000 meter order karna hai');

  // Config State
  const [configForm, setConfigForm] = useState({
    displayPhone: '+91 8790007228',
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    appSecret: '',
    verifyToken: 'gspaces-wa-verify-token',
  });

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  // WhatsApp config status
  const statusQ = useQuery({
    queryKey: ['wa-integration-status'],
    queryFn: () => api.get('/api/v1/integrations/status').then(r => r.data?.whatsapp),
    staleTime: 15_000,
  });

  // Conversations query with polling
  const convsQ = useQuery({
    queryKey: ['wa-conversations', filterTab, search],
    queryFn: () => api.get('/api/v1/whatsapp/conversations', {
      params: { search: search || undefined, status: filterTab === 'open' ? 'open' : undefined }
    }).then(r => r.data),
    refetchInterval: 4_000,
  });

  // Active chat thread query
  const threadQ = useQuery({
    queryKey: ['wa-thread', selectedId],
    queryFn: () => api.get(`/api/v1/whatsapp/conversations/${selectedId}/messages`).then(r => r.data),
    enabled: !!selectedId,
    refetchInterval: 3_000,
  });

  // Templates query
  const templatesQ = useQuery({
    queryKey: ['wa-templates'],
    queryFn: () => api.get('/api/v1/whatsapp/templates').then(r => r.data?.templates || []),
  });

  useEffect(() => {
    if (statusQ.data?.config) {
      const cfg = statusQ.data.config;
      setConfigForm(f => ({
        ...f,
        displayPhone: cfg.displayPhone || f.displayPhone,
        phoneNumberId: cfg.phoneNumberId || '',
        wabaId: cfg.wabaId || '',
        verifyToken: cfg.verifyToken || f.verifyToken,
      }));
    }
  }, [statusQ.data]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadQ.data?.messages]);

  // Set default selected thread
  useEffect(() => {
    if (!selectedId && convsQ.data?.data?.length > 0) {
      setSelectedId(convsQ.data.data[0].id);
    }
  }, [convsQ.data, selectedId]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const sendReplyMut = useMutation({
    mutationFn: (text: string) => api.post(`/api/v1/whatsapp/conversations/${selectedId}/send`, { message: text }),
    onSuccess: () => {
      setMessageText('');
      qc.invalidateQueries({ queryKey: ['wa-thread', selectedId] });
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
    },
    onError: (err: any) => {
      alert(`⚠️ ${err.response?.data?.error || 'Failed to send message'}`);
    },
  });

  const sendTemplateMut = useMutation({
    mutationFn: () => api.post('/api/v1/whatsapp/send-template', {
      toPhone: templatePhone,
      contactName: templateContactName,
      templateName: selectedTemplate?.metaTemplateName,
      language: selectedTemplate?.language || 'en',
      parameters: templateParams.filter(p => p.trim() !== ''),
    }),
    onSuccess: (res) => {
      setShowTemplateModal(false);
      setSelectedTemplate(null);
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
      if (res.data?.conversationId) setSelectedId(res.data.conversationId);
      alert('✅ Template message sent successfully!');
    },
    onError: (err: any) => {
      alert(`❌ ${err.response?.data?.error || 'Failed to send template'}`);
    },
  });

  const simulateMut = useMutation({
    mutationFn: () => api.post('/api/v1/whatsapp/simulate', {
      from: simPhone,
      senderName: simName,
      content: simMsg,
    }),
    onSuccess: (res) => {
      setShowSimulateModal(false);
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
      if (res.data?.conversation?.id) setSelectedId(res.data.conversation.id);
    },
  });

  const saveConfigMut = useMutation({
    mutationFn: () => api.post('/api/v1/integrations/whatsapp/setup', configForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-integration-status'] });
      setShowConfigModal(false);
      alert('✅ WhatsApp Business API configuration saved and verified with Meta!');
    },
    onError: (err: any) => {
      alert(`❌ ${err.response?.data?.error || 'Verification failed'}`);
    },
  });

  const convs: WaConv[] = convsQ.data?.data || [];
  const activeThread = threadQ.data?.conversation as WaConv | undefined;
  const messages: WaMsg[] = threadQ.data?.messages || [];
  const templates: TemplateItem[] = templatesQ.data || [];

  const handleSend = () => {
    if (!messageText.trim() || sendReplyMut.isPending) return;
    sendReplyMut.mutate(messageText.trim());
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Left Sidebar (Conversations List) ──────────────────────────────── */}
      <div style={{ width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid #e2e8f0' }}>

        {/* Top Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <MessageSquare size={18} />
              </div>
              <div>
                <h1 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>WhatsApp Hub</h1>
                <span style={{ fontSize: 11, color: statusQ.data?.isActive ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                  {statusQ.data?.isActive ? '● Live Meta Cloud API' : '○ Configuration Needed'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setShowSimulateModal(true)}
                title="Simulate Inbound WhatsApp Message"
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Bot size={13} /> Simulate
              </button>
              <button
                onClick={() => setShowConfigModal(true)}
                title="API Settings"
                style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* New Template Message Button */}
          <button
            onClick={() => {
              if (activeThread) {
                setTemplatePhone(activeThread.phoneNumber);
                setTemplateContactName(activeThread.contactName || '');
              }
              setShowTemplateModal(true);
            }}
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: 9,
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 2px 6px rgba(16,185,129,0.25)',
              marginBottom: 12,
            }}
          >
            <Plus size={16} /> New Conversation (Template)
          </button>

          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input
              type="text"
              placeholder="Search phone, customer, or message..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {(['all', 'open'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filterTab === tab ? '#0f172a' : '#f1f5f9',
                  color: filterTab === tab ? '#fff' : '#475569',
                  textTransform: 'capitalize'
                }}
              >
                {tab === 'all' ? 'All Chats' : 'Open 24h'}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Thread List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convs.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              <p>No conversations found.</p>
              <button
                onClick={() => setShowSimulateModal(true)}
                style={{ padding: '6px 12px', background: '#e2e8f0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
              >
                Simulate a WhatsApp Message
              </button>
            </div>
          ) : (
            convs.map(c => {
              const isSelected = selectedId === c.id;
              const badge = intentBadges[c.aiIntent || 'general'] || intentBadges.general;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: isSelected ? '#f1f5f9' : '#fff',
                    borderLeft: isSelected ? '4px solid #10b981' : '4px solid transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: c.unreadCount > 0 ? 800 : 700, color: '#0f172a' }}>
                        {c.contactName || c.phoneNumber}
                      </span>
                      {c.unreadCount > 0 && (
                        <span style={{ background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10 }}>
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {c.lastMessageAt ? fmtDate(c.lastMessageAt) : ''}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.latestContent || 'No messages'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {/* 24-Hour Window Badge */}
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: c.isWindowOpen ? '#dcfce7' : '#fee2e2',
                      color: c.isWindowOpen ? '#15803d' : '#b91c1c',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3
                    }}>
                      <Clock size={10} />
                      {c.isWindowOpen ? formatWindowTime(c.windowRemainingSeconds) : '24h Closed'}
                    </span>

                    {/* AI Intent Tag */}
                    {c.aiIntent && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    )}

                    {/* Hot Prospect Score */}
                    {c.customerScore && c.customerScore >= 70 && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#b45309' }}>
                        🔥 Hot Lead
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Main Chat Thread Panel ────────────────────────────────────────── */}
      {activeThread ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>

          {/* Chat Top Banner */}
          <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {activeThread.contactName || activeThread.phoneNumber}
                </h2>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  +{activeThread.phoneNumber}
                </span>
                {activeThread.party?.type && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f1f5f9', color: '#475569' }}>
                    {activeThread.party.type}
                  </span>
                )}
              </div>

              {/* 24-Hour Customer Window Tracker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: activeThread.isWindowOpen ? '#16a34a' : '#dc2626'
                }}>
                  <Clock size={13} />
                  {activeThread.isWindowOpen ? (
                    <span>Customer Session Active ({formatWindowTime(activeThread.windowRemainingSeconds)}) — Free-form replies permitted</span>
                  ) : (
                    <span>24h Window Closed — Send a template message to re-open</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setTemplatePhone(activeThread.phoneNumber);
                  setTemplateContactName(activeThread.contactName || '');
                  setShowTemplateModal(true);
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <FileText size={14} /> Send Template
              </button>
            </div>
          </div>

          {/* AI Customer Insight Bar (if lead detected) */}
          {(activeThread.customerScore && activeThread.customerScore >= 60) && (
            <div style={{ background: '#ecfdf5', borderBottom: '1px solid #a7f3d0', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#065f46' }}>
                <Sparkles size={14} color="#059669" />
                <span><strong>AI Buying Signal Detected:</strong> {activeThread.customerSignals?.join(', ') || 'High customer purchase intent'}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: 12 }}>
                Score: {activeThread.customerScore}/100
              </span>
            </div>
          )}

          {/* Message History Timeline */}
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No messages in this conversation thread yet.
              </div>
            ) : (
              messages.map(m => {
                const isOutbound = m.direction === 'OUTBOUND';
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: isOutbound ? 'flex-end' : 'flex-start',
                      maxWidth: '68%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isOutbound ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: isOutbound ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: isOutbound ? '#dcf8c6' : '#ffffff',
                        color: '#0f172a',
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                        border: isOutbound ? 'none' : '1px solid #e2e8f0',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.messageType === 'template' && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>
                          📄 Approved Template
                        </div>
                      )}
                      <div>{m.content}</div>

                      {m.errorMessage && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626', background: '#fee2e2', padding: '3px 6px', borderRadius: 4 }}>
                          Failed: {m.errorMessage}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, padding: '0 4px' }}>
                      <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                        {fmtTime(m.createdAt)}
                      </span>
                      {isOutbound && (
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          {m.status === 'read' ? (
                            <CheckCheck size={13} color="#2563eb" />
                          ) : m.status === 'delivered' ? (
                            <CheckCheck size={13} color="#64748b" />
                          ) : m.status === 'failed' ? (
                            <AlertTriangle size={13} color="#ef4444" />
                          ) : (
                            <Check size={13} color="#64748b" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Bottom Chat Composer */}
          <div style={{ padding: '16px 24px', background: '#fff', borderTop: '1px solid #e2e8f0' }}>
            {activeThread.isWindowOpen ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Type a WhatsApp reply to customer..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 13.5,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendReplyMut.isPending}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: messageText.trim() ? '#10b981' : '#cbd5e1',
                    color: '#fff',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: messageText.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Send size={15} /> Send
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1.5px dashed #cbd5e1', padding: '12px 18px', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
                  <ShieldAlert size={16} color="#eab308" />
                  <span>The 24-hour customer session window is closed. Meta requires an approved template to message this contact.</span>
                </div>
                <button
                  onClick={() => {
                    setTemplatePhone(activeThread.phoneNumber);
                    setTemplateContactName(activeThread.contactName || '');
                    setShowTemplateModal(true);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: '#10b981',
                    border: 'none',
                    color: '#fff',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Pick & Send Template
                </button>
              </div>
            )}
          </div>

        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
          Select a conversation from the left to start messaging.
        </div>
      )}

      {/* ── Template Picker & Sender Modal ──────────────────────────────────── */}
      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '560px', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Send Meta Approved Template</h3>
              </div>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Recipient Phone (E.164 without +)</label>
                <input
                  type="text"
                  placeholder="e.g. 919876543210"
                  value={templatePhone}
                  onChange={e => setTemplatePhone(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Select Template</label>
                <select
                  value={selectedTemplate?.metaTemplateName || ''}
                  onChange={e => {
                    const t = templates.find(item => item.metaTemplateName === e.target.value);
                    setSelectedTemplate(t || null);
                  }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                >
                  <option value="">-- Choose an approved template --</option>
                  {templates.map(t => (
                    <option key={t.metaTemplateName} value={t.metaTemplateName}>
                      {t.metaTemplateName} ({t.category || 'UTILITY'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate && (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Template Body Preview:</div>
                  <div style={{ fontSize: 12.5, color: '#0f172a', lineHeight: 1.5 }}>
                    {selectedTemplate.body || 'No template body available'}
                  </div>
                </div>
              )}

              {/* Dynamic Parameter Inputs */}
              {selectedTemplate && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                    Template Variables ({"{{1}}, {{2}}"}...)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[0, 1, 2, 3].map(idx => (
                      <input
                        key={idx}
                        type="text"
                        placeholder={`Parameter {{${idx + 1}}}`}
                        value={templateParams[idx] || ''}
                        onChange={e => {
                          const updated = [...templateParams];
                          updated[idx] = e.target.value;
                          setTemplateParams(updated);
                        }}
                        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowTemplateModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => sendTemplateMut.mutate()}
                disabled={!templatePhone || !selectedTemplate || sendTemplateMut.isPending}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#10b981',
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: (!templatePhone || !selectedTemplate) ? 0.6 : 1
                }}
              >
                {sendTemplateMut.isPending ? 'Sending...' : 'Send Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── API Credentials & Settings Modal ───────────────────────────────── */}
      {showConfigModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '580px', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} color="#0f172a" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Meta WhatsApp Cloud API Settings</h3>
              </div>
              <button onClick={() => setShowConfigModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, fontSize: 12, color: '#166534' }}>
                Configure your Meta Developer App credentials below. Long-lived System User Access Tokens are recommended.
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>Phone Number ID (from Meta Dashboard)</label>
                <input
                  type="text"
                  placeholder="e.g. 102938475610293"
                  value={configForm.phoneNumberId}
                  onChange={e => setConfigForm({ ...configForm, phoneNumberId: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, boxSizing: 'border-box', marginTop: 3 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>WhatsApp Business Account (WABA) ID</label>
                <input
                  type="text"
                  placeholder="e.g. 293847561029384"
                  value={configForm.wabaId}
                  onChange={e => setConfigForm({ ...configForm, wabaId: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, boxSizing: 'border-box', marginTop: 3 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>Permanent Access Token</label>
                <input
                  type="password"
                  placeholder="EAAB..."
                  value={configForm.accessToken}
                  onChange={e => setConfigForm({ ...configForm, accessToken: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, boxSizing: 'border-box', marginTop: 3 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>App Secret (Optional, for Webhook HMAC Signature)</label>
                <input
                  type="password"
                  value={configForm.appSecret}
                  onChange={e => setConfigForm({ ...configForm, appSecret: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, boxSizing: 'border-box', marginTop: 3 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>Webhook Callback URL</label>
                <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#0f172a', fontFamily: 'monospace', marginTop: 3 }}>
                  {window.location.origin.replace('3000', '3001')}/webhooks/whatsapp
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowConfigModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => saveConfigMut.mutate()}
                disabled={saveConfigMut.isPending}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                {saveConfigMut.isPending ? 'Verifying with Meta...' : 'Save & Verify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Simulate Message Modal ─────────────────────────────────────────── */}
      {showSimulateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '500px', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={18} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Simulate Inbound WhatsApp</h3>
              </div>
              <button onClick={() => setShowSimulateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Customer Phone Number</label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={e => setSimPhone(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, boxSizing: 'border-box', marginTop: 3 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Customer / Contact Name</label>
                <input
                  type="text"
                  value={simName}
                  onChange={e => setSimName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, boxSizing: 'border-box', marginTop: 3 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Customer Message Content</label>
                <textarea
                  rows={3}
                  value={simMsg}
                  onChange={e => setSimMsg(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, boxSizing: 'border-box', marginTop: 3, resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowSimulateModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => simulateMut.mutate()}
                disabled={simulateMut.isPending}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                {simulateMut.isPending ? 'Simulating...' : 'Trigger Inbound Message'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
