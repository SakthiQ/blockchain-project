import { useState } from 'react';
import { useWeb3 } from '../hooks/useBlockchainContext';
import { X, UserPlus, LogIn, Shield, Wallet, Mail, Lock, User } from 'lucide-react';

const ROLES = [
  { id: 'participant', label: 'Participant' },
  { id: 'judge',       label: 'Judge'       },
  { id: 'admin',       label: 'Organiser'   },
];

const EMPTY = { name: '', email: '', password: '', role: 'participant', bio: '' };

export default function AuthModal() {
  const {
    authModalOpen, setAuthModalOpen,
    signUpWithEmail, loginWithEmail, connectMetaMask, isConnecting,
  } = useWeb3();

  const [tab, setTab] = useState('signup');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  if (!authModalOpen) return null;

  const set = (key, val) => {
    setError('');
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (tab === 'signup') {
        if (!form.name.trim() || !form.email.trim() || !form.password) {
          setError('Name, email and password are required.');
          return;
        }
        await signUpWithEmail({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role, bio: form.bio.trim() });
      } else {
        if (!form.email.trim() || !form.password) {
          setError('Email and password are required.');
          return;
        }
        await loginWithEmail({ email: form.email.trim(), password: form.password });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to ChainJudge"
      onClick={(e) => { if (e.target === e.currentTarget) setAuthModalOpen(false); }}
    >
      <div className="modal">
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--c-brand-dim)', color: 'var(--c-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={16} />
            </div>
            <div>
              <div className="modal-title">ChainJudge</div>
              <div className="text-xs text-muted">Sign in to your account</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => { setAuthModalOpen(false); setForm(EMPTY); setError(''); }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Tab switcher */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 3,
              background: 'var(--c-bg)',
              padding: 3,
              borderRadius: 'var(--r-md)',
              marginBottom: 'var(--s-5)',
            }}
          >
            {[
              { id: 'signup', label: 'Sign Up', icon: UserPlus },
              { id: 'login',  label: 'Log In',  icon: LogIn },
              { id: 'wallet', label: 'Web3',    icon: Wallet },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setTab(id); setError(''); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 5, padding: '6px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  fontSize: '0.8rem', fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 120ms',
                  background: tab === id ? 'var(--c-brand)' : 'transparent',
                  color: tab === id ? '#fff' : 'var(--t-secondary)',
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {/* Web3 wallet panel */}
          {tab === 'wallet' && (
            <div>
              <div className="card card-sm" style={{ textAlign: 'center', marginBottom: 'var(--s-4)' }}>
                <Wallet size={28} color="var(--c-brand)" style={{ margin: '0 auto var(--s-3)' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>MetaMask</div>
                <p className="text-sm text-secondary" style={{ lineHeight: 1.55 }}>
                  Authenticate cryptographically via your Ethereum wallet address.
                </p>
              </div>
              <button
                className="btn btn-primary w-full"
                onClick={async () => { await connectMetaMask(); setAuthModalOpen(false); }}
                disabled={isConnecting}
              >
                {isConnecting ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Connecting…</> : 'Connect MetaMask'}
              </button>
            </div>
          )}

          {/* Email form */}
          {tab !== 'wallet' && (
            <form onSubmit={handleSubmit} noValidate>
              {tab === 'signup' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-name">Full Name *</label>
                  <div style={{ position: 'relative' }}>
                    <User size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-muted)', pointerEvents: 'none' }} />
                    <input
                      id="auth-name"
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 32 }}
                      placeholder="Alex Rivera"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="auth-email">Email *</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-muted)', pointerEvents: 'none' }} />
                  <input
                    id="auth-email"
                    type="email"
                    className="form-input"
                    style={{ paddingLeft: 32 }}
                    placeholder="name@company.com"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="auth-password">Password *</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-muted)', pointerEvents: 'none' }} />
                  <input
                    id="auth-password"
                    type="password"
                    className="form-input"
                    style={{ paddingLeft: 32 }}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                    required
                  />
                </div>
              </div>

              {tab === 'signup' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {ROLES.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => set('role', r.id)}
                          style={{
                            flex: 1, padding: '6px 4px',
                            border: `1px solid ${form.role === r.id ? 'var(--c-brand)' : 'var(--b-default)'}`,
                            borderRadius: 'var(--r-sm)',
                            background: form.role === r.id ? 'var(--c-brand-dim)' : 'transparent',
                            color: form.role === r.id ? 'var(--c-brand)' : 'var(--t-secondary)',
                            fontSize: '0.78rem', fontWeight: 600,
                            cursor: 'pointer', transition: 'all 120ms',
                          }}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="auth-bio">Bio / Title <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                    <input
                      id="auth-bio"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Smart Contract Developer"
                      value={form.bio}
                      onChange={(e) => set('bio', e.target.value)}
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="alert alert-danger mb-4" style={{ padding: '8px 12px' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isConnecting}
              >
                {isConnecting
                  ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Working…</>
                  : tab === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
