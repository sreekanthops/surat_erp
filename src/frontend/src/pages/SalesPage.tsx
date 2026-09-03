import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/hooks/useApi';
import {
  Plus, Search, Trash2, Edit2, X, ChevronDown, CreditCard,
  FileText, TrendingUp, Clock, CheckCircle, XCircle, DollarSign,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  referenceNo: string;
  date: string;
  dueDate?: string;
  party: { id: string; name: string; phone?: string };
  totalAmount: number;
  paidAmount: number;
  status: string;
  paymentMode?: string;
  notes?: string;
  items?: any[];
}

interface Party {
  id: string;
  name: string;
  phone?: string;
  type: string;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  saleRate?: number;
  gstRate?: number;
  unit?: string;
}

interface LineItem {
  productId: string;
  productName: string;
  qty: number;
  rate: number;
  discount: number;
  gstRate: number;
  amount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const today = () => new Date().toISOString().split('T')[0];

const computeAmount = (qty: number, rate: number, discount: number, gstRate: number) => {
  const base = qty * rate;
  const afterDiscount = base - (base * discount) / 100;
  const withGst = afterDiscount + (afterDiscount * gstRate) / 100;
  return Math.round(withGst);
};

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  PENDING:   { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
  PARTIAL:   { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  PAID:      { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
  CANCELLED: { background: '#f8f9fc', color: '#4b5563', border: '1px solid #e4e7ef' },
};

const PAYMENT_MODES = ['cash', 'upi', 'neft', 'cheque', 'credit'];

const BLANK_ITEM: LineItem = { productId: '', productName: '', qty: 1, rate: 0, discount: 0, gstRate: 0, amount: 0 };

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr>
    {[...Array(9)].map((_, i) => (
      <td key={i} style={{ padding: '13px 16px' }}>
        <div style={{
          height: '13px', borderRadius: '6px',
          background: 'linear-gradient(90deg, #f0f2f8 25%, #e8eaf2 50%, #f0f2f8 75%)',
          backgroundSize: '400% 100%',
          animation: 'skeleton-shimmer 1.5s ease infinite',
          width: i === 2 ? '140px' : i === 7 ? '70px' : '80px',
        }} />
      </td>
    ))}
  </tr>
);

const SkeletonStatCard = () => (
  <div style={{
    background: '#fff', borderRadius: '14px', padding: '20px',
    border: '1px solid #e4e7ef',
    boxShadow: '0 2px 8px rgba(17,24,39,0.05)',
  }}>
    <div style={{ height: '11px', width: '90px', borderRadius: '6px', background: '#f0f2f8', marginBottom: '12px' }} />
    <div style={{ height: '26px', width: '130px', borderRadius: '7px', background: '#e8eaf2' }} />
  </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => (
  <span style={{
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
    padding: '3px 10px', borderRadius: '20px',
    display: 'inline-block', textTransform: 'uppercase' as const,
    ...(STATUS_STYLES[status] || STATUS_STYLES.CANCELLED),
  }}>
    {status}
  </span>
);

// ─── Searchable Dropdown ───────────────────────────────────────────────────────

function SearchableSelect<T extends { id: string; name: string }>({
  items, value, onChange, placeholder, disabled,
}: {
  items: T[];
  value: string;
  onChange: (item: T) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = items.find(i => i.id === value);
  const filtered = items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!ref.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
      setQ('');
    }
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }} onBlur={handleBlur}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', borderRadius: '10px', fontSize: '13.5px',
          border: '1.5px solid #e4e7ef', background: disabled ? '#f8f9fc' : '#fff',
          color: selected ? '#1a2235' : '#9ca3af', cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: '#fff', borderRadius: '12px', marginTop: '4px',
          boxShadow: '0 8px 32px rgba(15,23,42,0.16)', border: '1px solid #e4e7ef',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px' }}>
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search..."
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '13px',
                border: '1.5px solid #e4e7ef', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: '13px', color: '#9ca3af' }}>No results</div>
            ) : filtered.map(item => (
              <button
                key={item.id}
                type="button"
                onMouseDown={() => { onChange(item); setOpen(false); setQ(''); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: '13.5px',
                  background: item.id === value ? '#eff6ff' : 'transparent',
                  color: item.id === value ? '#2563eb' : '#1a2235',
                  border: 'none', cursor: 'pointer', fontWeight: item.id === value ? 600 : 400,
                  display: 'block',
                }}
                onMouseEnter={e => { if (item.id !== value) (e.currentTarget as HTMLButtonElement).style.background = '#f8f9fc'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = item.id === value ? '#eff6ff' : 'transparent'; }}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Input component ──────────────────────────────────────────────────────────

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    style={{
      width: '100%', padding: '9px 12px', borderRadius: '10px', fontSize: '13.5px',
      border: '1.5px solid #e4e7ef', outline: 'none', boxSizing: 'border-box',
      color: '#1a2235', background: props.disabled ? '#f8f9fc' : '#fff',
      ...(props.style || {}),
    }}
    onFocus={e => { e.currentTarget.style.borderColor = '#5b5bd6'; }}
    onBlur={e => { e.currentTarget.style.borderColor = '#e4e7ef'; }}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    style={{
      width: '100%', padding: '9px 12px', borderRadius: '10px', fontSize: '13.5px',
      border: '1.5px solid #e4e7ef', outline: 'none', background: '#fff',
      color: '#1a2235', cursor: 'pointer', boxSizing: 'border-box',
      ...(props.style || {}),
    }}
  />
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '5px', letterSpacing: '0.03em' }}>
    {children}
  </label>
);

