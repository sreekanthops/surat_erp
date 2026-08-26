import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import {
  Plus, Search, Pencil, Trash2, X, Package, DollarSign, AlertTriangle, ShoppingCart,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  code?: string;
  category?: string;
  subcategory?: string;
  unit: string;
  hsnCode?: string;
  gstRate: number;
  purchaseRate?: number;
  saleRate?: number;
  currentStock: number;
  reorderLevel: number;
  isActive: boolean;
}

interface StockSummary {
  totalProducts?: number;
  totalStockValue?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
}

interface FormState {
  name: string;
  code: string;
  category: string;
  subcategory: string;
  unit: string;
  hsnCode: string;
  gstRate: string;
  purchaseRate: string;
  saleRate: string;
  currentStock: string;
  reorderLevel: string;
}

const EMPTY_FORM: FormState = {
  name: '', code: '', category: '', subcategory: '',
  unit: 'METER', hsnCode: '', gstRate: '0',
  purchaseRate: '', saleRate: '', currentStock: '0', reorderLevel: '0',
};

const UNITS = ['METER', 'KG', 'PIECE', 'BUNDLE', 'BOX', 'ROLL'];

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: {
    padding: '32px',
    maxWidth: '1200px',
    fontFamily: 'Inter, sans-serif',
    background: '#f1f5f9',
    minHeight: '100vh',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: '28px',
  } as React.CSSProperties,

  h1: {
    fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2,
  } as React.CSSProperties,

  sub: {
    fontSize: '13px', color: '#64748b', marginTop: '4px', margin: 0,
  } as React.CSSProperties,

  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '9px 18px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,

  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  } as React.CSSProperties,

  statCard: {
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  } as React.CSSProperties,

  statIconBox: (bg: string): React.CSSProperties => ({
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),

  statLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '4px',
  },

  statValue: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1,
  },

  toolbar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'center',
  } as React.CSSProperties,

  searchWrap: {
    position: 'relative' as const,
    flex: 1,
    maxWidth: '340px',
  },

  searchIcon: {
    position: 'absolute' as const,
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
    pointerEvents: 'none' as const,
  },

  searchInput: {
    width: '100%',
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px 14px 10px 38px',
    fontSize: '14px',
    background: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box' as const,
    color: '#1e293b',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,

  select: {
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '14px',
    background: '#f8fafc',
    outline: 'none',
    color: '#1e293b',
    cursor: 'pointer',
    minWidth: '160px',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,

  tableCard: {
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
    overflow: 'hidden',
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13.5px',
  } as React.CSSProperties,

  thead: {
    background: '#f8fafc',
  } as React.CSSProperties,

  th: {
    padding: '12px 16px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
    borderBottom: '1px solid #e2e8f0',
  } as React.CSSProperties,

  td: {
    padding: '13px 16px',
    borderBottom: '1px solid #f1f5f9',
    color: '#1e293b',
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,

  skeletonRow: {
    height: '20px',
    background: '#e2e8f0',
    borderRadius: '6px',
    animation: 'pulse 1.5s ease-in-out infinite',
  } as React.CSSProperties,

  actionBtn: (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: 'none',
    borderRadius: '8px',
    background: bg,
    color: color,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  }),

  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  } as React.CSSProperties,

  modal: {
    background: '#fff',
    borderRadius: '20px',
    padding: '32px',
    width: '520px',
    maxWidth: '100%',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
  } as React.CSSProperties,

  modalTitle: {
    fontSize: '17px',
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  } as React.CSSProperties,

  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  } as React.CSSProperties,

  formGroupFull: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
    gridColumn: '1 / -1' as const,
  } as React.CSSProperties,

  label: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,

  input: {
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '14px',
    background: '#f8fafc',
    outline: 'none',
    color: '#1e293b',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  } as React.CSSProperties,

  modalActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '24px',
  } as React.CSSProperties,

  cancelBtn: {
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    padding: '9px 20px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    background: '#fff',
    color: '#64748b',
    transition: 'background 0.15s',
  } as React.CSSProperties,

  dangerBtn: {
    border: 'none',
    borderRadius: '10px',
    padding: '9px 20px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg,#ef4444,#dc2626)',
    color: '#fff',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,
};

// ─── Stock Badge ─────────────────────────────────────────────────────────────

