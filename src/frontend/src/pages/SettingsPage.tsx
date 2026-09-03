import { useState, useEffect, useCallback } from 'react';
import {
  Settings, MessageSquare, Mail, Shield, User, CheckCircle,
  XCircle, AlertCircle, Eye, EyeOff, RefreshCw, Trash2, Save,
} from 'lucide-react';
import api from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaStatus {
  isActive: boolean;
  config?: {
    displayPhone?: string;
    phoneNumberId?: string;
    wabaId?: string;
    hasToken?: boolean;
    hasAppSecret?: boolean;
    verifyToken?: string;
  };
}

interface GmailStatus {
  isActive: boolean;
  config?: { email?: string; googleClientId?: string };
  lastSyncAt?: string | null;
  syncStatus?: string | null;
}

interface AppCreds {
  googleClientId: string;
  googleRedirectUri: string;
  hasClientSecret: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const S = {
  // Layout
  page: { padding: '28px 32px', background: '#f5f6fa', minHeight: '100vh', fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif" } as React.CSSProperties,
  heading: { fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.03em' } as React.CSSProperties,
  subheading: { fontSize: '13px', color: '#9ca3af', marginTop: '3px', margin: '3px 0 0' } as React.CSSProperties,
  tabs: { display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e4e7ef', paddingBottom: '0' } as React.CSSProperties,
  card: { background: '#fff', borderRadius: '14px', border: '1px solid #e4e7ef', padding: '24px 28px', marginBottom: '16px' } as React.CSSProperties,
  sectionTitle: { fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '4px', letterSpacing: '-0.02em' } as React.CSSProperties,
  sectionDesc: { fontSize: '12.5px', color: '#9ca3af', marginBottom: '20px' } as React.CSSProperties,
  label: { fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' } as React.CSSProperties,
  input: {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '13px', color: '#111827',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
    fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif",
    transition: 'border-color 0.15s',
  } as React.CSSProperties,
  inputGroup: { marginBottom: '14px' } as React.CSSProperties,
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' } as React.CSSProperties,
  // Buttons
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    padding: '9px 18px', borderRadius: '8px', border: 'none',
    background: '#111827', color: '#fff', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', fontFamily: "inherit",
  } as React.CSSProperties,
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    padding: '8px 16px', borderRadius: '8px', border: '1px solid #e4e7ef',
    background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', fontFamily: "inherit",
  } as React.CSSProperties,
  btnDanger: {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    padding: '8px 16px', borderRadius: '8px', border: '1px solid #fca5a5',
    background: '#fff5f5', color: '#dc2626', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', fontFamily: "inherit",
  } as React.CSSProperties,
  btnRow: { display: 'flex', gap: '10px', marginTop: '18px', alignItems: 'center' } as React.CSSProperties,
  // Status badge
  badge: (active: boolean) => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 600,
    background: active ? '#ecfdf5' : '#f9fafb',
    color: active ? '#059669' : '#9ca3af',
    border: `1px solid ${active ? '#a7f3d0' : '#e4e7ef'}`,
  } as React.CSSProperties),
  // Alerts
  alert: (type: 'success' | 'error' | 'info') => ({
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '12px 16px', borderRadius: '10px', fontSize: '12.5px', marginBottom: '14px',
    background: type === 'success' ? '#ecfdf5' : type === 'error' ? '#fef2f2' : '#eff6ff',
    color: type === 'success' ? '#065f46' : type === 'error' ? '#991b1b' : '#1d4ed8',
    border: `1px solid ${type === 'success' ? '#a7f3d0' : type === 'error' ? '#fca5a5' : '#bfdbfe'}`,
  } as React.CSSProperties),
  divider: { borderTop: '1px solid #f3f4f6', margin: '20px 0' } as React.CSSProperties,
};

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
        fontSize: '13px', fontWeight: active ? 700 : 500,
        color: active ? '#111827' : '#9ca3af',
        borderBottom: active ? '2px solid #111827' : '2px solid transparent',
        marginBottom: '-1px', fontFamily: "inherit", transition: 'color 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span style={S.badge(active)}>
      {active ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {label ?? (active ? 'Connected' : 'Not connected')}
    </span>
  );
}

