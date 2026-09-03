import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/hooks/useApi';
import { Eye, EyeOff, AlertCircle, BarChart3, MessageSquare, Package } from 'lucide-react';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/v1/auth/login', { phone, password });
      setAuth(data.token, data.refreshToken, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: BarChart3,      title: 'Live Dashboard',    desc: 'Real-time sales, profit & inventory analytics' },
    { icon: MessageSquare,  title: 'WhatsApp + Gmail',  desc: 'Unified inbox with AI intent detection' },
    { icon: Package,        title: 'Smart Inventory',   desc: 'Stock tracking with low-stock alerts' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif",
      background: '#f5f6fa',
    }}>
      {/* ══ Left panel ══ */}
      <div style={{
        flex: 1,
        background: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 48px',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, #5b5bd6, #8b5cf6, #06b6d4)',
        }} />

        {/* Ambient glow */}
        <div style={{
          position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(91,91,214,0.15) 0%, transparent 65%)',
          top: '-150px', left: '-100px', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)',
          bottom: '-100px', right: '-80px', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: '420px', width: '100%' }}>
          {/* Logo */}
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #5b5bd6 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', marginBottom: '28px',
            boxShadow: '0 8px 32px rgba(91,91,214,0.5)',
          }}>🧵</div>

          <h1 style={{
            fontSize: '32px', fontWeight: 800, color: '#f8fafc',
            margin: '0 0 10px', lineHeight: 1.15, letterSpacing: '-0.04em',
          }}>
            GSpaces<br />
            <span style={{ color: '#a5b4fc' }}>TextileIQ</span>
          </h1>
          <p style={{
            fontSize: '14px', color: 'rgba(148,163,184,0.8)', lineHeight: 1.7,
            margin: '0 0 40px', maxWidth: '320px',
          }}>
            The all-in-one business OS for Surat's textile industry.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                  background: 'rgba(91,91,214,0.2)', border: '1px solid rgba(91,91,214,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#a5b4fc',
                }}>
                  <Icon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#e2e8f0', marginBottom: '2px', letterSpacing: '-0.01em' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(148,163,184,0.65)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom tags */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '40px', flexWrap: 'wrap' }}>
            {['AI-Powered', 'Multi-tenant', 'WhatsApp Ready', 'Real-time'].map(tag => (
              <div key={tag} style={{
                fontSize: '11px', fontWeight: 600, color: 'rgba(148,163,184,0.6)',
                padding: '4px 12px', borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                letterSpacing: '0.02em',
              }}>{tag}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Right panel — form ══ */}
      <div style={{
        width: '460px',
        flexShrink: 0,
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 44px',
        borderLeft: '1px solid #e4e7ef',
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: '24px', fontWeight: 800, color: '#111827',
              margin: '0 0 6px', letterSpacing: '-0.035em',
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
              Sign in to your TextileIQ account
            </p>
          </div>

          <form onSubmit={handleLogin}>
            {/* Phone */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '11.5px', fontWeight: 600,
                color: '#374151', marginBottom: '6px',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="9876543210"
                required
                autoFocus
                style={{
                  width: '100%', padding: '10px 14px',
                  border: '1.5px solid #e4e7ef', borderRadius: '10px',
                  fontSize: '14px', color: '#111827', background: '#f8f9fc',
                  outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#5b5bd6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(91,91,214,0.10)';
                  e.target.style.background = '#fff';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#e4e7ef';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = '#f8f9fc';
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '11.5px', fontWeight: 600,
                color: '#374151', marginBottom: '6px',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '10px 44px 10px 14px',
                    border: '1.5px solid #e4e7ef', borderRadius: '10px',
                    fontSize: '14px', color: '#111827', background: '#f8f9fc',
                    outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#5b5bd6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(91,91,214,0.10)';
                    e.target.style.background = '#fff';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#e4e7ef';
                    e.target.style.boxShadow = 'none';
                    e.target.style.background = '#f8f9fc';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '10px', padding: '10px 14px', marginBottom: '20px',
                fontSize: '13px', color: '#dc2626',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? '#a5b4fc' : '#5b5bd6',
                border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: 700, color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 2px 8px rgba(91,91,214,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                transition: 'all 0.18s ease',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#4646b5';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(91,91,214,0.45)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = loading ? '#a5b4fc' : '#5b5bd6';
                (e.currentTarget as HTMLButtonElement).style.transform = 'none';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = loading ? 'none' : '0 2px 8px rgba(91,91,214,0.35)';
              }}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '28px' }}>
            GSpaces TextileIQ · Surat, Gujarat
          </p>
        </div>
      </div>
    </div>
  );
}
