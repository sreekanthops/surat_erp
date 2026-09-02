import { useState, useEffect, useCallback } from 'react';
import api from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import {
  Users, Shield, Plus, Pencil, Trash2, ToggleLeft,
  ToggleRight, X, Check, ChevronDown, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Group {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  _count: { users: number };
  users: UserSummary[];
}

interface UserSummary {
  id: string;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
}

interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  groupId?: string;
  group?: { id: string; name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLES = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'STAFF', 'READONLY'] as const;
const ROLE_COLORS: Record<string, string> = {
  OWNER:       '#6366f1',
  MANAGER:     '#0ea5e9',
  ACCOUNTANT:  '#10b981',
  STAFF:       '#f59e0b',
  READONLY:    '#94a3b8',
  SUPER_ADMIN: '#ef4444',
};

const badge = (label: string, color: string) => (
  <span style={{
    display: 'inline-block', padding: '2px 10px', borderRadius: '20px',
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
    background: color + '22', color,
  }}>{label}</span>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '100%',
        maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9',
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0',
  borderRadius: '8px', fontSize: '14px', color: '#0f172a',
  background: '#f8fafc', outline: 'none', boxSizing: 'border-box',
};

function Btn({ children, onClick, variant = 'primary', disabled, style }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const bg = variant === 'primary' ? '#6366f1' : variant === 'danger' ? '#ef4444' : 'transparent';
  const color = variant === 'ghost' ? '#64748b' : '#fff';
  const border = variant === 'ghost' ? '1.5px solid #e2e8f0' : 'none';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '9px 16px', borderRadius: '8px', fontSize: '13px',
        fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#e2e8f0' : bg, color: disabled ? '#94a3b8' : color,
        border, transition: 'opacity 0.15s', ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      background: '#fef2f2', border: '1px solid #fecaca',
      borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
      fontSize: '13px', color: '#dc2626',
    }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} />
      {message}
    </div>
  );
}

// ─── User Form Modal ──────────────────────────────────────────────────────────