function Alert({ type, message }: { type: 'success' | 'error' | 'info'; message: string }) {
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : AlertCircle;
  return (
    <div style={S.alert(type)}>
      <Icon size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span>{message}</span>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ''}
        style={{ ...S.input, paddingRight: '38px' }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          border: 'none', background: 'none', cursor: 'pointer', padding: '2px', color: '#9ca3af',
        }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// ── WhatsApp Section ──────────────────────────────────────────────────────────

function WhatsAppSection({ status, onRefresh }: { status: WaStatus | null; onRefresh: () => void }) {
  const [form, setForm] = useState({
    displayPhone: '', phoneNumberId: '', wabaId: '',
    accessToken: '', appSecret: '', verifyToken: '',
  });
  const [testPhone, setTestPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const isConnected = status?.isActive;

  const save = async () => {
    if (!form.phoneNumberId || !form.wabaId || !form.accessToken) {
      setMsg({ type: 'error', text: 'Phone Number ID, WABA ID, and Access Token are required.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.post('/api/v1/integrations/whatsapp/setup', form);
      setMsg({ type: 'success', text: 'WhatsApp connected successfully! Test it below.' });
      onRefresh();
      setForm(f => ({ ...f, accessToken: '', appSecret: '' })); // clear sensitive on success
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to save WhatsApp credentials.' });
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect WhatsApp? Messages will stop syncing.')) return;
    try {
      await api.delete('/api/v1/integrations/whatsapp/disconnect');
      setMsg({ type: 'info', text: 'WhatsApp disconnected.' });
      onRefresh();
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to disconnect.' });
    }
  };

  const test = async () => {
    if (!testPhone) { setMsg({ type: 'error', text: 'Enter a phone number to test.' }); return; }
    setTesting(true);
    setMsg(null);
    try {
      const res = await api.post('/api/v1/integrations/whatsapp/test', { toPhone: testPhone });
      setMsg({ type: 'success', text: res.data.message || 'Test message sent!' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error || 'Test failed.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={18} color="#16a34a" />
          </div>
          <div>
            <div style={S.sectionTitle}>WhatsApp Business</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Meta Cloud API — per-team number</div>
          </div>
        </div>
        <StatusBadge active={!!isConnected} />
      </div>

      {isConnected && status?.config && (
        <div style={{ ...S.alert('info'), marginTop: '14px', marginBottom: '0' }}>
          <CheckCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            Connected: <strong>{status.config.displayPhone || status.config.phoneNumberId}</strong>
            {status.config.verifyToken && <> · Verify token: <code style={{ fontSize: '11px' }}>{status.config.verifyToken}</code></>}
          </span>
        </div>
      )}

      <div style={S.divider} />
      <div style={{ ...S.sectionDesc, marginBottom: '16px' }}>
        Enter your Meta Cloud API credentials below. These are stored securely in the database and used only for this team's account.
        Get them from <strong>developers.facebook.com → Your App → WhatsApp → API Setup</strong>.
      </div>

      {msg && <Alert type={msg.type} message={msg.text} />}

      <div style={S.row}>
        <div style={S.inputGroup}>
          <label style={S.label}>Display Phone Number</label>
          <input style={S.input} value={form.displayPhone} onChange={e => setForm(f => ({ ...f, displayPhone: e.target.value }))} placeholder="+91 87900 07228" />
        </div>
        <div style={S.inputGroup}>
          <label style={S.label}>Phone Number ID <span style={{ color: '#ef4444' }}>*</span></label>
          <input style={S.input} value={form.phoneNumberId} onChange={e => setForm(f => ({ ...f, phoneNumberId: e.target.value }))} placeholder="123456789012345" />
        </div>
      </div>
      <div style={S.inputGroup}>
        <label style={S.label}>WhatsApp Business Account ID (WABA ID) <span style={{ color: '#ef4444' }}>*</span></label>
        <input style={S.input} value={form.wabaId} onChange={e => setForm(f => ({ ...f, wabaId: e.target.value }))} placeholder="987654321098765" />
      </div>
      <div style={S.inputGroup}>
        <label style={S.label}>Access Token <span style={{ color: '#ef4444' }}>*</span></label>
        <PasswordInput value={form.accessToken} onChange={v => setForm(f => ({ ...f, accessToken: v }))} placeholder="EAAxxxxxxxx — permanent system user token" />
      </div>
      <div style={S.row}>
        <div style={S.inputGroup}>
          <label style={S.label}>App Secret</label>
          <PasswordInput value={form.appSecret} onChange={v => setForm(f => ({ ...f, appSecret: v }))} placeholder="Meta App Secret (for webhook sig)" />
        </div>
        <div style={S.inputGroup}>
          <label style={S.label}>Webhook Verify Token</label>
          <input style={S.input} value={form.verifyToken} onChange={e => setForm(f => ({ ...f, verifyToken: e.target.value }))} placeholder="gspaces-wa-token" />
        </div>
      </div>

      <div style={S.btnRow}>
        <button style={S.btnPrimary} onClick={save} disabled={saving}>
          <Save size={14} />{saving ? 'Saving…' : 'Save & Connect'}
        </button>
        {isConnected && (
          <button style={S.btnDanger} onClick={disconnect}>
            <Trash2 size={14} />Disconnect
          </button>
        )}
      </div>

      {isConnected && (
        <>
          <div style={S.divider} />
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>Send Test Message</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              style={{ ...S.input, maxWidth: '260px' }}
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="91XXXXXXXXXX (with country code)"
            />
            <button style={S.btnGhost} onClick={test} disabled={testing}>
              <RefreshCw size={13} />{testing ? 'Sending…' : 'Send Test'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Gmail / Google OAuth Section ──────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{
        padding: '5px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
        background: copied ? '#ecfdf5' : '#f9fafb', color: copied ? '#059669' : '#374151',
        fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        flexShrink: 0, whiteSpace: 'nowrap',
      }}
    >{copied ? '✓ Copied' : 'Copy'}</button>
  );
}

function GmailSection({ gmailStatus, appCreds, onRefresh }: {
  gmailStatus: GmailStatus | null;
  appCreds: AppCreds | null;
  onRefresh: () => void;
}) {
  const [form, setForm] = useState({ googleClientId: '', googleClientSecret: '' });
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // The redirect URI is always driven by the server — read-only in the UI
  const redirectUri = appCreds?.googleRedirectUri || 'http://localhost:3001/api/v1/integrations/gmail/callback';

  useEffect(() => {
    if (appCreds) {
      setForm(f => ({ ...f, googleClientId: appCreds.googleClientId || '' }));
    }
  }, [appCreds]);

  const saveCredentials = async () => {
    if (!form.googleClientId) {
      setMsg({ type: 'error', text: 'Client ID is required.' });
      return;
    }
    if (!form.googleClientSecret && !appCreds?.hasClientSecret) {
      setMsg({ type: 'error', text: 'Client Secret is required (not yet saved for this team).' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      // Send blank secret when keeping existing — backend handles the merge
      const res = await api.put('/api/v1/integrations/app-credentials', {
        googleClientId: form.googleClientId,
        googleClientSecret: form.googleClientSecret || undefined,
      });
      setMsg({ type: 'success', text: 'Credentials saved. Make sure the Redirect URI above is registered in Google Cloud Console, then click Connect Gmail.' });
      onRefresh();
      setForm(f => ({ ...f, googleClientSecret: '' }));
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to save credentials.' });
    } finally {
      setSaving(false);
    }
  };

  const connectGmail = async () => {
    setConnecting(true);
    setMsg(null);
    try {
      const res = await api.get('/api/v1/integrations/gmail/connect');
      window.location.href = res.data.url;
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error || 'Could not start Gmail OAuth. Save credentials first.' });
      setConnecting(false);
    }
  };

  const disconnectGmail = async () => {
    if (!window.confirm('Disconnect Gmail? Inbox sync will stop.')) return;
    try {
      await api.delete('/api/v1/integrations/gmail/disconnect');
      setMsg({ type: 'info', text: 'Gmail disconnected.' });
      onRefresh();
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to disconnect.' });
    }
  };

  const isConnected = gmailStatus?.isActive;
  const hasCreds = !!(appCreds?.googleClientId);

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={18} color="#d97706" />
          </div>
          <div>
            <div style={S.sectionTitle}>Gmail</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Google OAuth 2.0 — one Gmail account per team</div>
          </div>
        </div>
        <StatusBadge active={!!isConnected} label={isConnected ? `Connected: ${gmailStatus?.config?.email || 'Gmail'}` : 'Not connected'} />
      </div>

      <div style={S.divider} />

      {/* ── Redirect URI — must be registered in Google Cloud Console ── */}
      <div style={{
        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
        padding: '14px 16px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>
          ⚠ Step 0 — Register this Redirect URI in Google Cloud Console first
        </div>
        <div style={{ fontSize: '11.5px', color: '#78350f', marginBottom: '10px', lineHeight: 1.6 }}>
          Go to <strong>console.cloud.google.com → APIs &amp; Services → Credentials → your OAuth 2.0 Client →
          Authorised redirect URIs</strong> and add the exact URI below. This must match character-for-character
          or Google will show "Access blocked: Authorization Error".
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <code style={{
            flex: 1, background: '#fff', border: '1px solid #fcd34d', borderRadius: '6px',
            padding: '7px 12px', fontSize: '12.5px', color: '#1f2937', wordBreak: 'break-all',
          }}>{redirectUri}</code>
          <CopyButton text={redirectUri} />
        </div>
      </div>

      {/* Step 1: Google OAuth App credentials */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: hasCreds ? '#ecfdf5' : '#f3f4f6', color: hasCreds ? '#059669' : '#9ca3af', fontSize: '11px', fontWeight: 700 }}>1</span>
          Paste your Google Cloud OAuth client credentials
          {hasCreds && <StatusBadge active={true} label="Saved" />}
        </div>
        {msg && <Alert type={msg.type} message={msg.text} />}
        <div style={S.inputGroup}>
          <label style={S.label}>Client ID <span style={{ color: '#ef4444' }}>*</span></label>
          <input style={S.input} value={form.googleClientId} onChange={e => setForm(f => ({ ...f, googleClientId: e.target.value }))} placeholder="xxxxxxx.apps.googleusercontent.com" />
        </div>
        <div style={S.inputGroup}>
          <label style={S.label}>
            Client Secret <span style={{ color: '#ef4444' }}>*</span>
            {appCreds?.hasClientSecret && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#059669', fontWeight: 500 }}>✓ already saved — leave blank to keep</span>}
          </label>
          <PasswordInput
            value={form.googleClientSecret}
            onChange={v => setForm(f => ({ ...f, googleClientSecret: v }))}
            placeholder={appCreds?.hasClientSecret ? '(leave blank to keep existing secret)' : 'GOCSPX-xxxxxxxx'}
          />
        </div>
        <button style={S.btnPrimary} onClick={saveCredentials} disabled={saving}>
          <Save size={14} />{saving ? 'Saving…' : 'Save Credentials'}
        </button>
      </div>

      <div style={S.divider} />

      {/* Step 2: Connect Gmail account */}
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#374151', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: isConnected ? '#ecfdf5' : '#f3f4f6', color: isConnected ? '#059669' : '#9ca3af', fontSize: '11px', fontWeight: 700 }}>2</span>
          Authorize the Gmail account for this team
          {isConnected && gmailStatus?.config?.email && <StatusBadge active={true} label={gmailStatus.config.email} />}
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '14px', marginLeft: '28px' }}>
          {isConnected
            ? `Inbox is connected to ${gmailStatus?.config?.email}. Click Reconnect to switch accounts.`
            : 'After saving credentials and registering the redirect URI, click Connect Gmail.'}
        </div>
        <div style={S.btnRow}>
          <button style={S.btnPrimary} onClick={connectGmail} disabled={connecting || !hasCreds}>
            <Mail size={14} />{connecting ? 'Opening Google…' : isConnected ? 'Reconnect Gmail' : 'Connect Gmail'}
          </button>
          {isConnected && (
            <button style={S.btnDanger} onClick={disconnectGmail}>
              <Trash2 size={14} />Disconnect Gmail
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Profile Section ───────────────────────────────────────────────────────────

function ProfileSection() {
  const user = useAuthStore(s => s.user);
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={18} color="#7c3aed" />
        </div>
        <div>
          <div style={S.sectionTitle}>Your Account</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>Login and role information</div>
        </div>
      </div>
      <div style={S.divider} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {[
          { label: 'Name', value: user?.name },
          { label: 'Phone', value: user?.phone },
          { label: 'Role', value: user?.role },
          { label: 'Team', value: user?.tenant?.name },
          { label: 'Plan', value: user?.tenant?.plan },
          { label: 'Group', value: user?.group?.name || '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '13.5px', color: '#111827', fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Access Denied ─────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div style={{ ...S.card, textAlign: 'center', padding: '48px 32px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Shield size={22} color="#dc2626" />
      </div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Access Restricted</div>
      <div style={{ fontSize: '13px', color: '#9ca3af', maxWidth: '320px', margin: '0 auto', lineHeight: 1.6 }}>
        Only the team <strong>Owner</strong> or <strong>Manager</strong> can configure integrations. Contact your admin to update credentials.
      </div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState<'integrations' | 'profile'>('integrations');
  const [waStatus, setWaStatus] = useState<WaStatus | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [appCreds, setAppCreds] = useState<AppCreds | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthMsg, setOauthMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'OWNER' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  // Handle Gmail OAuth redirect result (?connected=1 or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      window.history.replaceState({}, '', '/settings');
      setTab('integrations');
      setOauthMsg({ type: 'success', text: 'Gmail connected successfully!' });
    } else if (params.get('error')) {
      window.history.replaceState({}, '', '/settings');
      setTab('integrations');
      setOauthMsg({ type: 'error', text: `Gmail OAuth error: ${decodeURIComponent(params.get('error')!)}` });
    }
  }, []);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [statusRes, credsRes] = await Promise.all([
        api.get('/api/v1/integrations/status'),
        api.get('/api/v1/integrations/app-credentials'),
      ]);
      setWaStatus(statusRes.data.whatsapp);
      setGmailStatus(statusRes.data.gmail);
      setAppCreds(credsRes.data);
    } catch {
      // ignore — UI shows disconnected state
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={S.page}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Settings size={20} color="#111827" />
          <h1 style={S.heading}>Settings</h1>
        </div>
        <p style={S.subheading}>Configure integrations and view your account — credentials are stored per team, not in .env</p>
      </div>

      <div style={S.tabs}>
        <Tab label="Integrations" active={tab === 'integrations'} onClick={() => setTab('integrations')} />
        <Tab label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
      </div>

      <div style={{ maxWidth: '720px' }}>
        {tab === 'integrations' && (
          isAdmin ? (
            loading ? (
              <div style={{ color: '#9ca3af', fontSize: '13px', padding: '24px 0' }}>Loading integration status…</div>
            ) : (
              <>
                {oauthMsg && <Alert type={oauthMsg.type} message={oauthMsg.text} />}
                <WhatsAppSection status={waStatus} onRefresh={load} />
                <GmailSection gmailStatus={gmailStatus} appCreds={appCreds} onRefresh={load} />
              </>
            )
          ) : (
            <AccessDenied />
          )
        )}

        {tab === 'profile' && <ProfileSection />}
      </div>
    </div>
  );
}
