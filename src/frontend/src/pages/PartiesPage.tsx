import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import {
  Users, Search, Plus, Edit2, Trash2, X, ChevronDown,
  TrendingUp, TrendingDown, UserCheck, Building2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Party {
  id: string;
  name: string;
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  creditLimit: number;
  currentBalance: number;
}

interface PartyListResponse {
  data: Party[];
  total: number;
}

type TabFilter = 'ALL' | 'CUSTOMER' | 'SUPPLIER';

const emptyForm = {
  name: '',
  type: 'CUSTOMER' as Party['type'],
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: '',
  state: '',
  gstin: '',
  creditLimit: 0,
  notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr>
    {[200, 80, 110, 100, 120, 110, 90].map((w, i) => (
      <td key={i} style={{ padding: '14px 16px' }}>
        <div
          style={{
            height: '14px',
            width: `${w}px`,
            maxWidth: '100%',
            background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
            backgroundSize: '400% 100%',
            borderRadius: '6px',
            animation: 'shimmer 1.4s ease-in-out infinite',
          }}
        />
      </td>
    ))}
  </tr>
);

const SkeletonSummaryCard = () => (
  <div
    style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '22px',
      boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
      border: '1px solid rgba(226,232,240,0.8)',
    }}
  >
    <div style={{ height: '12px', width: '80px', background: '#e2e8f0', borderRadius: '6px', marginBottom: '12px' }} />
    <div style={{ height: '28px', width: '120px', background: '#e2e8f0', borderRadius: '6px' }} />
  </div>
);

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}

const SummaryCard = ({ title, value, icon: Icon, iconBg, iconColor, valueColor = '#0f172a' }: SummaryCardProps) => (
  <div
    style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '22px',
      boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
      border: '1px solid rgba(226,232,240,0.8)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
    }}
  >
    <div
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={20} color={iconColor} />
    </div>
    <div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
        {title}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: valueColor, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  </div>
);

// ─── Type Badge ───────────────────────────────────────────────────────────────

const TypeBadge = ({ type }: { type: Party['type'] }) => {
  const config: Record<Party['type'], { label: string; color: string; bg: string }> = {
    CUSTOMER: { label: 'Customer', color: '#2563eb', bg: '#eff6ff' },
    SUPPLIER: { label: 'Supplier', color: '#ea580c', bg: '#fff7ed' },
    BOTH: { label: 'Both', color: '#7c3aed', bg: '#f5f3ff' },
  };
  const { label, color, bg } = config[type];
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: '20px',
        color,
        background: bg,
        display: 'inline-block',
        letterSpacing: '0.03em',
      }}
    >
      {label}
    </span>
  );
};

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
  half?: boolean;
}

const Field = ({ label, children, half }: FieldProps) => (
  <div style={{ gridColumn: half ? 'span 1' : 'span 2' }}>
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', letterSpacing: '0.04em' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '40px',
  padding: '0 12px',
  borderRadius: '10px',
  border: '1.5px solid #e2e8f0',
  fontSize: '14px',
  color: '#1e293b',
  background: '#f8fafc',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
  fontFamily: 'Inter, sans-serif',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height: 'auto',
  padding: '10px 12px',
  resize: 'vertical' as const,
  minHeight: '72px',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  cursor: 'pointer',
};

// ─── Modal ────────────────────────────────────────────────────────────────────

interface PartyModalProps {
  open: boolean;
  onClose: () => void;
  initial?: Party | null;
  onSave: (data: typeof emptyForm) => void;
  saving: boolean;
}