function UserFormModal({
  user, groups, onClose, onSaved,
}: {
  user?: AdminUser;
  groups: Group[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'STAFF',
    groupId: user?.groupId ?? '',
    isActive: user?.isActive ?? true,
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setErr('');
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        role: form.role,
        groupId: form.groupId || null,
        isActive: form.isActive,
      };
      if (!isEdit || form.password) payload.password = form.password;
      if (isEdit) {
        await api.put(`/api/v1/admin/users/${user!.id}`, payload);
      } else {
        await api.post('/api/v1/admin/users', payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit User' : 'Create User'} onClose={onClose}>
      {err && <ErrorBanner message={err} />}
      <Field label="Full Name">
        <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ramesh Shah" />
      </Field>
      <Field label="Phone">
        <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" />
      </Field>
      <Field label="Email (optional)">
        <input style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
      </Field>
      <Field label={isEdit ? 'New Password (leave blank to keep current)' : 'Password'}>
        <input style={inputStyle} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Role">
          <div style={{ position: 'relative' }}>
            <select
              style={{ ...inputStyle, appearance: 'none', paddingRight: '32px' }}
              value={form.role}
              onChange={e => set('role', e.target.value)}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
          </div>
        </Field>
        <Field label="Group (optional)">
          <div style={{ position: 'relative' }}>
            <select
              style={{ ...inputStyle, appearance: 'none', paddingRight: '32px' }}
              value={form.groupId}
              onChange={e => set('groupId', e.target.value)}
            >
              <option value="">— No group —</option>
              {groups.filter(g => g.isActive).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
          </div>
        </Field>
      </div>
      {isEdit && (
        <Field label="Status">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
            <span style={{ fontSize: '13px', color: '#374151' }}>Active</span>
          </label>
        </Field>
      )}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={saving || !form.name || !form.phone || (!isEdit && !form.password)}>
          <Check size={14} />
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── Group Form Modal ─────────────────────────────────────────────────────────

function GroupFormModal({
  group, onClose, onSaved,
}: {
  group?: Group;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!group;
  const [form, setForm] = useState({
    name: group?.name ?? '',
    description: group?.description ?? '',
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErr('');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/api/v1/admin/groups/${group!.id}`, form);
      } else {
        await api.post('/api/v1/admin/groups', form);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit Group' : 'Create Group'} onClose={onClose}>
      {err && <ErrorBanner message={err} />}
      <Field label="Group Name">
        <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sales Team" />
      </Field>
      <Field label="Description (optional)">
        <input style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe this group…" />
      </Field>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={saving || !form.name}>
          <Check size={14} />
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ users, groups, reload }: { users: AdminUser[]; groups: Group[]; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [delConfirm, setDelConfirm] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const toggleActive = async (u: AdminUser) => {
    try {
      await api.patch(`/api/v1/admin/users/${u.id}/toggle-active`);
      reload();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Failed to update user');
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await api.delete(`/api/v1/admin/users/${id}`);
      setDelConfirm(null);
      reload();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Failed to delete user');
    }
  };

  return (
    <div>
      {err && <ErrorBanner message={err} />}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <Btn onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Add User
        </Btn>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Name', 'Phone', 'Role', 'Group', 'Status', 'Last Login', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f1f5f9' : 'none', background: u.isActive ? 'transparent' : '#fafafa' }}>
                <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700, color: '#fff',
                    }}>{u.name[0]?.toUpperCase()}</div>
                    <span style={{ opacity: u.isActive ? 1 : 0.5 }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', color: '#475569', opacity: u.isActive ? 1 : 0.5 }}>{u.phone}</td>
                <td style={{ padding: '12px 14px' }}>{badge(u.role, ROLE_COLORS[u.role] ?? '#64748b')}</td>
                <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12px' }}>
                  {u.group?.name ? (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                      {u.group.name}
                    </span>
                  ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <button onClick={() => toggleActive(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: u.isActive ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                    {u.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {u.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: '11px' }}>
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-IN') : 'Never'}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setEditing(u)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#6366f1' }}>
                      <Pencil size={13} />
                    </button>
                    {delConfirm === u.id ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#ef4444' }}>Delete?</span>
                        <button onClick={() => deleteUser(u.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>Yes</button>
                        <button onClick={() => setDelConfirm(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', fontSize: '11px' }}>No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDelConfirm(u.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#ef4444' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            No users yet. Create one to get started.
          </div>
        )}
      </div>

      {showCreate && <UserFormModal groups={groups} onClose={() => setShowCreate(false)} onSaved={reload} />}
      {editing && <UserFormModal user={editing} groups={groups} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

// ─── Groups Tab ───────────────────────────────────────────────────────────────

function GroupsTab({ groups, allUsers, reload }: { groups: Group[]; allUsers: AdminUser[]; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [delConfirm, setDelConfirm] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const deleteGroup = async (id: string) => {
    try {
      await api.delete(`/api/v1/admin/groups/${id}`);
      setDelConfirm(null);
      reload();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Failed to delete group');
    }
  };

  const removeMember = async (groupId: string, userId: string) => {
    try {
      await api.delete(`/api/v1/admin/groups/${groupId}/members/${userId}`);
      reload();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Failed to remove member');
    }
  };

  const [addUserId, setAddUserId] = useState<Record<string, string>>({});

  const addMember = async (groupId: string) => {
    const userId = addUserId[groupId];
    if (!userId) return;
    try {
      await api.post(`/api/v1/admin/groups/${groupId}/members`, { userIds: [userId] });
      setAddUserId(m => ({ ...m, [groupId]: '' }));
      reload();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Failed to add member');
    }
  };

  return (
    <div>
      {err && <ErrorBanner message={err} />}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <Btn onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Create Group
        </Btn>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {groups.map((g) => {
          const isOpen = expanded === g.id;
          // Users NOT already in this group
          const unassigned = allUsers.filter(u => u.isActive && !g.users.some(m => m.id === u.id));
          return (
            <div key={g.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {/* Group header */}
              <div
                style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', gap: '12px' }}
                onClick={() => setExpanded(isOpen ? null : g.id)}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Shield size={16} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{g.name}</div>
                  {g.description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{g.description}</div>}
                </div>
                <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, background: '#eef2ff', padding: '3px 10px', borderRadius: '20px' }}>
                  {g._count.users} member{g._count.users !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setEditing(g)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#6366f1' }}>
                    <Pencil size={13} />
                  </button>
                  {delConfirm === g.id ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#ef4444' }}>Delete?</span>
                      <button onClick={() => deleteGroup(g.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>Yes</button>
                      <button onClick={() => setDelConfirm(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', fontSize: '11px' }}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setDelConfirm(g.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#ef4444' }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <ChevronDown size={16} style={{ color: '#94a3b8', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
              </div>

              {/* Members panel */}
              {isOpen && (
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 18px', background: '#fafbfc' }}>
                  {/* Add member */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <select
                        style={{ ...inputStyle, appearance: 'none', paddingRight: '28px', fontSize: '13px', padding: '8px 28px 8px 10px' }}
                        value={addUserId[g.id] ?? ''}
                        onChange={e => setAddUserId(m => ({ ...m, [g.id]: e.target.value }))}
                      >
                        <option value="">Add user to group…</option>
                        {unassigned.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.phone})</option>
                        ))}
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
                    </div>
                    <Btn onClick={() => addMember(g.id)} disabled={!addUserId[g.id]}>
                      <Plus size={13} /> Add
                    </Btn>
                  </div>

                  {/* Member list */}
                  {g.users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
                      No members yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {g.users.map(m => (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
                          padding: '7px 12px', fontSize: '13px',
                        }}>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', fontWeight: 700, color: '#fff',
                          }}>{m.name[0]?.toUpperCase()}</div>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.name}</span>
                          {badge(m.role, ROLE_COLORS[m.role] ?? '#64748b')}
                          <button
                            onClick={() => removeMember(g.id, m.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 0 0 4px', display: 'flex', alignItems: 'center' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            No groups yet. Create one to organise your team.
          </div>
        )}
      </div>

      {showCreate && <GroupFormModal onClose={() => setShowCreate(false)} onSaved={reload} />}
      {editing && <GroupFormModal group={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'users' | 'groups'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const [ur, gr] = await Promise.all([
        api.get('/api/v1/admin/users'),
        api.get('/api/v1/admin/groups'),
      ]);
      setUsers(ur.data.data);
      setGroups(gr.data.data);
    } catch (e: any) {
      setLoadErr(e.response?.data?.error ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isAdmin = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  if (!isAdmin) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <Shield size={40} style={{ margin: '0 auto 16px' }} />
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>Access Denied</div>
        <div style={{ fontSize: '14px', marginTop: '4px' }}>You need OWNER or SUPER_ADMIN role to access this page.</div>
      </div>
    );
  }

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600, border: 'none',
    background: active ? '#6366f1' : 'transparent',
    color: active ? '#fff' : '#64748b',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>Admin</h1>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
          Manage users, roles, and groups for your organisation.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Users', value: users.length, icon: <Users size={18} color="#6366f1" /> },
          { label: 'Active Users', value: users.filter(u => u.isActive).length, icon: <ToggleRight size={18} color="#10b981" /> },
          { label: 'Groups', value: groups.length, icon: <Shield size={18} color="#f59e0b" /> },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        <button style={TAB_STYLE(tab === 'users')} onClick={() => setTab('users')}>
          <Users size={14} /> Users
        </button>
        <button style={TAB_STYLE(tab === 'groups')} onClick={() => setTab('groups')}>
          <Shield size={14} /> Groups
        </button>
      </div>

      {/* Content */}
      {loadErr && <ErrorBanner message={loadErr} />}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      ) : tab === 'users' ? (
        <UsersTab users={users} groups={groups} reload={load} />
      ) : (
        <GroupsTab groups={groups} allUsers={users} reload={load} />
      )}
    </div>
  );
}
