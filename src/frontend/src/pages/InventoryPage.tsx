import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import * as XLSX from 'xlsx';
import {
  Plus, Search, Pencil, Trash2, X, Package, DollarSign, AlertTriangle, ShoppingCart,
  ArrowDownToLine, ArrowUpFromLine, RotateCcw, History, BarChart2, Download, ChevronLeft, ChevronRight,
  Warehouse, ArrowLeftRight, Upload, Clock,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string; name: string; code?: string; category?: string; subcategory?: string;
  unit: string; hsnCode?: string; gstRate: number; purchaseRate?: number; saleRate?: number;
  currentStock: number; reorderLevel: number; maxStock?: number; isActive: boolean;
}

interface StockMovement {
  id: string; type: string; quantity: number; rate?: number; notes?: string;
  batchNo?: string; createdAt: string;
  product?: { name: string; unit: string };
  godown?: { name: string };
}

interface StockSummary {
  totalProducts?: number; totalStockValue?: number; lowStockCount?: number; outOfStockCount?: number;
}

interface ValuationRow {
  id: string; name: string; code?: string; category?: string; unit: string;
  currentStock: number; purchaseRate: number; saleRate: number;
  costValue: number; sellValue: number; potentialProfit: number; marginPct: number;
  status: string;
}

interface FormState {
  name: string; code: string; category: string; subcategory: string; unit: string;
  hsnCode: string; gstRate: string; purchaseRate: string; saleRate: string;
  currentStock: string; reorderLevel: string; maxStock: string;
}

const EMPTY_FORM: FormState = {
  name: '', code: '', category: '', subcategory: '', unit: 'METER',
  hsnCode: '', gstRate: '0', purchaseRate: '', saleRate: '',
  currentStock: '0', reorderLevel: '0', maxStock: '',
};

const UNITS = ['METER', 'KG', 'PIECE', 'BUNDLE', 'BOX', 'ROLL'];

