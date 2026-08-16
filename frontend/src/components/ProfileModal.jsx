import { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { X, User, Mail, Shield, Wallet, Save, LogOut, CheckCircle2 } from 'lucide-react';

export default function ProfileModal() {
  const { profileModalOpen, setProfileModalOpen, userProfile, updateUserProfile, logout, accountRole } = useWeb3();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        bio: userProfile.bio || '',
      });
    }
  }, [userProfile]);

  if (!profileModalOpen || !userProfile) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    updateUserProfile({
      name: formData.name.trim(),
      email: formData.email.trim(),
      bio: formData.bio.trim(),
    });
    setProfileModalOpen(false);
  };

  const handleLogout = () => {
    logout();
    setProfileModalOpen(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--color-bg-overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9000, backdropFilter: 'blur(6px)'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 'var(--space-xl)', position: 'relative' }}>
        <button
          onClick={() => setProfileModalOpen(false)}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
        >
          <X size={18} />
        </button>

        {/* Header Avatar & Info */}
        <div className="flex items-center gap-md mb-lg">
          <div style={{
            width: 52, height: 52, borderRadius: '50%', background: 'var(--color-primary)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', fontWeight: 700, flexShrink: 0
          }}>
            {userProfile.name?.charAt(0) || 'U'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{userProfile.name}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{userProfile.email}</p>
            <div className="flex items-center gap-xs mt-xs">
              <span className={`role-badge ${accountRole}`}>
                {accountRole}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {userProfile.authMethod === 'web3' ? 'Web3 Wallet Auth' : 'Email Auth Session'}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Settings Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bio / Headline</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
            />
          </div>

          <div className="form-group mb-lg">
            <label className="form-label">Linked EVM Wallet Address</label>
            <div style={{
              background: 'var(--color-bg-subtle)', padding: '8px 12px',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
              fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--color-text-secondary)',
              wordBreak: 'break-all'
            }}>
              <Wallet size={12} style={{ display: 'inline', marginRight: 6, color: 'var(--color-primary)' }} />
              {userProfile.walletAddress || 'No Wallet Connected'}
            </div>
          </div>

          <div className="flex items-center gap-sm">
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Save size={14} /> Save Profile Settings
            </button>
            <button type="button" className="btn btn-danger" onClick={handleLogout}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