const PartyModal = ({ open, onClose, initial, onSave, saving }: PartyModalProps) => {
  const [form, setForm] = useState<typeof emptyForm>(
    initial
      ? {
          name: initial.name,
          type: initial.type,
          phone: initial.phone || '',
          whatsapp: initial.whatsapp || '',
          email: initial.email || '',
          address: initial.address || '',
          city: initial.city || '',
          state: initial.state || '',
          gstin: initial.gstin || '',
          creditLimit: initial.creditLimit,
          notes: '',
        }
      : emptyForm
  );

  if (!open) return null;

  const set = (k: keyof typeof emptyForm, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
          borderRadius: '20px 20px 0 0',
        }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              {initial ? 'Edit Party' : 'Add New Party'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              {initial ? 'Update party details' : 'Fill in the party information'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: 'none', background: '#f1f5f9',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} color="#64748b" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            <Field label="Full Name *">
              <input
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Rajesh Textiles"
                style={inputStyle}
              />
            </Field>

            <Field label="Type *" half>
              <div style={{ position: 'relative' }}>
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value as Party['type'])}
                  style={selectStyle}
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="SUPPLIER">Supplier</option>
                  <option value="BOTH">Both</option>
                </select>
                <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </Field>

            <Field label="Phone" half>
              <input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+91 98765 43210"
                style={inputStyle}
              />
            </Field>

            <Field label="WhatsApp" half>
              <input
                value={form.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                placeholder="+91 98765 43210"
                style={inputStyle}
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="party@example.com"
                style={inputStyle}
              />
            </Field>

            <Field label="City" half>
              <input
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="Surat"
                style={inputStyle}
              />
            </Field>

            <Field label="State" half>
              <input
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                placeholder="Gujarat"
                style={inputStyle}
              />
            </Field>

            <Field label="Address">
              <textarea
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Full address..."
                style={textareaStyle}
                rows={2}
              />
            </Field>

            <Field label="GSTIN" half>
              <input
                value={form.gstin}
                onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                placeholder="24XXXXX1234X1Z5"
                style={{ ...inputStyle, fontFamily: 'monospace, Inter, sans-serif', letterSpacing: '0.05em' }}
                maxLength={15}
              />
            </Field>

            <Field label="Credit Limit (₹)" half>
              <input
                type="number"
                min={0}
                value={form.creditLimit}
                onChange={(e) => set('creditLimit', Number(e.target.value))}
                placeholder="0"
                style={inputStyle}
              />
            </Field>

            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Any additional notes..."
                style={textareaStyle}
                rows={2}
              />
            </Field>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '40px', padding: '0 20px', borderRadius: '10px',
                border: '1.5px solid #e2e8f0', background: '#fff',
                fontSize: '14px', fontWeight: 600, color: '#64748b',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                height: '40px', padding: '0 24px', borderRadius: '10px',
                border: 'none',
                background: saving ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                fontSize: '14px', fontWeight: 700, color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: saving ? 'none' : '0 4px 12px rgba(99,102,241,0.35)',
                transition: 'all 0.15s',
              }}
            >
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Delete Modal ──────────────────────────────────────────────────────────────

