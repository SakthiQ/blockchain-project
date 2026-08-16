import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import {
  Settings, FolderKanban, RefreshCw, AlertTriangle, Clock, Sliders,
  UserPlus, CheckCircle2, XCircle, MessageSquareWarning, ShieldCheck,
  ShieldOff, Gavel, FileCheck2, FileMinus2, UserCheck
} from 'lucide-react';

export default function AdminView() {
  const { contract, account, accountRole, isConnected, addToast, loadHackathonInfo, hackathonInfo } = useWeb3();

  const [projects, setProjects] = useState([]);
  const [judges, setJudges] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Forms
  const [hackForm, setHackForm] = useState({ name: '', description: '', active: true });
  const [projForm, setProjForm] = useState({ name: '', description: '', teamLead: '', category: 'DeFi', ipfsCID: '' });
  const [judgeForm, setJudgeForm] = useState({ address: '', name: '' });
  const [weights, setWeights] = useState([35, 30, 20, 15]);
  const [pendingAdminInput, setPendingAdminInput] = useState('');
  const [minJudgesInput, setMinJudgesInput] = useState(2);

  const [addingProject, setAddingProject] = useState(false);
  const [addingJudge, setAddingJudge] = useState(false);
  const [resolvingDispute, setResolvingDispute] = useState(null);
  const [decidingApp, setDecidingApp] = useState(null);

  const CATEGORIES = ['DeFi', 'HealthTech', 'EdTech', 'Sustainability', 'AI', 'Web3 Tools', 'Other'];
  const PHASES = ['Setup (Phase 0)', 'Judging / Commit (Phase 1)', 'Revealing / Verify (Phase 2)', 'Finalized / Locked (Phase 3)'];
  const DISPUTE_STATUS_LABELS = ['Pending', 'Resolved', 'Rejected'];
  const APP_STATUS_LABELS = ['Pending', 'Approved', 'Rejected'];

  useEffect(() => {
    if (hackathonInfo) {
      setHackForm({
        name: hackathonInfo.name || '',
        description: hackathonInfo.description || '',
        active: hackathonInfo.active,
      });
    }
  }, [hackathonInfo]);

  useEffect(() => {
    if (contract) loadLists();
  }, [contract]);

  const loadLists = async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const count = await contract.projectCount();
      const projList = [];
      for (let i = 1; i <= Number(count); i++) {
        const p = await contract.projects(i);
        projList.push({ id: Number(p.id), name: p.name, teamLead: p.teamLead, category: p.category, ipfsCID: p.ipfsCID });
      }
      setProjects(projList);

      const addrs = await contract.getAllJudgeAddresses();
      const judgeList = [];
      for (const addr of addrs) {
        const j = await contract.judges(addr);
        judgeList.push({ address: addr, name: j.name, isAuthorized: j.isAuthorized });
      }
      setJudges(judgeList);

      const minJ = await contract.minJudgesForRanking();
      setMinJudgesInput(Number(minJ));

      const dispCount = await contract.disputeCount();
      const dispList = [];
      for (let i = 1; i <= Number(dispCount); i++) {
        const d = await contract.disputes(i);
        dispList.push({
          id: Number(d.disputeId),
          projectId: Number(d.projectId),
          raisedBy: d.raisedBy,
          reason: d.reason,
          status: Number(d.status),
          timestamp: Number(d.timestamp),
        });
      }
      setDisputes(dispList);

      const appCount = await contract.applicationCount();
      const appList = [];
      for (let i = 1; i <= Number(appCount); i++) {
        const a = await contract.projectApplications(i);
        appList.push({
          id: Number(a.applicationId),
          name: a.name,
          description: a.description,
          teamLead: a.teamLead,
          category: a.category,
          ipfsCID: a.ipfsCID,
          applicantWallet: a.applicantWallet,
          status: Number(a.status),
          timestamp: Number(a.timestamp),
        });
      }
      setApplications(appList);
    } catch (err) {
      addToast('error', 'Load Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPhase = async (phaseNum) => {
    if (!contract) return;
    try {
      const tx = await contract.setPhase(phaseNum);
      addToast('info', 'Phase Change Sent', `Advancing phase to ${PHASES[phaseNum]}...`);
      await tx.wait();
      addToast('success', 'Phase Updated', `Hackathon is now in ${PHASES[phaseNum]}`);
      await loadHackathonInfo();
    } catch (err) {
      addToast('error', 'Transaction Failed', err.reason || err.message);
    }
  };

  const handleSaveWeights = async () => {
    if (!contract) return;
    const sum = weights.reduce((a, b) => a + Number(b), 0);
    if (sum !== 100) {
      addToast('warning', 'Invalid Weights', `Weights must sum to 100 (current sum: ${sum})`);
      return;
    }
    try {
      const tx = await contract.setCriteriaWeights(weights);
      addToast('info', 'Transaction Sent', 'Updating rubric weights on-chain...');
      await tx.wait();
      addToast('success', 'Rubric Updated', 'Weighted criteria successfully recorded on-chain!');
    } catch (err) {
      addToast('error', 'Transaction Failed', err.reason || err.message);
    }
  };

  const handleSetMinJudges = async () => {
    if (!contract) return;
    try {
      const tx = await contract.setMinJudgesForRanking(minJudgesInput);
      addToast('info', 'Transaction Sent', 'Updating quorum threshold on-chain...');
      await tx.wait();
      addToast('success', 'Quorum Updated', `Min judges for ranking set to ${minJudgesInput}`);
    } catch (err) {
      addToast('error', 'Transaction Failed', err.reason || err.message);
    }
  };

  const handleProposeAdmin = async () => {
    if (!contract || !pendingAdminInput) return;
    try {
      const tx = await contract.proposeNewAdmin(pendingAdminInput);
      addToast('info', 'Proposal Sent', 'Initiating 2-Step Admin Transfer...');
      await tx.wait();
      addToast('success', 'Admin Proposed', `Pending admin set to ${pendingAdminInput.slice(0, 6)}...`);
    } catch (err) {
      addToast('error', 'Proposal Failed', err.reason || err.message);
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!projForm.name.trim() || !projForm.teamLead.trim()) return;
    setAddingProject(true);
    try {
      const tx = await contract.registerProjectWithDetails(
        projForm.name.trim(),
        projForm.description.trim(),
        projForm.teamLead.trim(),
        projForm.category,
        projForm.ipfsCID.trim(),
        account
      );
      await tx.wait();
      addToast('success', 'Project Registered', `"${projForm.name}" registered on-chain!`);
      setProjForm({ name: '', description: '', teamLead: '', category: 'DeFi', ipfsCID: '' });
      await loadLists();
    } catch (err) {
      addToast('error', 'Registration Failed', err.reason || err.message);
    } finally {
      setAddingProject(false);
    }
  };

  const handleAddJudge = async (e) => {
    e.preventDefault();
    if (!judgeForm.address.trim() || !judgeForm.name.trim()) return;
    setAddingJudge(true);
    try {
      const tx = await contract.registerJudge(judgeForm.address.trim(), judgeForm.name.trim());
      await tx.wait();
      addToast('success', 'Judge Registered', `${judgeForm.name} authorized.`);
      setJudgeForm({ address: '', name: '' });
      await loadLists();
    } catch (err) {
      addToast('error', 'Registration Failed', err.reason || err.message);
    } finally {
      setAddingJudge(false);
    }
  };

  const handleResolveDispute = async (disputeId, approve) => {
    if (!contract) return;
    setResolvingDispute(disputeId);
    try {
      const tx = await contract.resolveDispute(disputeId, approve);
      addToast('info', 'Resolving Dispute', `${approve ? 'Accepting' : 'Rejecting'} dispute #${disputeId}...`);
      await tx.wait();
      addToast('success', 'Dispute Resolved', `Dispute #${disputeId} marked as ${approve ? 'Resolved' : 'Rejected'}.`);
      await loadLists();
    } catch (err) {
      addToast('error', 'Dispute Resolution Failed', err.reason || err.message);
    } finally {
      setResolvingDispute(null);
    }
  };

  const handleDecideApplication = async (appId, approve) => {
    if (!contract) return;
    setDecidingApp(appId);
    try {
      const tx = approve
        ? await contract.approveProjectApplication(appId)
        : await contract.rejectProjectApplication(appId);
      addToast('info', approve ? 'Approving Application' : 'Rejecting Application', `Processing application #${appId}...`);
      await tx.wait();
      addToast('success', approve ? 'Application Approved!' : 'Application Rejected',
        approve ? 'Project registered on-chain.' : `Application #${appId} rejected.`);
      await loadLists();
    } catch (err) {
      addToast('error', 'Decision Failed', err.reason || err.message);
    } finally {
      setDecidingApp(null);
    }
  };

  const fmtAddr = addr => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const fmtTime = ts => ts > 0 ? new Date(ts * 1000).toLocaleString() : '—';

  const pendingDisputes = disputes.filter(d => d.status === 0);
  const pendingApps = applications.filter(a => a.status === 0);

  if (accountRole !== 'admin') {
    return (
      <div className="card text-center py-xl">
        <AlertTriangle size={36} color="var(--color-danger)" style={{ margin: '0 auto 12px' }} />
        <h3>Administrator Access Required</h3>
        <p style={{ color: 'var(--color-text-secondary)' }}>Select Admin Account from <strong>"Demo Accounts"</strong> in the top header bar to access governance controls.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg flex-wrap gap-md">
        <div>
          <h1 className="page-title">
            <Settings size={24} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: 'var(--color-danger)' }} />
            Hackathon Governance &amp; Administration
          </h1>
          <p className="page-subtitle">
            Manage phase state machine, dispute appeals, team self-registrations, rubric weights, and admin role transfers.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadLists} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Phase Lifecycle Stepper */}
      <div className="card mb-lg">
        <h3 className="card-title mb-xs flex items-center gap-sm">
          <Clock size={16} color="var(--color-primary)" /> Phase Lifecycle Control Stepper
        </h3>
        {pendingDisputes.length > 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-danger)', marginBottom: 10 }}>
            ⚠ Finalized phase is locked — {pendingDisputes.length} pending dispute(s) must be resolved first.
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {PHASES.map((name, idx) => (
            <button
              key={idx}
              className={`btn ${hackathonInfo?.phase === idx ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleSetPhase(idx)}
              disabled={idx === 3 && pendingDisputes.length > 0}
              style={{ fontSize: '0.8rem', padding: '8px 12px' }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }} className="mb-lg">
        {/* Rubric Weights */}
        <div className="card">
          <h3 className="card-title mb-xs flex items-center gap-sm">
            <Sliders size={16} color="var(--color-primary)" /> Rubric Weights (%)
          </h3>
          {['Technical Quality', 'Innovation', 'User Experience', 'Impact'].map((lbl, idx) => (
            <div key={idx} className="flex items-center justify-between mb-xs" style={{ fontSize: '0.82rem' }}>
              <span>{lbl}</span>
              <input
                type="number"
                value={weights[idx]}
                onChange={e => {
                  const copy = [...weights];
                  copy[idx] = Number(e.target.value);
                  setWeights(copy);
                }}
                className="form-input"
                style={{ width: 64, textAlign: 'center', padding: '2px 6px' }}
              />
            </div>
          ))}
          <div style={{ fontSize: '0.75rem', color: weights.reduce((a,b)=>a+Number(b),0) === 100 ? 'var(--color-success)' : 'var(--color-danger)', marginBottom: 8 }}>
            Total Sum: {weights.reduce((a,b)=>a+Number(b),0)} / 100
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleSaveWeights}>Save Rubric</button>
        </div>

        {/* Quorum Setting */}
        <div className="card">
          <h3 className="card-title mb-xs flex items-center gap-sm">
            <Gavel size={16} color="var(--color-info)" /> Min-Quorum Threshold
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            Projects scored by fewer than this threshold remain in the "Provisional" leaderboard section.
          </p>
          <div className="flex items-center gap-sm mb-sm">
            <input
              type="number"
              min="1"
              max="20"
              value={minJudgesInput}
              onChange={e => setMinJudgesInput(Number(e.target.value))}
              className="form-input"
              style={{ width: 70, textAlign: 'center' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>judges required</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleSetMinJudges}>Set Quorum</button>
        </div>

        {/* 2-Step Admin Transfer */}
        <div className="card">
          <h3 className="card-title mb-xs flex items-center gap-sm">
            <UserPlus size={16} color="var(--color-warning)" /> 2-Step Admin Transfer
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            Propose a new admin wallet. The recipient must call <code>acceptAdmin()</code> to complete transfer.
          </p>
          <input
            type="text"
            placeholder="0x... proposed admin address"
            className="form-input mb-sm text-xs text-mono"
            value={pendingAdminInput}
            onChange={e => setPendingAdminInput(e.target.value)}
          />
          <button className="btn btn-secondary btn-sm" onClick={handleProposeAdmin}>Propose Admin</button>
        </div>
      </div>

      {/* Dispute Appeals Resolution Center */}
      <div className="card mb-lg">
        <div className="card-header mb-md">
          <h3 className="card-title flex items-center gap-sm">
            <MessageSquareWarning size={16} color="var(--color-danger)" /> Scoring Appeals &amp; Dispute Resolution
            {pendingDisputes.length > 0 && (
              <span className="badge badge-inactive" style={{ marginLeft: 6 }}>
                {pendingDisputes.length} Pending
              </span>
            )}
          </h3>
        </div>

        {disputes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-md) 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            <CheckCircle2 size={20} color="var(--color-success)" style={{ margin: '0 auto 6px', display: 'block' }} />
            No scoring disputes filed.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Project</th>
                  <th>Raised By</th>
                  <th>Reason</th>
                  <th>Filed At</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>#{d.id}</td>
                    <td>Project #{d.projectId}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{fmtAddr(d.raisedBy)}</td>
                    <td style={{ maxWidth: 220, fontSize: '0.8rem' }}>{d.reason}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{fmtTime(d.timestamp)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${d.status === 0 ? 'badge-pending' : d.status === 1 ? 'badge-active' : 'badge-inactive'}`}>
                        {DISPUTE_STATUS_LABELS[d.status]}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {d.status === 0 ? (
                        <div className="flex items-center justify-center gap-xs">
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleResolveDispute(d.id, true)}
                            disabled={resolvingDispute === d.id}
                          >
                            <FileCheck2 size={11} /> Resolve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleResolveDispute(d.id, false)}
                            disabled={resolvingDispute === d.id}
                          >
                            <FileMinus2 size={11} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Team Applications Queue */}
      <div className="card mb-lg">
        <div className="card-header mb-md">
          <h3 className="card-title flex items-center gap-sm">
            <FolderKanban size={16} color="var(--color-warning)" /> Team Registration Applications
            {pendingApps.length > 0 && (
              <span className="badge badge-pending" style={{ marginLeft: 6 }}>
                {pendingApps.length} Pending
              </span>
            )}
          </h3>
        </div>

        {applications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-md) 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            No team self-registration applications submitted.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Project Name</th>
                  <th>Team Lead</th>
                  <th>Category</th>
                  <th>Applicant Wallet</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>#{a.id}</td>
                    <td>
                      <strong>{a.name}</strong>
                      {a.ipfsCID && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>CID: {a.ipfsCID.slice(0, 12)}...</div>
                      )}
                    </td>
                    <td>{a.teamLead}</td>
                    <td><span className="badge badge-category">{a.category}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{fmtAddr(a.applicantWallet)}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{fmtTime(a.timestamp)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${a.status === 0 ? 'badge-pending' : a.status === 1 ? 'badge-active' : 'badge-inactive'}`}>
                        {APP_STATUS_LABELS[a.status]}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {a.status === 0 ? (
                        <div className="flex items-center justify-center gap-xs">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleDecideApplication(a.id, true)}
                            disabled={decidingApp === a.id}
                          >
                            <CheckCircle2 size={11} /> Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDecideApplication(a.id, false)}
                            disabled={decidingApp === a.id}
                          >
                            <XCircle size={11} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Direct Project & Judge Registration Forms */}
      <div className="two-col-grid mb-lg">
        <div className="card">
          <h3 className="card-title mb-xs">Direct Project Registration</h3>
          <form onSubmit={handleAddProject}>
            <div className="form-group">
              <input type="text" placeholder="Project Title *" className="form-input"
                value={projForm.name} onChange={e => setProjForm({ ...projForm, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <input type="text" placeholder="Team Lead Name *" className="form-input"
                value={projForm.teamLead} onChange={e => setProjForm({ ...projForm, teamLead: e.target.value })} required />
            </div>
            <div className="form-group">
              <input type="text" placeholder="IPFS CID (bafybeig...)" className="form-input"
                value={projForm.ipfsCID} onChange={e => setProjForm({ ...projForm, ipfsCID: e.target.value })} />
            </div>
            <div className="form-group mb-md">
              <select className="form-select" value={projForm.category}
                onChange={e => setProjForm({ ...projForm, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={addingProject}>Register Project</button>
          </form>
        </div>

        <div className="card">
          <h3 className="card-title mb-xs">Authorize Judge Wallet</h3>
          <form onSubmit={handleAddJudge}>
            <div className="form-group">
              <input type="text" placeholder="Judge Display Name *" className="form-input"
                value={judgeForm.name} onChange={e => setJudgeForm({ ...judgeForm, name: e.target.value })} required />
            </div>
            <div className="form-group mb-md">
              <input type="text" placeholder="Wallet Address (0x...) *" className="form-input text-mono text-xs"
                value={judgeForm.address} onChange={e => setJudgeForm({ ...judgeForm, address: e.target.value })} required />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={addingJudge}>Authorize Judge</button>
          </form>
        </div>
      </div>
    </div>
  );
}
