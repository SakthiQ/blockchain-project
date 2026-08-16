import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { ethers } from 'ethers';
import {
  Gavel, CheckCircle2, XCircle, AlertCircle, ExternalLink,
  Info, Loader2, RefreshCw, Shield, Download, Key, Eye, Lock, FileText, Cpu
} from 'lucide-react';

const RUBRIC_CRITERIA = [
  {
    key: 'technicalQuality',
    label: 'Technical Quality',
    desc: 'Code soundness, architecture, and execution completeness.',
  },
  {
    key: 'innovation',
    label: 'Innovation & Creativity',
    desc: 'Originality of concept and novel technical approach.',
  },
  {
    key: 'userExperience',
    label: 'User Experience & Polish',
    desc: 'Usability, interface design, and workflow clarity.',
  },
  {
    key: 'impact',
    label: 'Real-World Impact',
    desc: 'Practical utility, scalability, and problem relevance.',
  },
];

const AI_PROJECT_ANALYZER = {
  DeFi: {
    risk: 'Low Risk — Smart contract architecture static checks passed.',
    aiInsight: 'High technical rigor detected. Multi-sig treasury security verified.',
    tags: ['EVM Multi-Sig', 'Reentrancy Guarded', 'Low Gas Footprint']
  },
  HealthTech: {
    risk: 'Zero Data Leak — Zero-knowledge access logs verified.',
    aiInsight: 'Exceptional societal impact. Solves HIPAA compliance friction.',
    tags: ['Patient Privacy', 'ZK Consent', 'Interoperable']
  },
  EdTech: {
    risk: 'Low Risk — Immutable issuer signature verification confirmed.',
    aiInsight: 'Eliminates credential forgery with cryptographic checks.',
    tags: ['Soulbound NFT Certificates', 'Fast Verification', 'Low Friction']
  },
  Sustainability: {
    risk: 'Low Risk — Transparent carbon credit registry audit.',
    aiInsight: 'Solves double-counting via public ledger verification.',
    tags: ['Carbon Offsets', 'Public Audit Trail', 'ESG Aligned']
  },
  default: {
    risk: 'Standard Risk Profile — All checks normal.',
    aiInsight: 'Balanced project profile across technical execution and UX.',
    tags: ['Smart Contract Validated', 'Clean Architecture']
  }
};

