/**
 * AdminView — Admin-only panel for managing the hackathon, projects, and judges
 */
import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import {
  Settings, Plus, FolderKanban, Users, CheckCircle2, XCircle,
  ShieldCheck, ShieldOff, RefreshCw, AlertTriangle, Zap
} from 'lucide-react';

export default function AdminView() {
  const { contract, account, accountRole, isConnected, addToast, loadHackathonInfo, hackathonInfo } = useWeb3();

  // Hackathon config form
  const [hackForm, setHackForm] = useState({ name: '', description: '', active: true });
  const [savingHack, setSavingHack] = useState(false);

  // Project form
  const [projForm, setProjForm] = useState({ name: '', description: '', teamLead: '', category: 'DeFi' });
  const [addingProject, setAddingProject] = useState(false);

  // Judge form
  const [judgeForm, setJudgeForm] = useState({ address: '', name: '' });
  const [addingJudge, setAddingJudge] = useState(false);

  // Lists
  const [projects, setProjects] = useState([]);
  const [judges, setJudges] = useState([]);
  const [loading, setLoading] = useState(false);

  const CATEGORIES = ['DeFi', 'HealthTech', 'EdTech', 'Sustainability', 'AI', 'Web3 Tools', 'Other'];

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
      // Load projects
      const count = await contract.projectCount();
      const projList = [];
      for (let i = 1; i <= Number(count); i++) {
        const p = await contract.projects(i);
        projList.push({ id: Number(p.id), name: p.name, teamLead: p.teamLead, category: p.category });
      }
      setProjects(projList);

      // Load judges
      const addrs = await contract.getAllJudgeAddresses();
      const judgeList = [];
      for (const addr of addrs) {
        const j = await contract.judges(addr);
        judgeList.push({ address: addr, name: j.name, isAuthorized: j.isAuthorized });
      }
      setJudges(judgeList);
    } catch (err) {
      addToast('error', 'Load Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHackathon = async (e) => {
    e.preventDefault();
    if (!hackForm.name.trim() || !hackForm.description.trim()) {
      addToast('warning', 'Validation', 'Name and description are required.');
      return;
    }
    setSavingHack(true);
    try {
      const tx = await contract.configureHackathon(hackForm.name.trim(), hackForm.description.trim(), hackForm.active);
      addToast('info', 'Transaction Sent', 'Configuring hackathon on-chain...');
      await tx.wait();
      addToast('success', 'Hackathon Updated', `"${hackForm.name}" configured on-chain. Tx: ${tx.hash.slice(0, 16)}...`);
      await loadHackathonInfo();
    } catch (err) {
      addToast('error', 'Transaction Failed', parseError(err));
    } finally {
      setSavingHack(false);
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!projForm.name.trim() || !projForm.teamLead.trim()) {
      addToast('warning', 'Validation', 'Project name and team lead are required.');
      return;
    }
    setAddingProject(true);
    try {
      const tx = await contract.registerProject(projForm.name.trim(), projForm.description.trim(), projForm.teamLead.trim(), projForm.category);
      addToast('info', 'Transaction Sent', 'Registering project on-chain...');
      await tx.wait();
      addToast('success', 'Project Registered', `"${projForm.name}" added on-chain. Tx: ${tx.hash.slice(0, 16)}...`);
      setProjForm({ name: '', description: '', teamLead: '', category: 'DeFi' });
      await loadLists();
      await loadHackathonInfo();
    } catch (err) {
      addToast('error', 'Transaction Failed', parseError(err));
    } finally {
      setAddingProject(false);
    }
  };

  const handleAddJudge = async (e) => {
    e.preventDefault();
    if (!judgeForm.address.trim() || !judgeForm.name.trim()) {
      addToast('warning', 'Validation', 'Judge address and name are required.');
      return;
    }
    setAddingJudge(true);
    try {
      const tx = await contract.registerJudge(judgeForm.address.trim(), judgeForm.name.trim());
      addToast('info', 'Transaction Sent', 'Registering judge on-chain...');
      await tx.wait();
      addToast('success', 'Judge Registered', `${judgeForm.name} authorized. Tx: ${tx.hash.slice(0, 16)}...`);
      setJudgeForm({ address: '', name: '' });
      await loadLists();
      await loadHackathonInfo();
    } catch (err) {
      addToast('error', 'Transaction Failed', parseError(err));
    } finally {
      setAddingJudge(false);
    }
  };

  const handleToggleJudge = async (address, currentlyAuthorized, name) => {
    try {
      const tx = currentlyAuthorized
        ? await contract.revokeJudge(address)
        : await contract.reauthorizeJudge(address);
      addToast('info', 'Transaction Sent', `${currentlyAuthorized ? 'Revoking' : 'Re-authorizing'} judge...`);
      await tx.wait();
      addToast('success', currentlyAuthorized ? 'Judge Revoked' : 'Judge Re-authorized',
        `${name} — ${currentlyAuthorized ? 'no longer can submit scores' : 'can submit scores again'}.`);
      await loadLists();
    } catch (err) {
      addToast('error', 'Transaction Failed', parseError(err));
    }
  };

  const parseError = (err) => {
    if (err.code === 4001) return 'Transaction rejected in wallet.';
    if (err.message?.includes('caller is not the admin')) return 'Only the admin can perform this action.';
    if (err.message?.includes('already registered')) return 'This judge address is already registered.';
    return err.reason || err.message?.slice(0, 200) || 'Unknown error.';
  };

  if (!isConnected || accountRole !== 'admin') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Settings size={28} /></div>
        <div className="empty-state-title">Admin Access Only</div>
        <div className="empty-state-desc">
          Switch to the Admin Account (Account #0) using the Demo Accounts menu to access the admin panel.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <div>
          <h1 className="page-title">
            <Settings size={24} style={{ display: 'inline', marginRight: 10, verticalAlign: 'middle' }} />
            Admin Panel
          </h1>
          <p className="page-subtitle">
            All admin actions are on-chain transactions signed by the admin wallet.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadLists} disabled={loading}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Hackathon Config */}
      <div className="card mb-lg">
        <h2 className="section-title"><Zap size={16} color="var(--color-accent-primary)" /> Configure Hackathon</h2>
        <form onSubmit={handleSaveHackathon}>
          <div className="two-col-grid">
            <div className="form-group">
              <label className="form-label">Hackathon Name *</label>
              <input
                className="form-input"
                value={hackForm.name}
                onChange={e => setHackForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Web3 Innovation Hackathon 2026"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={hackForm.active ? 'active' : 'inactive'}
                onChange={e => setHackForm(p => ({ ...p, active: e.target.value === 'active' }))}
              >
                <option value="active">Active (Judging Open)</option>
                <option value="inactive">Inactive (Judging Closed)</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea
              className="form-textarea"
              value={hackForm.description}
              onChange={e => setHackForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Brief description of the hackathon..."
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingHack}>
            {savingHack ? <><div className="spinner" /> Saving...</> : <><CheckCircle2 size={15} /> Save Configuration</>}
          </button>
        </form>
      </div>

      {/* Register Project */}
      <div className="card mb-lg">
        <h2 className="section-title"><FolderKanban size={16} color="var(--color-accent-secondary)" /> Register Project</h2>
        <form onSubmit={handleAddProject}>
          <div className="two-col-grid">
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input className="form-input" value={projForm.name}
                onChange={e => setProjForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. ChainVault" required />
            </div>
            <div className="form-group">
              <label className="form-label">Team Lead Name *</label>
              <input className="form-input" value={projForm.teamLead}
                onChange={e => setProjForm(p => ({ ...p, teamLead: e.target.value }))}
                placeholder="e.g. Alice Johnson" required />
            </div>
          </div>
          <div className="two-col-grid">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={projForm.category}
                onChange={e => setProjForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={projForm.description}
                onChange={e => setProjForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Short project description..." />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={addingProject}>
            {addingProject ? <><div className="spinner" /> Registering...</> : <><Plus size={15} /> Register Project</>}
          </button>
        </form>

        {/* Current projects list */}
        {projects.length > 0 && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <div className="divider" />
            <h4 style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-sm)' }}>
              Registered Projects ({projects.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {projects.map(p => (
                <div key={p.id} style={{
                  padding: '8px 12px',
                  background: 'var(--color-bg-glass)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>#{p.id}</span>
                  <strong>{p.name}</strong>
                  <span style={{ color: 'var(--color-text-muted)' }}>·</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{p.teamLead}</span>
                  <span className="badge badge-category" style={{ marginLeft: 'auto' }}>{p.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Register Judge */}
      <div className="card">
        <h2 className="section-title"><Users size={16} color="var(--color-accent-tertiary)" /> Manage Judges</h2>
        <form onSubmit={handleAddJudge}>
          <div className="two-col-grid">
            <div className="form-group">
              <label className="form-label">Judge Wallet Address *</label>
              <input className="form-input" value={judgeForm.address}
                onChange={e => setJudgeForm(p => ({ ...p, address: e.target.value }))}
                placeholder="0x..." required
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Judge Display Name *</label>
              <input className="form-input" value={judgeForm.name}
                onChange={e => setJudgeForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Dr. Emily Chen" required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={addingJudge}>
            {addingJudge ? <><div className="spinner" /> Registering...</> : <><ShieldCheck size={15} /> Register & Authorize Judge</>}
          </button>
        </form>

        {/* Current judges list */}
        {judges.length > 0 && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <div className="divider" />
            <h4 style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-sm)' }}>
              Registered Judges ({judges.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {judges.map(j => (
                <div key={j.address} style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  background: 'var(--color-bg-glass)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                  border: `1px solid ${j.isAuthorized ? 'rgba(0,229,160,0.15)' : 'rgba(255,77,106,0.15)'}`
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{j.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{j.address}</div>
                  </div>
                  <span className={`badge ${j.isAuthorized ? 'badge-active' : 'badge-inactive'}`}>
                    {j.isAuthorized ? 'Authorized' : 'Revoked'}
                  </span>
                  <button
                    className={`btn btn-sm ${j.isAuthorized ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => handleToggleJudge(j.address, j.isAuthorized, j.name)}
                  >
                    {j.isAuthorized
                      ? <><ShieldOff size={13} /> Revoke</>
                      : <><ShieldCheck size={13} /> Re-authorize</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
