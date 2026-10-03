import { useState, useEffect, useCallback } from 'react';
import {
  Settings, MessageSquare, Mail, Shield, User, CheckCircle,
  XCircle, AlertCircle, Eye, EyeOff, RefreshCw, Trash2, Save,
  Users, Plus, Pencil, UserCheck, UserX,
} from 'lucide-react';
import api from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';

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
  const { canConfigureIntegrations } = usePermissions();
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

      {!canConfigureIntegrations ? (
        // Read-only view for STAFF / ACCOUNTANT / READONLY
        <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
          {isConnected
            ? <>WhatsApp is connected to <strong style={{ color: '#111827' }}>{status?.config?.displayPhone || 'your team number'}</strong>. Messages are synced automatically.</>
            : 'WhatsApp has not been configured yet. Contact your Owner or Manager to connect a WhatsApp Business account.'}
        </div>
      ) : (
        // Configure view — OWNER + MANAGER only
        <>
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

function GmailSection({ gmailStatus, onRefresh }: {
  gmailStatus: GmailStatus | null;
  onRefresh: () => void;
}) {
  const { canConfigureIntegrations } = usePermissions();
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const connectGmail = async () => {
    setConnecting(true);
    setMsg(null);
    try {
      const res = await api.get('/api/v1/integrations/gmail/connect');
      window.location.href = res.data.url;
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error || 'Could not start Gmail OAuth.' });
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

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={18} color="#d97706" />
          </div>
          <div>
            <div style={S.sectionTitle}>Gmail</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
              {canConfigureIntegrations
                ? 'Connect your team Gmail to sync emails for all members'
                : 'Gmail inbox for this team'}
            </div>
          </div>
        </div>
        <StatusBadge
          active={!!isConnected}
          label={isConnected
            ? `Connected${gmailStatus?.config?.email ? `: ${gmailStatus.config.email}` : ''}`
            : 'Not configured'}
        />
      </div>

      <div style={S.divider} />

      {msg && <Alert type={msg.type} message={msg.text} />}

      {/* Read-only status for non-configurators */}
      {!canConfigureIntegrations && (
        <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
          {isConnected
            ? <>Gmail is connected to <strong style={{ color: '#111827' }}>{gmailStatus?.config?.email || 'your team account'}</strong>. Emails are synced automatically.</>
            : 'Gmail has not been configured yet. Contact your Owner or Manager to connect a Gmail account.'}
        </div>
      )}

      {/* Configure buttons — OWNER + MANAGER only */}
      {canConfigureIntegrations && (
        <>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>
            {isConnected
              ? `Inbox is connected to ${gmailStatus?.config?.email}. All team members can see synced emails. Click Reconnect to switch accounts.`
              : 'Connect your Gmail account. Once connected, all team members in this group will see synced emails.'}
          </div>
          <div style={S.btnRow}>
            <button style={S.btnPrimary} onClick={connectGmail} disabled={connecting}>
              <Mail size={14} />{connecting ? 'Opening Google…' : isConnected ? 'Reconnect Gmail' : 'Connect Gmail'}
            </button>
            {isConnected && (
              <button style={S.btnDanger} onClick={disconnectGmail}>
                <Trash2 size={14} />Disconnect Gmail
              </button>
            )}
          </div>
        </>
      )}
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
        Only the team <strong>Owner</strong> or <strong>Manager</strong> can access this section.
      </div>
    </div>
  );
}

// ── Team / User Management Section ───────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner', MANAGER: 'Manager', ACCOUNTANT: 'Accountant',
  STAFF: 'Staff', READONLY: 'Read-only',
};
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  OWNER:      { bg: '#ede9fe', color: '#5b21b6' },
  MANAGER:    { bg: '#dbeafe', color: '#1e40af' },
  ACCOUNTANT: { bg: '#d1fae5', color: '#065f46' },
  STAFF:      { bg: '#fef3c7', color: '#92400e' },
  READONLY:   { bg: '#f3f4f6', color: '#374151' },
};

interface TeamUser {
  id: string; name: string; phone: string; email?: string;
  role: string; isActive: boolean; lastLoginAt?: string | null;
  group?: { id: string; name: string } | null;
}

