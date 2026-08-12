/**
 * DashboardView — Landing page showing hackathon overview and blockchain info
 */
import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import {
  Activity, Users, FolderKanban, Trophy, Shield, Link2,
  Globe, Lock, Eye, Zap, AlertCircle, RefreshCw, Sparkles, BrainCircuit, Bot
} from 'lucide-react';

export default function DashboardView({ setActiveTab }) {
  const { contract, hackathonInfo, isConnected, loadHackathonInfo, isLoadingInfo, contractAddress, networkName, account, accountRole } = useWeb3();
  const [blockNumber, setBlockNumber] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);

  useEffect(() => {
    loadLatestBlock();
    loadRecentEvents();
  }, [contract]);

  const loadLatestBlock = async () => {
    if (!contract) return;
    try {
      const provider = contract.runner.provider;
      const bn = await provider.getBlockNumber();
      setBlockNumber(bn);
    } catch {}
  };

  const loadRecentEvents = async () => {
    if (!contract) return;
    try {
      const filter = contract.filters.ScoreSubmitted();
      const events = await contract.queryFilter(filter, -50);
      setRecentEvents(events.slice(-5).reverse());
    } catch {}
  };

  const WHY_BLOCKCHAIN = [
    {
      icon: <Lock size={20} />,
      color: '#6c63ff',
      title: 'Immutable Records',
      desc: 'Once a judge submits a score, it cannot be altered or deleted — by anyone, including the organizer.'
    },
    {
      icon: <Eye size={20} />,
      color: '#00d4ff',
      title: 'Transparent Verification',
      desc: 'Anyone can independently verify all judging records by querying the blockchain — no trust required.'
    },
    {
      icon: <Shield size={20} />,
      color: '#00e5a0',
      title: 'Tamper Resistance',
      desc: 'Smart contract rules are enforced by the blockchain network — no central party can override them.'
    },
    {
      icon: <Users size={20} />,
      color: '#ff6b8a',
      title: 'Wallet-Based Identity',
      desc: 'Judge authorization is cryptographically enforced. Only registered wallet addresses can submit scores.'
    },
    {
      icon: <Globe size={20} />,
      color: '#ffb347',
      title: 'Decentralized Trust',
      desc: 'Results are determined by code, not administrators. The leaderboard reflects on-chain data directly.'
    },
    {
      icon: <Zap size={20} />,
      color: '#6c63ff',
      title: 'Audit Trail',
      desc: 'Every judging action emits an on-chain event with timestamp — a permanent, verifiable audit log.'
    },
  ];

  return (
    <div>
      {/* Hero */}
      <div className="hero-section">
        <div className="flex items-center gap-md mb-md" style={{ flexWrap: 'wrap' }}>
          <span className="ai-badge">
            <Sparkles size={12} className="ai-sparkle-icon" /> AI Copilot Enhanced
          </span>
          <span className="badge badge-active">
            <Activity size={10} />
            {hackathonInfo?.active ? 'Judging Open' : 'Setup Mode'}
          </span>
          {isConnected && (
            <span className="badge badge-category">
              <Link2 size={10} />
              {networkName}
            </span>
          )}
        </div>
        <h1 className="hero-title">
          {hackathonInfo?.name || 'ChainJudge — Blockchain & AI Platform'}
        </h1>
        <p className="hero-description">
          Next-generation decentralized hackathon judging powered by <strong>Solidity Smart Contracts</strong> and <strong>AI Evaluation Copilots</strong>.
          Transparent, tamper-proof, and audit-ready.
        </p>

        {!isConnected && (
          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            background: 'rgba(255,179,71,0.1)',
            border: '1px solid rgba(255,179,71,0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.85rem',
            color: 'var(--color-accent-warning)'
          }}>
            <AlertCircle size={16} />
            Connect a wallet or select a demo account from <strong>"Demo Accounts"</strong> in the top-right to explore the platform.
          </div>
        )}
      </div>

      {/* Stats */}
      {hackathonInfo && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(108,99,255,0.15)' }}>
              <FolderKanban size={20} color="var(--color-accent-primary)" />
            </div>
            <div className="stat-value">{hackathonInfo.numProjects}</div>
            <div className="stat-label">Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(0,212,255,0.15)' }}>
              <Users size={20} color="var(--color-accent-secondary)" />
            </div>
            <div className="stat-value">{hackathonInfo.numJudges}</div>
            <div className="stat-label">Judges</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(0,229,160,0.15)' }}>
              <Activity size={20} color="var(--color-accent-success)" />
            </div>
            <div className="stat-value">{blockNumber ?? '—'}</div>
            <div className="stat-label">Block Height</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(255,107,138,0.15)' }}>
              <Trophy size={20} color="var(--color-accent-tertiary)" />
            </div>
            <div className="stat-value">{recentEvents.length > 0 ? recentEvents.length : '—'}</div>
            <div className="stat-label">Recent Scores</div>
          </div>
        </div>
      )}

      {/* Contract Info */}
      {isConnected && (
        <div className="card mb-lg">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-sm">
              <Link2 size={16} color="var(--color-accent-secondary)" />
              Deployed Contract
            </h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { loadHackathonInfo(); loadLatestBlock(); loadRecentEvents(); }}
              disabled={isLoadingInfo}
            >
              <RefreshCw size={13} className={isLoadingInfo ? 'spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-item-label">Contract Address</span>
              <span className="info-item-value">{contractAddress}</span>
            </div>
            <div className="info-item">
              <span className="info-item-label">Network</span>
              <span className="info-item-value">{networkName}</span>
            </div>
            <div className="info-item">
              <span className="info-item-label">Connected As</span>
              <span className="info-item-value">{account}</span>
            </div>
            <div className="info-item">
              <span className="info-item-label">Your Role</span>
              <span className={`role-badge ${accountRole}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                {accountRole}
              </span>
            </div>
            {hackathonInfo && (
              <div className="info-item">
                <span className="info-item-label">Admin Address</span>
                <span className="info-item-value">{hackathonInfo.adminAddress}</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-item-label">Latest Block</span>
              <span className="info-item-value">{blockNumber ?? 'Loading...'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Why Blockchain */}
      <h2 className="section-title">
        <Shield size={18} color="var(--color-accent-primary)" />
        Why Blockchain for Judging?
      </h2>
      <div className="projects-grid mb-xl">
        {WHY_BLOCKCHAIN.map((item, i) => (
          <div key={i} className="card">
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-md)',
              background: item.color + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: item.color, marginBottom: 'var(--space-md)'
            }}>
              {item.icon}
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 6 }}>{item.title}</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="two-col-grid">
        <div className="card" style={{ background: 'rgba(108,99,255,0.08)', borderColor: 'rgba(108,99,255,0.2)' }}>
          <h3 className="card-title mb-sm">View Projects</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            Browse all registered hackathon teams and their project descriptions.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('projects')}>
            <FolderKanban size={14} /> Browse Projects
          </button>
        </div>
        <div className="card" style={{ background: 'rgba(0,229,160,0.06)', borderColor: 'rgba(0,229,160,0.2)' }}>
          <h3 className="card-title mb-sm">Leaderboard</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            View real-time rankings generated directly from on-chain score aggregation.
          </p>
          <button className="btn btn-success btn-sm" onClick={() => setActiveTab('leaderboard')}>
            <Trophy size={14} /> View Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
