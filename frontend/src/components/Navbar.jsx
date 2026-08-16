import { useState, useRef, useEffect } from 'react';
import { useWeb3, LOCAL_ACCOUNTS } from '../hooks/useWeb3';
import {
  LayoutDashboard, FolderKanban, Gavel, Trophy,
  Settings, History, Award, ChevronDown, Check,
  Zap, Clock, Shield, LogIn, User, Menu, X
} from 'lucide-react';

const NAV_TABS = [
  { id: 'dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'projects',     label: 'Projects',    icon: FolderKanban },
  { id: 'judging',      label: 'Judging',     icon: Gavel },
  { id: 'scorecard',    label: 'Scorecard',   icon: Award },
  { id: 'leaderboard',  label: 'Leaderboard', icon: Trophy },
  { id: 'admin',        label: 'Admin',       icon: Settings, adminOnly: true },
  { id: 'transactions', label: 'Tx Log',      icon: History },
];

const short = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';

export default function Navbar({ activeTab, setActiveTab }) {
  const {
    isConnected, networkName, accountRole, hackathonInfo,
    connectLocalAccount, useLocalMode, selectedLocalAccount,
    userProfile, setAuthModalOpen, setProfileModalOpen,
  } = useWeb3();

  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const demoRef = useRef(null);

  // Close demo dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (demoRef.current && !demoRef.current.contains(e.target)) {
        setShowDemoMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visibleTabs = NAV_TABS.filter(
    (t) => !t.adminOnly || (t.adminOnly && accountRole === 'admin')
  );

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      {/* Brand */}
      <button
        className="navbar-brand"
        onClick={() => { setActiveTab('dashboard'); setShowMobileMenu(false); }}
        aria-label="ChainJudge home"
      >
        <div className="navbar-logo-icon" aria-hidden="true">
          <Shield size={16} />
        </div>
        <span className="navbar-brand-name">ChainJudge</span>
        <span className="navbar-brand-tag">OS</span>
      </button>

      <div className="nav-divider" aria-hidden="true" />

      {/* Desktop nav */}
      <div className="navbar-nav" role="tablist" aria-label="Navigation tabs">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`nav-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right cluster */}
      <div className="navbar-right">
        {/* Phase indicator */}
        {hackathonInfo?.phaseName && (
          <span
            className={`badge ${hackathonInfo.phase === 3 ? 'badge-active' : 'badge-info'}`}
            title={`Current phase: ${hackathonInfo.phaseName}`}
          >
            <Clock size={10} aria-hidden="true" />
            {hackathonInfo.phaseName}
          </span>
        )}

        {/* Network */}
        {isConnected && (
          <span className="badge badge-active" title={`Connected to ${networkName}`}>
            <Zap size={10} aria-hidden="true" />
            {networkName}
          </span>
        )}

        {/* Role */}
        {isConnected && (
          <span className={`role-badge ${accountRole}`} aria-label={`Role: ${accountRole}`}>
            {accountRole}
          </span>
        )}

        {/* Demo accounts switcher */}
        <div className="account-switcher" ref={demoRef}>
          <button
            className="account-switcher-btn"
            onClick={() => setShowDemoMenu((v) => !v)}
            aria-expanded={showDemoMenu}
            aria-haspopup="listbox"
          >
            <User size={13} aria-hidden="true" />
            <span className="truncate" style={{ maxWidth: 70 }}>
              {useLocalMode
                ? LOCAL_ACCOUNTS[selectedLocalAccount]?.name.split(' ')[0]
                : 'Demo'}
            </span>
            <ChevronDown
              size={12}
              style={{ transition: 'transform 150ms', transform: showDemoMenu ? 'rotate(180deg)' : 'none' }}
              aria-hidden="true"
            />
          </button>

          {showDemoMenu && (
            <div
              className="account-switcher-dropdown"
              role="listbox"
              aria-label="Select demo account"
            >
              <div className="dropdown-header">Local Test Accounts</div>
              {LOCAL_ACCOUNTS.map((acc, idx) => {
                const isActive = useLocalMode && selectedLocalAccount === idx;
                return (
                  <div
                    key={acc.address}
                    role="option"
                    aria-selected={isActive}
                    className={`account-option${isActive ? ' active' : ''}`}
                    onClick={() => {
                      connectLocalAccount(idx);
                      setShowDemoMenu(false);
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        connectLocalAccount(idx);
                        setShowDemoMenu(false);
                      }
                    }}
                  >
                    <div
                      className="account-avatar"
                      style={{ background: acc.color }}
                      aria-hidden="true"
                    >
                      {acc.name.charAt(0)}
                    </div>
                    <div className="account-details">
                      <div className="account-name">{acc.name}</div>
                      <div className="account-addr">{short(acc.address)}</div>
                    </div>
                    <span className={`role-badge ${acc.role}`}>{acc.role}</span>
                    {isActive && (
                      <Check size={13} color="var(--c-green)" aria-label="Currently active" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sign in / user profile */}
        {userProfile ? (
          <button
            className="user-btn"
            onClick={() => setProfileModalOpen(true)}
            aria-label={`Open profile for ${userProfile.name}`}
          >
            <div className="user-avatar" aria-hidden="true">
              {userProfile.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="user-name">{userProfile.name}</span>
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setAuthModalOpen(true)}
          >
            <LogIn size={13} aria-hidden="true" />
            Sign in
          </button>
        )}

        {/* Mobile menu toggle */}
        <button
          className="btn btn-ghost btn-icon"
          style={{ display: 'none' }}
          onClick={() => setShowMobileMenu((v) => !v)}
          aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
          aria-expanded={showMobileMenu}
          id="mobile-menu-toggle"
        >
          {showMobileMenu ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile slide-down nav */}
      {showMobileMenu && (
        <div
          style={{
            position: 'fixed',
            top: 'var(--nav-h)',
            left: 0, right: 0,
            background: 'var(--c-raised)',
            borderBottom: '1px solid var(--b-default)',
            padding: 'var(--s-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--s-1)',
            zIndex: 'calc(var(--z-nav) - 1)',
          }}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`nav-tab${activeTab === tab.id ? ' active' : ''}`}
                style={{ justifyContent: 'flex-start', padding: '9px 12px' }}
                onClick={() => { setActiveTab(tab.id); setShowMobileMenu(false); }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
