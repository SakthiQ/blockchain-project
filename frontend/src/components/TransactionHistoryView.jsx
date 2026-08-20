/**
 * TxHistoryView — On-Chain Event Explorer & Audit Log (HackerRank Style)
 */
import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useBlockchainContext';
import { History, RefreshCw, Activity, ExternalLink } from 'lucide-react';

export default function TxHistoryView() {
  const { contract, getReadOnlyContract } = useWeb3();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockRange, setBlockRange] = useState('');

  useEffect(() => {
    loadEvents();
  }, [contract]);

  const loadEvents = async () => {
    const c = contract || getReadOnlyContract();
    if (!c) { setError('No blockchain connection.'); return; }
    setLoading(true);
    setError('');
    try {
      const provider = c.runner?.provider || c.provider;
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 10000);
      setBlockRange(`${fromBlock} – ${latestBlock}`);

      const scoreFilter = c.filters.ScoreSubmitted();
      const scoreEvents = await c.queryFilter(scoreFilter, fromBlock);

      const hackFilter = c.filters.HackathonConfigured();
      const projFilter = c.filters.ProjectRegistered();
      const judgeFilter = c.filters.JudgeStatusChanged();

      const [hackEvents, projEvents, judgeEvents] = await Promise.all([
        c.queryFilter(hackFilter, fromBlock),
        c.queryFilter(projFilter, fromBlock),
        c.queryFilter(judgeFilter, fromBlock),
      ]);

      const allEvents = [
        ...hackEvents.map(e => ({ ...e, type: 'HackathonConfigured', parsed: c.interface.parseLog(e) })),
        ...projEvents.map(e => ({ ...e, type: 'ProjectRegistered', parsed: c.interface.parseLog(e) })),
        ...judgeEvents.map(e => ({ ...e, type: 'JudgeStatusChanged', parsed: c.interface.parseLog(e) })),
        ...scoreEvents.map(e => ({ ...e, type: 'ScoreSubmitted', parsed: c.interface.parseLog(e) })),
      ].sort((a, b) => b.blockNumber - a.blockNumber);

      setEvents(allEvents);
    } catch (err) {
      setError(err.message?.includes('ECONNREFUSED')
        ? 'Cannot reach Hardhat node. Is it running?'
        : 'Failed to load events: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderEventDetails = (event) => {
    const args = event.parsed?.args;
    if (!args) return null;
    switch (event.type) {
      case 'ScoreSubmitted':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            <span>Project: <strong>#{args[0]?.toString()}</strong></span>
            <span>Judge: <span className="text-mono">{args[1]?.slice(0,8)}...</span></span>
            <span>Tech: <strong>{args[2]?.toString()}</strong></span>
            <span>Innov: <strong>{args[3]?.toString()}</strong></span>
            <span>UX: <strong>{args[4]?.toString()}</strong></span>
            <span>Impact: <strong>{args[5]?.toString()}</strong></span>
            <span>Total Score: <strong style={{ color: 'var(--color-primary)' }}>{args[6]?.toString()} / 1000</strong></span>
          </div>
        );
      case 'ProjectRegistered':
        return (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            Registered <strong>#{args[0]?.toString()} {args[1]}</strong> | Lead: {args[2]} | Category: {args[3]}
          </div>
        );
      case 'HackathonConfigured':
        return (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            Title: <strong>{args[0]}</strong>
          </div>
        );
      case 'JudgeStatusChanged':
        return (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            Judge <span className="text-mono">{args[0]?.slice(0,8)}...</span> ({args[1]}) status set to <strong>{args[2] ? 'Authorized' : 'Revoked'}</strong>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-lg flex-wrap gap-md">
        <div>
          <h1 className="page-title">
            <History size={24} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: 'var(--color-primary)' }} />
            On-Chain Event Explorer &amp; Audit Log
          </h1>
          <p className="page-subtitle">
            Permanent transaction log querying on-chain smart contract events (Blocks {blockRange || 'Loading'}).
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadEvents} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh Events
        </button>
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

      <div className="card">
        <div className="card-header mb-md">
          <h3 className="card-title flex items-center gap-sm">
            <Activity size={16} color="var(--color-primary)" /> Smart Contract Log Stream ({events.length} Events)
          </h3>
        </div>

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" style={{ width: 24, height: 24 }} />
            <p>Querying logs from local EVM node...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><History size={24} /></div>
            <div className="empty-state-title">No Contract Events Logged Yet</div>
            <div className="empty-state-desc">
              Submit a score or register a project to produce real-time on-chain events.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Event Type</th>
                  <th>Transaction Hash</th>
                  <th>Event Payload Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>#{e.blockNumber}</td>
                    <td>
                      <span className={`badge ${e.type === 'ScoreSubmitted' ? 'badge-active' : 'badge-category'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {e.transactionHash?.slice(0, 12)}...
                    </td>
                    <td>{renderEventDetails(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
