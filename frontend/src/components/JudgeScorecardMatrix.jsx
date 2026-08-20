import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useBlockchainContext';
import { Award, CheckCircle2, AlertCircle, RefreshCw, BarChart2, ShieldCheck } from 'lucide-react';

export default function ScorecardView() {
  const { contract, account, accountRole, getReadOnlyContract } = useWeb3();
  const [projects, setProjects] = useState([]);
  const [judges, setJudges] = useState([]);
  const [scoresMatrix, setScoresMatrix] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadScorecardData();
  }, [contract, account]);

  const loadScorecardData = async () => {
    const c = contract || getReadOnlyContract();
    if (!c) return;
    setLoading(true);
    try {
      const count = await c.projectCount();
      const projList = [];
      for (let i = 1; i <= Number(count); i++) {
        const p = await c.projects(i);
        projList.push({ id: Number(p.id), name: p.name, category: p.category });
      }
      setProjects(projList);

      const judgeAddrs = await c.getAllJudgeAddresses();
      const judgeList = [];
      for (const addr of judgeAddrs) {
        const j = await c.judges(addr);
        judgeList.push({ address: addr, name: j.name, isAuthorized: j.isAuthorized });
      }
      setJudges(judgeList);

      const matrix = {};
      for (const j of judgeList) {
        matrix[j.address] = {};
        for (const p of projList) {
          const hasScored = await c.judgeHasScored(j.address, p.id);
          if (hasScored) {
            const sub = await c.getScore(j.address, p.id);
            matrix[j.address][p.id] = Number(sub.totalScore);
          } else {
            matrix[j.address][p.id] = null;
          }
        }
      }
      setScoresMatrix(matrix);
    } catch (err) {
      console.error('Failed to load scorecard:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentJudgeAddr = account ? account.toLowerCase() : '';
  const myScores = scoresMatrix[account] || {};
  const scoredCount = Object.values(myScores).filter(v => v !== null).length;
  const totalProjects = projects.length;
  const progressPct = totalProjects > 0 ? Math.round((scoredCount / totalProjects) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-lg flex-wrap gap-md">
        <div>
          <h1 className="page-title">
            <Award size={24} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: 'var(--color-primary)' }} />
            Judge Evaluation Scorecard Matrix
          </h1>
          <p className="page-subtitle">
            Progress tracker for authorized judges and cross-judge scorecard audit matrix.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadScorecardData} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {accountRole === 'judge' && (
        <div className="card mb-lg" style={{ borderLeft: '3px solid var(--color-primary)' }}>
          <div className="flex items-center justify-between mb-xs">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Your Evaluation Progress</h3>
            <span className="badge badge-active">
              {scoredCount} / {totalProjects} Projects Scored
            </span>
          </div>

          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden', margin: '8px 0' }}>
            <div style={{
              width: `${progressPct}%`,
              background: 'var(--color-primary)',
              height: '100%',
              transition: 'width 0.4s ease'
            }} />
          </div>

          <div className="flex justify-between items-center" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            <span>Completion: {progressPct}%</span>
            <span>{progressPct === 100 ? '🎉 All scorecards submitted!' : `${totalProjects - scoredCount} remaining`}</span>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title mb-md flex items-center gap-sm">
          <BarChart2 size={16} color="var(--color-primary)" /> Judge vs. Project Matrix
        </h3>

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" style={{ width: 24, height: 24 }} />
            <p>Compiling scorecards from blockchain...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Judge</th>
                  <th>Status</th>
                  {projects.map(p => (
                    <th key={p.id} style={{ textAlign: 'center' }}>
                      {p.name}
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>{p.category}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {judges.map(j => {
                  const jScores = scoresMatrix[j.address] || {};
                  const countScored = Object.values(jScores).filter(v => v !== null).length;
                  const isCurrentAccount = j.address.toLowerCase() === currentJudgeAddr;

                  return (
                    <tr key={j.address} style={{ background: isCurrentAccount ? 'var(--color-primary-subtle)' : 'transparent' }}>
                      <td>
                        <strong>{j.name}</strong>
                        {isCurrentAccount && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--color-primary)' }}>(You)</span>}
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {j.address.slice(0, 6)}...{j.address.slice(-4)}
                        </div>
                      </td>
                      <td>
                        {j.isAuthorized ? (
                          <span className="badge badge-active"><ShieldCheck size={10} /> Active</span>
                        ) : (
                          <span className="badge badge-inactive">Revoked</span>
                        )}
                      </td>
                      {projects.map(p => {
                        const scoreVal = jScores[p.id];
                        return (
                          <td key={p.id} style={{ textAlign: 'center' }}>
                            {scoreVal !== null && scoreVal !== undefined ? (
                              <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                                {(scoreVal / 10).toFixed(1)} / 100
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>
                        {countScored} / {projects.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
