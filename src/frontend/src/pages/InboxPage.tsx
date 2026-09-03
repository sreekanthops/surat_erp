import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/hooks/useApi';

// ── Types ────────────────────────────────────────────────────────────────────
interface Msg {
  id: string; channel: 'WHATSAPP' | 'GMAIL' | string; direction: string;
  fromAddress?: string; content?: string; aiIntent?: string; aiSentiment?: string;
  aiLanguage?: string; aiEntities?: any; isRead: boolean; isReplied: boolean;
  createdAt: string; party?: { id: string; name: string; phone?: string };
}
interface PotentialLead {
  phone: string; partyId: string; partyName: string; isKnownCustomer: boolean;
  messageCount: number; intents: string[]; customerSignals: string[];
  latestMessage: string; latestAt: string;
  score: number; recommendation: string;
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const intentMeta: Record<string, { label: string; bg: string; color: string }> = {
  quote_request:        { label: 'Quote Request',    bg: '#eff6ff', color: '#2563eb' },
  order_confirm:        { label: 'Order Confirm',    bg: '#f0fdf4', color: '#16a34a' },
  payment_info:         { label: 'Payment',          bg: '#fefce8', color: '#ca8a04' },
  complaint:            { label: 'Complaint',        bg: '#fef2f2', color: '#dc2626' },
  delivery_query:       { label: 'Delivery Query',   bg: '#f5f3ff', color: '#7c3aed' },
  catalogue_request:    { label: 'Catalogue',        bg: '#fff7ed', color: '#ea580c' },
  new_customer_inquiry: { label: 'New Inquiry',      bg: '#ecfdf5', color: '#059669' },
  bulk_inquiry:         { label: 'Bulk Inquiry',     bg: '#f0f9ff', color: '#0284c7' },
  sample_request:       { label: 'Sample Req',       bg: '#fdf4ff', color: '#9333ea' },
  reorder:              { label: 'Reorder',          bg: '#f0fdf4', color: '#15803d' },
  general:              { label: 'General',          bg: '#f8f9fc', color: '#4b5563' },
};
const sentimentColor: Record<string, string> = { positive: '#16a34a', neutral: '#4b5563', negative: '#dc2626' };
const scoreColor = (s: number) => s >= 70 ? '#16a34a' : s >= 40 ? '#f97316' : '#4b5563';
const scoreBg    = (s: number) => s >= 70 ? '#f0fdf4' : s >= 40 ? '#fff7ed' : '#f8f9fc';
const fmt        = (d: string) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const WA_ICON = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="#16a34a">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

// ── WhatsApp Setup Wizard ─────────────────────────────────────────────────────
interface WaSetupWizardProps { onClose: () => void; onConnected: () => void; }

function WaSetupWizard({ onClose, onConnected }: WaSetupWizardProps) {
  const qc = useQueryClient();
  const OWNER_PHONE = '918790007228'; // your number in E.164 without +

  // Wizard state: 0=credentials 1=webhook 2=test
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    displayPhone:  '+91 8790007228',
    phoneNumberId: '',
    wabaId:        '',
    accessToken:   '',
    appSecret:     '',
    verifyToken:   'gspaces-wa-token-' + Math.random().toString(36).slice(2, 8),
  });
  const [testPhone, setTestPhone] = useState(OWNER_PHONE);
  const [testResult, setTestResult] = useState('');
  const [copied, setCopied] = useState('');

  // Load existing config
  const statusQ = useQuery({
    queryKey: ['wa-status'],
    queryFn: () => api.get('/api/v1/integrations/status').then(r => r.data),
  });
  useEffect(() => {
    const wa = statusQ.data?.whatsapp?.config;
    if (wa) {
      setForm(f => ({
        ...f,
        displayPhone: wa.displayPhone || f.displayPhone,
        phoneNumberId: wa.phoneNumberId || '',
        wabaId: wa.wabaId || '',
        verifyToken: wa.verifyToken || f.verifyToken,
      }));
      if (wa.displayPhone || wa.phoneNumberId) setStep(1); // jump to webhook step if already saved
    }
  }, [statusQ.data]);

  const isConnected = statusQ.data?.whatsapp?.isActive;

  const setupMut = useMutation({
    mutationFn: () => api.post('/api/v1/integrations/whatsapp/setup', form).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['wa-status'] });
      setStep(1); // move to webhook step
    },
  });

  const testMut = useMutation({
    mutationFn: () => api.post('/api/v1/integrations/whatsapp/test', { toPhone: testPhone }).then(r => r.data),
    onSuccess: (data) => {
      setTestResult('✅ ' + data.message);
      onConnected();
    },
    onError: (err: any) => {
      setTestResult('❌ ' + (err?.response?.data?.error || err?.message));
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => api.delete('/api/v1/integrations/whatsapp/disconnect').then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wa-status'] }); setStep(0); },
  });

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };

  // Use the backend API URL env var if set, otherwise fall back to same host with port 3001
  const backendBase = (import.meta.env.VITE_API_URL || window.location.origin.replace(':3000', ':3001')).replace(/\/$/, '');
  const webhookUrl = `${backendBase}/webhooks/whatsapp`;

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e4e7ef',
    borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  };
  const labelStyle = {
    display: 'block' as const, fontSize: 11, fontWeight: 700, color: '#374151',
    marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  };
  const codeBlock = {
    background: '#1a2235', borderRadius: 8, padding: '9px 12px',
    fontFamily: 'monospace', fontSize: 12, color: '#a3e635',
    wordBreak: 'break-all' as const, position: 'relative' as const,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WA_ICON /></div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1a2235', margin: 0 }}>Connect WhatsApp Business</h2>
            <p style={{ fontSize: 11, color: '#4b5563', margin: 0 }}>Meta Cloud API · Number: +91 8790007228</p>
          </div>
          {isConnected && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' }}>
              ● Connected
            </span>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', padding: '0 4px' }}>×</button>
        </div>

        {/* Step pills */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
          {['1 Credentials', '2 Webhook URL', '3 Test & Done'].map((label, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 700,
              background: step === i ? '#5b5bd6' : step > i ? '#f0fdf4' : '#f8f9fc',
              color: step === i ? '#fff' : step > i ? '#16a34a' : '#9ca3af',
              borderRadius: i === 0 ? '8px 0 0 8px' : i === 2 ? '0 8px 8px 0' : '0',
              border: `1px solid ${step === i ? '#5b5bd6' : '#e4e7ef'}`,
              cursor: step > i ? 'pointer' : 'default',
            }} onClick={() => step > i && setStep(i)}>
              {step > i ? '✓ ' : ''}{label}
            </div>
          ))}
        </div>

        {/* ── Step 0: Enter Meta credentials ── */}
        {step === 0 && (
          <div>
            <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1d4ed8' }}>
              <strong>Where to get these?</strong> Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>developers.facebook.com</a> → Your App → WhatsApp → API Setup
            </div>

            {[
              { label: 'Your WhatsApp Display Phone', key: 'displayPhone', ph: '+91 8790007228', hint: 'The number registered on Meta Business' },
              { label: 'Phone Number ID', key: 'phoneNumberId', ph: '123456789012345', hint: 'Found in Meta App → WhatsApp → API Setup' },
              { label: 'WhatsApp Business Account ID (WABA ID)', key: 'wabaId', ph: '987654321098765', hint: 'Found in Meta Business Suite → Settings' },
              { label: 'Permanent Access Token', key: 'accessToken', ph: 'EAAxxxxxxxx…', hint: 'Generate in Meta System User or use temp token for testing' },
              { label: 'App Secret (optional — for HMAC verification)', key: 'appSecret', ph: 'abc123…', hint: 'Meta App → Settings → Basic → App Secret' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 13 }}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  type={f.key === 'accessToken' || f.key === 'appSecret' ? 'password' : 'text'}
                  style={inputStyle}
                />
                {f.hint && <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0' }}>{f.hint}</p>}
              </div>
            ))}

            {setupMut.isError && (
              <div style={{ background: '#fef2f2', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#dc2626' }}>
                {(setupMut.error as any)?.response?.data?.error || 'Setup failed. Check credentials.'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '8px 16px', border: '1.5px solid #e4e7ef', borderRadius: 9, background: '#fff', color: '#4b5563', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => setupMut.mutate()}
                disabled={!form.phoneNumberId || !form.accessToken || !form.wabaId || setupMut.isPending}
                style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!form.phoneNumberId || !form.accessToken || !form.wabaId) ? 0.5 : 1 }}
              >
                {setupMut.isPending ? 'Verifying with Meta…' : 'Verify & Save →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Register webhook URL ── */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: '#4b5563', marginBottom: 16, lineHeight: 1.6 }}>
              Now tell Meta where to send your WhatsApp messages. Copy the URL below and paste it in the Meta Developer Console.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Webhook Callback URL — paste this in Meta</label>
              <div style={{ ...codeBlock, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ flex: 1 }}>{webhookUrl}</span>
                <button onClick={() => copy(webhookUrl, 'url')}
                  style={{ background: copied === 'url' ? '#22c55e' : '#334155', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', cursor: 'pointer', flexShrink: 0 }}>
                  {copied === 'url' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Verify Token — paste this in Meta</label>
              <div style={{ ...codeBlock, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ flex: 1 }}>{form.verifyToken}</span>
                <button onClick={() => copy(form.verifyToken, 'token')}
                  style={{ background: copied === 'token' ? '#22c55e' : '#334155', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', cursor: 'pointer', flexShrink: 0 }}>
                  {copied === 'token' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ background: '#f8f9fc', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
              <strong>Steps in Meta Developer Console:</strong><br />
              1. Go to your App → WhatsApp → Configuration<br />
              2. Click <em>"Edit"</em> next to Webhook<br />
              3. Paste the Callback URL above<br />
              4. Paste the Verify Token above<br />
              5. Click <em>"Verify and Save"</em><br />
              6. Under <em>"Webhook Fields"</em>, enable <strong>messages</strong>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button onClick={() => setStep(0)} style={{ padding: '8px 16px', border: '1.5px solid #e4e7ef', borderRadius: 9, background: '#fff', color: '#4b5563', fontSize: 13, cursor: 'pointer' }}>← Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer"
                  style={{ padding: '8px 14px', background: '#f5f6fa', border: '1px solid #e4e7ef', borderRadius: 9, color: '#4b5563', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                  Meta Docs ↗
                </a>
                <button onClick={() => setStep(2)}
                  style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#5b5bd6,#8b5cf6)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Done, Test it →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Test the connection ── */}
        {step === 2 && (
          <div>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>🎉 Almost there!</div>
              <p style={{ fontSize: 12, color: '#166534', margin: 0, lineHeight: 1.6 }}>
                Send a test WhatsApp message to yourself at <strong>+91 8790007228</strong> to confirm everything is working. The message will come from your Business number.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Send test message to this number</label>
              <input
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="918790007228"
                style={inputStyle}
              />
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0' }}>Enter in international format without + (e.g. 918790007228)</p>
            </div>

            {testResult && (
              <div style={{ background: testResult.startsWith('✅') ? '#f0fdf4' : '#fef2f2', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: testResult.startsWith('✅') ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {testResult}
              </div>
            )}

            <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
              <strong>Note:</strong> If you are using a test number (Meta Sandbox), you must add +91 8790007228 as a recipient in Meta → WhatsApp → API Setup → To field. Production numbers don't need this.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={{ padding: '8px 16px', border: '1.5px solid #e4e7ef', borderRadius: 9, background: '#fff', color: '#4b5563', fontSize: 13, cursor: 'pointer' }}>← Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {isConnected && (
                  <button onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}
                    style={{ padding: '8px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Disconnect
                  </button>
                )}
                <button
                  onClick={() => testMut.mutate()}
                  disabled={!testPhone || testMut.isPending}
                  style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !testPhone ? 0.5 : 1 }}
                >
                  {testMut.isPending ? 'Sending…' : '📱 Send Test Message'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const qc = useQueryClient();
  const [tab, setTab]               = useState<'inbox' | 'potential'>('inbox');
  const [selected, setSelected]     = useState<Msg | null>(null);
  const [showSimulate, setShowSimulate] = useState(false);
  const [showWebhook, setShowWebhook]   = useState(false);
  const [simForm, setSimForm]       = useState({ from: '9800000001', senderName: '', content: '' });
  const [convertForm, setConvertForm] = useState({ title: '', productInterest: '', estimatedValue: '' });
  const [showConvert, setShowConvert] = useState(false);
  const [replyText, setReplyText]   = useState('');
  const [bulkMsg, setBulkMsg]       = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────
  const inboxQ = useQuery({
    queryKey: ['inbox'],
    queryFn: () => api.get('/api/v1/messages/inbox?limit=50').then(r => r.data),
    refetchInterval: 15_000,
  });

  const potentialQ = useQuery({
    queryKey: ['potential-leads'],
    queryFn: () => api.get('/api/v1/messages/potential-leads?days=30').then(r => r.data),
    enabled: tab === 'potential',
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/messages/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });

  const simulateMut = useMutation({
    mutationFn: (body: any) => api.post('/api/v1/messages/simulate-whatsapp', body).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['potential-leads'] });
      setShowSimulate(false);
      setSimForm({ from: '9800000001', senderName: '', content: '' });
      if (data.lead) alert(`✅ Lead auto-created for ${data.party.name}! Intent: ${data.aiIntent}`);
      else alert(`📱 Message received from ${data.party.name}. Intent: ${data.aiIntent}. Score: ${data.customerScore}/100`);
    },
  });

  const convertMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api.patch(`/api/v1/messages/${id}/convert-lead`, body).then(r => r.data),
    onSuccess: (lead) => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['potential-leads'] });
      setShowConvert(false);
      setSelected(null);
      alert(`✅ Lead created: ${lead.title}`);
    },
  });

  const replyMut = useMutation({
    mutationFn: ({ messageId, content }: any) =>
      api.post('/api/v1/messages/reply', { messageId, content }).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      setReplyText('');
      if (selected) setSelected({ ...selected, isReplied: true });
      if (data.sendError) alert(`⚠️ Saved but WhatsApp delivery failed:\n${data.sendError}`);
    },
  });

  const bulkConvertMut = useMutation({
    mutationFn: () => api.post('/api/v1/messages/bulk-convert-leads', { minScore: 70 }).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['potential-leads'] });
      setBulkMsg(`✅ ${data.created} leads created from high-score WhatsApp prospects!`);
    },
  });

  const openMessage = (msg: Msg) => {
    setSelected(msg);
    if (!msg.isRead) markRead.mutate(msg.id);
  };

  const unread = inboxQ.data?.data?.filter((m: Msg) => !m.isRead).length || 0;
  const msgs: Msg[] = inboxQ.data?.data || [];
  const hotLeads = potentialQ.data?.data?.filter((pl: PotentialLead) => pl.score >= 70).length || 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'Inter,sans-serif', background: '#f5f6fa' }}>

      {/* ── Left panel ── */}
      <div style={{ width: selected ? '360px' : '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid #e4e7ef', transition: 'width 0.2s' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #f5f6fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>Inbox</h1>
              <p style={{ fontSize: 12, color: '#4b5563', margin: '2px 0 0' }}>
                {unread > 0 ? `${unread} unread` : 'All caught up'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowWebhook(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9, color: '#16a34a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                <WA_ICON /> Connect WA
              </button>
              <button
                onClick={() => setShowSimulate(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <WA_ICON /> Simulate WA
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #f5f6fa' }}>
            {([
              ['inbox', `Messages${unread > 0 ? ` (${unread})` : ''}`],
              ['potential', `🎯 Potential Leads${hotLeads > 0 ? ` (${hotLeads} hot)` : ''}`],
            ] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t as any)} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 500, color: tab === t ? '#5b5bd6' : '#4b5563', borderBottom: tab === t ? '2px solid #5b5bd6' : '2px solid transparent', marginBottom: -2 }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── Inbox tab ── */}
          {tab === 'inbox' && (
            <>
              {inboxQ.isLoading && [...Array(5)].map((_, i) => (
                <div key={i} style={{ margin: '8px 12px', height: 72, background: '#f5f6fa', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
              ))}
              {msgs.map(msg => {
                const im = intentMeta[msg.aiIntent || 'general'] || intentMeta.general;
                const isWA = msg.channel === 'WHATSAPP';
                const isSel = selected?.id === msg.id;
                const cScore = (msg.aiEntities as any)?.customerScore;
                return (
                  <div
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    style={{ display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isSel ? '#f5f3ff' : !msg.isRead ? '#f0f9ff' : 'transparent', borderBottom: '1px solid #f8fafc', borderLeft: isSel ? '3px solid #5b5bd6' : !msg.isRead ? '3px solid #3b82f6' : '3px solid transparent', transition: 'background 0.1s' }}
                  >
                    {/* Icon */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: isWA ? '#dcfce7' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isWA ? <WA_ICON /> : <span style={{ fontSize: 14, color: '#3b82f6' }}>✉</span>}
                    </div>
                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: msg.isRead ? 500 : 700, color: '#1a2235', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {msg.party?.name || msg.fromAddress}
                        </span>
                        {!msg.isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
                        {isWA && cScore >= 70 && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', flexShrink: 0 }}>🔥 HOT</span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: '#4b5563', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.content}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>{fmt(msg.createdAt)}</span>
                        {msg.aiIntent && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: im.bg, color: im.color }}>{im.label}</span>
                        )}
                        {isWA && cScore > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: scoreBg(cScore), color: scoreColor(cScore) }}>{cScore}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!inboxQ.isLoading && msgs.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No messages yet</div>
              )}
            </>
          )}

          {/* ── Potential Leads tab ── */}
          {tab === 'potential' && (
            <>
              <div style={{ padding: '12px 16px', background: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
                <div style={{ fontSize: 12, color: '#166534', marginBottom: 8 }}>
                  <strong>🤖 AI Detection:</strong> WhatsApp messages with buying signals — pricing questions, bulk inquiries, order intent. These are your hot prospects.
                </div>
                {/* Bulk convert button */}
                {potentialQ.data?.data?.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => bulkConvertMut.mutate()}
                      disabled={bulkConvertMut.isPending}
                      style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#16a34a,#15803d)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: bulkConvertMut.isPending ? 0.6 : 1 }}
                    >
                      {bulkConvertMut.isPending ? 'Converting...' : `⚡ Bulk Convert Hot Leads (score ≥70)`}
                    </button>
                    {bulkMsg && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{bulkMsg}</span>}
                  </div>
                )}
              </div>
              {potentialQ.isLoading && (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Analysing messages...</div>
              )}
              {potentialQ.data?.data?.map((pl: PotentialLead) => (
                <div key={pl.phone} style={{ padding: '14px 16px', borderBottom: '1px solid #f8fafc', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2235' }}>{pl.partyName}</span>
                        {!pl.isKnownCustomer && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: '#fefce8', color: '#ca8a04' }}>NEW PROSPECT</span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: '#4b5563', margin: '3px 0 0' }}>{pl.phone} · {pl.messageCount} msg{pl.messageCount > 1 ? 's' : ''}</p>
                    </div>
                    {/* Score ring */}
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: scoreBg(pl.score), border: `2px solid ${scoreColor(pl.score)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor(pl.score) }}>{pl.score}</span>
                    </div>
                  </div>

                  {/* Intent badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {pl.intents.map(intent => {
                      const im2 = intentMeta[intent] || intentMeta.general;
                      return <span key={intent} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: im2.bg, color: im2.color }}>{im2.label}</span>;
                    })}
                  </div>

                  {/* Customer signals */}
                  {pl.customerSignals && pl.customerSignals.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {pl.customerSignals.map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#fefce8', color: '#92400e', border: '1px solid #fde68a' }}>
                          ⚡ {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <p style={{ fontSize: 12, color: '#4b5563', margin: '0 0 8px', fontStyle: 'italic' }}>"{pl.latestMessage.slice(0, 80)}"</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: scoreColor(pl.score), fontWeight: 600 }}>{pl.recommendation}</span>
                    <button
                      onClick={() => {
                        const msg = msgs.find(m => m.fromAddress === pl.phone);
                        if (msg) { setSelected(msg); setShowConvert(true); }
                        else { setTab('inbox'); }
                      }}
                      style={{ padding: '5px 12px', background: 'linear-gradient(135deg,#5b5bd6,#8b5cf6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      + Create Lead
                    </button>
                  </div>
                </div>
              ))}
              {!potentialQ.isLoading && !potentialQ.data?.data?.length && (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
                  <p style={{ fontSize: 13, color: '#4b5563' }}>No potential leads detected yet.</p>
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>Simulate a WhatsApp inquiry above to see AI detection in action.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right detail panel ── */}
      {selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8f9fc', minWidth: 0 }}>
          {/* Detail header */}
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e4e7ef', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1a2235' }}>{selected.party?.name || selected.fromAddress}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: selected.channel === 'WHATSAPP' ? '#dcfce7' : '#eff6ff', color: selected.channel === 'WHATSAPP' ? '#16a34a' : '#2563eb', fontWeight: 700 }}>
                  {selected.channel === 'WHATSAPP' ? '📱 WhatsApp' : '📧 Gmail'}
                </span>
                {selected.aiIntent && (() => { const im = intentMeta[selected.aiIntent] || intentMeta.general; return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: im.bg, color: im.color, fontWeight: 600 }}>{im.label}</span>; })()}
              </div>
              <p style={{ fontSize: 12, color: '#4b5563', margin: '3px 0 0' }}>
                {selected.fromAddress} · {fmt(selected.createdAt)}
                {selected.aiSentiment && <span style={{ marginLeft: 8, color: sentimentColor[selected.aiSentiment] || '#4b5563', fontWeight: 600 }}>● {selected.aiSentiment}</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowConvert(true)} style={{ padding: '7px 14px', background: 'linear-gradient(135deg,#5b5bd6,#8b5cf6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                + Create Lead
              </button>
              <button onClick={() => setSelected(null)} style={{ padding: '7px 10px', background: '#f5f6fa', border: 'none', borderRadius: 8, color: '#4b5563', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          </div>

          {/* Message bubble */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
            <div style={{ maxWidth: 560 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: selected.channel === 'WHATSAPP' ? '#dcfce7' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                  {selected.channel === 'WHATSAPP' ? '📱' : '📧'}
                </div>
                <div>
                  <div style={{ background: '#fff', border: '1px solid #e4e7ef', borderRadius: '0 12px 12px 12px', padding: '12px 16px', fontSize: 14, color: '#1a2235', lineHeight: 1.6, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', maxWidth: 480 }}>
                    {selected.content}
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0 4px' }}>{fmt(selected.createdAt)}</p>
                </div>
              </div>

              {/* AI Extraction panel */}
              {(selected.aiIntent || selected.aiEntities) && (
                <div style={{ background: '#fff', border: '1px solid #e4e7ef', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#5b5bd6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>🤖 AI Analysis</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      ['Intent',    (intentMeta[selected.aiIntent || 'general'] || intentMeta.general).label],
                      ['Sentiment', selected.aiSentiment || '—'],
                      ['Language',  selected.aiLanguage || '—'],
                      ['Score',     `${(selected.aiEntities as any)?.customerScore || 0}/100`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: '#f8f9fc', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{k}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2235', marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {/* Customer signals */}
                  {(selected.aiEntities as any)?.customerSignals?.length > 0 && (
                    <div style={{ marginTop: 10, background: '#fefce8', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#92400e', fontWeight: 700, marginBottom: 4 }}>⚡ BUYING SIGNALS</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(selected.aiEntities as any).customerSignals.map((s: string) => (
                          <span key={s} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fde68a', color: '#78350f', fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selected.aiEntities && Object.keys(selected.aiEntities).some(k => !['customerScore','customerSignals'].includes(k) && (selected.aiEntities as any)[k]) && (
                    <div style={{ marginTop: 8, background: '#f0fdf4', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, marginBottom: 4 }}>EXTRACTED ENTITIES</div>
                      {Object.entries(selected.aiEntities).filter(([k, v]) => !['customerScore','customerSignals'].includes(k) && v).map(([k, v]) => (
                        <div key={k} style={{ fontSize: 12, color: '#1a2235' }}><strong>{k}:</strong> {String(v)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Prospect signal banner */}
              {(selected.aiIntent === 'quote_request' || selected.aiIntent === 'new_customer_inquiry' || selected.aiIntent === 'bulk_inquiry') && (
                <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #86efac', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>🎯 Potential Customer Detected!</div>
                  <p style={{ fontSize: 12, color: '#166534', margin: 0 }}>
                    This person is asking about your products/prices — a strong buying signal. Convert to a lead to track and follow up.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reply box */}
          <div style={{ padding: '16px 24px', background: '#fff', borderTop: '1px solid #e4e7ef' }}>
            {/* Channel indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              {selected.channel === 'WHATSAPP' ? (
                <>
                  <WA_ICON />
                  <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Reply via WhatsApp — sends directly to their phone</span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: '#4b5563' }}>Reply via {selected.channel}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && replyText.trim() && replyMut.mutate({ messageId: selected.id, content: replyText })}
                placeholder={`Type your reply to ${selected.party?.name || selected.fromAddress}...`}
                style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #e4e7ef', borderRadius: 10, fontSize: 13, outline: 'none', background: '#f8f9fc' }}
              />
              <button
                onClick={() => replyText.trim() && replyMut.mutate({ messageId: selected.id, content: replyText })}
                disabled={!replyText.trim() || replyMut.isPending}
                style={{ padding: '10px 18px', background: selected.channel === 'WHATSAPP' ? 'linear-gradient(135deg,#25d366,#128c7e)' : 'linear-gradient(135deg,#5b5bd6,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !replyText.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {replyMut.isPending ? 'Sending…' : <>{selected.channel === 'WHATSAPP' && <WA_ICON />} Send</>}
              </button>
            </div>
            {selected.isReplied && (
              <p style={{ fontSize: 11, color: '#16a34a', margin: '6px 0 0', fontWeight: 600 }}>✓ Replied</p>
            )}
          </div>
        </div>
      )}

      {/* ── Simulate WhatsApp Modal ── */}
      {showSimulate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setShowSimulate(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WA_ICON /></div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1a2235', margin: 0 }}>Simulate WhatsApp Message</h2>
                <p style={{ fontSize: 12, color: '#4b5563', margin: 0 }}>AI will analyse intent, score & auto-create leads</p>
              </div>
            </div>

            {[
              { label: 'Sender Phone', key: 'from', placeholder: '9800000001', hint: 'Unique number = new prospect' },
              { label: 'Sender Name (optional)', key: 'senderName', placeholder: 'e.g. Ravi Gupta' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                <input value={(simForm as any)[f.key]} onChange={e => setSimForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={(f as any).placeholder} style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e4e7ef', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                {(f as any).hint && <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0' }}>{(f as any).hint}</p>}
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message Content</label>
              <textarea value={simForm.content} onChange={e => setSimForm(p => ({ ...p, content: e.target.value }))} placeholder={'Try: "Bhai georgette ka rate kya hai? 500 meter chahiye urgent"\nor: "Hi, I need bulk cotton fabric price list"\nor: "Silk saree ka catalogue bhejo please"'} rows={4} style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e4e7ef', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif' }} />
            </div>

            {/* Quick examples */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 6px', fontWeight: 600 }}>QUICK EXAMPLES:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  'Georgette 4-way ka rate kya hai bhai?',
                  'Need 1000m chiffon ASAP, price?',
                  'Banarasi silk catalogue bhejo',
                  'Maine payment kar diya ₹45000',
                  'Mera order kab aayega?',
                  '500 meter bandhani urgent chahiye, best rate?',
                ].map(ex => (
                  <button key={ex} onClick={() => setSimForm(p => ({ ...p, content: ex }))} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid #e4e7ef', background: '#f8f9fc', color: '#4b5563', cursor: 'pointer' }}>{ex.slice(0, 30)}…</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSimulate(false)} style={{ padding: '9px 18px', border: '1.5px solid #e4e7ef', borderRadius: 10, background: '#fff', color: '#4b5563', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => simulateMut.mutate(simForm)} disabled={!simForm.from || !simForm.content || simulateMut.isPending} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!simForm.from || !simForm.content) ? 0.5 : 1 }}>
                {simulateMut.isPending ? 'Sending...' : '📱 Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WhatsApp Setup Wizard ── */}
      {showWebhook && (
        <WaSetupWizard
          onClose={() => setShowWebhook(false)}
          onConnected={() => { setShowWebhook(false); qc.invalidateQueries({ queryKey: ['inbox'] }); }}
        />
      )}

      {/* ── Convert to Lead Modal ── */}
      {showConvert && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setShowConvert(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1a2235', margin: '0 0 6px' }}>Convert to Lead</h2>
            <p style={{ fontSize: 12, color: '#4b5563', margin: '0 0 20px' }}>From: <strong>{selected.party?.name || selected.fromAddress}</strong> via {selected.channel}</p>

            {[
              { label: 'Lead Title', key: 'title', placeholder: `${selected.party?.name || ''} — ${(intentMeta[selected.aiIntent || 'general'] || intentMeta.general).label}` },
              { label: 'Product Interest', key: 'productInterest', placeholder: (selected.aiEntities as any)?.product || 'e.g. Georgette 4-Way' },
              { label: 'Estimated Value (₹)', key: 'estimatedValue', placeholder: '50000' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                <input value={(convertForm as any)[f.key]} onChange={e => setConvertForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e4e7ef', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConvert(false)} style={{ padding: '9px 18px', border: '1.5px solid #e4e7ef', borderRadius: 10, background: '#fff', color: '#4b5563', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => convertMut.mutate({ id: selected.id, body: { ...convertForm, estimatedValue: convertForm.estimatedValue ? parseFloat(convertForm.estimatedValue) : undefined } })}
                disabled={convertMut.isPending}
                style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#5b5bd6,#8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {convertMut.isPending ? 'Creating...' : '🎯 Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
