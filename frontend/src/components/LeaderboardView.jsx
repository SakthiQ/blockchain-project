import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useBlockchainContext';
import {
  Trophy, RefreshCw, BarChart3, ShieldCheck, Zap,
  Award, ExternalLink, AlertTriangle, CheckCircle2, Users, Medal
} from 'lucide-react';

export default function LeaderboardView() {
  const { contract, account, hackathonInfo, addToast, getReadOnlyContract } = useWeb3();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mintingRank, setMintingRank] = useState(null);
  const [minJudges, setMinJudges] = useState(2);

  const isFinalized = hackathonInfo && hackathonInfo.phase === 3;

  const loadLeaderboard = async () => {
    const c = contract || getReadOnlyContract();
    if (!c) { setError('No blockchain connection.'); return; }
    setLoading(true);
    setError('');
    try {
      const [entries, minJ] = await Promise.all([
        c.getLeaderboard(),
        c.minJudgesForRanking(),
      ]);
      setMinJudges(Number(minJ));
      const parsed = entries.map((e, idx) => ({
        rank: idx + 1,
        projectId: Number(e.projectId),
        projectName: e.projectName,
        teamLead: e.teamLead,
        category: e.category,
        ipfsCID: e.ipfsCID,
        averageScore: Number(e.averageScore),
        trimmedScore: Number(e.trimmedScore),
        judgeCount: Number(e.judgeCount),
        totalScore: Number(e.totalScore),
        quorumMet: e.quorumMet,
      }));
      setLeaderboard(parsed);
    } catch (err) {
      setError('Failed to load leaderboard: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLeaderboard(); }, [contract]);

  const handleMintNFT = async (projectId, rank) => {
    if (!contract) return;
    setMintingRank(rank);
    try {
      const tx = await contract.mintWinnerNFT(projectId, rank);
      addToast('info', 'Minting NFT', `Minting Soulbound Winner Certificate (Rank #${rank})...`);
      await tx.wait();
      addToast('success', 'NFT Certificate Minted!', `Rank #${rank} Soulbound Certificate issued on-chain!`);
    } catch (err) {
      addToast('error', 'NFT Mint Failed', err.reason || err.message);
    } finally {
      setMintingRank(null);
    }
  };

  const formatAvg = (valX100) => (valX100 / 100).toFixed(2);

  const ranked = leaderboard.filter(e => e.quorumMet);
  const provisional = leaderboard.filter(e => !e.quorumMet);

  const renderTiebreakerHint = (e, prev) => {
    if (!prev || e.trimmedScore !== prev.trimmedScore) return null;
    return (
      <span title="Tie-broken by judge count → projectId" style={{
        marginLeft: 6, fontSize: '0.65rem', color: 'var(--color-warning)',
        background: 'var(--color-warning-subtle)', padding: '1px 6px',
        borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-warning-border)',
        fontWeight: 600
      }}>
        TIE-BROKEN
      </span>
    );
  };

  const renderRankBadge = (rank) => {
    if (rank === 1) return <span style={{ color: '#f59e0b', fontWeight: 700 }}>🥇 #1</span>;
    if (rank === 2) return <span style={{ color: '#94a3b8', fontWeight: 700 }}>🥈 #2</span>;
    if (rank === 3) return <span style={{ color: '#d97706', fontWeight: 700 }}>🥉 #3</span>;
    return <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>#{rank}</span>;
  };

  const renderTable = (entries, provisional = false) => (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Project Title</th>
            <th>Category</th>
            <th>IPFS Proof</th>
            <th style={{ textAlign: 'center' }}>Raw Avg</th>
            <th style={{ textAlign: 'center' }}>Trimmed Score</th>
            <th style={{ textAlign: 'center' }}>Judges</th>
            {isFinalized && !provisional && <th style={{ textAlign: 'center' }}>Winner NFT</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, idx) => (
            <tr key={e.projectId}>
              <td style={{ fontSize: '0.9rem' }}>
                {provisional ? <span style={{ color: 'var(--color-warning)', fontSize: '0.8rem', fontWeight: 600 }}>P#{idx + 1}</span> : renderRankBadge(e.rank)}
                {renderTiebreakerHint(e, entries[idx - 1])}
              </td>
              <td>
                <strong>{e.projectName}</strong>
                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Lead: {e.teamLead}</div>
              </td>
              <td><span className="badge badge-category">{e.category}</span></td>
              <td>
                {e.ipfsCID ? (
                  <a
                    href={`https://ipfs.io/ipfs/${e.ipfsCID}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    {e.ipfsCID.slice(0, 10)}... <ExternalLink size={10} />
                  </a>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>On-Chain</span>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>{formatAvg(e.averageScore)}</td>
              <td style={{ textAlign: 'center', fontWeight: 700, color: provisional ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {formatAvg(e.trimmedScore)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className="flex items-center justify-center gap-xs">
                  <Users size={12} color="var(--color-text-muted)" />
                  {e.judgeCount}
                </span>
              </td>
              {isFinalized && !provisional && (
                <td style={{ textAlign: 'center' }}>
                  {e.rank <= 3 ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleMintNFT(e.projectId, e.rank)}
                      disabled={mintingRank === e.rank}
                    >
                      <Award size={12} /> Mint Rank #{e.rank} NFT
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-lg flex-wrap gap-md">
        <div>
          <h1 className="page-title">
            <Trophy size={24} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: 'var(--color-warning)' }} />
            Leaderboard &amp; Winner Certificates
          </h1>
          <p className="page-subtitle">
            Trimmed mean score aggregation (dropping min &amp; max outliers when ≥3 judges score). Quorum requirement: ≥<strong>{minJudges}</strong> judge scores.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadLeaderboard} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" style={{ width: 24, height: 24 }} />
          <p>Querying on-chain leaderboard entries...</p>
        </div>
      ) : (
        <>
          {/* Ranked Section */}
          <div className="card mb-lg">
            <div className="card-header mb-md">
              <h3 className="card-title flex items-center gap-sm">
                <CheckCircle2 size={16} color="var(--color-success)" />
                Ranked Entries
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 6 }}>
                  (Quorum Met — ≥{minJudges} Judge Scores)
                </span>
              </h3>
              {isFinalized && (
                <span className="badge badge-active">
                  🏆 Finalized — Winner Certificates Ready
                </span>
              )}
            </div>

            {ranked.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><BarChart3 size={24} /></div>
                <div className="empty-state-title">No Ranked Entries Yet</div>
                <div className="empty-state-desc">
                  At least {minJudges} judge score(s) required per project to qualify for official ranking.
                </div>
              </div>
            ) : (
              renderTable(ranked, false)
            )}
          </div>

          {/* Provisional Section */}
          {provisional.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--color-warning-border)' }}>
              <div className="card-header mb-sm">
                <h3 className="card-title flex items-center gap-sm" style={{ color: 'var(--color-warning)' }}>
                  <AlertTriangle size={16} />
                  Provisional Submissions
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 6 }}>
                    (Awaiting Quorum — &lt;{minJudges} Judge Scores)
                  </span>
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                These submissions have fewer than {minJudges} judge score(s). They remain in the provisional queue until additional judges complete evaluation.
              </p>
              {renderTable(provisional, true)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
