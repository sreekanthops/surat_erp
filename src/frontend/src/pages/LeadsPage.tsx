import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import {
  Plus, Search, X, ChevronDown, Pencil, Trash2, AlertTriangle,
  TrendingUp, Phone, MapPin, Calendar, MoreHorizontal,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Party { id: string; name: string; phone?: string; city?: string; }

interface Lead {
  id: string;
  title?: string;
  source?: string;
  status: string;
  productInterest?: string;
  estimatedQty?: number;
  estimatedValue?: number;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
  party?: Party;
}

interface LeadsResponse { data: Lead[]; total: number; }

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'WON', 'LOST'] as const;
type Status = typeof STATUSES[number];

const SOURCES = ['WHATSAPP', 'GMAIL', 'REFERRAL', 'WALK_IN', 'COLD_CALL', 'EXHIBITION', 'MANUAL'] as const;

const STATUS_COLOR: Record<string, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#6366f1',
  QUOTED: '#f97316',
  NEGOTIATING: '#8b5cf6',
  WON: '#22c55e',
  LOST: '#94a3b8',
};

const STATUS_BG: Record<string, string> = {
  NEW: '#eff6ff',
  CONTACTED: '#eef2ff',
  QUOTED: '#fff7ed',
  NEGOTIATING: '#f5f3ff',
  WON: '#f0fdf4',
  LOST: '#f8fafc',
};

const SOURCE_COLOR: Record<string, { bg: string; color: string }> = {
  WHATSAPP:  { bg: '#dcfce7', color: '#16a34a' },
  GMAIL:     { bg: '#fee2e2', color: '#dc2626' },
  REFERRAL:  { bg: '#fef3c7', color: '#d97706' },
  WALK_IN:   { bg: '#e0f2fe', color: '#0284c7' },
  COLD_CALL: { bg: '#f3e8ff', color: '#9333ea' },
  EXHIBITION:{ bg: '#fce7f3', color: '#db2777' },
  MANUAL:    { bg: '#f1f5f9', color: '#475569' },
};

const FLOW: Record<string, string[]> = {
  NEW:         ['CONTACTED'],
  CONTACTED:   ['QUOTED', 'LOST'],
  QUOTED:      ['NEGOTIATING', 'WON', 'LOST'],
  NEGOTIATING: ['WON', 'LOST'],
  WON:         [],
  LOST:        ['NEW'],
};

const fmt = (n?: number) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const isPastDue = (s?: string) => !!s && new Date(s) < new Date(new Date().toDateString());

// ─── Empty form ───────────────────────────────────────────────────────────────

