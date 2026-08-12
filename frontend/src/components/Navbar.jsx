/**
 * Navbar — Top navigation bar with tab switching, wallet badge, and account switcher
 */
import { useState } from 'react';
import { useWeb3, LOCAL_ACCOUNTS } from '../hooks/useWeb3';
import {
  LayoutDashboard, FolderKanban, Gavel, Trophy, Settings, History,
  Link2, ChevronDown, Check, RefreshCw, Zap, Sparkles, Cpu
} from 'lucide-react';

const NAV_TABS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'projects',    label: 'Projects',    icon: FolderKanban },
  { id: 'judging',     label: 'Judge & AI Copilot', icon: Gavel },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'admin',       label: 'Admin',       icon: Settings },
  { id: 'transactions',label: 'Tx Log',      icon: History },
];

export default function Navbar({ activeTab, setActiveTab }) {
  const {
    account, isConnected, isConnecting, networkName, accountRole,
    connectMetaMask, connectLocalAccount, disconnect, useLocalMode, selectedLocalAccount
  } = useWeb3();

  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  const shortAddr = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const roleColors = {
    admin: 'admin',
    judge: 'judge',
    viewer: 'viewer',
  };

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="navbar-brand">
        <div className="navbar-logo-icon">⛓</div>
        <span className="navbar-brand-name">ChainJudge</span>
      </div>

      {/* Navigation Tabs */}
      <div className="navbar-nav">
        {NAV_TABS.map(tab => {
          const Icon = tab.icon;
          // Hide admin tab for non-admins
          if (tab.id === 'admin' && accountRole !== 'admin' && isConnected) return null;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right section */}
      <div className="navbar-right">
        {/* Network badge */}
        {isConnected && (
          <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
            <Zap size={10} />
            {networkName}
          </span>
        )}

        {/* Role badge */}
        {isConnected && (
          <span className={`role-badge ${roleColors[accountRole]}`}>
            {accountRole}
          </span>
        )}

        {/* Local account switcher */}
        <div className="account-switcher">
          <button
            className="account-switcher-btn"
            onClick={() => setShowAccountSwitcher(v => !v)}
            title="Switch demo account"
          >
            <RefreshCw size={12} />
            Demo Accounts
            <ChevronDown size={12} />
          </button>

          {showAccountSwitcher && (
            <div
              className="account-switcher-dropdown"
              onMouseLeave={() => setShowAccountSwitcher(false)}
            >
              <div style={{
                padding: '8px 14px 6px',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
                borderBottom: '1px solid var(--color-border-subtle)'
              }}>
                Local Hardhat Accounts
              </div>
              {LOCAL_ACCOUNTS.map((acc, idx) => (
                <div
                  key={acc.address}
                  className={`account-option ${useLocalMode && selectedLocalAccount === idx ? 'active' : ''}`}
                  onClick={() => {
                    connectLocalAccount(idx);
                    setShowAccountSwitcher(false);
                  }}
                >
                  <div
                    className="account-avatar"
                    style={{ background: acc.color + '25', color: acc.color, border: `1px solid ${acc.color}40` }}
                  >
                    {acc.name.charAt(0)}
                  </div>
                  <div className="account-details">
                    <div className="account-name">{acc.name}</div>
                    <div className="account-addr">{shortAddr(acc.address)}</div>
                  </div>
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    borderRadius: '99px',
                    background: acc.color + '15',
                    color: acc.color,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>
                    {acc.role}
                  </span>
                  {useLocalMode && selectedLocalAccount === idx && (
                    <Check size={14} color="var(--color-accent-success)" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wallet button */}
        <button
          className={`wallet-btn ${isConnected ? 'connected' : ''}`}
          onClick={isConnected ? disconnect : connectMetaMask}
          disabled={isConnecting}
        >
          <span className={`wallet-dot ${isConnected ? 'connected' : ''}`} />
          {isConnecting
            ? 'Connecting...'
            : isConnected
              ? shortAddr(account)
              : 'Connect MetaMask'
          }
          <Link2 size={12} />
        </button>
      </div>
    </nav>
  );
}
