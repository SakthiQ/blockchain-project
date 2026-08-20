import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useBlockchainContext';
import {
  Activity, Users, FolderKanban, Trophy, Shield,
  Lock, Eye, Zap, AlertCircle, RefreshCw,
  CheckCircle2, ArrowRight, FileCheck, Gavel, Database
} from 'lucide-react';

const PHASES = [
  { num: 0, label: 'Setup',      desc: 'Team applications & judge onboarding' },
  { num: 1, label: 'Commit',     desc: 'Blind score hash submission' },
  { num: 2, label: 'Reveal',     desc: 'Hash verification & score unblinding' },
  { num: 3, label: 'Finalized',  desc: 'Rankings locked, NFTs mintable' },
];

const FEATURES = [
  { icon: Lock,       title: 'Blind Scoring',         desc: 'Commit-reveal hash pattern eliminates score-anchoring bias between judges.' },
  { icon: Eye,        title: 'Trimmed Mean',           desc: 'Outlier judges are dropped automatically (n≥3). One corrupt score can\'t swing the result.' },
  { icon: Shield,     title: 'Conflict Recusal',       desc: 'Mentors and conflicted judges are blocked at the EVM level — not just warned.' },
  { icon: Gavel,      title: 'Dispute Appeals',        desc: 'On-chain appeals block finalization. Admin must resolve every dispute before locking.' },
  { icon: Trophy,     title: 'Soulbound NFTs',         desc: 'Winners receive non-transferable ERC-721 certificates with on-chain SVG rendering.' },
  { icon: FileCheck,  title: 'Immutable Audit Log',    desc: 'Every score emits a permanent, publicly indexed smart contract event.' },
];

export default function DashboardView({ setActiveTab }) {
  const {
    contract, hackathonInfo, isConnected, loadHackathonInfo,
    isLoadingInfo, networkName, dbStatus, redisStatus,
  } = useWeb3();

  const [blockNumber, setBlockNumber] = useState(null);
  const [disputeCount, setDisputeCount] = useState(0);

  useEffect(() => {
    if (!contract) return;
    (async () => {
      try {
        const bn = await contract.runner.provider.getBlockNumber();
        setBlockNumber(bn);
        const dc = await contract.pendingDisputeCount();
        setDisputeCount(Number(dc));
      } catch {}
    })();
  }, [contract]);

  const phase = hackathonInfo?.phase ?? 0;

  return (
    <div>
      {/* ── Hero ── */}
      <div className="hero-section mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center flex-wrap gap-2">
            <span className={`badge ${hackathonInfo?.active ? 'badge-active' : 'badge-pending'}`}>
              <Activity size={10} />
              {hackathonInfo?.active ? 'Live' : 'Setup'}
            </span>
            {networkName && (
              <span className="badge badge-default">
                <Zap size={10} />
                {networkName}
              </span>
            )}
            {dbStatus && (
              <span className="badge badge-active" title="Database status">
                <Database size={10} />
                {dbStatus}
              </span>
            )}
            {redisStatus && (
              <span className="badge badge-info" title="Cache status">
                <Zap size={10} />
                {redisStatus}
              </span>
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadHackathonInfo()}
            disabled={isLoadingInfo}
            aria-label="Refresh chain data"
          >
            <RefreshCw size={13} className={isLoadingInfo ? 'spin' : ''} />
            Refresh
          </button>
        </div>

        <h1 className="hero-title">
          {hackathonInfo?.name || 'Web3 AI Innovation Hackathon 2026'}
        </h1>
        <p className="hero-description mt-2">
          {hackathonInfo?.description ||
            'End-to-end decentralized judging — blind scoring, trimmed-mean math, on-chain disputes, and Soulbound certificates.'}
        </p>

        {!isConnected && (
          <div className="alert alert-warning mt-4">
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Use <strong>Demo Accounts</strong> in the top bar to switch between Admin, Judge, and Participant roles.
            </span>
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid mb-6">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--c-brand-dim)', color: 'var(--c-brand)' }}>
            <FolderKanban size={18} />
          </div>
          <div>
            <div className="stat-value">{hackathonInfo?.numProjects ?? '—'}</div>
            <div className="stat-label">Projects</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--c-sky-dim)', color: 'var(--c-sky)' }}>
            <Users size={18} />
          </div>
          <div>
            <div className="stat-value">{hackathonInfo?.numJudges ?? '—'}</div>
            <div className="stat-label">Judges</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--c-green-dim)', color: 'var(--c-green)' }}>
            <Activity size={18} />
          </div>
          <div>
            <div className="stat-value">{blockNumber != null ? blockNumber.toLocaleString() : '—'}</div>
            <div className="stat-label">EVM Block</div>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon"
            style={{
              background: disputeCount > 0 ? 'var(--c-red-dim)' : 'var(--c-raised)',
              color: disputeCount > 0 ? 'var(--c-red)' : 'var(--t-muted)',
            }}
          >
            <Shield size={18} />
          </div>
          <div>
            <div className="stat-value">{disputeCount}</div>
            <div className="stat-label">Disputes</div>
          </div>
        </div>
      </div>

      {/* ── Phase stepper ── */}
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-title">Hackathon Lifecycle</div>
            <div className="card-subtitle">Current: Phase {phase} — {hackathonInfo?.phaseName || PHASES[phase]?.label}</div>
          </div>
          <span className="badge badge-brand">Phase {phase} of 3</span>
        </div>
        <div className="phase-stepper">
          {PHASES.map((p) => {
            const done   = phase > p.num;
            const active = phase === p.num;
            return (
              <div
                key={p.num}
                className={`stepper-step${active ? ' active' : done ? ' completed' : ''}`}
              >
                <div className="stepper-num">
                  {done && <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 3 }} />}
                  Phase {p.num}
                </div>
                <div className="stepper-label">{p.label}</div>
                <div className="text-xs text-muted mt-2">{p.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Features grid ── */}
      <div className="section-label mb-3">Protocol capabilities</div>
      <div className="projects-grid mb-6">
        {FEATURES.map(({ icon: Icon, title, desc }, i) => (
          <div key={i} className="card card-sm">
            <div
              style={{
                width: 34, height: 34,
                borderRadius: 'var(--r-md)',
                background: 'var(--c-brand-dim)',
                color: 'var(--c-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 'var(--s-3)',
              }}
            >
              <Icon size={16} />
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>{title}</div>
            <p className="text-sm text-secondary" style={{ lineHeight: 1.55 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div className="two-col">
        <div className="card">
          <div className="card-title mb-2">Projects Directory</div>
          <p className="text-sm text-secondary mb-4" style={{ lineHeight: 1.55 }}>
            Browse teams, verify IPFS pitch CIDs, and submit applications.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('projects')}>
            Browse <ArrowRight size={13} />
          </button>
        </div>

        <div className="card">
          <div className="card-title mb-2">Judging Console</div>
          <p className="text-sm text-secondary mb-4" style={{ lineHeight: 1.55 }}>
            Commit score hashes in Phase 1, then reveal salt-verified scores in Phase 2.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('judging')}>
            Open Console <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
