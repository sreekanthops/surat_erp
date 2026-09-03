import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '@/hooks/useApi';
import {
  RefreshCw, Mail, MailOpen, Search, Send, X,
  ExternalLink, AlertCircle, CheckCircle, Loader,
  Inbox, Unlink,
} from 'lucide-react';

interface GmailMsg {
  id: string;
  fromAddress?: string;
  subject?: string;
  content?: string;
  isRead: boolean;
  isReplied: boolean;
  createdAt: string;
  threadId?: string;
  party?: { id: string; name: string; email?: string } | null;
}

interface GmailStatus {
  isActive: boolean;
  syncStatus?: string;
  lastSyncAt?: string;
  config?: { email?: string; hasToken?: boolean };
}

const fmtDate = (d: string) => {
  const dt = new Date(d);
  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  if (diff < 86400000) return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * 86400000) return dt.toLocaleDateString('en-IN', { weekday: 'short' });
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const initials = (s?: string) => (s || '?')[0].toUpperCase();

const avatarColor = (s?: string) => {
  const colors = ['#5b5bd6','#059669','#d97706','#db2777','#0284c7','#7c3aed'];
  const idx = (s?.charCodeAt(0) || 0) % colors.length;
  return colors[idx];
};

// ── Connect Banner ────────────────────────────────────────────────────────────
function ConnectBanner({ onConnect, loading }: { onConnect: () => void; loading: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', textAlign: 'center', gap: '20px',
    }}>
      <div style={{
        width: '72px', height: '72px', borderRadius: '20px',
        background: '#f0f2f8', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Mail size={32} color="#5b5bd6" />
      </div>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Connect your Gmail
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, maxWidth: '360px', lineHeight: 1.6 }}>
          Connect your Gmail account to view your inbox, read emails, reply to customers, and let the AI chatbot answer email-related questions.
        </p>
      </div>
      <button
        onClick={onConnect}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '11px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          background: '#5b5bd6', color: '#fff',
          boxShadow: '0 2px 8px rgba(91,91,214,0.35)',
          transition: 'all 0.15s', opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 13L4 6H20ZM20 18H4V8L12 15L20 8V18Z" fill="white"/>
          </svg>
        )}
        {loading ? 'Opening Google…' : 'Connect with Google'}
      </button>
      <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: 4 }}>
        You'll be redirected to Google to authorize. Only read + send permissions are requested.
      </p>
    </div>
  );
}

// ── Email Row ─────────────────────────────────────────────────────────────────
function EmailRow({ msg, active, onClick }: { msg: GmailMsg; active: boolean; onClick: () => void }) {
  const from = msg.party?.name || msg.fromAddress || 'Unknown';
  const bg   = avatarColor(msg.fromAddress);
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '13px 18px', cursor: 'pointer',
        borderBottom: '1px solid #eff0f6',
        background: active ? '#f0f0ff' : msg.isRead ? '#fff' : '#fafbff',
        borderLeft: active ? '3px solid #5b5bd6' : '3px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: 700, color: '#fff',
      }}>
        {initials(msg.fromAddress)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{
            fontSize: '13.5px', fontWeight: msg.isRead ? 500 : 700,
            color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>{from}</span>
          <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{fmtDate(msg.createdAt)}</span>
        </div>
        <div style={{
          fontSize: '13px', color: msg.isRead ? '#6b7280' : '#374151',
          fontWeight: msg.isRead ? 400 : 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px',
        }}>
          {msg.subject || '(no subject)'}
        </div>
        <div style={{
          fontSize: '12px', color: '#9ca3af', marginTop: '2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {(msg.content || '').slice(0, 80)}
        </div>
      </div>
      {!msg.isRead && (
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: '#5b5bd6', flexShrink: 0, marginTop: '6px',
        }} />
      )}
    </div>
  );
}