function StockBadge({ stock, reorder }: { stock: number; reorder: number }) {
  let bg = '#dcfce7', color = '#16a34a', label = `${stock}`;
  if (stock === 0) {
    bg = '#fef2f2'; color = '#ef4444';
  } else if (stock <= reorder) {
    bg = '#fef2f2'; color = '#ef4444';
  } else if (stock <= reorder * 1.5) {
    bg = '#fff7ed'; color = '#f97316';
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '20px', fontWeight: 700,
      fontSize: '12px', background: bg, color,
    }}>
      {label}
    </span>
  );
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i}>
          {[...Array(9)].map((__, j) => (
            <td key={j} style={S.td}>
              <div style={{ ...S.skeletonRow, width: j === 0 ? '80%' : j === 8 ? '60px' : '55%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, iconBg, iconColor, loading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading: boolean;
}) {
  return (
    <div style={S.statCard}>
      <div style={S.statIconBox(iconBg)}>
        <Icon size={20} color={iconColor} />
      </div>
      <div>
        <div style={S.statLabel}>{label}</div>
        {loading
          ? <div style={{ width: '80px', height: '22px', background: '#e2e8f0', borderRadius: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          : <div style={S.statValue}>{value}</div>
        }
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fmt = (n?: number) =>
    n == null
      ? '—'
      : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  // ── Queries ────────────────────────────────────────────────────────────────

  const productsQuery = useQuery<{ data: Product[]; total: number }>({
    queryKey: ['inventory-products', search, category],
    queryFn: () =>
      api.get('/api/v1/inventory/products', {
        params: { search, category, page: 1, limit: 50 },
      }).then((r) => r.data),
    staleTime: 30_000,
  });

  const summaryQuery = useQuery<StockSummary>({
    queryKey: ['stock-summary'],
    queryFn: () => api.get('/api/v1/reports/stock-summary').then((r) => r.data),
    staleTime: 60_000,
  });

  const products: Product[] = productsQuery.data?.data ?? [];
  const summary: StockSummary = summaryQuery.data ?? {};

  // Derive unique categories for filter
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inventory-products'] });
    qc.invalidateQueries({ queryKey: ['stock-summary'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Product>) => api.post('/api/v1/inventory/products', payload).then((r) => r.data),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Product> }) =>
      api.put(`/api/v1/inventory/products/${id}`, payload).then((r) => r.data),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/inventory/products/${id}`).then((r) => r.data),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditProduct(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      code: p.code ?? '',
      category: p.category ?? '',
      subcategory: p.subcategory ?? '',
      unit: p.unit,
      hsnCode: p.hsnCode ?? '',
      gstRate: String(p.gstRate),
      purchaseRate: p.purchaseRate != null ? String(p.purchaseRate) : '',
      saleRate: p.saleRate != null ? String(p.saleRate) : '',
      currentStock: String(p.currentStock),
      reorderLevel: String(p.reorderLevel),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditProduct(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = () => {
    const payload: Partial<Product> = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      category: form.category.trim() || undefined,
      subcategory: form.subcategory.trim() || undefined,
      unit: form.unit,
      hsnCode: form.hsnCode.trim() || undefined,
      gstRate: parseFloat(form.gstRate) || 0,
      purchaseRate: form.purchaseRate ? parseFloat(form.purchaseRate) : undefined,
      saleRate: form.saleRate ? parseFloat(form.saleRate) : undefined,
      currentStock: parseFloat(form.currentStock) || 0,
      reorderLevel: parseFloat(form.reorderLevel) || 0,
    };
    if (editProduct) {
      updateMutation.mutate({ id: editProduct.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const inputStyle = (name: string): React.CSSProperties => ({
    ...S.input,
    borderColor: focusedField === name ? '#6366f1' : '#e2e8f0',
  });

  const selectStyle = (name: string): React.CSSProperties => ({
    ...S.input,
    borderColor: focusedField === name ? '#6366f1' : '#e2e8f0',
    cursor: 'pointer',
  });

  const focusHandlers = (name: string) => ({
    onFocus: () => setFocusedField(name),
    onBlur: () => setFocusedField(null),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Pulse keyframes injected once */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={S.page}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h1 style={S.h1}>Inventory</h1>
            <p style={S.sub}>Manage stock &amp; products</p>
          </div>
          <button
            style={S.primaryBtn}
            onClick={openAdd}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={16} />
            Add Product
          </button>
        </div>

        {/* Summary Cards */}
        <div style={S.summaryGrid}>
          <StatCard
            label="Total Products"
            value={summary.totalProducts ?? productsQuery.data?.total ?? 0}
            icon={Package}
            iconBg="#ede9fe"
            iconColor="#6366f1"
            loading={summaryQuery.isLoading}
          />
          <StatCard
            label="Total Stock Value"
            value={fmt(summary.totalStockValue)}
            icon={DollarSign}
            iconBg="#dcfce7"
            iconColor="#16a34a"
            loading={summaryQuery.isLoading}
          />
          <StatCard
            label="Low Stock"
            value={summary.lowStockCount ?? 0}
            icon={AlertTriangle}
            iconBg="#fff7ed"
            iconColor="#f97316"
            loading={summaryQuery.isLoading}
          />
          <StatCard
            label="Out of Stock"
            value={summary.outOfStockCount ?? 0}
            icon={ShoppingCart}
            iconBg="#fef2f2"
            iconColor="#ef4444"
            loading={summaryQuery.isLoading}
          />
        </div>

        {/* Toolbar */}
        <div style={S.toolbar}>
          <div style={S.searchWrap}>
            <span style={S.searchIcon}><Search size={15} /></span>
            <input
              style={{
                ...S.searchInput,
                borderColor: focusedField === 'search' ? '#6366f1' : '#e2e8f0',
              }}
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              {...focusHandlers('search')}
            />
          </div>
          <select
            style={{
              ...S.select,
              borderColor: focusedField === 'catFilter' ? '#6366f1' : '#e2e8f0',
            }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            {...focusHandlers('catFilter')}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c as string}>{c}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div style={S.tableCard}>
          <table style={S.table}>
            <thead style={S.thead}>
              <tr>
                <th style={S.th}>Name / Code</th>
                <th style={S.th}>Category</th>
                <th style={S.th}>Unit</th>
                <th style={S.th}>Purchase Rate</th>
                <th style={S.th}>Sale Rate</th>
                <th style={S.th}>Current Stock</th>
                <th style={S.th}>Reorder Level</th>
                <th style={S.th}>GST %</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {productsQuery.isLoading ? (
                <SkeletonRows />
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...S.td, textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Package size={32} color="#cbd5e1" />
                      <span>No products found. Add your first product.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    fmt={fmt}
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDeleteTarget(p)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={S.modal}>
            <div style={S.modalTitle}>
              <span>{editProduct ? 'Edit Product' : 'Add Product'}</span>
              <button
                onClick={closeModal}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={S.formGrid}>
              {/* Name */}
              <div style={S.formGroupFull}>
                <label style={S.label}>Product Name *</label>
                <input
                  style={inputStyle('name')}
                  placeholder="e.g. Silk Dupatta"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  {...focusHandlers('name')}
                />
              </div>

              {/* Code */}
              <div style={S.formGroup}>
                <label style={S.label}>Code / SKU</label>
                <input
                  style={inputStyle('code')}
                  placeholder="e.g. SD-001"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  {...focusHandlers('code')}
                />
              </div>

              {/* Unit */}
              <div style={S.formGroup}>
                <label style={S.label}>Unit *</label>
                <select
                  style={selectStyle('unit')}
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  {...focusHandlers('unit')}
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Category */}
              <div style={S.formGroup}>
                <label style={S.label}>Category</label>
                <input
                  style={inputStyle('category')}
                  placeholder="e.g. Sarees"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  {...focusHandlers('category')}
                />
              </div>

              {/* Subcategory */}
              <div style={S.formGroup}>
                <label style={S.label}>Subcategory</label>
                <input
                  style={inputStyle('subcategory')}
                  placeholder="e.g. Silk"
                  value={form.subcategory}
                  onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                  {...focusHandlers('subcategory')}
                />
              </div>

              {/* HSN Code */}
              <div style={S.formGroup}>
                <label style={S.label}>HSN Code</label>
                <input
                  style={inputStyle('hsnCode')}
                  placeholder="e.g. 5208"
                  value={form.hsnCode}
                  onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
                  {...focusHandlers('hsnCode')}
                />
              </div>

              {/* GST Rate */}
              <div style={S.formGroup}>
                <label style={S.label}>GST Rate (%)</label>
                <input
                  style={inputStyle('gstRate')}
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="5"
                  value={form.gstRate}
                  onChange={(e) => setForm({ ...form, gstRate: e.target.value })}
                  {...focusHandlers('gstRate')}
                />
              </div>

              {/* Purchase Rate */}
              <div style={S.formGroup}>
                <label style={S.label}>Purchase Rate (₹)</label>
                <input
                  style={inputStyle('purchaseRate')}
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={form.purchaseRate}
                  onChange={(e) => setForm({ ...form, purchaseRate: e.target.value })}
                  {...focusHandlers('purchaseRate')}
                />
              </div>

              {/* Sale Rate */}
              <div style={S.formGroup}>
                <label style={S.label}>Sale Rate (₹)</label>
                <input
                  style={inputStyle('saleRate')}
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={form.saleRate}
                  onChange={(e) => setForm({ ...form, saleRate: e.target.value })}
                  {...focusHandlers('saleRate')}
                />
              </div>

              {/* Current Stock */}
              <div style={S.formGroup}>
                <label style={S.label}>Current Stock</label>
                <input
                  style={inputStyle('currentStock')}
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.currentStock}
                  onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                  {...focusHandlers('currentStock')}
                />
              </div>

              {/* Reorder Level */}
              <div style={S.formGroup}>
                <label style={S.label}>Reorder Level</label>
                <input
                  style={inputStyle('reorderLevel')}
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.reorderLevel}
                  onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                  {...focusHandlers('reorderLevel')}
                />
              </div>
            </div>

            <div style={S.modalActions}>
              <button
                style={S.cancelBtn}
                onClick={closeModal}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                Cancel
              </button>
              <button
                style={{ ...S.primaryBtn, opacity: isSaving || !form.name.trim() ? 0.6 : 1 }}
                onClick={handleSave}
                disabled={isSaving || !form.name.trim()}
                onMouseEnter={(e) => { if (!isSaving && form.name.trim()) e.currentTarget.style.opacity = '0.88'; }}
                onMouseLeave={(e) => { if (!isSaving && form.name.trim()) e.currentTarget.style.opacity = '1'; }}
              >
                {isSaving ? 'Saving…' : editProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div style={{ ...S.modal, width: '420px', textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={24} color="#ef4444" />
              </div>
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Delete Product</h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: '#1e293b' }}>{deleteTarget.name}</strong>?
              This action cannot be undone.
            </p>
            <div style={{ ...S.modalActions, justifyContent: 'center' }}>
              <button
                style={S.cancelBtn}
                onClick={() => setDeleteTarget(null)}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                Cancel
              </button>
              <button
                style={{ ...S.dangerBtn, opacity: deleteMutation.isPending ? 0.6 : 1 }}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                onMouseEnter={(e) => { if (!deleteMutation.isPending) e.currentTarget.style.opacity = '0.88'; }}
                onMouseLeave={(e) => { if (!deleteMutation.isPending) e.currentTarget.style.opacity = '1'; }}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Product Row (extracted to avoid hook-in-loop issues) ─────────────────────

function ProductRow({
  product: p,
  fmt,
  onEdit,
  onDelete,
}: {
  product: Product;
  fmt: (n?: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      style={{ background: hovered ? '#f8fafc' : '#fff', transition: 'background 0.12s' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={S.td}>
        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13.5px' }}>{p.name}</div>
        {p.code && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{p.code}</div>}
      </td>
      <td style={S.td}>
        <div style={{ fontSize: '13px', color: '#475569' }}>{p.category ?? '—'}</div>
        {p.subcategory && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{p.subcategory}</div>}
      </td>
      <td style={S.td}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: '6px',
          background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700,
        }}>
          {p.unit}
        </span>
      </td>
      <td style={{ ...S.td, fontWeight: 500, color: '#475569' }}>{fmt(p.purchaseRate)}</td>
      <td style={{ ...S.td, fontWeight: 600, color: '#1e293b' }}>{fmt(p.saleRate)}</td>
      <td style={S.td}>
        <StockBadge stock={p.currentStock} reorder={p.reorderLevel} />
      </td>
      <td style={{ ...S.td, color: '#64748b', fontSize: '13px' }}>{p.reorderLevel}</td>
      <td style={{ ...S.td, color: '#64748b', fontSize: '13px' }}>{p.gstRate}%</td>
      <td style={{ ...S.td, textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
          <button
            style={{ ...S.actionBtn('#6366f1', '#ede9fe'), border: 'none' }}
            onClick={onEdit}
            title="Edit"
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Pencil size={14} />
          </button>
          <button
            style={{ ...S.actionBtn('#ef4444', '#fef2f2'), border: 'none' }}
            onClick={onDelete}
            title="Delete"
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