interface DeleteModalProps {
  party: Party | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

const DeleteModal = ({ party, onClose, onConfirm, deleting }: DeleteModalProps) => {
  if (!party) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1001, padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '400px',
          padding: '32px',
          boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
          textAlign: 'center',
        }}
      >
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Trash2 size={22} color="#ef4444" />
        </div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
          Delete Party?
        </div>
        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '28px', lineHeight: 1.6 }}>
          Are you sure you want to delete <strong style={{ color: '#1e293b' }}>{party.name}</strong>? This action cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              height: '40px', padding: '0 20px', borderRadius: '10px',
              border: '1.5px solid #e2e8f0', background: '#fff',
              fontSize: '14px', fontWeight: 600, color: '#64748b',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              height: '40px', padding: '0 24px', borderRadius: '10px',
              border: 'none',
              background: deleting ? '#fca5a5' : '#ef4444',
              fontSize: '14px', fontWeight: 700, color: '#fff',
              cursor: deleting ? 'not-allowed' : 'pointer',
              boxShadow: deleting ? 'none' : '0 4px 12px rgba(239,68,68,0.3)',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PartiesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabFilter>('ALL');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editParty, setEditParty] = useState<Party | null>(null);
  const [deleteParty, setDeleteParty] = useState<Party | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<PartyListResponse>({
    queryKey: ['parties', search, tab],
    queryFn: () =>
      api
        .get('/api/v1/parties', {
          params: {
            search,
            type: tab === 'ALL' ? '' : tab,
            page: 1,
            limit: 50,
          },
        })
        .then((r) => r.data),
    staleTime: 30_000,
  });

  const parties = data?.data ?? [];

  // ── Summary ────────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const allParties = data?.data ?? [];
    return {
      customers: allParties.filter((p) => p.type === 'CUSTOMER' || p.type === 'BOTH').length,
      suppliers: allParties.filter((p) => p.type === 'SUPPLIER' || p.type === 'BOTH').length,
      receivable: allParties.filter((p) => Number(p.currentBalance) > 0).reduce((s, p) => s + Number(p.currentBalance), 0),
      payable: allParties.filter((p) => Number(p.currentBalance) < 0).reduce((s, p) => s + Math.abs(Number(p.currentBalance)), 0),
    };
  }, [data]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: typeof emptyForm) => api.post('/api/v1/parties', body).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['parties'] }); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof emptyForm }) =>
      api.put(`/api/v1/parties/${id}`, body).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['parties'] }); setEditParty(null); setShowModal(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/parties/${id}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['parties'] }); setDeleteParty(null); },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openAdd = () => { setEditParty(null); setShowModal(true); };
  const openEdit = (p: Party) => { setEditParty(p); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditParty(null); };

  const handleSave = (form: typeof emptyForm) => {
    if (editParty) {
      updateMutation.mutate({ id: editParty.id, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const deleting = deleteMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: TabFilter[] = ['ALL', 'CUSTOMER', 'SUPPLIER'];

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        input:focus, textarea:focus, select:focus {
          border-color: #6366f1 !important;
          background: #fff !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .party-row:hover { background: #f8fafc !important; }
        .action-btn:hover { opacity: 0.8; }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
            Parties
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Customers &amp; Suppliers
          </p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '16px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  height: '32px',
                  padding: '0 16px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#4f46e5' : '#64748b',
                  boxShadow: tab === t ? '0 1px 4px rgba(15,23,42,0.1)' : 'none',
                }}
              >
                {t === 'ALL' ? 'All' : t === 'CUSTOMER' ? 'Customers' : 'Suppliers'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={openAdd}
          style={{
            height: '42px',
            padding: '0 20px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.35)';
          }}
        >
          <Plus size={16} />
          Add Party
        </button>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {isLoading ? (
          [...Array(4)].map((_, i) => <SkeletonSummaryCard key={i} />)
        ) : (
          <>
            <SummaryCard
              title="Total Customers"
              value={String(summary.customers)}
              icon={UserCheck}
              iconBg="#eff6ff"
              iconColor="#2563eb"
            />
            <SummaryCard
              title="Total Suppliers"
              value={String(summary.suppliers)}
              icon={Building2}
              iconBg="#fff7ed"
              iconColor="#ea580c"
            />
            <SummaryCard
              title="Total Receivable"
              value={fmt(summary.receivable)}
              icon={TrendingUp}
              iconBg="#fef2f2"
              iconColor="#ef4444"
              valueColor="#ef4444"
            />
            <SummaryCard
              title="Total Payable"
              value={fmt(summary.payable)}
              icon={TrendingDown}
              iconBg="#f0fdf4"
              iconColor="#16a34a"
              valueColor="#16a34a"
            />
          </>
        )}
      </div>

      {/* ── Table Card ────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
        border: '1px solid rgba(226,232,240,0.8)',
        overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#fafbff',
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parties by name, city…"
              style={{
                ...inputStyle,
                paddingLeft: '36px',
                background: '#fff',
                border: '1.5px solid #e2e8f0',
              }}
            />
          </div>
          {!isLoading && (
            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {parties.length} {parties.length === 1 ? 'party' : 'parties'}
            </span>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Name', 'Type', 'Phone', 'City', 'Credit Limit', 'Balance', 'Actions'].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 16px',
                      textAlign: col === 'Actions' ? 'right' : 'left',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid #f1f5f9',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '14px',
                        background: '#f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Users size={22} color="#94a3b8" />
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>No parties found</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                        {search ? `No results for "${search}"` : 'Add your first party to get started'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                parties.map((party, i) => {
                  const bal = Number(party.currentBalance);
                  const balColor =
                    bal > 0 ? '#ef4444' :
                    bal < 0 ? '#16a34a' :
                    '#94a3b8';

                  return (
                    <tr
                      key={party.id}
                      className="party-row"
                      style={{
                        background: 'transparent',
                        borderBottom: i === parties.length - 1 ? 'none' : '1px solid #f8fafc',
                        transition: 'background 0.12s',
                      }}
                    >
                      {/* Name */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{party.name}</div>
                        {party.email && (
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{party.email}</div>
                        )}
                      </td>

                      {/* Type */}
                      <td style={{ padding: '14px 16px' }}>
                        <TypeBadge type={party.type} />
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '14px 16px', color: '#475569' }}>
                        {party.phone || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>

                      {/* City */}
                      <td style={{ padding: '14px 16px', color: '#475569' }}>
                        {party.city || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>

                      {/* Credit Limit */}
                      <td style={{ padding: '14px 16px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                        {Number(party.creditLimit) > 0 ? fmt(Number(party.creditLimit)) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>

                      {/* Balance */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 700, color: balColor, fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(Math.abs(bal))}
                        </span>
                        {bal !== 0 && (
                          <div style={{ fontSize: '11px', color: balColor, opacity: 0.75, marginTop: '2px' }}>
                            {bal > 0 ? 'Receivable' : 'Payable'}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="action-btn"
                            onClick={() => openEdit(party)}
                            title="Edit"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px',
                              border: '1.5px solid #e2e8f0', background: '#fff',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            <Edit2 size={14} color="#4f46e5" />
                          </button>
                          <button
                            className="action-btn"
                            onClick={() => setDeleteParty(party)}
                            title="Delete"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px',
                              border: '1.5px solid #fee2e2', background: '#fff',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showModal && (
        <PartyModal
          open={showModal}
          onClose={closeModal}
          initial={editParty}
          onSave={handleSave}
          saving={saving}
        />
      )}
      <DeleteModal
        party={deleteParty}
        onClose={() => setDeleteParty(null)}
        onConfirm={() => deleteParty && deleteMutation.mutate(deleteParty.id)}
        deleting={deleting}
      />
    </div>
  );
}