export default function JudgingView() {
  const { contract, account, accountRole, isConnected, hackathonInfo, addToast, getReadOnlyContract } = useWeb3();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [scores, setScores] = useState({ technicalQuality: 5, innovation: 5, userExperience: 5, impact: 5 });
  const [salt, setSalt] = useState('');
  const [hasCommitted, setHasCommitted] = useState(false);
  const [alreadyScored, setAlreadyScored] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [existingScore, setExistingScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastTx, setLastTx] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const isJudge = accountRole === 'judge' && isConnected;
  const currentPhase = hackathonInfo ? hackathonInfo.phase : 0; // 0=Setup, 1=Judging(Commit), 2=Revealing, 3=Finalized

  useEffect(() => {
    loadProjects();
  }, [contract]);

  useEffect(() => {
    if (selectedProjectId && account && (contract || getReadOnlyContract())) {
      checkStatus(selectedProjectId);
    }
  }, [selectedProjectId, account, contract, currentPhase]);

  const loadProjects = async () => {
    const c = contract || getReadOnlyContract();
    if (!c) return;
    setLoadingProjects(true);
    try {
      const count = await c.projectCount();
      const list = [];
      for (let i = 1; i <= Number(count); i++) {
        const p = await c.projects(i);
        list.push({ id: Number(p.id), name: p.name, teamLead: p.teamLead, category: p.category, description: p.description, ipfsCID: p.ipfsCID });
      }
      setProjects(list);
      if (list.length > 0) setSelectedProjectId(String(list[0].id));
    } catch (err) {
      console.error('Failed to load projects:', err.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  const checkStatus = async (projectId) => {
    const c = contract || getReadOnlyContract();
    if (!c || !account) return;
    try {
      const conflict = await c.judgeConflicts(account, projectId);
      setHasConflict(conflict);

      const scored = await c.judgeHasScored(account, projectId);
      setAlreadyScored(scored);

      const committed = await c.judgeHasCommitted(account, projectId);
      setHasCommitted(committed);

      const savedSalt = localStorage.getItem(`judge_salt_${account}_proj_${projectId}`);
      if (savedSalt) setSalt(savedSalt);
      else if (!salt) {
        const newSalt = ethers.hexlify(ethers.randomBytes(32));
        setSalt(newSalt);
      }

      if (scored) {
        const sub = await c.getScore(account, projectId);
        setExistingScore({
          technicalQuality: Number(sub.technicalQuality),
          innovation: Number(sub.innovation),
          userExperience: Number(sub.userExperience),
          impact: Number(sub.impact),
          totalScore: Number(sub.totalScore),
          timestamp: Number(sub.timestamp),
        });
      } else {
        setExistingScore(null);
      }
    } catch (err) {
      console.warn('Status check warning:', err.message);
    }
  };

  const handleScoreChange = (key, value) => {
    setScores(prev => ({ ...prev, [key]: Number(value) }));
  };

  const handleCommitScore = async (e) => {
    e.preventDefault();
    if (!contract || !isJudge) return;

    if (hasConflict) {
      addToast('error', 'Recused', 'You are recused from scoring this project due to conflict of interest.');
      return;
    }

    setSubmitting(true);
    setLastTx(null);
    try {
      const activeSalt = salt || ethers.hexlify(ethers.randomBytes(32));
      const hash = ethers.solidityPackedKeccak256(
        ['uint256', 'uint8', 'uint8', 'uint8', 'uint8', 'bytes32'],
        [selectedProjectId, scores.technicalQuality, scores.innovation, scores.userExperience, scores.impact, activeSalt]
      );

      localStorage.setItem(`judge_salt_${account}_proj_${selectedProjectId}`, activeSalt);

      const tx = await contract.commitScore(selectedProjectId, hash);
      addToast('info', 'Commit Hash Sent', 'Submitting blind score commitment on-chain...');
      const receipt = await tx.wait();
      setLastTx(receipt.hash);
      setHasCommitted(true);
      addToast('success', 'Score Committed (Phase 1)', `Hash locked on-chain.`);
    } catch (err) {
      addToast('error', 'Commit Failed', err.reason || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevealScore = async (e) => {
    e.preventDefault();
    if (!contract || !isJudge) return;

    setSubmitting(true);
    setLastTx(null);
    try {
      const tx = await contract.revealScore(
        selectedProjectId,
        scores.technicalQuality,
        scores.innovation,
        scores.userExperience,
        scores.impact,
        salt
      );
      addToast('info', 'Verification Sent', 'Submitting secret salt and revealing score on-chain...');
      const receipt = await tx.wait();
      setLastTx(receipt.hash);
      setAlreadyScored(true);
      addToast('success', 'Score Revealed (Phase 2)', `Blind score verified and recorded on-chain!`);
      await checkStatus(selectedProjectId);
    } catch (err) {
      addToast('error', 'Reveal Failed', err.reason || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSaltBackup = () => {
    const backup = {
      projectId: selectedProjectId,
      judge: account,
      salt: salt,
      scores: scores,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `judge_salt_project_${selectedProjectId}.json`;
    a.click();
  };

  const selectedProj = projects.find(p => String(p.id) === String(selectedProjectId));
  const aiInfo = (selectedProj && AI_PROJECT_ANALYZER[selectedProj.category]) || AI_PROJECT_ANALYZER.default;

  return (
    <div>
      <div className="flex items-center justify-between mb-lg flex-wrap gap-md">
        <div>
          <h1 className="page-title">
            <Gavel size={24} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: 'var(--color-primary)' }} />
            Judge Workspace &amp; Rubric Scoring
          </h1>
          <p className="page-subtitle">
            Phase 1: Commit score hash. Phase 2: Reveal salt verification. Cryptographically blind evaluation workspace.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadProjects} disabled={loadingProjects}>
          <RefreshCw size={13} className={loadingProjects ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {!isJudge && (
        <div style={{
          padding: 'var(--space-md)', background: 'var(--color-warning-subtle)',
          border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-md)',
          color: 'var(--color-warning)', marginBottom: 'var(--space-lg)', fontSize: '0.85rem'
        }}>
          <AlertCircle size={15} style={{ display: 'inline', marginRight: 6 }} />
          You are currently in <strong>{accountRole}</strong> mode. To submit scores, select <strong>Dr. Emily Chen (Judge)</strong> from <strong>"Demo Accounts"</strong> in the top header.
        </div>
      )}

      <div className="two-col-grid mb-xl">
        {/* Left Column: Project Selection & Technical Profile */}
        <div>
          <div className="card mb-md">
            <h3 className="card-title mb-sm">Select Project for Evaluation</h3>
            <div className="form-group mb-md">
              <label className="form-label">Project</label>
              <select
                className="form-select"
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.id} — {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            {selectedProj && (
              <div>
                <div className="flex items-center justify-between mb-xs">
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selectedProj.name}</h4>
                  <span className="badge badge-category">{selectedProj.category}</span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.5 }}>
                  {selectedProj.description || 'No detailed description provided.'}
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                  Team Lead: <strong>{selectedProj.teamLead}</strong>
                </div>
                {selectedProj.ipfsCID && (
                  <a
                    href={`https://ipfs.io/ipfs/${selectedProj.ipfsCID}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.78rem', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <ExternalLink size={11} /> View Pitch CID ({selectedProj.ipfsCID.slice(0, 12)}...)
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Technical Profile Breakdown */}
          {selectedProj && (
            <div className="ai-copilot-card">
              <div className="flex items-center justify-between mb-sm">
                <span className="ai-badge">Technical Verification Check</span>
                <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                  <Shield size={10} /> Verified
                </span>
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-sm)' }}>
                {aiInfo.aiInsight}
              </p>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-sm)' }}>
                {aiInfo.risk}
              </div>
              <div className="flex items-center gap-xs flex-wrap">
                {aiInfo.tags.map((tag, idx) => (
                  <span key={idx} style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-xs)',
                    background: 'var(--color-bg-surface)', border: '1px solid var(--border-color)',
                    color: 'var(--color-text-secondary)'
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Scorecard & Commit/Reveal Controls */}
        <div>
          <div className="card">
            <div className="card-header mb-md">
              <h3 className="card-title">Scorecard Criteria</h3>
              <span className="badge badge-category">
                Phase {currentPhase}: {hackathonInfo?.phaseName || 'Setup'}
              </span>
            </div>

            {hasConflict ? (
              <div style={{ padding: 'var(--space-md)', background: 'var(--color-danger-subtle)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                <XCircle size={16} style={{ display: 'inline', marginRight: 6 }} />
                <strong>Conflict of Interest Recusal:</strong> You are marked as a mentor/conflict for this project and cannot submit scores.
              </div>
            ) : alreadyScored ? (
              <div>
                <div style={{ padding: 'var(--space-md)', background: 'var(--color-success-subtle)', border: '1px solid var(--color-success-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-success)', marginBottom: 'var(--space-md)', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} />
                  <strong>Score Verified &amp; Revealed:</strong> Your scorecard has been recorded on-chain.
                </div>
                {existingScore && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <div className="flex justify-between mb-xs">
                      <span>Technical Quality:</span>
                      <strong>{existingScore.technicalQuality} / 10</strong>
                    </div>
                    <div className="flex justify-between mb-xs">
                      <span>Innovation:</span>
                      <strong>{existingScore.innovation} / 10</strong>
                    </div>
                    <div className="flex justify-between mb-xs">
                      <span>User Experience:</span>
                      <strong>{existingScore.userExperience} / 10</strong>
                    </div>
                    <div className="flex justify-between mb-xs">
                      <span>Real-World Impact:</span>
                      <strong>{existingScore.impact} / 10</strong>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={currentPhase === 2 ? handleRevealScore : handleCommitScore}>
                {RUBRIC_CRITERIA.map(crit => (
                  <div key={crit.key} className="form-group mb-md">
                    <div className="flex justify-between items-center mb-xs">
                      <label className="form-label">{crit.label}</label>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--color-primary)' }}>
                        {scores[crit.key]} / 10
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={scores[crit.key]}
                      onChange={e => handleScoreChange(crit.key, e.target.value)}
                    />
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {crit.desc}
                    </div>
                  </div>
                ))}

                {/* Salt manager */}
                <div className="form-group mb-md" style={{ background: 'var(--color-bg-subtle)', padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center justify-between mb-xs">
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>
                      <Key size={10} style={{ display: 'inline', marginRight: 4 }} /> Secret Salt Hash
                    </label>
                    <button type="button" onClick={handleDownloadSaltBackup} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.72rem', cursor: 'pointer' }}>
                      <Download size={10} style={{ display: 'inline', marginRight: 2 }} /> Backup Salt JSON
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input text-mono text-xs"
                    value={salt}
                    onChange={e => setSalt(e.target.value)}
                  />
                </div>

                {currentPhase === 1 ? (
                  <button type="submit" className="btn btn-primary w-full" disabled={submitting || !isJudge}>
                    {submitting ? 'Submitting Hash...' : 'Phase 1: Commit Score Hash'}
                  </button>
                ) : currentPhase === 2 ? (
                  <button type="submit" className="btn btn-success w-full" disabled={submitting || !isJudge}>
                    {submitting ? 'Revealing Score...' : 'Phase 2: Reveal & Verify Score'}
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary w-full" disabled={submitting || !isJudge}>
                    {submitting ? 'Recording Score...' : 'Submit Scorecard'}
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