const MOVEMENT_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PURCHASE:    { label: 'Purchase',      color: '#059669', bg: '#ecfdf5' },
  SALE:        { label: 'Sale',          color: '#dc2626', bg: '#fef2f2' },
  ADJUSTMENT:  { label: 'Adjustment',    color: '#7c3aed', bg: '#f5f3ff' },
  DAMAGE:      { label: 'Damage',        color: '#d97706', bg: '#fffbeb' },
  SAMPLE:      { label: 'Sample',        color: '#0891b2', bg: '#ecfeff' },
  OPENING:     { label: 'Opening Stock', color: '#374151', bg: '#f3f4f6' },
  RETURN_IN:   { label: 'Return In',     color: '#16a34a', bg: '#dcfce7' },
  RETURN_OUT:  { label: 'Return Out',    color: '#b45309', bg: '#fef3c7' },
  TRANSFER_IN: { label: 'Transfer In',   color: '#2563eb', bg: '#eff6ff' },
  TRANSFER_OUT:{ label: 'Transfer Out',  color: '#7c3aed', bg: '#f5f3ff' },
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: { padding: '24px 28px', fontFamily: "Inter,-apple-system,'Segoe UI',sans-serif", background: '#f5f6fa', minHeight: '100vh' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap' as const, gap: '12px' },
  h1: { fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.03em' } as React.CSSProperties,
  sub: { fontSize: '13px', color: '#9ca3af', marginTop: '2px' } as React.CSSProperties,
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '18px' } as React.CSSProperties,
  toolbar: { display: 'flex', gap: '10px', flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: '14px' },
  tableCard: { background: '#fff', borderRadius: '14px', border: '1px solid #e4e7ef', overflow: 'hidden', boxShadow: '0 1px 4px rgba(17,24,39,.04)' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, minWidth: '900px' },
  thead: { background: '#f8f9fc' },
  th: { padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #e4e7ef', textAlign: 'left' as const, whiteSpace: 'nowrap' as const } as React.CSSProperties,
  td: { padding: '10px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' as const } as React.CSSProperties,
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', backdropFilter: 'blur(2px)', overflowY: 'auto' as const },
  modal: { background: '#fff', borderRadius: '18px', width: '680px', maxWidth: '100%', boxShadow: '0 24px 80px rgba(15,23,42,.2)', overflow: 'hidden' } as React.CSSProperties,
  modalTitle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f5f6fa', background: 'linear-gradient(135deg,#f8faff,#f0f4ff)', fontSize: '15px', fontWeight: 800, color: '#1a2235' } as React.CSSProperties,
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '16px 22px', borderTop: '1px solid #f5f6fa' } as React.CSSProperties,
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '20px 22px' } as React.CSSProperties,
  formGroup: {} as React.CSSProperties,
  formGroupFull: { gridColumn: '1 / -1' } as React.CSSProperties,
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' } as React.CSSProperties,
  input: { width: '100%', padding: '8px 11px', borderRadius: '8px', border: '1.5px solid #e4e7ef', fontSize: '13px', color: '#1a2235', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const } as React.CSSProperties,
  primaryBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', background: '#5b5bd6', color: '#fff', fontFamily: 'inherit' } as React.CSSProperties,
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, border: '1.5px solid #e4e7ef', cursor: 'pointer', background: '#fff', color: '#374151', fontFamily: 'inherit' } as React.CSSProperties,
  cancelBtn: { padding: '8px 18px', borderRadius: '9px', border: '1.5px solid #e4e7ef', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  dangerBtn: { padding: '8px 18px', borderRadius: '9px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  actionBtn: (color: string, bg: string): React.CSSProperties => ({ padding: '5px 8px', borderRadius: '7px', border: 'none', background: bg, color, cursor: 'pointer', display: 'flex', alignItems: 'center' }),
  select: { padding: '8px 11px', borderRadius: '8px', border: '1.5px solid #e4e7ef', fontSize: '13px', color: '#1a2235', outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({ padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: active ? 700 : 500, border: 'none', cursor: 'pointer', background: active ? '#5b5bd6' : '#f3f4f6', color: active ? '#fff' : '#6b7280', fontFamily: 'inherit', transition: 'all .12s' }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n?: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtQty = (n: number, unit: string) => `${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${unit}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StockBadge({ stock, reorder, maxStock }: { stock: number; reorder: number; maxStock?: number }) {
  const isOut  = stock === 0;
  const isLow  = !isOut && stock <= reorder;
  const isOver = maxStock != null && maxStock > 0 && stock > maxStock;
  const color  = isOut ? '#dc2626' : isLow ? '#d97706' : isOver ? '#7c3aed' : '#16a34a';
  const bg     = isOut ? '#fef2f2' : isLow ? '#fffbeb' : isOver ? '#f5f3ff' : '#ecfdf5';
  const label  = isOut ? 'Out of Stock' : isLow ? `Low: ${stock}` : isOver ? `Over: ${stock}` : String(stock);
  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: bg, color }}>
      {label}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, loading }: any) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 18px', border: '1px solid #e4e7ef', boxShadow: '0 1px 4px rgba(17,24,39,.04)' }}>
      {loading ? (
        <div style={{ height: '48px', borderRadius: '8px', background: '#f3f4f6', animation: 'pulse 1.5s infinite' }} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} color={iconColor} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{value}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MovementTypeBadge({ type }: { type: string }) {
  const t = MOVEMENT_TYPE_LABELS[type] ?? { label: type, color: '#374151', bg: '#f3f4f6' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: t.bg, color: t.color }}>
      {t.label}
    </span>
  );
}

// ─── Stock History Drawer ─────────────────────────────────────────────────────

function HistoryDrawer({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['movements', product.id],
    queryFn: () => api.get('/api/v1/inventory/movements', { params: { productId: product.id, limit: 100 } }).then(r => r.data.data as StockMovement[]),
  });

  const movements = data ?? [];
  // compute running balance from oldest → newest
  const withBalance = [...movements].reverse().reduce<(StockMovement & { balance: number })[]>((acc, m) => {
    const prev = acc[acc.length - 1]?.balance ?? 0;
    acc.push({ ...m, balance: prev + Number(m.quantity) });
    return acc;
  }, []).reverse();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1100, display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '520px', maxWidth: '100vw', background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#f8faff,#f0f4ff)' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#1a2235' }}>{product.name}</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Stock Movement History</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', display: 'flex' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: '20px' }}>
          <div><div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Current Stock</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>{product.currentStock} <span style={{ fontSize: '13px', color: '#9ca3af' }}>{product.unit}</span></div></div>
          <div><div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Reorder At</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706' }}>{product.reorderLevel}</div></div>
        </div>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
        ) : movements.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9ca3af' }}>
            <History size={32} style={{ marginBottom: '10px', opacity: .3 }} />
            <div>No movement history yet.</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#f8f9fc' }}>
                  {['Date', 'Type', 'Qty', 'Rate', 'Balance', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e4e7ef' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withBalance.map((m) => {
                  const qty = Number(m.quantity);
                  const isIn = qty > 0;
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '8px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(m.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                      <td style={{ padding: '8px 12px' }}><MovementTypeBadge type={m.type} /></td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: isIn ? '#059669' : '#dc2626' }}>{isIn ? '+' : ''}{qty}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{m.rate ? fmt(Number(m.rate)) : '—'}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{m.balance}</td>
                      <td style={{ padding: '8px 12px', color: '#9ca3af', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stock Adjustment Modal ───────────────────────────────────────────────────

function AdjustmentModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('ADJUSTMENT');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const REMOVAL_TYPES = ['DAMAGE', 'SAMPLE', 'RETURN_OUT'];
  const isRemoval = REMOVAL_TYPES.includes(type);

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/inventory/movements', {
      productId: product.id,
      type,
      quantity: isRemoval ? -Math.abs(parseFloat(qty)) : Math.abs(parseFloat(qty)),
      rate: rate ? parseFloat(rate) : undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to save'),
  });

  const handleSave = () => {
    if (!qty || parseFloat(qty) <= 0) { setError('Enter a valid quantity'); return; }
    if (isRemoval && parseFloat(qty) > product.currentStock) { setError(`Cannot remove more than current stock (${product.currentStock})`); return; }
    setError('');
    mutation.mutate();
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, width: '460px' }}>
        <div style={S.modalTitle}>
          <span>Adjust Stock — {product.name}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={S.label}>Adjustment Type</label>
            <select style={{ ...S.input, cursor: 'pointer' }} value={type} onChange={e => setType(e.target.value)}>
              <option value="OPENING">Opening Stock (+)</option>
              <option value="ADJUSTMENT">Correction / Adjustment (+/−)</option>
              <option value="DAMAGE">Damage (−)</option>
              <option value="SAMPLE">Sample Given (−)</option>
              <option value="RETURN_OUT">Purchase Return (−)</option>
              <option value="RETURN_IN">Customer Return (+)</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={S.label}>Quantity ({product.unit}) *</label>
              <input style={S.input} type="number" min="0.001" step="0.001" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Rate (₹) <span style={{ color: '#9ca3af' }}>optional</span></label>
              <input style={S.input} type="number" min="0" step="0.01" placeholder="0.00" value={rate} onChange={e => setRate(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={S.label}>Notes <span style={{ color: '#9ca3af' }}>optional</span></label>
            <input style={S.input} placeholder="Reason for adjustment…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div style={{ background: '#f8f9fc', borderRadius: '9px', padding: '10px 14px', fontSize: '12.5px', color: '#6b7280' }}>
            Current stock: <strong style={{ color: '#111827' }}>{product.currentStock} {product.unit}</strong>
            {qty && !isNaN(parseFloat(qty)) && (
              <> → After: <strong style={{ color: isRemoval && parseFloat(qty) > product.currentStock ? '#dc2626' : '#059669' }}>
                {isRemoval ? product.currentStock - Math.abs(parseFloat(qty)) : product.currentStock + Math.abs(parseFloat(qty))} {product.unit}
              </strong></>
            )}
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '12.5px', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>}
        </div>
        <div style={S.modalActions}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...S.primaryBtn, opacity: mutation.isPending ? 0.6 : 1 }} onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock Inward Modal ───────────────────────────────────────────────────────

function InwardModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState(product.purchaseRate ? String(product.purchaseRate) : '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchNo, setBatchNo] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/inventory/stock-inward', {
      productId: product.id,
      quantity: parseFloat(qty),
      rate: rate ? parseFloat(rate) : undefined,
      batchNo: batchNo || undefined,
      notes: notes || undefined,
      date,
    }),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const handleSave = () => {
    if (!qty || parseFloat(qty) <= 0) { setError('Enter a valid quantity'); return; }
    setError(''); mutation.mutate();
  };

  const total = qty && rate ? parseFloat(qty) * parseFloat(rate) : null;

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, width: '460px' }}>
        <div style={S.modalTitle}>
          <span>Stock Inward — {product.name}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={S.label}>Quantity ({product.unit}) *</label>
              <input style={S.input} type="number" min="0.001" step="0.001" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Purchase Rate (₹)</label>
              <input style={S.input} type="number" min="0" step="0.01" placeholder="0.00" value={rate} onChange={e => setRate(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Date</label>
              <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Batch No <span style={{ color: '#9ca3af' }}>optional</span></label>
              <input style={S.input} placeholder="e.g. LOT-001" value={batchNo} onChange={e => setBatchNo(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={S.label}>Notes <span style={{ color: '#9ca3af' }}>optional</span></label>
            <input style={S.input} placeholder="Supplier name, invoice no…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {total != null && (
            <div style={{ background: '#ecfdf5', borderRadius: '9px', padding: '10px 14px', fontSize: '12.5px', color: '#065f46' }}>
              Total Value: <strong>{fmt(total)}</strong> &nbsp;·&nbsp; After inward: <strong>{product.currentStock + parseFloat(qty)} {product.unit}</strong>
            </div>
          )}
          {error && <div style={{ color: '#dc2626', fontSize: '12.5px', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>}
        </div>
        <div style={S.modalActions}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...S.primaryBtn, background: '#059669', opacity: mutation.isPending ? 0.6 : 1 }} onClick={handleSave} disabled={mutation.isPending}>
            <ArrowDownToLine size={14} />{mutation.isPending ? 'Saving…' : 'Add Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Returns Modal ────────────────────────────────────────────────────────────

function ReturnModal({ product, returnType, onClose, onSaved }: { product: Product; returnType: 'sales' | 'purchase'; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState(returnType === 'sales' ? (product.saleRate ? String(product.saleRate) : '') : (product.purchaseRate ? String(product.purchaseRate) : ''));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const endpoint = returnType === 'sales' ? '/api/v1/inventory/sales-return' : '/api/v1/inventory/purchase-return';
  const label    = returnType === 'sales' ? 'Sales Return (Customer)' : 'Purchase Return (Supplier)';

  const mutation = useMutation({
    mutationFn: () => api.post(endpoint, {
      productId: product.id,
      quantity: parseFloat(qty),
      rate: rate ? parseFloat(rate) : undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, width: '420px' }}>
        <div style={S.modalTitle}>
          <span>{label} — {product.name}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={S.label}>Quantity ({product.unit}) *</label>
              <input style={S.input} type="number" min="0.001" step="0.001" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Rate (₹) <span style={{ color: '#9ca3af' }}>optional</span></label>
              <input style={S.input} type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={S.label}>Notes</label>
            <input style={S.input} placeholder="Reason for return…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div style={{ background: '#fffbeb', borderRadius: '9px', padding: '10px 14px', fontSize: '12.5px', color: '#78350f' }}>
            Current stock: <strong>{product.currentStock} {product.unit}</strong>
            {qty && !isNaN(parseFloat(qty)) && returnType === 'purchase' && parseFloat(qty) > product.currentStock && (
              <span style={{ color: '#dc2626', marginLeft: '8px' }}>⚠ Exceeds current stock</span>
            )}
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '12.5px', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>}
        </div>
        <div style={S.modalActions}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...S.primaryBtn, background: '#d97706', opacity: mutation.isPending ? 0.6 : 1 }} onClick={() => { if (!qty || parseFloat(qty) <= 0) { setError('Enter valid quantity'); return; } setError(''); mutation.mutate(); }} disabled={mutation.isPending}>
            <RotateCcw size={14} />{mutation.isPending ? 'Saving…' : 'Record Return'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── P3 Types ─────────────────────────────────────────────────────────────────

interface Godown { id: string; name: string; address?: string; isActive: boolean; }
interface GodownStock { id: string; quantity: number; product: { id: string; name: string; code?: string; unit: string; category?: string; reorderLevel: number; saleRate?: number; purchaseRate?: number; }; godown: { id: string; name: string }; }
interface AgingRow { id: string; name: string; code?: string; category?: string; unit: string; currentStock: number; purchaseRate: number; saleRate: number; stockValue: number; lastSaleDate: string | null; daysSinceLastSale: number | null; bucket: string; }

// ─── Godown Tab ───────────────────────────────────────────────────────────────

function GodownTab({ onInvalidate }: { onInvalidate: () => void }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [editGodown, setEditGodown] = useState<Godown | null>(null);
  const [formName, setFormName]     = useState('');
  const [formAddr, setFormAddr]     = useState('');
  const [saving, setSaving]         = useState(false);

  const { data: godownsData, isLoading } = useQuery({
    queryKey: ['godowns'],
    queryFn: () => api.get('/api/v1/inventory/godowns').then(r => r.data.data as Godown[]),
  });
  const godowns = godownsData ?? [];

  const { data: stockData } = useQuery({
    queryKey: ['godown-stock', selectedId],
    queryFn: () => api.get(`/api/v1/inventory/godowns/${selectedId}/stock`).then(r => r.data),
    enabled: !!selectedId,
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['godowns'] }); qc.invalidateQueries({ queryKey: ['godown-stock'] }); onInvalidate(); };

  const saveGodown = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editGodown) {
        await api.put(`/api/v1/inventory/godowns/${editGodown.id}`, { name: formName, address: formAddr || undefined });
      } else {
        await api.post('/api/v1/inventory/godowns', { name: formName, address: formAddr || undefined });
      }
      invalidate(); setShowAdd(false); setEditGodown(null); setFormName(''); setFormAddr('');
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed'); }
    setSaving(false);
  };

  const deleteGodown = async (id: string) => {
    if (!confirm('Delete this godown? Stock records will be preserved.')) return;
    await api.delete(`/api/v1/inventory/godowns/${id}`);
    invalidate();
    if (selectedId === id) setSelectedId(null);
  };

  const openEdit = (g: Godown) => { setEditGodown(g); setFormName(g.name); setFormAddr(g.address ?? ''); setShowAdd(true); };

  const stockRows: GodownStock[] = stockData?.data ?? [];
  const selectedGodown = godowns.find(g => g.id === selectedId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px', minHeight: '400px' }}>
      {/* Left: godown list */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e4e7ef', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Godowns</span>
          <button style={{ ...S.primaryBtn, padding: '4px 10px', fontSize: '12px' }} onClick={() => { setEditGodown(null); setFormName(''); setFormAddr(''); setShowAdd(true); }}><Plus size={12} /></button>
        </div>
        {isLoading ? <div style={{ padding: '20px', color: '#9ca3af', fontSize: '13px' }}>Loading…</div>
          : godowns.length === 0 ? <div style={{ padding: '20px', color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}><Warehouse size={24} style={{ opacity: .3, marginBottom: '8px' }} /><div>No godowns yet</div></div>
          : godowns.map(g => (
            <div key={g.id} onClick={() => setSelectedId(g.id)} style={{ padding: '10px 14px', cursor: 'pointer', background: selectedId === g.id ? '#ede9fe' : 'transparent', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: selectedId === g.id ? 700 : 500, color: selectedId === g.id ? '#5b5bd6' : '#1a2235' }}>{g.name}</div>
                {g.address && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{g.address}</div>}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={e => { e.stopPropagation(); openEdit(g); }} style={S.actionBtn('#5b5bd6', '#ede9fe')}><Pencil size={11} /></button>
                <button onClick={e => { e.stopPropagation(); deleteGodown(g.id); }} style={S.actionBtn('#ef4444', '#fef2f2')}><Trash2 size={11} /></button>
              </div>
            </div>
          ))
        }
      </div>

      {/* Right: stock in selected godown */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e4e7ef', overflow: 'hidden' }}>
        {!selectedId ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}><Warehouse size={32} style={{ opacity: .3, marginBottom: '12px' }} /><div>Select a godown to view its stock</div></div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px', color: '#1a2235' }}>{selectedGodown?.name} — Stock</div>
            {stockRows.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No stock recorded for this godown yet.<br/>Use Stock Inward with a godown to start tracking.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ ...S.table, minWidth: '600px' }}>
                  <thead style={S.thead}><tr>
                    {['Product', 'Category', 'Unit', 'Qty in Godown', 'Buy Rate', 'Value'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {stockRows.map(r => {
                      const qty = Number(r.quantity);
                      const val = qty * Number(r.product.purchaseRate ?? 0);
                      const fmt2 = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={S.td}><div style={{ fontWeight: 600 }}>{r.product.name}</div>{r.product.code && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{r.product.code}</div>}</td>
                          <td style={S.td}>{r.product.category ?? '—'}</td>
                          <td style={S.td}>{r.product.unit}</td>
                          <td style={S.td}><span style={{ fontWeight: 700, color: qty <= 0 ? '#dc2626' : '#059669' }}>{qty}</span></td>
                          <td style={S.td}>{fmt2(Number(r.product.purchaseRate ?? 0))}</td>
                          <td style={{ ...S.td, fontWeight: 600, color: '#7c3aed' }}>{fmt2(val)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Godown Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#1a2235', marginBottom: '16px' }}>{editGodown ? 'Edit Godown' : 'Add Godown'}</div>
            <label style={S.label}>Name *</label>
            <input style={{ ...S.input, marginBottom: '12px' }} placeholder="e.g. Main Warehouse" value={formName} onChange={e => setFormName(e.target.value)} />
            <label style={S.label}>Address <span style={{ color: '#9ca3af', fontWeight: 400 }}>optional</span></label>
            <input style={{ ...S.input, marginBottom: '16px' }} placeholder="e.g. Ring Road, Surat" value={formAddr} onChange={e => setFormAddr(e.target.value)} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button style={S.cancelBtn} onClick={() => { setShowAdd(false); setEditGodown(null); }}>Cancel</button>
              <button style={{ ...S.primaryBtn, opacity: saving || !formName.trim() ? .6 : 1 }} onClick={saveGodown} disabled={saving || !formName.trim()}>{saving ? 'Saving…' : editGodown ? 'Save' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Transfer Tab ─────────────────────────────────────────────────────────────

function TransferTab({ onInvalidate }: { onInvalidate: () => void }) {
  const [productId, setProductId]   = useState('');
  const [fromId, setFromId]         = useState('');
  const [toId, setToId]             = useState('');
  const [qty, setQty]               = useState('');
  const [notes, setNotes]           = useState('');
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const { data: godownsData } = useQuery({ queryKey: ['godowns'], queryFn: () => api.get('/api/v1/inventory/godowns').then(r => r.data.data as Godown[]) });
  const { data: productsData } = useQuery({ queryKey: ['inventory-products-all'], queryFn: () => api.get('/api/v1/inventory/products', { params: { limit: 2000 } }).then(r => r.data.data) });
  const { data: sbgData } = useQuery({ queryKey: ['stock-by-godown'], queryFn: () => api.get('/api/v1/inventory/stock-by-godown').then(r => r.data) });

  const godowns = godownsData ?? [];
  const products = (productsData ?? []).map((p: any) => ({ ...p, currentStock: Number(p.currentStock) }));
  const stockRows: GodownStock[] = sbgData?.data ?? [];

  // Available qty in selected fromGodown for selected product
  const availableQty = useMemo(() => {
    if (!productId || !fromId) return null;
    const row = stockRows.find(r => r.product.id === productId && r.godown.id === fromId);
    return row ? Number(row.quantity) : 0;
  }, [productId, fromId, stockRows]);

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/inventory/transfer', { productId, fromGodownId: fromId, toGodownId: toId, quantity: parseFloat(qty), notes: notes || undefined }),
    onSuccess: () => {
      setSuccess('Transfer recorded successfully');
      setQty(''); setNotes(''); setError('');
      onInvalidate();
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Transfer failed'),
  });

  const handleTransfer = () => {
    if (!productId || !fromId || !toId || !qty) { setError('Fill all required fields'); return; }
    if (fromId === toId) { setError('Source and destination must be different'); return; }
    if (parseFloat(qty) <= 0) { setError('Enter a valid quantity'); return; }
    setError(''); mutation.mutate();
  };

  const selectedProduct = products.find((p: any) => p.id === productId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Transfer Form */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e4e7ef', padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a2235', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeftRight size={16} color="#5b5bd6" />Stock Transfer</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={S.label}>Product *</label>
            <select style={{ ...S.input, cursor: 'pointer' }} value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">Select product…</option>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={S.label}>From Godown *</label>
              <select style={{ ...S.input, cursor: 'pointer' }} value={fromId} onChange={e => setFromId(e.target.value)}>
                <option value="">Select…</option>
                {godowns.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>To Godown *</label>
              <select style={{ ...S.input, cursor: 'pointer' }} value={toId} onChange={e => setToId(e.target.value)}>
                <option value="">Select…</option>
                {godowns.filter(g => g.id !== fromId).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={S.label}>Quantity {selectedProduct ? `(${selectedProduct.unit})` : ''} *</label>
            <input style={S.input} type="number" min="0.001" step="0.001" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
            {availableQty !== null && <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '4px' }}>Available in source godown: <strong>{availableQty}</strong></div>}
          </div>
          <div>
            <label style={S.label}>Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>optional</span></label>
            <input style={S.input} placeholder="Reason for transfer…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: '12.5px', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>}
          {success && <div style={{ color: '#059669', fontSize: '12.5px', background: '#ecfdf5', padding: '8px 12px', borderRadius: '8px' }}>{success}</div>}
          <button style={{ ...S.primaryBtn, justifyContent: 'center', opacity: mutation.isPending ? .6 : 1 }} onClick={handleTransfer} disabled={mutation.isPending}>
            <ArrowLeftRight size={14} />{mutation.isPending ? 'Transferring…' : 'Transfer Stock'}
          </button>
        </div>
      </div>

      {/* Stock distribution view */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e4e7ef', padding: '20px', overflowY: 'auto', maxHeight: '500px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a2235', marginBottom: '12px' }}>Stock Distribution</div>
        {godowns.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: '13px' }}>No godowns configured yet.</div>
        ) : godowns.map(g => {
          const rows = stockRows.filter(r => r.godown.id === g.id);
          return (
            <div key={g.id} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#5b5bd6', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><Warehouse size={12} />{g.name}</div>
              {rows.length === 0 ? <div style={{ fontSize: '12px', color: '#9ca3af', paddingLeft: '18px' }}>No stock</div>
                : rows.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '3px 0 3px 18px', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ color: '#374151' }}>{r.product.name}</span>
                    <span style={{ fontWeight: 600, color: Number(r.quantity) > 0 ? '#059669' : '#dc2626' }}>{Number(r.quantity)} {r.product.unit}</span>
                  </div>
                ))
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Bulk Import Tab ─────────────────────────────────────────────────────────

function BulkImportTab({ onInvalidate }: { onInvalidate: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [result, setResult] = useState<{ created: number; updated: number; errors: { row: number; error: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const TEMPLATE_HEADERS = ['name', 'code', 'category', 'subcategory', 'unit', 'hsnCode', 'gstRate', 'purchaseRate', 'saleRate', 'currentStock', 'reorderLevel', 'maxStock'];

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['Silk Dupatta', 'SKU-001', 'Fabric', 'Silk', 'METER', '5007', '5', '250', '400', '100', '20', '500'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'product-import-template.xlsx');
  };

  const handleFile = (file: File) => {
    setError(''); setResult(null); setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
        if (data.length === 0) { setError('File is empty'); return; }
        // Normalize keys to lowercase
        const normalized = data.map((row: any) => {
          const norm: any = {};
          for (const k of Object.keys(row)) norm[k.toLowerCase().replace(/\s+/g, '')] = row[k];
          // Parse numbers
          ['gstrate', 'purchaserate', 'salerate', 'currentstock', 'reorderlevel', 'maxstock'].forEach(k => {
            if (norm[k] !== '' && norm[k] !== undefined) norm[k] = parseFloat(norm[k]) || 0;
          });
          return {
            name: norm.name || norm['productname'] || '',
            code: norm.code || norm.sku || '',
            category: norm.category || '',
            subcategory: norm.subcategory || '',
            unit: (norm.unit || 'METER').toUpperCase(),
            hsnCode: norm.hsncode || '',
            gstRate: norm.gstrate ?? 5,
            purchaseRate: norm.purchaserate || undefined,
            saleRate: norm.salerate || undefined,
            currentStock: norm.currentstock ?? 0,
            reorderLevel: norm.reorderlevel ?? 0,
            maxStock: norm.maxstock || undefined,
          };
        });
        setRows(normalized);
      } catch (e) { setError('Failed to parse file. Use the template.'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true); setError('');
    try {
      const r = await api.post('/api/v1/inventory/bulk-import', { products: rows });
      setResult(r.data);
      if (r.data.created > 0 || r.data.updated > 0) onInvalidate();
    } catch (e: any) { setError(e?.response?.data?.error || 'Import failed'); }
    setImporting(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Upload area */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e4e7ef', padding: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a2235', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Upload size={16} color="#5b5bd6" />Bulk Import Products</div>
        <div style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '20px' }}>Upload an Excel or CSV file to create/update multiple products at once. Products with matching Code/SKU will be updated; others will be created.</div>

        <button style={{ ...S.secondaryBtn, marginBottom: '16px', width: '100%', justifyContent: 'center' }} onClick={downloadTemplate}>
          <Download size={14} /> Download Template
        </button>

        <div
          style={{ border: '2px dashed #e4e7ef', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: '#fafbff' }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload size={24} color="#9ca3af" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>Click or drag file here</div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Excel (.xlsx) or CSV</div>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: '12.5px', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', marginTop: '12px' }}>{error}</div>}

        {rows.length > 0 && !result && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '12.5px', color: '#059669', fontWeight: 600, marginBottom: '8px' }}>✓ {rows.length} rows ready to import</div>
            <button style={{ ...S.primaryBtn, width: '100%', justifyContent: 'center', opacity: importing ? .6 : 1 }} onClick={handleImport} disabled={importing}>
              <Upload size={14} />{importing ? 'Importing…' : `Import ${rows.length} Products`}
            </button>
          </div>
        )}

        {result && (
          <div style={{ marginTop: '14px', background: '#ecfdf5', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#059669', marginBottom: '6px' }}>Import Complete</div>
            <div style={{ fontSize: '12.5px', color: '#374151' }}>✅ Created: <strong>{result.created}</strong> &nbsp; 🔄 Updated: <strong>{result.updated}</strong></div>
            {result.errors.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626' }}>
                ⚠ {result.errors.length} errors:
                {result.errors.slice(0, 5).map(e => <div key={e.row}>Row {e.row}: {e.error}</div>)}
              </div>
            )}
            <button style={{ ...S.secondaryBtn, marginTop: '10px', fontSize: '12px' }} onClick={() => { setRows([]); setResult(null); }}>Import Another File</button>
          </div>
        )}
      </div>

      {/* Preview */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e4e7ef', padding: '20px', overflowY: 'auto', maxHeight: '500px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a2235', marginBottom: '12px' }}>Preview</div>
        {rows.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}><Package size={28} style={{ opacity: .3, marginBottom: '8px' }} /><div>Upload a file to preview</div></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead><tr style={{ background: '#f8f9fc' }}>
                {['Name', 'Code', 'Category', 'Unit', 'Buy Rate', 'Sell Rate', 'Stock'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #e4e7ef' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 600, color: r.name ? '#1a2235' : '#dc2626' }}>{r.name || '⚠ Missing'}</td>
                    <td style={{ padding: '5px 10px', color: '#9ca3af' }}>{r.code || '—'}</td>
                    <td style={{ padding: '5px 10px', color: '#6b7280' }}>{r.category || '—'}</td>
                    <td style={{ padding: '5px 10px' }}>{r.unit}</td>
                    <td style={{ padding: '5px 10px', color: '#6b7280' }}>{r.purchaseRate ?? '—'}</td>
                    <td style={{ padding: '5px 10px', color: '#6b7280' }}>{r.saleRate ?? '—'}</td>
                    <td style={{ padding: '5px 10px', fontWeight: 600 }}>{r.currentStock}</td>
                  </tr>
                ))}
                {rows.length > 20 && <tr><td colSpan={7} style={{ padding: '6px 10px', color: '#9ca3af', fontSize: '12px' }}>…and {rows.length - 20} more rows</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stock Aging Tab ──────────────────────────────────────────────────────────

function AgingTab() {
  const [bucket, setBucket] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-aging'],
    queryFn: () => api.get('/api/v1/inventory/aging').then(r => r.data as { data: AgingRow[]; summary: Record<string, number> }),
    staleTime: 60_000,
  });

  const rows = data?.data ?? [];
  const summary = data?.summary ?? {};

  const filteredRows = bucket === 'all' ? rows : rows.filter(r => r.bucket === bucket);

  const BUCKETS = [
    { key: 'all',       label: 'All',           color: '#374151', bg: '#f3f4f6' },
    { key: '0_30',      label: '0–30 days',      color: '#059669', bg: '#ecfdf5' },
    { key: '31_60',     label: '31–60 days',     color: '#2563eb', bg: '#eff6ff' },
    { key: '61_90',     label: '61–90 days',     color: '#d97706', bg: '#fffbeb' },
    { key: '91_180',    label: '91–180 days',    color: '#ea580c', bg: '#fff7ed' },
    { key: 'over_180',  label: '180+ days',      color: '#dc2626', bg: '#fef2f2' },
    { key: 'never_sold',label: 'Never Sold',     color: '#7c3aed', bg: '#f5f3ff' },
  ];

  const bucketColor = (b: string) => BUCKETS.find(x => x.key === b) ?? BUCKETS[0];

  const exportAging = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows.map(r => ({
      'Product': r.name, 'Code': r.code ?? '', 'Category': r.category ?? '', 'Unit': r.unit,
      'Current Stock': r.currentStock, 'Stock Value (₹)': r.stockValue,
      'Last Sale Date': r.lastSaleDate ? new Date(r.lastSaleDate).toLocaleDateString('en-IN') : 'Never',
      'Days Since Last Sale': r.daysSinceLastSale ?? 'Never',
      'Aging Bucket': bucketColor(r.bucket).label,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Aging');
    XLSX.writeFile(wb, `stock-aging-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const fmtCurr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  if (isLoading) return <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>Loading aging data…</div>;

  return (
    <div>
      {/* Summary buckets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {BUCKETS.map(b => {
          const count = b.key === 'all' ? rows.length : (summary[b.key] ?? 0);
          const active = bucket === b.key;
          return (
            <button key={b.key} onClick={() => setBucket(b.key)} style={{ padding: '8px 14px', borderRadius: '10px', border: `1.5px solid ${active ? b.color : '#e4e7ef'}`, background: active ? b.bg : '#fff', color: active ? b.color : '#6b7280', fontSize: '12.5px', fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800 }}>{count}</span> {b.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button style={S.secondaryBtn} onClick={exportAging}><Download size={14} />Export</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ ...S.table, minWidth: '760px' }}>
          <thead style={S.thead}><tr>
            {['Product', 'Category', 'Stock', 'Stock Value', 'Last Sale', 'Days Idle', 'Bucket'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No products in this bucket</td></tr>
            ) : filteredRows.map(r => {
              const bc = bucketColor(r.bucket);
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={S.td}><div style={{ fontWeight: 600, color: '#1a2235' }}>{r.name}</div>{r.code && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{r.code}</div>}</td>
                  <td style={S.td}>{r.category ?? '—'}</td>
                  <td style={S.td}><span style={{ fontWeight: 700, color: r.currentStock === 0 ? '#dc2626' : '#059669' }}>{r.currentStock} {r.unit}</span></td>
                  <td style={{ ...S.td, fontWeight: 600, color: '#7c3aed' }}>{fmtCurr(r.stockValue)}</td>
                  <td style={S.td}>{r.lastSaleDate ? new Date(r.lastSaleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : <span style={{ color: '#9ca3af' }}>Never</span>}</td>
                  <td style={S.td}><span style={{ fontWeight: 700, color: bc.color }}>{r.daysSinceLastSale ?? '—'}</span></td>
                  <td style={S.td}><span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: bc.bg, color: bc.color }}>{bc.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Valuation Tab ────────────────────────────────────────────────────────────

function ValuationTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-valuation'],
    queryFn: () => api.get('/api/v1/inventory/valuation').then(r => r.data as { data: ValuationRow[]; totalCostValue: number; totalSellValue: number; totalPotentialProfit: number }),
    staleTime: 60_000,
  });

  const rows = data?.data ?? [];

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      'Product': r.name, 'Code': r.code ?? '', 'Category': r.category ?? '', 'Unit': r.unit,
      'Stock': r.currentStock, 'Buy Rate': r.purchaseRate, 'Sell Rate': r.saleRate,
      'Cost Value (₹)': r.costValue, 'Sell Value (₹)': r.sellValue,
      'Potential Profit (₹)': r.potentialProfit, 'Margin %': r.marginPct,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Valuation');
    XLSX.writeFile(wb, `stock-valuation-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) return <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>Loading valuation…</div>;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '16px' }}>
        {[
          { label: 'Total Cost Value', value: fmt(data?.totalCostValue), color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Total Sell Value', value: fmt(data?.totalSellValue), color: '#059669', bg: '#ecfdf5' },
          { label: 'Potential Profit', value: fmt(data?.totalPotentialProfit), color: '#d97706', bg: '#fffbeb' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: '12px', padding: '14px 18px', border: `1px solid ${c.bg}` }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '4px' }}>{c.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button style={{ ...S.secondaryBtn, gap: '6px' }} onClick={exportXlsx}>
          <Download size={14} /> Export Excel
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ ...S.table, minWidth: '860px' }}>
          <thead style={S.thead}>
            <tr>
              {['Product', 'Category', 'Stock', 'Buy Rate', 'Sell Rate', 'Cost Value', 'Sell Value', 'Margin %', 'Status'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={S.td}><div style={{ fontWeight: 600, color: '#1a2235' }}>{r.name}</div>{r.code && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{r.code}</div>}</td>
                <td style={S.td}>{r.category ?? '—'}</td>
                <td style={S.td}>{fmtQty(r.currentStock, r.unit)}</td>
                <td style={S.td}>{fmt(r.purchaseRate)}</td>
                <td style={S.td}>{fmt(r.saleRate)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#7c3aed' }}>{fmt(r.costValue)}</td>
                <td style={{ ...S.td, fontWeight: 600, color: '#059669' }}>{fmt(r.sellValue)}</td>
                <td style={S.td}>
                  <span style={{ fontWeight: 700, color: r.marginPct >= 20 ? '#059669' : r.marginPct >= 10 ? '#d97706' : '#dc2626' }}>
                    {r.marginPct}%
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: r.status === 'ok' ? '#ecfdf5' : r.status === 'low' ? '#fffbeb' : '#fef2f2', color: r.status === 'ok' ? '#059669' : r.status === 'low' ? '#d97706' : '#dc2626' }}>
                    {r.status === 'ok' ? 'OK' : r.status === 'low' ? 'Low Stock' : 'Out'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Product Row ─────────────────────────────────────────────────────────────

function ProductRow({ product: p, onEdit, onDelete, onAdjust, onInward, onHistory, onSalesReturn, onPurchaseReturn }: {
  product: Product; onEdit: () => void; onDelete: () => void; onAdjust: () => void;
  onInward: () => void; onHistory: () => void; onSalesReturn: () => void; onPurchaseReturn: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr style={{ background: hovered ? '#f8f9fc' : '#fff', transition: 'background .12s' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td style={S.td}>
        <div style={{ fontWeight: 600, color: '#1a2235', fontSize: '13.5px' }}>{p.name}</div>
        {p.code && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{p.code}</div>}
      </td>
      <td style={S.td}>
        <div style={{ fontSize: '13px', color: '#4b5563' }}>{p.category ?? '—'}</div>
        {p.subcategory && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{p.subcategory}</div>}
      </td>
      <td style={S.td}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', background: '#f5f6fa', color: '#4b5563', fontSize: '11px', fontWeight: 700 }}>{p.unit}</span></td>
      <td style={{ ...S.td, color: '#4b5563' }}>{fmt(p.purchaseRate)}</td>
      <td style={{ ...S.td, fontWeight: 600, color: '#1a2235' }}>{fmt(p.saleRate)}</td>
      <td style={S.td}><StockBadge stock={p.currentStock} reorder={p.reorderLevel} maxStock={p.maxStock} /></td>
      <td style={{ ...S.td, color: '#4b5563' }}>{p.reorderLevel}</td>
      <td style={{ ...S.td, color: '#4b5563' }}>{p.gstRate}%</td>
      <td style={{ ...S.td, textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={S.actionBtn('#059669', '#ecfdf5')} onClick={onInward} title="Stock Inward"><ArrowDownToLine size={13} /></button>
          <button style={S.actionBtn('#7c3aed', '#f5f3ff')} onClick={onAdjust} title="Adjust Stock"><BarChart2 size={13} /></button>
          <button style={S.actionBtn('#2563eb', '#eff6ff')} onClick={onHistory} title="History"><History size={13} /></button>
          <button style={S.actionBtn('#d97706', '#fffbeb')} onClick={onSalesReturn} title="Sales Return"><RotateCcw size={13} /></button>
          <button style={S.actionBtn('#b45309', '#fef3c7')} onClick={onPurchaseReturn} title="Purchase Return"><ArrowUpFromLine size={13} /></button>
          <button style={S.actionBtn('#5b5bd6', '#ede9fe')} onClick={onEdit} title="Edit"><Pencil size={13} /></button>
          <button style={S.actionBtn('#ef4444', '#fef2f2')} onClick={onDelete} title="Delete"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const qc = useQueryClient();

  // Tabs
  const [tab, setTab] = useState<'products' | 'valuation' | 'godowns' | 'transfer' | 'import' | 'aging'>('products');

  // Filters + pagination
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Modals
  const [modalOpen, setModalOpen]           = useState(false);
  const [editProduct, setEditProduct]       = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<Product | null>(null);
  const [adjustTarget, setAdjustTarget]     = useState<Product | null>(null);
  const [inwardTarget, setInwardTarget]     = useState<Product | null>(null);
  const [historyTarget, setHistoryTarget]   = useState<Product | null>(null);
  const [salesReturnTarget, setSalesReturnTarget]     = useState<Product | null>(null);
  const [purchaseReturnTarget, setPurchaseReturnTarget] = useState<Product | null>(null);

  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [focusedField, setFocused]  = useState<string | null>(null);

  // Queries
  const productsQuery = useQuery<{ data: Product[]; total: number }>({
    queryKey: ['inventory-products', search, category, page, limit],
    queryFn: () => api.get('/api/v1/inventory/products', { params: { search: search || undefined, category: category || undefined, page, limit } }).then(r => r.data),
    staleTime: 30_000,
  });

  const summaryQuery = useQuery<StockSummary>({
    queryKey: ['stock-summary'],
    queryFn: () => api.get('/api/v1/reports/stock-summary').then(r => r.data),
    staleTime: 60_000,
  });

  const allProductsForExport = useQuery<Product[]>({
    queryKey: ['inventory-all-export'],
    queryFn: () => api.get('/api/v1/inventory/products', { params: { limit: 2000 } }).then(r => r.data.data),
    enabled: false, // only fetch on demand
  });

  const rawProducts = productsQuery.data?.data ?? [];
  const total = productsQuery.data?.total ?? 0;

  const products: Product[] = useMemo(() => rawProducts.map((p: any) => ({
    ...p,
    currentStock:  Number(p.currentStock),
    saleRate:      p.saleRate      != null ? Number(p.saleRate)      : undefined,
    purchaseRate:  p.purchaseRate  != null ? Number(p.purchaseRate)  : undefined,
    reorderLevel:  Number(p.reorderLevel ?? 0),
    maxStock:      p.maxStock      != null ? Number(p.maxStock)      : undefined,
    gstRate:       Number(p.gstRate ?? 0),
  })), [rawProducts]);

  // Client-side stock filter (on top of server pagination)
  const filtered = useMemo(() => {
    if (stockFilter === 'out') return products.filter(p => p.currentStock === 0);
    if (stockFilter === 'low') return products.filter(p => p.currentStock > 0 && p.currentStock <= p.reorderLevel);
    return products;
  }, [products, stockFilter]);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))), [products]);
  const summary: StockSummary = summaryQuery.data ?? {};

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inventory-products'] });
    qc.invalidateQueries({ queryKey: ['stock-summary'] });
    qc.invalidateQueries({ queryKey: ['inventory-valuation'] });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/v1/inventory/products', payload).then(r => r.data),
    onSuccess: () => { invalidate(); closeModal(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/api/v1/inventory/products/${id}`, payload).then(r => r.data),
    onSuccess: () => { invalidate(); closeModal(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/inventory/products/${id}`).then(r => r.data),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  // Modal helpers
  const openAdd = () => { setEditProduct(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, code: p.code ?? '', category: p.category ?? '', subcategory: p.subcategory ?? '', unit: p.unit, hsnCode: p.hsnCode ?? '', gstRate: String(p.gstRate), purchaseRate: p.purchaseRate != null ? String(p.purchaseRate) : '', saleRate: p.saleRate != null ? String(p.saleRate) : '', currentStock: String(p.currentStock), reorderLevel: String(p.reorderLevel), maxStock: p.maxStock != null ? String(p.maxStock) : '' });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditProduct(null); setForm(EMPTY_FORM); };
  const handleSave = () => {
    const payload = { name: form.name.trim(), code: form.code || undefined, category: form.category || undefined, subcategory: form.subcategory || undefined, unit: form.unit, hsnCode: form.hsnCode || undefined, gstRate: parseFloat(form.gstRate) || 0, purchaseRate: form.purchaseRate ? parseFloat(form.purchaseRate) : undefined, saleRate: form.saleRate ? parseFloat(form.saleRate) : undefined, currentStock: parseFloat(form.currentStock) || 0, reorderLevel: parseFloat(form.reorderLevel) || 0, maxStock: form.maxStock ? parseFloat(form.maxStock) : undefined };
    editProduct ? updateMutation.mutate({ id: editProduct.id, payload }) : createMutation.mutate(payload);
  };
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const inputStyle = (name: string): React.CSSProperties => ({ ...S.input, borderColor: focusedField === name ? '#5b5bd6' : '#e4e7ef' });
  const focusHandlers = (name: string) => ({ onFocus: () => setFocused(name), onBlur: () => setFocused(null) });

  // Export products CSV
  const exportProducts = async () => {
    const res = await api.get('/api/v1/inventory/products', { params: { limit: 2000 } });
    const rows = (res.data.data ?? []).map((p: any) => ({
      Name: p.name, Code: p.code ?? '', Category: p.category ?? '', Subcategory: p.subcategory ?? '',
      Unit: p.unit, 'HSN Code': p.hsnCode ?? '', 'GST %': p.gstRate, 'Purchase Rate': p.purchaseRate ?? '',
      'Sale Rate': p.saleRate ?? '', 'Current Stock': p.currentStock, 'Reorder Level': p.reorderLevel, 'Max Stock': p.maxStock ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `inventory-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Pagination
  const totalPages = Math.ceil(total / limit);
  const pageStart = (page - 1) * limit + 1;
  const pageEnd = Math.min(page * limit, total);
  const pageNums: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) pageNums.push(i);
    else if (pageNums[pageNums.length - 1] !== '…') pageNums.push('…');
  }

  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <div style={S.page}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h1 style={S.h1}>Inventory</h1>
            <p style={S.sub}>Manage stock, products &amp; movements</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button style={S.secondaryBtn} onClick={exportProducts}><Download size={14} />Export</button>
            <button style={S.primaryBtn} onClick={openAdd}><Plus size={15} />Add Product</button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={S.summaryGrid}>
          <StatCard label="Total Products" value={summary.totalProducts ?? total ?? 0} icon={Package} iconBg="#ede9fe" iconColor="#5b5bd6" loading={summaryQuery.isLoading} />
          <StatCard label="Total Stock Value" value={fmt(summary.totalStockValue)} icon={DollarSign} iconBg="#dcfce7" iconColor="#16a34a" loading={summaryQuery.isLoading} />
          <StatCard label="Low Stock" value={summary.lowStockCount ?? 0} icon={AlertTriangle} iconBg="#fff7ed" iconColor="#f97316" loading={summaryQuery.isLoading} />
          <StatCard label="Out of Stock" value={summary.outOfStockCount ?? 0} icon={ShoppingCart} iconBg="#fef2f2" iconColor="#ef4444" loading={summaryQuery.isLoading} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button style={S.tab(tab === 'products')} onClick={() => setTab('products')}>Products</button>
          <button style={S.tab(tab === 'valuation')} onClick={() => setTab('valuation')}><BarChart2 size={13} style={{ display: 'inline', marginRight: '4px' }} />Valuation</button>
          <button style={S.tab(tab === 'godowns')} onClick={() => setTab('godowns')}><Warehouse size={13} style={{ display: 'inline', marginRight: '4px' }} />Godowns</button>
          <button style={S.tab(tab === 'transfer')} onClick={() => setTab('transfer')}><ArrowLeftRight size={13} style={{ display: 'inline', marginRight: '4px' }} />Transfer</button>
          <button style={S.tab(tab === 'import')} onClick={() => setTab('import')}><Upload size={13} style={{ display: 'inline', marginRight: '4px' }} />Bulk Import</button>
          <button style={S.tab(tab === 'aging')} onClick={() => setTab('aging')}><Clock size={13} style={{ display: 'inline', marginRight: '4px' }} />Stock Aging</button>
        </div>

        {tab === 'valuation' ? (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e4e7ef', padding: '20px', boxShadow: '0 1px 4px rgba(17,24,39,.04)' }}>
            <ValuationTab />
          </div>
        ) : tab === 'godowns' ? (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e4e7ef', padding: '20px', boxShadow: '0 1px 4px rgba(17,24,39,.04)' }}>
            <GodownTab onInvalidate={() => qc.invalidateQueries({ queryKey: ['products'] })} />
          </div>
        ) : tab === 'transfer' ? (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e4e7ef', padding: '20px', boxShadow: '0 1px 4px rgba(17,24,39,.04)' }}>
            <TransferTab onInvalidate={() => qc.invalidateQueries({ queryKey: ['products'] })} />
          </div>
        ) : tab === 'import' ? (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e4e7ef', padding: '20px', boxShadow: '0 1px 4px rgba(17,24,39,.04)' }}>
            <BulkImportTab onInvalidate={() => qc.invalidateQueries({ queryKey: ['products'] })} />
          </div>
        ) : tab === 'aging' ? (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e4e7ef', padding: '20px', boxShadow: '0 1px 4px rgba(17,24,39,.04)' }}>
            <AgingTab />
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div style={S.toolbar}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}><Search size={14} /></span>
                <input style={{ ...S.input, paddingLeft: '32px', borderColor: focusedField === 'search' ? '#5b5bd6' : '#e4e7ef' }} placeholder="Search products…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} {...focusHandlers('search')} />
              </div>
              <select style={{ ...S.select, minWidth: '150px' }} value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c as string} value={c as string}>{c}</option>)}
              </select>
              {/* Stock status filter */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'low', 'out'] as const).map(f => (
                  <button key={f} style={{ ...S.tab(stockFilter === f), padding: '7px 12px', fontSize: '12px' }} onClick={() => setStockFilter(f)}>
                    {f === 'all' ? 'All' : f === 'low' ? '⚠ Low Stock' : '🔴 Out of Stock'}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={S.tableCard}>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead style={S.thead}>
                    <tr>
                      <th style={S.th}>Name / Code</th>
                      <th style={S.th}>Category</th>
                      <th style={S.th}>Unit</th>
                      <th style={S.th}>Buy Rate</th>
                      <th style={S.th}>Sell Rate</th>
                      <th style={S.th}>Stock</th>
                      <th style={S.th}>Reorder</th>
                      <th style={S.th}>GST %</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsQuery.isLoading ? (
                      [...Array(6)].map((_, i) => (
                        <tr key={i}>{[...Array(9)].map((_, j) => <td key={j} style={S.td}><div style={{ height: '16px', borderRadius: '4px', background: '#f3f4f6', animation: 'pulse 1.5s infinite' }} /></td>)}</tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', padding: '56px', color: '#9ca3af' }}>
                        <Package size={32} color="#d1d5db" style={{ marginBottom: '10px' }} />
                        <div>{stockFilter !== 'all' ? `No products with ${stockFilter === 'low' ? 'low stock' : 'zero stock'}` : 'No products found'}</div>
                      </td></tr>
                    ) : (
                      filtered.map(p => (
                        <ProductRow key={p.id} product={p}
                          onEdit={() => openEdit(p)} onDelete={() => setDeleteTarget(p)}
                          onAdjust={() => setAdjustTarget(p)} onInward={() => setInwardTarget(p)}
                          onHistory={() => setHistoryTarget(p)}
                          onSalesReturn={() => setSalesReturnTarget(p)}
                          onPurchaseReturn={() => setPurchaseReturnTarget(p)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid #e4e7ef', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12.5px', color: '#6b7280' }}>Showing <strong>{pageStart}–{pageEnd}</strong> of <strong>{total}</strong></span>
                    <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} style={{ ...S.select, fontSize: '12px', padding: '4px 8px' }}>
                      {[20, 50, 100, 200].map(n => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid #e4e7ef', background: page === 1 ? '#f9fafb' : '#fff', color: page === 1 ? '#d1d5db' : '#374151', cursor: page === 1 ? 'default' : 'pointer', fontSize: '12.5px', fontFamily: 'inherit' }}>
                      <ChevronLeft size={14} />
                    </button>
                    {pageNums.map((p, i) => p === '…' ? (
                      <span key={`e${i}`} style={{ padding: '4px 6px', fontSize: '12px', color: '#9ca3af' }}>…</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p as number)} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid', borderColor: p === page ? '#5b5bd6' : '#e4e7ef', background: p === page ? '#5b5bd6' : '#fff', color: p === page ? '#fff' : '#374151', fontWeight: p === page ? 700 : 400, cursor: 'pointer', fontSize: '12.5px', fontFamily: 'inherit', minWidth: '30px' }}>{p}</button>
                    ))}
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid #e4e7ef', background: page === totalPages ? '#f9fafb' : '#fff', color: page === totalPages ? '#d1d5db' : '#374151', cursor: page === totalPages ? 'default' : 'pointer', fontSize: '12.5px', fontFamily: 'inherit' }}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Add / Edit Modal */}
      {modalOpen && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={S.modal}>
            <div style={S.modalTitle}>
              <span>{editProduct ? 'Edit Product' : 'Add Product'}</span>
              <button onClick={closeModal} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={20} /></button>
            </div>
            <div style={S.formGrid}>
              <div style={S.formGroupFull}><label style={S.label}>Product Name *</label><input style={inputStyle('name')} placeholder="e.g. Silk Dupatta" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} {...focusHandlers('name')} /></div>
              <div><label style={S.label}>Code / SKU</label><input style={inputStyle('code')} placeholder="SKU-001" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} {...focusHandlers('code')} /></div>
              <div><label style={S.label}>Unit *</label><select style={{ ...inputStyle('unit'), cursor: 'pointer' }} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} {...focusHandlers('unit')}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
              <div><label style={S.label}>Category</label><input style={inputStyle('category')} placeholder="e.g. Fabric" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} {...focusHandlers('category')} /></div>
              <div><label style={S.label}>Subcategory</label><input style={inputStyle('subcategory')} placeholder="e.g. Silk" value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })} {...focusHandlers('subcategory')} /></div>
              <div><label style={S.label}>HSN Code</label><input style={inputStyle('hsnCode')} placeholder="5007" value={form.hsnCode} onChange={e => setForm({ ...form, hsnCode: e.target.value })} {...focusHandlers('hsnCode')} /></div>
              <div><label style={S.label}>GST Rate (%)</label><input style={inputStyle('gstRate')} type="number" min="0" max="28" step="0.1" value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })} {...focusHandlers('gstRate')} /></div>
              <div><label style={S.label}>Purchase Rate (₹)</label><input style={inputStyle('purchaseRate')} type="number" min="0" step="0.01" placeholder="0.00" value={form.purchaseRate} onChange={e => setForm({ ...form, purchaseRate: e.target.value })} {...focusHandlers('purchaseRate')} /></div>
              <div><label style={S.label}>Sale Rate (₹)</label><input style={inputStyle('saleRate')} type="number" min="0" step="0.01" placeholder="0.00" value={form.saleRate} onChange={e => setForm({ ...form, saleRate: e.target.value })} {...focusHandlers('saleRate')} /></div>
              <div><label style={S.label}>Current Stock</label><input style={inputStyle('currentStock')} type="number" min="0" step="0.001" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: e.target.value })} {...focusHandlers('currentStock')} /></div>
              <div><label style={S.label}>Reorder Level</label><input style={inputStyle('reorderLevel')} type="number" min="0" step="0.001" value={form.reorderLevel} onChange={e => setForm({ ...form, reorderLevel: e.target.value })} {...focusHandlers('reorderLevel')} /></div>
              <div><label style={S.label}>Max Stock <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label><input style={inputStyle('maxStock')} type="number" min="0" step="0.001" placeholder="No limit" value={form.maxStock} onChange={e => setForm({ ...form, maxStock: e.target.value })} {...focusHandlers('maxStock')} /></div>
            </div>
            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={closeModal}>Cancel</button>
              <button style={{ ...S.primaryBtn, opacity: isSaving || !form.name.trim() ? 0.6 : 1 }} onClick={handleSave} disabled={isSaving || !form.name.trim()}>
                {isSaving ? 'Saving…' : editProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal */}
      {deleteTarget && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div style={{ ...S.modal, width: '400px', textAlign: 'center', padding: '32px 28px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><Trash2 size={22} color="#ef4444" /></div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Delete Product</h3>
            <p style={{ fontSize: '13.5px', color: '#4b5563', margin: '0 0 22px', lineHeight: 1.5 }}>Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button style={S.cancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button style={{ ...S.dangerBtn, opacity: deleteMutation.isPending ? .6 : 1 }} onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Other modals */}
      {adjustTarget     && <AdjustmentModal product={adjustTarget}  onClose={() => setAdjustTarget(null)}  onSaved={invalidate} />}
      {inwardTarget     && <InwardModal     product={inwardTarget}   onClose={() => setInwardTarget(null)}   onSaved={invalidate} />}
      {historyTarget    && <HistoryDrawer   product={historyTarget}  onClose={() => setHistoryTarget(null)} />}
      {salesReturnTarget    && <ReturnModal product={salesReturnTarget}    returnType="sales"    onClose={() => setSalesReturnTarget(null)}    onSaved={invalidate} />}
      {purchaseReturnTarget && <ReturnModal product={purchaseReturnTarget} returnType="purchase" onClose={() => setPurchaseReturnTarget(null)} onSaved={invalidate} />}
    </>
  );
}