// ─── Create Invoice Modal ─────────────────────────────────────────────────────

function CreateInvoiceModal({
  parties, products, onClose, onSaved,
}: {
  parties: Party[];
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ ...BLANK_ITEM }]);
  const [paymentMode, setPaymentMode] = useState('credit');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const subtotal = useMemo(() =>
    items.reduce((s, it) => {
      const base = it.qty * it.rate;
      const afterDiscount = base - (base * it.discount) / 100;
      return s + afterDiscount;
    }, 0), [items]);

  const gstTotal = useMemo(() =>
    items.reduce((s, it) => {
      const base = it.qty * it.rate;
      const afterDiscount = base - (base * it.discount) / 100;
      return s + (afterDiscount * it.gstRate) / 100;
    }, 0), [items]);

  const total = Math.round(subtotal + gstTotal);

  const setItem = (index: number, patch: Partial<LineItem>) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      const updated = { ...it, ...patch };
      updated.amount = computeAmount(updated.qty, updated.rate, updated.discount, updated.gstRate);
      return updated;
    }));
  };

  const selectProduct = (index: number, product: Product) => {
    setItem(index, {
      productId: product.id,
      productName: product.name,
      rate: product.saleRate || 0,
      gstRate: product.gstRate || 0,
    });
  };

  const handleSave = async () => {
    if (!partyId) { setError('Please select a party.'); return; }
    if (items.some(it => !it.productId)) { setError('All line items need a product selected.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.post('/api/v1/sales/invoices', {
        partyId, date, dueDate: dueDate || undefined,
        paymentMode, notes: notes || undefined,
        items: items.map(it => ({
          productId: it.productId,
          qty: it.qty,
          rate: it.rate,
          discount: it.discount,
          gstRate: it.gstRate,
          amount: it.amount,
        })),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '32px 16px', backdropFilter: 'blur(2px)', overflowY: 'auto',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px', width: '680px', maxWidth: '100%',
        boxShadow: '0 24px 80px rgba(15,23,42,0.2)', overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #f5f6fa',
          background: 'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg,#5b5bd6,#4646b5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>New Invoice</div>
              <div style={{ fontSize: '12px', color: '#4b5563' }}>Create a sales invoice</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="#4b5563" />
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
          {/* Party + Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ gridColumn: '1 / 3' }}>
              <Label>Party (Customer) *</Label>
              <SearchableSelect<Party>
                items={parties}
                value={partyId}
                onChange={p => setPartyId(p.id)}
                placeholder="Select customer..."
              />
            </div>
            <div>
              <Label>Invoice Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div style={{ gridColumn: '3 / 4', marginTop: '-68px' }}>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Line Items */}
          <div style={{
            border: '1.5px solid #e4e7ef', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px',
          }}>
            <div style={{ background: '#f8f9fc', padding: '10px 14px', borderBottom: '1px solid #e4e7ef' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Line Items
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '580px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f5f6fa' }}>
                    {['Product', 'Qty', 'Rate (₹)', 'Disc %', 'GST %', 'Amount', ''].map(h => (
                      <th key={h} style={{
                        padding: '8px 10px', fontSize: '11px', fontWeight: 700, color: '#9ca3af',
                        textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '8px 10px', minWidth: '160px' }}>
                        <SearchableSelect<Product>
                          items={products}
                          value={item.productId}
                          onChange={p => selectProduct(idx, p)}
                          placeholder="Select product"
                        />
                      </td>
                      <td style={{ padding: '8px 6px', width: '60px' }}>
                        <Input type="number" min={1} value={item.qty}
                          onChange={e => setItem(idx, { qty: Number(e.target.value) })}
                          style={{ padding: '7px 8px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '8px 6px', width: '90px' }}>
                        <Input type="number" min={0} value={item.rate}
                          onChange={e => setItem(idx, { rate: Number(e.target.value) })}
                          style={{ padding: '7px 8px', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '8px 6px', width: '70px' }}>
                        <Input type="number" min={0} max={100} value={item.discount}
                          onChange={e => setItem(idx, { discount: Number(e.target.value) })}
                          style={{ padding: '7px 8px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '8px 6px', width: '70px' }}>
                        <Input type="number" min={0} max={100} value={item.gstRate}
                          onChange={e => setItem(idx, { gstRate: Number(e.target.value) })}
                          style={{ padding: '7px 8px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', width: '90px', fontSize: '13px', fontWeight: 600, color: '#1a2235', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {fmt(item.amount)}
                      </td>
                      <td style={{ padding: '8px 6px', width: '32px' }}>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '8px 14px', borderTop: '1px solid #f5f6fa' }}>
              <button
                type="button"
                onClick={() => setItems(prev => [...prev, { ...BLANK_ITEM }])}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '13px', fontWeight: 600, color: '#5b5bd6',
                  border: '1.5px dashed #c7d2fe', borderRadius: '8px',
                  background: '#fafbff', padding: '6px 14px', cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
          </div>

          {/* Summary */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', marginBottom: '20px',
          }}>
            <div style={{
              background: '#f8f9fc', borderRadius: '12px', padding: '16px 20px',
              minWidth: '240px', border: '1px solid #e4e7ef',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4b5563', marginBottom: '8px' }}>
                <span>Subtotal</span><span style={{ fontWeight: 600, color: '#1a2235' }}>{fmt(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4b5563', marginBottom: '10px' }}>
                <span>GST</span><span style={{ fontWeight: 600, color: '#1a2235' }}>{fmt(gstTotal)}</span>
              </div>
              <div style={{ borderTop: '1px solid #e4e7ef', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>Total</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#4646b5' }}>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment & Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                {PAYMENT_MODES.map(m => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
              padding: '10px 14px', fontSize: '13px', color: '#dc2626', marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600,
                border: '1.5px solid #e4e7ef', background: '#fff', color: '#4b5563', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '10px 24px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 700,
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                background: 'linear-gradient(135deg,#5b5bd6,#4646b5)',
                color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {saving ? 'Saving...' : <><FileText size={15} /> Save Invoice</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({
  invoice, onClose, onDeleted,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/v1/sales/invoices/${invoice.id}`);
      onDeleted();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Delete failed.');
      setDeleting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(2px)',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px', width: '400px', maxWidth: '94vw',
        boxShadow: '0 20px 60px rgba(15,23,42,0.2)', padding: '28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Trash2 size={20} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>Delete Invoice</div>
            <div style={{ fontSize: '12.5px', color: '#4b5563', marginTop: '2px' }}>This action cannot be undone</div>
          </div>
        </div>
        <p style={{ fontSize: '13.5px', color: '#4b5563', lineHeight: 1.6, marginBottom: '20px' }}>
          Are you sure you want to delete invoice <strong style={{ color: '#1a2235' }}>{invoice.referenceNo}</strong> for{' '}
          <strong style={{ color: '#1a2235' }}>{invoice.party.name}</strong>? All associated data will be permanently removed.
        </p>
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
            padding: '9px 12px', fontSize: '13px', color: '#dc2626', marginBottom: '16px',
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600,
              border: '1.5px solid #e4e7ef', background: '#fff', color: '#4b5563', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '9px 20px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 700,
              border: 'none', background: '#ef4444', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.7 : 1, boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
            }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({
  invoice, onClose, onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const due = invoice.totalAmount - invoice.paidAmount;
  const [amount, setAmount] = useState(String(due));
  const [mode, setMode] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return; }
    if (amt > due) { setError(`Amount cannot exceed due amount of ${fmt(due)}.`); return; }
    setError('');
    setSaving(true);
    try {
      await api.patch(`/api/v1/sales/invoices/${invoice.id}/payment`, { amount: amt, paymentMode: mode });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Payment record failed.');
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(2px)',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px', width: '380px', maxWidth: '94vw',
        boxShadow: '0 20px 60px rgba(15,23,42,0.2)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 22px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
          borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DollarSign size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>Record Payment</div>
              <div style={{ fontSize: '12px', color: '#4b5563' }}>{invoice.party.name} · {invoice.referenceNo}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={18} color="#4b5563" />
          </button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{
            background: '#f8f9fc', borderRadius: '10px', padding: '12px 16px',
            marginBottom: '18px', display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '12.5px', color: '#4b5563' }}>Outstanding Due</span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#ef4444' }}>{fmt(due)}</span>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <Label>Amount Received (₹)</Label>
            <Input
              type="number"
              min={1}
              max={due}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
          </div>
          <div style={{ marginBottom: '18px' }}>
            <Label>Payment Mode</Label>
            <Select value={mode} onChange={e => setMode(e.target.value)}>
              {PAYMENT_MODES.map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </Select>
          </div>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
              padding: '9px 12px', fontSize: '13px', color: '#dc2626', marginBottom: '14px',
            }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 16px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600,
                border: '1.5px solid #e4e7ef', background: '#fff', color: '#4b5563', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '9px 20px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 700,
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: '#fff', boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
              }}
            >
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const qc = useQueryClient();

  // ── Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page] = useState(1);

  // ── Modals
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);

  // ── Queries
  const invoicesQuery = useQuery({
    queryKey: ['invoices', fromDate, toDate, statusFilter, page],
    queryFn: () =>
      api.get('/api/v1/sales/invoices', {
        params: { from: fromDate || undefined, to: toDate || undefined, status: statusFilter || undefined, page, limit: 20 },
      }).then(r => r.data as { data: Invoice[]; total: number }),
  });

  const partiesQuery = useQuery({
    queryKey: ['parties-customers'],
    queryFn: () => api.get('/api/v1/parties', { params: { type: 'CUSTOMER' } }).then(r => r.data as Party[]),
    enabled: showCreate,
  });

  const productsQuery = useQuery({
    queryKey: ['products-for-invoice'],
    queryFn: () => api.get('/api/v1/inventory/products').then(r => r.data as Product[]),
    enabled: showCreate,
  });

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['invoices'] }), [qc]);

  // ── Derived data
  const invoices: Invoice[] = invoicesQuery.data?.data ?? [];
  const total: number = invoicesQuery.data?.total ?? 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(inv =>
      inv.party.name.toLowerCase().includes(q) ||
      inv.referenceNo.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  // ── Stats
  const thisMonthTotal = filtered.reduce((s, inv) => s + inv.totalAmount, 0);
  const pendingAmt = filtered.filter(i => i.status === 'PENDING' || i.status === 'PARTIAL')
    .reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
  const paidAmt = filtered.reduce((s, i) => s + i.paidAmount, 0);

  const statCards = [
    {
      label: 'This Month Sales', value: fmt(thisMonthTotal),
      icon: TrendingUp, gradient: 'linear-gradient(135deg, #5b5bd6 0%, #7c3aed 100%)', shadow: 'rgba(91,91,214,0.4)',
    },
    {
      label: 'Total Invoices', value: String(total),
      icon: FileText, gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', shadow: 'rgba(16,185,129,0.4)',
    },
    {
      label: 'Pending Amount', value: fmt(pendingAmt),
      icon: Clock, gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', shadow: 'rgba(245,158,11,0.4)',
    },
    {
      label: 'Paid Amount', value: fmt(paidAmt),
      icon: CheckCircle, gradient: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)', shadow: 'rgba(34,197,94,0.4)',
    },
  ];

  const currentMonth = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // ── Render
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .inv-row:hover { background: #fafbff !important; }
        .action-btn:hover { opacity: 1 !important; }
        .stat-card:hover { transform: translateY(-3px) !important; }
      `}</style>

      <div style={{ padding: '28px 32px', fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif", background: '#f5f6fa', minHeight: '100vh' }}>

        {/* ── Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em' }}>
              Sales & Invoices
            </h1>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '3px' }}>
              {currentMonth} · <strong style={{ color: '#5b5bd6', fontWeight: 700 }}>{fmt(thisMonthTotal)}</strong> in sales
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: '#5b5bd6',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(91,91,214,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
              transition: 'all 0.15s ease',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#4646b5';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(91,91,214,0.45)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#5b5bd6';
              (e.currentTarget as HTMLButtonElement).style.transform = 'none';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(91,91,214,0.35)';
            }}
          >
            <Plus size={15} /> New Invoice
          </button>
        </div>

        {/* ── Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '22px' }}>
          {invoicesQuery.isLoading
            ? [...Array(4)].map((_, i) => <SkeletonStatCard key={i} />)
            : statCards.map(({ label, value, icon: Icon, gradient, shadow }) => (
              <div
                key={label}
                className="stat-card"
                style={{
                  background: gradient, borderRadius: '14px', padding: '20px 22px',
                  boxShadow: `0 6px 24px ${shadow}`, color: '#fff',
                  position: 'relative', overflow: 'hidden', cursor: 'default',
                  transition: 'transform 0.18s ease',
                }}
              >
                <div style={{
                  position: 'absolute', top: -20, right: -20,
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                }} />
                <div style={{
                  fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', opacity: 0.75, marginBottom: '10px',
                }}>
                  {label}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
                <div style={{
                  position: 'absolute', top: '16px', right: '16px',
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} color="#fff" />
                </div>
              </div>
            ))}
        </div>

        {/* ── Filter Bar */}
        <div style={{
          background: '#fff', borderRadius: '14px', padding: '14px 18px',
          boxShadow: '0 2px 8px rgba(17,24,39,0.05)', border: '1px solid #e4e7ef',
          display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end',
          marginBottom: '18px',
        }}>
          <div>
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              style={{ width: '150px' }} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              style={{ width: '150px' }} />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ width: '140px' }}
            >
              <option value="">All</option>
              {['PENDING', 'PARTIAL', 'PAID', 'CANCELLED'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <Label>Search</Label>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by party or ref no…"
                style={{ paddingLeft: '32px' }}
              />
            </div>
          </div>
          {(fromDate || toDate || statusFilter || search) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); setStatusFilter(''); setSearch(''); }}
              style={{
                padding: '9px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                border: '1.5px solid #e4e7ef', background: '#fff', color: '#4b5563', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <XCircle size={14} /> Clear
            </button>
          )}
        </div>

        {/* ── Table */}
        <div style={{
          background: '#fff', borderRadius: '14px',
          boxShadow: '0 2px 8px rgba(17,24,39,0.05)', border: '1px solid #e4e7ef',
          overflow: 'hidden',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 18px', borderBottom: '1px solid #eff0f6', background: '#f8f9fc',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
              Invoices
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: '#9ca3af',
              background: '#f0f2f8', padding: '3px 10px', borderRadius: '20px',
              border: '1px solid #e4e7ef',
            }}>
              {invoicesQuery.isLoading ? '…' : `${filtered.length} of ${total}`}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
              <thead>
                <tr style={{ background: '#f8f9fc' }}>
                  {['Ref No', 'Date', 'Party Name', 'Items', 'Total Amount', 'Paid', 'Due', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '11px 16px', fontSize: '11px', fontWeight: 600, color: '#9ca3af',
                      textAlign: h === 'Actions' || h === 'Items' ? 'center' : 'left',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: '1px solid #e4e7ef', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoicesQuery.isLoading ? (
                  [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '56px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '48px', height: '48px', borderRadius: '14px',
                          background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <FileText size={22} color="#3b82f6" />
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a2235' }}>No invoices found</div>
                        <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                          {search || statusFilter ? 'Try adjusting your filters' : 'Create your first invoice'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv, idx) => {
                    const due = inv.totalAmount - inv.paidAmount;
                    const isLast = idx === filtered.length - 1;
                    return (
                      <tr
                        key={inv.id}
                        className="inv-row"
                        style={{
                          borderBottom: isLast ? 'none' : '1px solid #f8fafc',
                          transition: 'background 0.12s',
                          cursor: 'default',
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '13px', fontWeight: 700, color: '#4646b5',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {inv.referenceNo}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                          {new Date(inv.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1a2235' }}>{inv.party.name}</div>
                          {inv.party.phone && (
                            <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '2px' }}>{inv.party.phone}</div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '12px', fontWeight: 700, color: '#4b5563',
                            background: '#f5f6fa', borderRadius: '20px', padding: '3px 10px',
                          }}>
                            {inv.items?.length ?? '–'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                          {fmt(inv.totalAmount)}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#16a34a', whiteSpace: 'nowrap' }}>
                          {fmt(inv.paidAmount)}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: due > 0 ? '#dc2626' : '#4b5563', whiteSpace: 'nowrap' }}>
                          {due > 0 ? fmt(due) : '—'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge status={inv.status} />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            {(inv.status === 'PENDING' || inv.status === 'PARTIAL') && (
                              <button
                                className="action-btn"
                                title="Record Payment"
                                onClick={() => setPayTarget(inv)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '5px',
                                  padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                                  border: '1.5px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a',
                                  cursor: 'pointer', opacity: 0.9, whiteSpace: 'nowrap',
                                }}
                              >
                                <CreditCard size={12} /> Pay
                              </button>
                            )}
                            <button
                              className="action-btn"
                              title="View / Edit"
                              style={{
                                padding: '5px 8px', borderRadius: '8px', border: '1.5px solid #e4e7ef',
                                background: '#f8f9fc', color: '#4b5563', cursor: 'pointer', opacity: 0.9,
                                display: 'flex', alignItems: 'center',
                              }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="action-btn"
                              title="Delete"
                              onClick={() => setDeleteTarget(inv)}
                              style={{
                                padding: '5px 8px', borderRadius: '8px', border: '1.5px solid #fecaca',
                                background: '#fef2f2', color: '#ef4444', cursor: 'pointer', opacity: 0.9,
                                display: 'flex', alignItems: 'center',
                              }}
                            >
                              <Trash2 size={13} />
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
      </div>

      {/* ── Create Modal */}
      {showCreate && (
        <CreateInvoiceModal
          parties={partiesQuery.data ?? []}
          products={productsQuery.data ?? []}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); invalidate(); }}
        />
      )}

      {/* ── Delete Modal */}
      {deleteTarget && (
        <DeleteModal
          invoice={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); invalidate(); }}
        />
      )}

      {/* ── Record Payment Modal */}
      {payTarget && (
        <RecordPaymentModal
          invoice={payTarget}
          onClose={() => setPayTarget(null)}
          onSaved={() => { setPayTarget(null); invalidate(); }}
        />
      )}
    </>
  );
}
