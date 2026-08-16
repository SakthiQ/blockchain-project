/**
 * ProjectsView — Browse registered projects + team self-registration (#23) & appeals (#18)
 */
import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import {
  FolderKanban, Users, RefreshCw, Gavel, Send,
  ExternalLink, MessageSquareWarning, CheckCircle2, X, Search, Filter
} from 'lucide-react';

export default function ProjectsView({ setActiveTab }) {
  const { contract, account, isConnected, hackathonInfo, addToast, getReadOnlyContract } = useWeb3();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // #23 — Application modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({ name: '', description: '', teamLead: '', category: 'DeFi', ipfsCID: '' });
  const [submittingApp, setSubmittingApp] = useState(false);
  const [myApplicationId, setMyApplicationId] = useState(null);

  // #18 — Dispute modal
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeProjectId, setDisputeProjectId] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const CATEGORIES = ['All', 'DeFi', 'HealthTech', 'EdTech', 'Sustainability', 'AI', 'Web3 Tools', 'Other'];

  const currentPhase = hackathonInfo?.phase ?? 0; // 0=Setup

  const loadProjects = async () => {
    const c = contract || getReadOnlyContract();
    if (!c) { setError('No connection available.'); return; }
    setLoading(true);
    setError('');
    try {
      const count = await c.projectCount();
      const projectList = [];
      for (let i = 1; i <= Number(count); i++) {
        const p = await c.projects(i);
        const [judgesWhoScored] = await c.getProjectAggregateScore(i);
        projectList.push({
          id: Number(p.id),
          name: p.name,
          description: p.description,
          teamLead: p.teamLead,
          category: p.category,
          ipfsCID: p.ipfsCID,
          judgesWhoScored: Number(judgesWhoScored),
        });
      }
      setProjects(projectList);
    } catch (err) {
      setError(err.message?.includes('ECONNREFUSED')
        ? 'Cannot connect to blockchain. Make sure the Hardhat node is running.'
        : 'Failed to load projects: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, [contract]);

  // #23 — Submit project application
  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    if (!contract) {
      addToast('error', 'Not Connected', 'Connect a wallet to submit an application.');
      return;
    }
    if (!applyForm.name.trim() || !applyForm.teamLead.trim()) {
      addToast('warning', 'Missing Fields', 'Project name and team lead are required.');
      return;
    }
    setSubmittingApp(true);
    try {
      const tx = await contract.submitProjectApplication(
        applyForm.name.trim(),
        applyForm.description.trim(),
        applyForm.teamLead.trim(),
        applyForm.category,
        applyForm.ipfsCID.trim()
      );
      addToast('info', 'Submitting Application', 'Broadcasting project application on-chain...');
      const receipt = await tx.wait();
      const event = receipt.logs?.find(l => l.fragment?.name === 'ProjectApplicationSubmitted');
      const appId = event ? Number(event.args[0]) : '?';
      setMyApplicationId(appId);
      addToast('success', 'Application Submitted!', `Application #${appId} is pending admin review.`);
      setApplyForm({ name: '', description: '', teamLead: '', category: 'DeFi', ipfsCID: '' });
      setShowApplyModal(false);
    } catch (err) {
      addToast('error', 'Submission Failed', err.reason || err.message);
    } finally {
      setSubmittingApp(false);
    }
  };

  // #18 — Raise dispute
  const handleRaiseDispute = async (e) => {
    e.preventDefault();
    if (!contract) {
      addToast('error', 'Not Connected', 'Connect a wallet to raise a dispute.');
      return;
    }
    if (!disputeReason.trim()) {
      addToast('warning', 'Missing Reason', 'Please describe the grounds for the dispute.');
      return;
    }
    setSubmittingDispute(true);
    try {
      const tx = await contract.raiseDispute(disputeProjectId, disputeReason.trim());
      addToast('info', 'Filing Dispute', 'Broadcasting appeal on-chain...');
      const receipt = await tx.wait();
      const event = receipt.logs?.find(l => l.fragment?.name === 'DisputeRaised');
      const dispId = event ? Number(event.args[0]) : '?';
      addToast('success', 'Dispute Filed!', `Dispute #${dispId} is pending admin review. Finalization is blocked until resolved.`);
      setShowDisputeModal(false);
      setDisputeReason('');
      setDisputeProjectId(null);
    } catch (err) {
      addToast('error', 'Dispute Failed', err.reason || err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.teamLead.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const canApply = currentPhase === 0 && isConnected;
  const canDispute = (currentPhase === 1 || currentPhase === 2) && isConnected;

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 24, height: 24 }} />
        <p>Querying project registry on-chain...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg flex-wrap gap-md">
        <div>
          <h1 className="page-title">
            <FolderKanban size={24} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: 'var(--color-primary)' }} />
            Projects Showcase Directory
          </h1>
          <p className="page-subtitle">
            Explore registered hackathon entries. Submit applications during Setup phase or file scoring appeals during Judging.
          </p>
        </div>

        <div className="flex items-center gap-sm">
          {canApply && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowApplyModal(true)}>
              <Send size={13} /> Submit Application
            </button>
          )}
          {myApplicationId && (
            <span className="badge badge-active">
              <CheckCircle2 size={10} /> App #{myApplicationId} Submitted
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={loadProjects}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="card mb-lg" style={{ padding: 'var(--space-md)' }}>
        <div className="flex items-center justify-between gap-md flex-wrap">
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search by title, team lead, or keywords..."
              className="form-input"
              style={{ paddingLeft: 34 }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-xs flex-wrap">
            <Filter size={13} color="var(--color-text-muted)" style={{ marginRight: 4 }} />
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedCategory(cat)}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: 'var(--space-md)', background: 'var(--color-danger-subtle)',
          border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)',
          color: 'var(--color-danger)', marginBottom: 'var(--space-lg)', fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {filteredProjects.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FolderKanban size={24} /></div>
          <div className="empty-state-title">No Projects Found</div>
          <div className="empty-state-desc">
            {searchQuery || selectedCategory !== 'All'
              ? 'No projects match your search filters.'
              : 'No projects registered yet for this hackathon.'}
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map(project => (
            <div key={project.id} className="card">
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                      color: 'var(--color-text-muted)', background: 'var(--color-bg-subtle)',
                      padding: '2px 6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)'
                    }}>#{project.id}</span>
                    <span className="badge badge-category">
                      {project.category}
                    </span>
                  </div>
                  <h3 className="card-title">{project.name}</h3>
                </div>
              </div>

              <p style={{
                fontSize: '0.84rem', color: 'var(--color-text-secondary)',
                lineHeight: 1.5, marginBottom: 'var(--space-md)', minHeight: 40
              }}>
                {project.description}
              </p>

              {project.ipfsCID ? (
                <a
                  href={`https://ipfs.io/ipfs/${project.ipfsCID}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.75rem', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 'var(--space-sm)' }}
                >
                  <ExternalLink size={11} /> Proof CID: {project.ipfsCID.slice(0, 14)}...
                </a>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-sm)' }}>
                  On-Chain Submission
                </span>
              )}

              <div className="divider" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-xs" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  <Users size={13} color="var(--color-text-muted)" />
                  <span>Lead: <strong>{project.teamLead}</strong></span>
                </div>
                <div className="flex items-center gap-xs" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  <Gavel size={12} />
                  <span>{project.judgesWhoScored} scored</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-md)' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => setActiveTab('judging')}
                >
                  <Gavel size={12} /> Score Entry
                </button>
                {canDispute && (
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setDisputeProjectId(project.id);
                      setDisputeReason('');
                      setShowDisputeModal(true);
                    }}
                  >
                    <MessageSquareWarning size={12} /> File Dispute
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Application Modal (#23) */}
      {showApplyModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--color-bg-overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9000, backdropFilter: 'blur(6px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: 'var(--space-xl)', position: 'relative' }}>
            <button
              onClick={() => setShowApplyModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
            >
              <X size={18} />
            </button>

            <h2 className="card-title mb-xs flex items-center gap-sm">
              <Send size={18} color="var(--color-primary)" />
              Submit Project Application
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
              Applications are stored in an on-chain queue. The hackathon admin reviews and approves submissions to auto-register projects.
            </p>

            <form onSubmit={handleSubmitApplication}>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input type="text" className="form-input" placeholder="e.g. ChainVault"
                  value={applyForm.name} onChange={e => setApplyForm({ ...applyForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Team Lead Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Alice Johnson"
                  value={applyForm.teamLead} onChange={e => setApplyForm({ ...applyForm, teamLead: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Short Description</label>
                <input type="text" className="form-input" placeholder="Brief project summary"
                  value={applyForm.description} onChange={e => setApplyForm({ ...applyForm, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={applyForm.category}
                  onChange={e => setApplyForm({ ...applyForm, category: e.target.value })}>
                  {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group mb-lg">
                <label className="form-label">IPFS CID (Optional)</label>
                <input type="text" className="form-input" placeholder="bafybeig..."
                  value={applyForm.ipfsCID} onChange={e => setApplyForm({ ...applyForm, ipfsCID: e.target.value })} />
              </div>
              <div className="flex items-center gap-sm">
                <button type="submit" className="btn btn-primary" disabled={submittingApp} style={{ flex: 1 }}>
                  {submittingApp ? 'Submitting Application...' : 'Submit Application'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowApplyModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Dispute Modal (#18) */}
      {showDisputeModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--color-bg-overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9000, backdropFilter: 'blur(6px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 'var(--space-xl)', position: 'relative' }}>
            <button
              onClick={() => setShowDisputeModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
            >
              <X size={18} />
            </button>

            <h2 className="card-title mb-xs flex items-center gap-sm" style={{ color: 'var(--color-danger)' }}>
              <MessageSquareWarning size={18} />
              File Scoring Appeal / Dispute
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
              Filing a dispute against <strong>Project #{disputeProjectId}</strong>. Hackathon finalization is strictly blocked on-chain until the admin resolves this appeal.
            </p>

            <form onSubmit={handleRaiseDispute}>
              <div className="form-group mb-lg">
                <label className="form-label">Grounds for Appeal *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Describe your appeal reasons (e.g. undisclosed mentor conflict, late submission, or scoring anomaly)..."
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-sm">
                <button type="submit" className="btn btn-danger" disabled={submittingDispute} style={{ flex: 1 }}>
                  {submittingDispute ? 'Filing Appeal...' : 'File Official Appeal'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDisputeModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