const emptyForm = () => ({
  partyId: '',
  partySearch: '',
  title: '',
  source: '',
  status: 'NEW' as string,
  productInterest: '',
  estimatedQty: '',
  estimatedValue: '',
  followUpDate: '',
  notes: '',
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: { padding: '32px', fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: '#f8fafc' } as React.CSSProperties,
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' } as React.CSSProperties,
  h1: { fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 } as React.CSSProperties,
  sub: { fontSize: '13px', color: '#64748b', marginTop: '4px' } as React.CSSProperties,
  addBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '9px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
    color: '#fff', fontSize: '13px', fontWeight: 700,
    transition: 'transform 0.15s, box-shadow 0.15s',
  } as React.CSSProperties,

  summaryGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '24px',
  } as React.CSSProperties,
  summaryCard: (color: string, bg: string): React.CSSProperties => ({
    background: '#fff', borderRadius: '12px', padding: '14px 16px',
    border: `1px solid ${bg === '#f8fafc' ? '#e2e8f0' : bg}`,
    boxShadow: '0 1px 6px rgba(15,23,42,0.05)',
  }),
  summaryLabel: (color: string): React.CSSProperties => ({
    fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', color, marginBottom: '6px',
  }),
  summaryCount: { fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1 } as React.CSSProperties,
  summaryValue: { fontSize: '11px', color: '#64748b', marginTop: '3px' } as React.CSSProperties,

  filterBar: { display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' as const } as React.CSSProperties,
  filterTab: (active: boolean, color: string, bg: string): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
    cursor: 'pointer', border: active ? 'none' : '1px solid #e2e8f0',
    background: active ? color : '#fff', color: active ? '#fff' : '#64748b',
    transition: 'all 0.15s',
    boxShadow: active ? `0 2px 8px ${color}55` : 'none',
  }),

  tableCard: {
    background: '#fff', borderRadius: '16px',
    boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
    border: '1px solid rgba(226,232,240,0.8)', overflow: 'hidden',
  } as React.CSSProperties,
  thead: { background: '#fafbff', borderBottom: '1px solid #f1f5f9' } as React.CSSProperties,
  th: {
    padding: '11px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b',
    letterSpacing: '0.06em', textTransform: 'uppercase' as const, textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  },
  td: { padding: '13px 14px', fontSize: '13px', color: '#1e293b', verticalAlign: 'middle' as const },
  tr: { borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' } as React.CSSProperties,

  badge: (color: string, bg: string, clickable = false): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
    color, background: bg,
    cursor: clickable ? 'pointer' : 'default',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  }),
  actionBtn: (danger = false): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
    borderRadius: '7px', color: danger ? '#ef4444' : '#64748b',
    display: 'flex', alignItems: 'center', transition: 'background 0.12s, color 0.12s',
  }),

  empty: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    padding: '64px 32px', color: '#94a3b8',
  } as React.CSSProperties,

  // Modal
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(15,23,42,0.55)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '24px',
  } as React.CSSProperties,
  modal: {
    background: '#fff', borderRadius: '20px', width: '560px', maxWidth: '100%',
    maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 24px 80px rgba(15,23,42,0.22)',
  } as React.CSSProperties,
  modalHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9',
    background: 'linear-gradient(135deg, #fafbff 0%, #f0f4ff 100%)',
  } as React.CSSProperties,
  modalTitle: { fontSize: '16px', fontWeight: 800, color: '#0f172a' } as React.CSSProperties,
  modalBody: { padding: '20px 24px', overflowY: 'auto' as const, flex: 1 } as React.CSSProperties,
  modalFoot: {
    padding: '14px 24px', borderTop: '1px solid #f1f5f9',
    display: 'flex', gap: '10px', justifyContent: 'flex-end',
    background: '#fafbff',
  } as React.CSSProperties,
  label: { display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '5px', letterSpacing: '0.04em' } as React.CSSProperties,
  input: (err = false): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box' as const,
    padding: '9px 12px', borderRadius: '9px', fontSize: '13.5px', color: '#0f172a',
    border: `1px solid ${err ? '#ef4444' : '#e2e8f0'}`,
    outline: 'none', background: '#fff', transition: 'border-color 0.15s, box-shadow 0.15s',
  }),
  select: {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '9px 12px', borderRadius: '9px', fontSize: '13.5px', color: '#0f172a',
    border: '1px solid #e2e8f0', outline: 'none', background: '#fff',
    cursor: 'pointer',
  } as React.CSSProperties,
  textarea: {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '9px 12px', borderRadius: '9px', fontSize: '13.5px', color: '#0f172a',
    border: '1px solid #e2e8f0', outline: 'none', background: '#fff', resize: 'vertical' as const,
    fontFamily: 'inherit', minHeight: '72px',
  } as React.CSSProperties,
  fgRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' } as React.CSSProperties,
  fg: { marginBottom: '14px' } as React.CSSProperties,
  cancelBtn: {
    padding: '9px 20px', borderRadius: '9px', border: '1px solid #e2e8f0',
    background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,
  saveBtn: {
    padding: '9px 24px', borderRadius: '9px', border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
    color: '#fff', fontSize: '13px', fontWeight: 700,
  } as React.CSSProperties,
  dangerBtn: {
    padding: '9px 20px', borderRadius: '9px', border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    boxShadow: '0 4px 12px rgba(239,68,68,0.35)',
    color: '#fff', fontSize: '13px', fontWeight: 700,
  } as React.CSSProperties,

  dropdown: {
    position: 'absolute' as const, top: 'calc(100% + 4px)', left: 0,
    background: '#fff', borderRadius: '10px', minWidth: '150px', zIndex: 200,
    boxShadow: '0 8px 30px rgba(15,23,42,0.16)', border: '1px solid #f1f5f9',
    overflow: 'hidden',
  } as React.CSSProperties,
  dropItem: (color: string): React.CSSProperties => ({
    padding: '9px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
    color, transition: 'background 0.1s', display: 'block', borderBottom: '1px solid #f8fafc',
  }),

  partyResult: {
    position: 'absolute' as const, top: 'calc(100% + 2px)', left: 0, right: 0,
    background: '#fff', borderRadius: '10px', zIndex: 300,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', border: '1px solid #e2e8f0',
    maxHeight: '200px', overflowY: 'auto' as const,
  } as React.CSSProperties,
  partyItem: {
    padding: '9px 12px', cursor: 'pointer', fontSize: '13px', color: '#0f172a',
    borderBottom: '1px solid #f8fafc', transition: 'background 0.1s',
  } as React.CSSProperties,
};

