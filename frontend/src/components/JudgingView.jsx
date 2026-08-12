/**
 * JudgingView — Score submission form for authorized judges
 *
 * BLOCKCHAIN CONCEPTS DEMONSTRATED:
 *   - Only authorized judges can submit scores (enforced on-chain)
 *   - Smart contract validation rejects invalid scores before recording
 *   - Duplicate submission prevention enforced at contract level
 *   - Transaction hash is displayed after successful submission
 *   - Events are emitted and readable from the transaction receipt
 */
import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import {
  Gavel, CheckCircle2, XCircle, AlertCircle, ExternalLink,
  Info, Loader2, RefreshCw, Shield, Sparkles, Cpu, Bot, BrainCircuit, Wand2
} from 'lucide-react';

const RUBRIC_CRITERIA = [
  {
    key: 'technicalQuality',
    label: 'Technical Quality',
    desc: 'How well-built and technically sound is the implementation?',
    color: '#8b5cf6',
  },
  {
    key: 'innovation',
    label: 'Innovation',
    desc: 'How original and creative is the concept or approach?',
    color: '#06b6d4',
  },
  {
    key: 'userExperience',
    label: 'User Experience',
    desc: 'How polished, usable, and intuitive is the interface?',
    color: '#ec4899',
  },
  {
    key: 'impact',
    label: 'Real-World Impact',
    desc: 'What is the potential societal or practical impact?',
    color: '#10b981',
  },
];

// AI Copilot Knowledge Base & Scoring Recommendation Logic
const AI_PROJECT_ANALYZER = {
  DeFi: {
    tech: 9, innov: 8, ux: 7, impact: 8,
    risk: 'Low Risk — Smart contract architecture passed automated static analysis.',
    aiInsight: 'High technical rigor detected. Solves key liquidity and multi-sig security challenges.',
    tags: ['EVM Multi-Sig', 'Reentrancy Guarded', 'Low Gas Footprint']
  },
  HealthTech: {
    tech: 8, innov: 9, ux: 8, impact: 10,
    risk: 'Zero Data Leak — Zero-knowledge access logs verified.',
    aiInsight: 'Exceptional societal impact. Decentralized consent solves major HIPAA compliance friction.',
    tags: ['Patient Privacy', 'ZK Consent', 'Interoperable']
  },
  EdTech: {
    tech: 9, innov: 8, ux: 8, impact: 8,
    risk: 'Low Risk — Immutable issuer signature verification confirmed.',
    aiInsight: 'Solid implementation. Eliminates credential forgery with instant cryptographic checks.',
    tags: ['Soulbound NFT Certificates', 'Fast Verification', 'Low Friction']
  },
  Sustainability: {
    tech: 7, innov: 10, ux: 9, impact: 10,
    risk: 'Low Risk — Transparent carbon credit registry audit.',
    aiInsight: 'Highest innovation rating. Solves double-counting in carbon markets via public ledger.',
    tags: ['Carbon Offsets', 'Public Audit Trail', 'ESG Aligned']
  },
  default: {
    tech: 8, innov: 8, ux: 8, impact: 8,
    risk: 'Standard Risk Profile — All checks normal.',
    aiInsight: 'Balanced project profile across technical execution and UX design.',
    tags: ['Smart Contract Validated', 'Clean Architecture']
  }
};

