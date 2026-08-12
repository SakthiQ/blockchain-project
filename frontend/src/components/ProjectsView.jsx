/**
 * ProjectsView — Browse all registered hackathon projects
 */
import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { FolderKanban, Users, Loader2, RefreshCw, Gavel } from 'lucide-react';

export default function ProjectsView({ setActiveTab }) {
  const { contract, isConnected, getReadOnlyContract } = useWeb3();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const CATEGORY_COLORS = {
    DeFi: '#6c63ff',
    HealthTech: '#00e5a0',
    EdTech: '#00d4ff',
    Sustainability: '#ffb347',
    AI: '#ff6b8a',
    default: '#8892b0',
  };

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

  const getCategoryColor = (cat) => CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <p>Loading projects from blockchain...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <div>
          <h1 className="page-title">
            <FolderKanban size={26} style={{ display: 'inline', marginRight: 10, verticalAlign: 'middle' }} />
            Hackathon Projects
          </h1>
          <p className="page-subtitle">
            All {projects.length} registered teams — data sourced directly from the blockchain.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadProjects}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{
          padding: 'var(--space-md)',
          background: 'rgba(255,77,106,0.1)',
          border: '1px solid rgba(255,77,106,0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-accent-danger)',
          marginBottom: 'var(--space-lg)',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {projects.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FolderKanban size={28} /></div>
          <div className="empty-state-title">No Projects Registered</div>
          <div className="empty-state-desc">
            No projects have been registered yet. Admin can register projects from the Admin panel, or run the seed script.
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => {
            const catColor = getCategoryColor(project.category);
            return (
              <div key={project.id} className="card">
                <div className="card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-bg-glass)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}>
                        #{project.id}
                      </span>
                      <span className="badge badge-category" style={{
                        background: catColor + '18',
                        color: catColor,
                        border: `1px solid ${catColor}30`
                      }}>
                        {project.category}
                      </span>
                    </div>
                    <h3 className="card-title">{project.name}</h3>
                  </div>
                </div>

                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: 'var(--space-md)'
                }}>
                  {project.description}
                </p>

                <div className="divider" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <Users size={14} color="var(--color-text-muted)" />
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                      {project.teamLead}
                    </span>
                  </div>
                  <div className="flex items-center gap-sm">
                    <Gavel size={13} color="var(--color-text-muted)" />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {project.judgesWhoScored} scored
                    </span>
                  </div>
                </div>

                <button
                  className="btn btn-secondary btn-sm w-full"
                  style={{ marginTop: 'var(--space-md)' }}
                  onClick={() => setActiveTab('judging')}
                >
                  <Gavel size={13} /> Score This Project
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