// ─── StatusBadge with quick-change dropdown ──────────────────────────────────

function StatusBadge({ lead, onStatusChange }: { lead: Lead; onStatusChange: (id: string, s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const next = FLOW[lead.status] || [];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span
        style={S.badge(STATUS_COLOR[lead.status] || '#64748b', STATUS_BG[lead.status] || '#f8fafc', next.length > 0)}
        onClick={() => next.length > 0 && setOpen((p) => !p)}
      >
        {lead.status}
        {next.length > 0 && <ChevronDown size={10} />}
      </span>
      {open && (
        <div style={S.dropdown}>
          {next.map((s) => (
            <span
              key={s}
              style={S.dropItem(STATUS_COLOR[s] || '#64748b')}
              onClick={() => { onStatusChange(lead.id, s); setOpen(false); }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = STATUS_BG[s] || '#f8fafc'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              → {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Party Search ─────────────────────────────────────────────────────────────

function PartySelector({
  value, search, onSearchChange, onSelect, onClear,
}: {
  value: string;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (p: Party) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: parties } = useQuery<Party[]>({
    queryKey: ['parties-search', search],
    queryFn: () => api.get('/api/v1/parties', { params: { search, limit: 20 } }).then((r) => r.data?.data ?? r.data),
    enabled: open && search.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          style={{ ...S.input(), paddingLeft: '30px', paddingRight: value ? '30px' : '12px' }}
          placeholder="Search party…"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(e) => { onSearchChange(e.target.value); setOpen(true); }}
        />
        {value && (
          <X size={13} onClick={onClear} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', cursor: 'pointer' }} />
        )}
      </div>
      {open && parties && parties.length > 0 && (
        <div style={S.partyResult}>
          {parties.map((p) => (
            <div
              key={p.id}
              style={S.partyItem}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              onClick={() => { onSelect(p); setOpen(false); }}
            >
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              {(p.phone || p.city) && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{[p.phone, p.city].filter(Boolean).join(' · ')}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function LeadModal({
  lead, onClose,
}: { lead: Lead | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!lead;
  const [form, setForm] = useState(() => {
    if (!lead) return emptyForm();
    return {
      partyId: lead.party?.id ?? '',
      partySearch: lead.party?.name ?? '',
      title: lead.title ?? '',
      source: lead.source ?? '',
      status: lead.status,
      productInterest: lead.productInterest ?? '',
      estimatedQty: lead.estimatedQty != null ? String(lead.estimatedQty) : '',
      estimatedValue: lead.estimatedValue != null ? String(lead.estimatedValue) : '',
      followUpDate: lead.followUpDate ? lead.followUpDate.substring(0, 10) : '',
      notes: lead.notes ?? '',
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.partyId) e.partyId = 'Required';
    return e;
  };

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      isEdit
        ? api.put(`/api/v1/leads/${lead!.id}`, body).then((r) => r.data)
        : api.post('/api/v1/leads', body).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); onClose(); },
  });

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({
      partyId: form.partyId || undefined,
      title: form.title || undefined,
      source: form.source || undefined,
      status: form.status,
      productInterest: form.productInterest || undefined,
      estimatedQty: form.estimatedQty ? Number(form.estimatedQty) : undefined,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
      followUpDate: form.followUpDate || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.modalHead}>
          <h2 style={S.modalTitle}>{isEdit ? 'Edit Lead' : 'Add New Lead'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={S.modalBody}>
          {/* Party */}
          <div style={S.fg}>
            <label style={S.label}>Party <span style={{ color: '#ef4444' }}>*</span></label>
            <PartySelector
              value={form.partyId}
              search={form.partySearch}
              onSearchChange={(v) => set('partySearch', v)}
              onSelect={(p) => setForm((f) => ({ ...f, partyId: p.id, partySearch: p.name }))}
              onClear={() => setForm((f) => ({ ...f, partyId: '', partySearch: '' }))}
            />
            {errors.partyId && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '3px' }}>{errors.partyId}</div>}
          </div>

          {/* Title */}
          <div style={S.fg}>
            <label style={S.label}>Title</label>
            <input style={S.input()} placeholder="e.g. Bulk saree order enquiry" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          {/* Source + Status */}
          <div style={S.fgRow}>
            <div>
              <label style={S.label}>Source</label>
              <select style={S.select} value={form.source} onChange={(e) => set('source', e.target.value)}>
                <option value="">— Select source —</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Status</label>
              <select style={S.select} value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Product Interest */}
          <div style={S.fg}>
            <label style={S.label}>Product Interest</label>
            <input style={S.input()} placeholder="e.g. Georgette sarees, embroidered fabric…" value={form.productInterest} onChange={(e) => set('productInterest', e.target.value)} />
          </div>

          {/* Est. Qty + Est. Value */}
          <div style={S.fgRow}>
            <div>
              <label style={S.label}>Est. Qty (meters/pcs)</label>
              <input type="number" min="0" style={S.input()} placeholder="0" value={form.estimatedQty} onChange={(e) => set('estimatedQty', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Est. Value (₹)</label>
              <input type="number" min="0" style={S.input()} placeholder="0" value={form.estimatedValue} onChange={(e) => set('estimatedValue', e.target.value)} />
            </div>
          </div>

          {/* Follow-up Date */}
          <div style={S.fg}>
            <label style={S.label}>Follow-up Date</label>
            <input type="date" style={S.input()} value={form.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} />
          </div>

          {/* Notes */}
          <div style={S.fg}>
            <label style={S.label}>Notes</label>
            <textarea style={S.textarea} placeholder="Any additional context…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {mutation.isError && (
            <div style={{ fontSize: '12px', color: '#ef4444', padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', marginTop: '4px' }}>
              {(mutation.error as any)?.response?.data?.message ?? 'Something went wrong.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.modalFoot}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={S.saveBtn} onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Lead')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/leads/${lead.id}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); onClose(); },
  });

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: '420px' }}>
        <div style={{ ...S.modalHead, background: '#fff7f7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#ef4444" />
            <h2 style={{ ...S.modalTitle, color: '#ef4444' }}>Delete Lead</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '24px' }}>
          <p style={{ fontSize: '14px', color: '#1e293b', marginBottom: '6px', lineHeight: 1.6 }}>
            Are you sure you want to delete this lead
            {lead.party?.name ? <> for <strong>{lead.party.name}</strong></> : ''}?
          </p>
          {lead.title && <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>"{lead.title}"</p>}
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px' }}>This action cannot be undone.</p>
        </div>
        <div style={S.modalFoot}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={S.dangerBtn} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Deleting…' : 'Delete Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [addModal, setAddModal] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);

  const { data, isLoading } = useQuery<LeadsResponse>({
    queryKey: ['leads', statusFilter],
    queryFn: () =>
      api.get('/api/v1/leads', {
        params: { ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}), page: 1, limit: 50 },
      }).then((r) => r.data),
    staleTime: 30_000,
  });

  const leads: Lead[] = data?.data ?? [];

  // Pipeline summary — always fetch all leads for counts
  const { data: allData } = useQuery<LeadsResponse>({
    queryKey: ['leads', 'ALL'],
    queryFn: () => api.get('/api/v1/leads', { params: { page: 1, limit: 1000 } }).then((r) => r.data),
    staleTime: 60_000,
  });
  const allLeads: Lead[] = allData?.data ?? [];

  const summary = STATUSES.map((s) => {
    const group = allLeads.filter((l) => l.status === s);
    return {
      status: s,
      count: group.length,
      value: group.reduce((acc, l) => acc + (l.estimatedValue ?? 0), 0),
    };
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/leads/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const handleStatusChange = useCallback((id: string, status: string) => {
    statusMutation.mutate({ id, status });
  }, [statusMutation]);

  const filterTabColor = (s: string) =>
    s === 'ALL' ? '#6366f1' : STATUS_COLOR[s] || '#6366f1';

  const filterTabBg = (s: string) =>
    s === 'ALL' ? '#eef2ff' : STATUS_BG[s] || '#f8fafc';

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.row}>
        <div>
          <h1 style={S.h1}>Leads & Pipeline</h1>
          <p style={S.sub}>Sales pipeline</p>
        </div>
        <button
          style={S.addBtn}
          onClick={() => setAddModal(true)}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(99,102,241,0.5)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(99,102,241,0.4)'; }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Add Lead
        </button>
      </div>

      {/* ── Pipeline Summary ── */}
      <div style={S.summaryGrid}>
        {summary.map(({ status, count, value }) => (
          <div
            key={status}
            style={S.summaryCard(STATUS_COLOR[status], STATUS_BG[status])}
            onClick={() => setStatusFilter(status)}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${STATUS_COLOR[status]}33`; (e.currentTarget as HTMLElement).style.cursor = 'pointer'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 6px rgba(15,23,42,0.05)'; }}
          >
            <div style={S.summaryLabel(STATUS_COLOR[status])}>{status}</div>
            <div style={S.summaryCount}>{count}</div>
            <div style={S.summaryValue}>{fmt(value)}</div>
          </div>
        ))}
      </div>

      {/* ── Status Filter Tabs ── */}
      <div style={S.filterBar}>
        {(['ALL', ...STATUSES] as string[]).map((s) => (
          <button
            key={s}
            style={S.filterTab(statusFilter === s, filterTabColor(s), filterTabBg(s))}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Leads Table ── */}
      <div style={S.tableCard}>
        {isLoading ? (
          <div style={S.empty}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ marginTop: '12px', fontSize: '13px' }}>Loading leads…</p>
          </div>
        ) : leads.length === 0 ? (
          <div style={S.empty}>
            <TrendingUp size={36} color="#cbd5e1" />
            <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>No leads found</p>
            <p style={{ fontSize: '12px', marginTop: '4px', color: '#94a3b8' }}>
              {statusFilter === 'ALL' ? 'Add your first lead to start tracking your pipeline.' : `No leads with status ${statusFilter}.`}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={S.thead}>
              <tr>
                {['Party', 'Title', 'Product Interest', 'Est. Value', 'Est. Qty', 'Source', 'Status', 'Follow-up', 'Created', 'Actions'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, idx) => {
                const pastDue = isPastDue(lead.followUpDate);
                return (
                  <tr
                    key={lead.id}
                    style={{ ...S.tr, borderBottom: idx === leads.length - 1 ? 'none' : '1px solid #f8fafc' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafbff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    {/* Party */}
                    <td style={S.td}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{lead.party?.name ?? <span style={{ color: '#94a3b8' }}>—</span>}</div>
                      {lead.party?.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          <Phone size={9} />
                          {lead.party.phone}
                        </div>
                      )}
                      {lead.party?.city && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                          <MapPin size={9} />
                          {lead.party.city}
                        </div>
                      )}
                    </td>

                    {/* Title */}
                    <td style={{ ...S.td, maxWidth: '160px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.title || <span style={{ color: '#94a3b8' }}>—</span>}
                      </div>
                    </td>

                    {/* Product Interest */}
                    <td style={{ ...S.td, maxWidth: '140px', color: '#475569', fontSize: '12.5px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.productInterest || <span style={{ color: '#94a3b8' }}>—</span>}
                      </div>
                    </td>

                    {/* Est. Value */}
                    <td style={{ ...S.td, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {fmt(lead.estimatedValue)}
                    </td>

                    {/* Est. Qty */}
                    <td style={{ ...S.td, color: '#475569', whiteSpace: 'nowrap' }}>
                      {lead.estimatedQty != null ? lead.estimatedQty.toLocaleString('en-IN') : '—'}
                    </td>

                    {/* Source */}
                    <td style={S.td}>
                      {lead.source ? (
                        <span style={S.badge(SOURCE_COLOR[lead.source]?.color ?? '#475569', SOURCE_COLOR[lead.source]?.bg ?? '#f1f5f9')}>
                          {lead.source.replace('_', ' ')}
                        </span>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>

                    {/* Status */}
                    <td style={S.td}>
                      <StatusBadge lead={lead} onStatusChange={handleStatusChange} />
                    </td>

                    {/* Follow-up */}
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      {lead.followUpDate ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} color={pastDue ? '#ef4444' : '#94a3b8'} />
                          <span style={{ fontSize: '12px', fontWeight: pastDue ? 700 : 500, color: pastDue ? '#ef4444' : '#64748b' }}>
                            {fmtDate(lead.followUpDate)}
                          </span>
                          {pastDue && <span style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '1px 5px', borderRadius: '4px' }}>OVERDUE</span>}
                        </div>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>

                    {/* Created */}
                    <td style={{ ...S.td, fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {fmtDate(lead.createdAt)}
                    </td>

                    {/* Actions */}
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button
                          title="Edit lead"
                          style={S.actionBtn()}
                          onClick={() => setEditLead(lead)}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="Delete lead"
                          style={S.actionBtn(true)}
                          onClick={() => setDeleteLead(lead)}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fef2f2'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {(addModal || editLead) && (
        <LeadModal
          lead={editLead}
          onClose={() => { setAddModal(false); setEditLead(null); }}
        />
      )}
      {deleteLead && (
        <DeleteModal lead={deleteLead} onClose={() => setDeleteLead(null)} />
      )}

      {/* Keyframe injected via style tag */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