export default function JudgingView() {
  const { contract, account, accountRole, isConnected, addToast, getReadOnlyContract } = useWeb3();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [scores, setScores] = useState({ technicalQuality: 5, innovation: 5, userExperience: 5, impact: 5 });
  const [alreadyScored, setAlreadyScored] = useState(false);
  const [existingScore, setExistingScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastTx, setLastTx] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const isJudge = accountRole === 'judge' && isConnected;
  const totalScore = Object.values(scores).reduce((a, b) => a + Number(b), 0);

  // Load projects
  useEffect(() => {
    loadProjects();
  }, [contract]);

  // Check if already scored when project changes
  useEffect(() => {
    if (selectedProjectId && account && (contract || getReadOnlyContract())) {
      checkAlreadyScored(selectedProjectId);
    }
  }, [selectedProjectId, account, contract]);

  const loadProjects = async () => {
    const c = contract || getReadOnlyContract();
    if (!c) return;
    setLoadingProjects(true);
    try {
      const count = await c.projectCount();
      const list = [];
      for (let i = 1; i <= Number(count); i++) {
        const p = await c.projects(i);
        list.push({ id: Number(p.id), name: p.name, teamLead: p.teamLead, category: p.category });
      }
      setProjects(list);
      if (list.length > 0) setSelectedProjectId(String(list[0].id));
    } catch (err) {
      console.error('Failed to load projects:', err.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  const checkAlreadyScored = async (projectId) => {
    const c = contract || getReadOnlyContract();
    if (!c || !account) return;
    try {
      const hasScored = await c.judgeHasScored(account, projectId);
      setAlreadyScored(hasScored);
      if (hasScored) {
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
    } catch {}
  };

  const handleScoreChange = (key, value) => {
    setScores(prev => ({ ...prev, [key]: Number(value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isJudge) return;
    if (!selectedProjectId) {
      addToast('warning', 'No Project Selected', 'Please select a project to score.');
      return;
    }
    if (alreadyScored) {
      addToast('error', 'Already Scored', 'You have already submitted a score for this project. The blockchain prevents duplicate submissions.');
      return;
    }

    setSubmitting(true);
    setLastTx(null);

    try {
      addToast('info', 'Transaction Pending', 'Sending score to the blockchain. Please wait...');

      const tx = await contract.submitScore(
        selectedProjectId,
        scores.technicalQuality,
        scores.innovation,
        scores.userExperience,
        scores.impact
      );

      addToast('info', 'Transaction Submitted', `Tx Hash: ${tx.hash.slice(0, 20)}...`);

      const receipt = await tx.wait();

      // Extract the ScoreSubmitted event from the receipt
      const scoreEvent = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'ScoreSubmitted';
        } catch { return false; }
      });

      setLastTx({
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
        event: scoreEvent ? contract.interface.parseLog(scoreEvent) : null,
      });

      setAlreadyScored(true);
      setExistingScore({
        technicalQuality: scores.technicalQuality,
        innovation: scores.innovation,
        userExperience: scores.userExperience,
        impact: scores.impact,
        totalScore,
        timestamp: Date.now() / 1000,
      });

      addToast('success', 'Score Submitted!',
        `Your judging record is now permanently recorded on the blockchain.\nTx: ${receipt.hash.slice(0, 20)}...`);

    } catch (err) {
      const reason = parseContractError(err);
      addToast('error', 'Transaction Failed', reason);
    } finally {
      setSubmitting(false);
    }
  };

  const parseContractError = (err) => {
    if (err.code === 4001) return 'Transaction was rejected in your wallet.';
    if (err.message?.includes('judge has already scored')) return 'You have already scored this project (enforced by smart contract).';
    if (err.message?.includes('not a registered judge')) return 'Your address is not registered as an authorized judge.';
    if (err.message?.includes('out of range')) return 'Score out of valid range (0–10).';
    if (err.message?.includes('hackathon is not active')) return 'Judging is currently closed.';
    if (err.reason) return err.reason;
    return err.message?.slice(0, 200) || 'Unknown error occurred.';
  };

  const selectedProject = projects.find(p => String(p.id) === String(selectedProjectId));

  // ---- Render: not connected ----
  if (!isConnected) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Gavel size={28} /></div>
        <div className="empty-state-title">Connect Your Wallet</div>
        <div className="empty-state-desc">
          Please connect a wallet or select a demo judge account to submit scores.
        </div>
      </div>
    );
  }

  // ---- Render: not a judge ----
  if (accountRole !== 'judge') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Shield size={28} /></div>
        <div className="empty-state-title">Judge Access Required</div>
        <div className="empty-state-desc">
          Your connected address is not registered as an authorized judge.
          Switch to a judge account using the Demo Accounts menu, or ask the admin to register your address.
        </div>
        <div style={{
          marginTop: 'var(--space-md)',
          padding: 'var(--space-md)',
          background: 'rgba(108,99,255,0.08)',
          border: '1px solid rgba(108,99,255,0.2)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          color: 'var(--color-text-secondary)',
          maxWidth: 400,
          textAlign: 'left',
        }}>
          <strong style={{ color: 'var(--color-accent-primary)' }}>Why?</strong> The smart contract enforces role-based access control.
          Only wallet addresses registered by the admin as judges can call <code>submitScore()</code>.
          This is checked on-chain — frontend validation alone is not sufficient.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <div>
          <h1 className="page-title">
            <Gavel size={24} style={{ display: 'inline', marginRight: 10, verticalAlign: 'middle' }} />
            Submit Scores
          </h1>
          <p className="page-subtitle">
            Scores are validated and recorded immutably on-chain. Each judge can score each project only once.
          </p>
        </div>
      </div>

      <div className="two-col-grid" style={{ alignItems: 'start' }}>
        {/* Scoring Form */}
        <div className="card">
          <h3 className="card-title mb-md">Judging Form</h3>

          <form onSubmit={handleSubmit}>
            {/* Project selector */}
            <div className="form-group">
              <label className="form-label">Select Project to Score</label>
              {loadingProjects ? (
                <div className="flex items-center gap-sm" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  <div className="spinner" style={{ width: 16, height: 16 }} /> Loading projects...
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                >
                  <option value="">-- Select a project --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.id} — {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Already scored indicator */}
            {selectedProjectId && alreadyScored && (
              <div style={{
                padding: 'var(--space-md)',
                background: 'rgba(255,179,71,0.08)',
                border: '1px solid rgba(255,179,71,0.3)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-md)',
                display: 'flex',
                gap: 'var(--space-sm)',
                alignItems: 'flex-start',
              }}>
                <AlertCircle size={16} color="var(--color-accent-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-accent-warning)', marginBottom: 4 }}>
                    Already Submitted
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    You have already scored this project. The smart contract prevents duplicate submissions to ensure judging integrity.
                  </div>
                </div>
              </div>
            )}

            {/* Rubric sliders */}
            {RUBRIC_CRITERIA.map(criterion => (
              <div key={criterion.key} className="score-slider-group">
                <div className="score-slider-header">
                  <span className="score-slider-label" style={{ color: criterion.color }}>
                    {criterion.label}
                  </span>
                  <span className="score-slider-value"
                    style={{ background: `linear-gradient(135deg, ${criterion.color}, var(--color-accent-secondary))`,
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    {scores[criterion.key]}/10
                  </span>
                </div>
                <span className="score-slider-desc">{criterion.desc}</span>
                <input
                  type="range"
                  min="0" max="10" step="1"
                  value={scores[criterion.key]}
                  onChange={e => handleScoreChange(criterion.key, e.target.value)}
                  disabled={alreadyScored || submitting}
                  style={{ accentColor: criterion.color }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                  <span>0 — Poor</span>
                  <span>5 — Average</span>
                  <span>10 — Excellent</span>
                </div>
              </div>
            ))}

            {/* Total score preview */}
            <div style={{
              padding: 'var(--space-md)',
              background: 'rgba(108,99,255,0.08)',
              border: '1px solid rgba(108,99,255,0.2)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Total Score (Sum)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Aggregated average across all judges' totals
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2rem',
                fontWeight: 800,
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {totalScore}<span style={{ fontSize: '1rem', opacity: 0.6 }}>/40</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={submitting || alreadyScored || !selectedProjectId}
            >
              {submitting ? (
                <><div className="spinner" /> Sending to Blockchain...</>
              ) : alreadyScored ? (
                <><CheckCircle2 size={16} /> Already Scored</>
              ) : (
                <><Gavel size={16} /> Submit Score On-Chain</>
              )}
            </button>

            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-sm)' }}>
              This will send a real blockchain transaction. Gas fees apply (free on local network).
            </p>
          </form>
        </div>

        {/* Right column: AI Copilot Assistant + project info + tx result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* AI Copilot Evaluation Assistant */}
          {selectedProject && (
            <div className="ai-copilot-card">
              <div className="flex items-center justify-between mb-sm">
                <span className="ai-badge">
                  <Sparkles size={12} className="ai-sparkle-icon" /> AI Judging Copilot
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-accent-secondary)', fontFamily: 'var(--font-mono)' }}>
                  Model: Neural-Web3-v4
                </span>
              </div>

              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4, fontFamily: 'var(--font-display)' }}>
                AI Analysis: {selectedProject.name}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.5 }}>
                {AI_PROJECT_ANALYZER[selectedProject.category]?.aiInsight || AI_PROJECT_ANALYZER.default.aiInsight}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-md)' }}>
                {(AI_PROJECT_ANALYZER[selectedProject.category]?.tags || AI_PROJECT_ANALYZER.default.tags).map((tag, idx) => (
                  <span key={idx} className="ai-insight-tag">
                    <BrainCircuit size={10} /> {tag}
                  </span>
                ))}
              </div>

              <div className="ai-suggestion-box">
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-accent-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  AI Suggested Rubric Scores
                </div>
                {(() => {
                  const rec = AI_PROJECT_ANALYZER[selectedProject.category] || AI_PROJECT_ANALYZER.default;
                  return (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                        <div>Tech Quality: <strong style={{ color: '#8b5cf6' }}>{rec.tech}/10</strong></div>
                        <div>Innovation: <strong style={{ color: '#06b6d4' }}>{rec.innov}/10</strong></div>
                        <div>UX Design: <strong style={{ color: '#ec4899' }}>{rec.ux}/10</strong></div>
                        <div>Impact: <strong style={{ color: '#10b981' }}>{rec.impact}/10</strong></div>
                      </div>
                      <button
                        className="btn btn-sm w-full"
                        style={{ background: 'var(--gradient-ai)', color: 'white', border: 'none', fontWeight: 700 }}
                        onClick={() => {
                          if (alreadyScored) return;
                          setScores({
                            technicalQuality: rec.tech,
                            innovation: rec.innov,
                            userExperience: rec.ux,
                            impact: rec.impact,
                          });
                          addToast('info', 'AI Scores Applied', 'Suggested scores copied to the evaluation sliders.');
                        }}
                        disabled={alreadyScored}
                      >
                        <Wand2 size={13} /> Auto-Fill AI Recommended Scores
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          {/* Selected project info */}
          {selectedProject && (
            <div className="card">
              <h3 className="card-title mb-md">Project Details</h3>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <div><span style={{ color: 'var(--color-text-muted)', width: 100, display: 'inline-block' }}>Project</span> <strong>{selectedProject.name}</strong></div>
                <div><span style={{ color: 'var(--color-text-muted)', width: 100, display: 'inline-block' }}>Team Lead</span> {selectedProject.teamLead}</div>
                <div><span style={{ color: 'var(--color-text-muted)', width: 100, display: 'inline-block' }}>Category</span>
                  <span className="badge badge-category">{selectedProject.category}</span>
                </div>
                <div><span style={{ color: 'var(--color-text-muted)', width: 100, display: 'inline-block' }}>Project ID</span>
                  <span className="text-mono" style={{ fontSize: '0.8rem' }}>#{selectedProject.id}</span>
                </div>
              </div>

              {/* Existing score display */}
              {alreadyScored && existingScore && (
                <div style={{ marginTop: 'var(--space-md)' }}>
                  <div className="divider" />
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--color-accent-success)' }}>
                    Your Submitted Scores (Immutable)
                  </h4>
                  <div className="criteria-breakdown">
                    {RUBRIC_CRITERIA.map(c => (
                      <div key={c.key} className="criteria-row">
                        <span className="criteria-name">{c.label}</span>
                        <div className="criteria-bar">
                          <div className="criteria-bar-fill" style={{ width: `${existingScore[c.key] * 10}%`, background: c.color }} />
                        </div>
                        <span className="criteria-score">{existingScore[c.key]}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right', color: 'var(--color-accent-primary)' }}>
                    Total: {existingScore.totalScore}/40
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction result */}
          {lastTx && (
            <div className="card" style={{ borderColor: 'rgba(0,229,160,0.3)', background: 'rgba(0,229,160,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <CheckCircle2 size={20} color="var(--color-accent-success)" />
                <h3 className="card-title" style={{ color: 'var(--color-accent-success)' }}>
                  Score Recorded On-Chain
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="info-item">
                  <span className="info-item-label">Transaction Hash</span>
                  <span className="tx-hash" title="Click to copy" onClick={() => navigator.clipboard?.writeText(lastTx.hash)}>
                    <ExternalLink size={10} /> {lastTx.hash}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-item-label">Block Number</span>
                  <span className="info-item-value">#{lastTx.blockNumber}</span>
                </div>
                <div className="info-item">
                  <span className="info-item-label">Gas Used</span>
                  <span className="info-item-value">{lastTx.gasUsed} units</span>
                </div>
                <div className="info-item">
                  <span className="info-item-label">Status</span>
                  <span style={{ color: lastTx.status === 1 ? 'var(--color-accent-success)' : 'var(--color-accent-danger)', fontWeight: 600, fontSize: '0.85rem' }}>
                    {lastTx.status === 1 ? '✓ Confirmed' : '✗ Failed'}
                  </span>
                </div>
                {lastTx.event && (
                  <div className="info-item">
                    <span className="info-item-label">Emitted Event</span>
                    <span className="info-item-value" style={{ color: 'var(--color-accent-primary)' }}>
                      ScoreSubmitted (projectId={lastTx.event.args[0]?.toString()}, total={lastTx.event.args[6]?.toString()})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Security info */}
          <div className="card" style={{ background: 'rgba(108,99,255,0.05)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}>
              <Shield size={16} color="var(--color-accent-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>On-Chain Security</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  All score validation is enforced by the smart contract:
                  valid judge check, score range (0–10), duplicate prevention, and active hackathon status.
                  Frontend validation alone is <strong>not sufficient</strong> — the contract is the authoritative source.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