// ── Email Reader ──────────────────────────────────────────────────────────────
function EmailReader({ msg, onClose, onReply }: { msg: GmailMsg; onClose: () => void; onReply: (body: string) => void }) {
  const [reply, setReply] = useState('');
  const [showReply, setShowReply] = useState(false);
  const from = msg.party?.name || msg.fromAddress || 'Unknown';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 16px', borderBottom: '1px solid #e4e7ef',
        background: '#fff', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{
              fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 6px',
              letterSpacing: '-0.02em', lineHeight: 1.3,
            }}>
              {msg.subject || '(no subject)'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '12.5px', color: '#4b5563',
              }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: avatarColor(msg.fromAddress),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {initials(msg.fromAddress)}
                </div>
                <span style={{ fontWeight: 600 }}>{from}</span>
                {msg.fromAddress && <span style={{ color: '#9ca3af' }}>&lt;{msg.fromAddress}&gt;</span>}
              </span>
              <span style={{ fontSize: '11.5px', color: '#9ca3af' }}>
                {new Date(msg.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', display: 'flex', flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#fafbff' }}>
        <pre style={{
          fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif",
          fontSize: '14px', color: '#374151', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
        }}>
          {msg.content || '(empty)'}
        </pre>
      </div>

      {/* Reply composer */}
      <div style={{ borderTop: '1px solid #e4e7ef', background: '#fff', flexShrink: 0 }}>
        {!showReply ? (
          <div style={{ padding: '12px 20px' }}>
            <button
              onClick={() => setShowReply(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 16px', borderRadius: '9px', border: '1.5px solid #e4e7ef',
                background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s',
              }}
            >
              <Send size={14} /> Reply
            </button>
          </div>
        ) : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
              Replying to: <span style={{ color: '#4b5563', fontWeight: 600 }}>{msg.fromAddress}</span>
            </div>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write your reply…"
              rows={4}
              style={{
                width: '100%', padding: '10px 13px', borderRadius: '10px', resize: 'vertical',
                border: '1.5px solid #e4e7ef', fontSize: '13.5px', fontFamily: 'inherit',
                color: '#111827', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#5b5bd6'; }}
              onBlur={e => { e.target.style.borderColor = '#e4e7ef'; }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowReply(false); setReply(''); }}
                style={{
                  padding: '8px 14px', borderRadius: '9px', border: '1.5px solid #e4e7ef',
                  background: '#fff', color: '#6b7280', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >Cancel</button>
              <button
                onClick={() => { if (reply.trim()) { onReply(reply); setShowReply(false); setReply(''); } }}
                disabled={!reply.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '9px', border: 'none',
                  background: reply.trim() ? '#5b5bd6' : '#e4e7ef',
                  color: reply.trim() ? '#fff' : '#9ca3af',
                  fontSize: '13px', fontWeight: 600, cursor: reply.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', transition: 'all 0.13s',
                }}
              >
                <Send size={13} /> Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GmailPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GmailMsg | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [bannerMsg, setBannerMsg] = useState('');

  // Handle OAuth redirect result
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error     = searchParams.get('error');
    if (connected === '1') setBannerMsg('✅ Gmail connected! Click "Sync" to load your emails.');
    if (error)             setBannerMsg(`❌ ${decodeURIComponent(error)}`);
  }, [searchParams]);

  // Gmail connection status
  const statusQ = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => api.get('/api/v1/integrations/status').then(r => r.data.gmail as GmailStatus),
    staleTime: 30_000,
  });
  const gmailStatus: GmailStatus = statusQ.data || { isActive: false };

  // Email list
  const inboxQ = useQuery({
    queryKey: ['gmail-inbox', unreadOnly, search],
    queryFn: () => api.get('/api/v1/integrations/gmail/inbox', {
      params: { limit: 50, unread: unreadOnly || undefined, search: search || undefined },
    }).then(r => r.data as { data: GmailMsg[]; total: number }),
    enabled: gmailStatus.isActive,
    staleTime: 30_000,
  });

  const emails: GmailMsg[] = inboxQ.data?.data ?? [];
  const total: number = inboxQ.data?.total ?? 0;
  const unreadCount = emails.filter(m => !m.isRead).length;

  // Connect
  const handleConnect = async () => {
    setConnectLoading(true);
    try {
      const { data } = await api.get('/api/v1/integrations/gmail/connect');
      window.location.href = data.url;
    } catch (e: any) {
      setBannerMsg(`❌ ${e?.response?.data?.error || 'Could not start OAuth'}`);
      setConnectLoading(false);
    }
  };

  // Sync
  const syncMut = useMutation({
    mutationFn: () => api.post('/api/v1/integrations/gmail/sync').then(r => r.data),
    onSuccess: (data) => {
      setSyncMsg(`✅ Synced ${data.synced} new email${data.synced !== 1 ? 's' : ''} (${data.total} in inbox)`);
      qc.invalidateQueries({ queryKey: ['gmail-inbox'] });
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      setTimeout(() => setSyncMsg(''), 4000);
    },
    onError: (e: any) => {
      setSyncMsg(`❌ ${e?.response?.data?.error || 'Sync failed'}`);
      setTimeout(() => setSyncMsg(''), 5000);
    },
  });

  // Mark read
  const markReadMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/messages/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmail-inbox'] }),
  });

  // Disconnect
  const disconnectMut = useMutation({
    mutationFn: () => api.delete('/api/v1/integrations/gmail/disconnect'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      setSelected(null);
      setBannerMsg('Gmail disconnected.');
    },
  });

  // Reply
  const replyMut = useMutation({
    mutationFn: ({ body }: { body: string }) => {
      if (!selected) throw new Error('No message selected');
      return api.post('/api/v1/integrations/gmail/reply', {
        to:       selected.fromAddress,
        subject:  selected.subject || '',
        body,
        threadId: selected.threadId,
      });
    },
    onSuccess: () => {
      setSyncMsg('✅ Reply sent!');
      qc.invalidateQueries({ queryKey: ['gmail-inbox'] });
      setTimeout(() => setSyncMsg(''), 3000);
    },
    onError: (e: any) => {
      setSyncMsg(`❌ ${e?.response?.data?.error || 'Reply failed'}`);
      setTimeout(() => setSyncMsg(''), 5000);
    },
  });

  const openEmail = useCallback((msg: GmailMsg) => {
    setSelected(msg);
    if (!msg.isRead) markReadMut.mutate(msg.id);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#f5f6fa', fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 24px',
        background: '#fff', borderBottom: '1px solid #e4e7ef', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
          <Mail size={18} color="#5b5bd6" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>Gmail</span>
          {gmailStatus.isActive && (
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
              background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
            }}>
              {gmailStatus.config?.email || 'Connected'}
            </span>
          )}
          {unreadCount > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px',
              background: '#5b5bd6', color: '#fff',
            }}>
              {unreadCount} unread
            </span>
          )}
        </div>

        {gmailStatus.isActive && (
          <>
            {/* Unread filter */}
            <button
              onClick={() => setUnreadOnly(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px',
                borderRadius: '8px', border: '1.5px solid',
                borderColor: unreadOnly ? '#5b5bd6' : '#e4e7ef',
                background: unreadOnly ? '#f0f0ff' : '#fff',
                color: unreadOnly ? '#5b5bd6' : '#6b7280',
                fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Inbox size={13} /> Unread only
            </button>

            {/* Sync */}
            <button
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                borderRadius: '9px', border: 'none', cursor: syncMut.isPending ? 'not-allowed' : 'pointer',
                background: '#5b5bd6', color: '#fff', fontSize: '13px', fontWeight: 600,
                fontFamily: 'inherit', opacity: syncMut.isPending ? 0.7 : 1,
                boxShadow: '0 2px 6px rgba(91,91,214,0.3)',
              }}
            >
              <RefreshCw size={13} style={{ animation: syncMut.isPending ? 'spin 1s linear infinite' : 'none' }} />
              {syncMut.isPending ? 'Syncing…' : 'Sync'}
            </button>

            {/* Disconnect */}
            <button
              onClick={() => disconnectMut.mutate()}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px',
                borderRadius: '9px', border: '1.5px solid #fecaca',
                background: '#fff', color: '#dc2626', fontSize: '12.5px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Unlink size={12} /> Disconnect
            </button>
          </>
        )}
      </div>

      {/* ── Banners ── */}
      {(bannerMsg || syncMsg) && (
        <div style={{
          padding: '10px 24px', fontSize: '13px', fontWeight: 500,
          background: (bannerMsg || syncMsg).startsWith('✅') ? '#f0fdf4' : '#fef2f2',
          color:      (bannerMsg || syncMsg).startsWith('✅') ? '#15803d' : '#dc2626',
          borderBottom: '1px solid',
          borderColor: (bannerMsg || syncMsg).startsWith('✅') ? '#bbf7d0' : '#fecaca',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {(bannerMsg || syncMsg).startsWith('✅')
            ? <CheckCircle size={14} />
            : <AlertCircle size={14} />
          }
          {bannerMsg || syncMsg}
        </div>
      )}

      {/* ── Content ── */}
      {!gmailStatus.isActive ? (
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
          <ConnectBanner onConnect={handleConnect} loading={connectLoading} />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

          {/* ── Left: Email list ── */}
          <div style={{
            width: selected ? '360px' : '100%',
            flexShrink: 0,
            borderRight: selected ? '1px solid #e4e7ef' : 'none',
            display: 'flex', flexDirection: 'column',
            background: '#fff', overflow: 'hidden',
          }}>
            {/* Search */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #eff0f6', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search emails…"
                  style={{
                    width: '100%', padding: '8px 12px 8px 32px', borderRadius: '8px',
                    border: '1.5px solid #e4e7ef', fontSize: '13px', fontFamily: 'inherit',
                    color: '#374151', outline: 'none', boxSizing: 'border-box',
                    background: '#f8f9fc', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#5b5bd6'; }}
                  onBlur={e => { e.target.style.borderColor = '#e4e7ef'; }}
                />
              </div>
            </div>

            {/* Count row */}
            <div style={{
              padding: '8px 18px', borderBottom: '1px solid #eff0f6',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
                {inboxQ.isLoading ? 'Loading…' : `${total} email${total !== 1 ? 's' : ''}`}
              </span>
              {inboxQ.isLoading && (
                <Loader size={13} color="#9ca3af" style={{ animation: 'spin 1s linear infinite' }} />
              )}
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {inboxQ.isLoading ? (
                [...Array(8)].map((_, i) => (
                  <div key={i} style={{ padding: '13px 18px', borderBottom: '1px solid #eff0f6', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(90deg,#f0f2f8 25%,#e8eaf2 50%,#f0f2f8 75%)', backgroundSize: '400% 100%', animation: 'skeleton-shimmer 1.5s ease infinite', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: '13px', width: '60%', background: 'linear-gradient(90deg,#f0f2f8 25%,#e8eaf2 50%,#f0f2f8 75%)', borderRadius: '6px', marginBottom: '7px', backgroundSize: '400% 100%', animation: 'skeleton-shimmer 1.5s ease infinite' }} />
                      <div style={{ height: '11px', width: '85%', background: 'linear-gradient(90deg,#f0f2f8 25%,#e8eaf2 50%,#f0f2f8 75%)', borderRadius: '5px', backgroundSize: '400% 100%', animation: 'skeleton-shimmer 1.5s ease infinite' }} />
                    </div>
                  </div>
                ))
              ) : emails.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '60px 20px', gap: '12px', color: '#9ca3af', textAlign: 'center',
                }}>
                  <MailOpen size={36} color="#d1d5db" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#4b5563' }}>
                      {search || unreadOnly ? 'No matching emails' : 'No emails yet'}
                    </div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>
                      {search || unreadOnly ? 'Try clearing your filters' : 'Click Sync to fetch your Gmail inbox'}
                    </div>
                  </div>
                </div>
              ) : (
                emails.map(m => (
                  <EmailRow
                    key={m.id}
                    msg={m}
                    active={selected?.id === m.id}
                    onClick={() => openEmail(m)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Right: Email reader ── */}
          {selected && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <EmailReader
                msg={selected}
                onClose={() => setSelected(null)}
                onReply={(body) => replyMut.mutate({ body })}
              />
            </div>
          )}

        </div>
      )}
    </div>
  );
}