function TeamSection({ callerRole }: { callerRole: string }) {
  const { canWriteUsers, canDeleteUsers, isOwnerOrAbove } = usePermissions();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', role: 'STAFF' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/users');
      setUsers(res.data.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditUser(null); setForm({ name: '', phone: '', email: '', password: '', role: 'STAFF' }); setShowAdd(true); };
  const openEdit = (u: TeamUser) => {
    setEditUser(u);
    setForm({ name: u.name, phone: u.phone ?? '', email: u.email ?? '', password: '', role: u.role });
    setShowAdd(true);
  };

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      if (editUser) {
        const payload: any = { name: form.name, email: form.email || undefined, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/api/v1/users/${editUser.id}`, payload);
      } else {
        await api.post('/api/v1/users', form);
      }
      setMsg({ type: 'success', text: editUser ? 'User updated.' : 'User created successfully.' });
      setShowAdd(false); setEditUser(null);
      load();
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.error || 'Save failed.' });
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (u: TeamUser) => {
    if (!confirm(`${u.isActive ? 'Deactivate' : 'Reactivate'} ${u.name}?`)) return;
    try {
      await api.put(`/api/v1/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed.'); }
  };

  const ASSIGNABLE_ROLES = isOwnerOrAbove
    ? ['MANAGER', 'ACCOUNTANT', 'STAFF', 'READONLY']
    : ['ACCOUNTANT', 'STAFF', 'READONLY'];

  const iBtn = (bg: string, color: string) => ({
    padding: '5px 8px', borderRadius: '7px', border: `1px solid ${bg}`,
    background: bg, color, cursor: 'pointer', display: 'flex', alignItems: 'center',
    fontSize: '12px', fontFamily: 'inherit', gap: '4px',
  });

  return (
    <div>
      {msg && <Alert type={msg.type} message={msg.text} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Team Members</div>
        {canWriteUsers && (
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#5b5bd6', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={14} /> Add Member
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: '13px', padding: '16px 0' }}>Loading team…</div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f7f8fa' }}>
                {['Name', 'Phone', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', fontSize: '12px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = ROLE_COLORS[u.role] ?? ROLE_COLORS.STAFF;
                const isOwner = u.role === 'OWNER';
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f0f1f5' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1f2328' }}>{u.name}</div>
                      {u.email && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{u.email}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#4b5563' }}>{u.phone}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ ...rc, display: 'inline-block', borderRadius: '5px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 700 }}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: u.isActive ? '#16a34a' : '#9ca3af' }}>
                        {u.isActive ? <UserCheck size={13} /> : <UserX size={13} />}
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: '12px' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {!isOwner && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {canWriteUsers && (
                            <button style={iBtn('#ede9fe', '#5b21b6')} onClick={() => openEdit(u)} title="Edit">
                              <Pencil size={12} />
                            </button>
                          )}
                          {canDeleteUsers && (
                            <button
                              style={iBtn(u.isActive ? '#fef2f2' : '#f0fdf4', u.isActive ? '#ef4444' : '#16a34a')}
                              onClick={() => handleDeactivate(u)}
                              title={u.isActive ? 'Deactivate' : 'Reactivate'}
                            >
                              {u.isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setMsg(null); } }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{editUser ? 'Edit Member' : 'Add Team Member'}</div>
            </div>
            {msg && <Alert type={msg.type} message={msg.text} />}
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Full Name *</label>
                <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rajesh Kumar" />
              </div>
              {!editUser && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Phone (used to login) *</label>
                  <input style={S.input} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
              )}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Email</label>
                <input style={S.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="rajesh@company.com" />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input style={S.input} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' }}>Role *</label>
                <select style={{ ...S.input, cursor: 'pointer' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  {form.role === 'MANAGER' && 'Can add/edit/delete most data. Cannot change integrations.'}
                  {form.role === 'ACCOUNTANT' && 'Can record payments and view reports. Cannot add/delete products or parties.'}
                  {form.role === 'STAFF' && 'Can create invoices, add parties, record stock. Cannot delete.'}
                  {form.role === 'READONLY' && 'Can only view data. Cannot create or modify anything.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button style={{ padding: '8px 18px', borderRadius: '8px', border: '1.5px solid #e4e7ef', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }} onClick={() => { setShowAdd(false); setMsg(null); }}>Cancel</button>
              <button
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#5b5bd6', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', opacity: saving || !form.name.trim() || (!editUser && !form.phone.trim()) || (!editUser && !form.password) ? 0.6 : 1 }}
                onClick={handleSave}
                disabled={saving || !form.name.trim() || (!editUser && !form.phone.trim()) || (!editUser && !form.password)}
              >
                {saving ? 'Saving…' : editUser ? 'Save Changes' : 'Create Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const { canViewIntegrations, canConfigureIntegrations, canViewUsers } = usePermissions();
  const [tab, setTab] = useState<'integrations' | 'profile' | 'team'>('integrations');
  const [waStatus, setWaStatus] = useState<WaStatus | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [appCreds, setAppCreds] = useState<AppCreds | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthMsg, setOauthMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    if (!canViewIntegrations) return;
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
  }, [canViewIntegrations]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={S.page}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Settings size={20} color="#111827" />
          <h1 style={S.heading}>Settings</h1>
        </div>
        <p style={S.subheading}>Manage integrations, team members, and your account profile</p>
      </div>

      <div style={S.tabs}>
        {canViewIntegrations && <Tab label="Integrations" active={tab === 'integrations'} onClick={() => setTab('integrations')} />}
        {canViewUsers && <Tab label="Team" active={tab === 'team'} onClick={() => setTab('team')} />}
        <Tab label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
      </div>

      <div style={{ maxWidth: '720px' }}>
        {tab === 'integrations' && (
          canViewIntegrations ? (
            loading ? (
              <div style={{ color: '#9ca3af', fontSize: '13px', padding: '24px 0' }}>Loading integration status…</div>
            ) : (
              <>
                {oauthMsg && <Alert type={oauthMsg.type} message={oauthMsg.text} />}
                <WhatsAppSection status={waStatus} onRefresh={load} />
                <GmailSection gmailStatus={gmailStatus} onRefresh={load} />
              </>
            )
          ) : (
            <AccessDenied />
          )
        )}

        {tab === 'team' && (
          canViewUsers ? <TeamSection callerRole={user?.role ?? ''} /> : <AccessDenied />
        )}

        {tab === 'profile' && <ProfileSection />}
      </div>
    </div>
  );
}
