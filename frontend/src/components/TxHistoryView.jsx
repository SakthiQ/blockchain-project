/**
 * TxHistoryView — Blockchain transaction log / event explorer
 * Shows all ScoreSubmitted events with full on-chain data
 */
import { useEffect, useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { History, ExternalLink, RefreshCw, Blocks, Activity } from 'lucide-react';

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

      // Query all ScoreSubmitted events
      const scoreFilter = c.filters.ScoreSubmitted();
      const scoreEvents = await c.queryFilter(scoreFilter, fromBlock);

      // Also query HackathonConfigured, ProjectRegistered, JudgeStatusChanged
      const hackFilter = c.filters.HackathonConfigured();
      const projFilter = c.filters.ProjectRegistered();
      const judgeFilter = c.filters.JudgeStatusChanged();

      const [hackEvents, projEvents, judgeEvents] = await Promise.all([
        c.queryFilter(hackFilter, fromBlock),
        c.queryFilter(projFilter, fromBlock),
        c.queryFilter(judgeFilter, fromBlock),
      ]);

      // Combine and annotate all events
      const allEvents = [
        ...hackEvents.map(e => ({ ...e, type: 'HackathonConfigured', parsed: c.interface.parseLog(e) })),
        ...projEvents.map(e => ({ ...e, type: 'ProjectRegistered', parsed: c.interface.parseLog(e) })),
        ...judgeEvents.map(e => ({ ...e, type: 'JudgeStatusChanged', parsed: c.interface.parseLog(e) })),
        ...scoreEvents.map(e => ({ ...e, type: 'ScoreSubmitted', parsed: c.interface.parseLog(e) })),
      ].sort((a, b) => b.blockNumber - a.blockNumber); // newest first

      setEvents(allEvents);
    } catch (err) {
      setError(err.message?.includes('ECONNREFUSED')
        ? 'Cannot reach Hardhat node. Is it running?'
        : 'Failed to load events: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const EVENT_STYLES = {
    ScoreSubmitted:      { color: '#6c63ff', bg: 'rgba(108,99,255,0.1)', label: 'Score Submitted' },
    ProjectRegistered:   { color: '#00d4ff', bg: 'rgba(0,212,255,0.1)',  label: 'Project Registered' },
    HackathonConfigured: { color: '#00e5a0', bg: 'rgba(0,229,160,0.1)', label: 'Hackathon Configured' },
    JudgeStatusChanged:  { color: '#ff6b8a', bg: 'rgba(255,107,138,0.1)', label: 'Judge Status Changed' },
  };

  const renderEventDetails = (event) => {
    const args = event.parsed?.args;
    if (!args) return null;
    switch (event.type) {
      case 'ScoreSubmitted':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            <span><strong style={{ color: 'var(--color-text-primary)' }}>Project:</strong> #{args[0]?.toString()}</span>
            <span><strong style={{ color: 'var(--color-text-primary)' }}>Judge:</strong> {args[1]?.slice(0,10)}...</span>
            <span><strong style={{ color: 'var(--color-text-primary)' }}>Tech:</strong> {args[2]?.toString()}</span>
            <span><strong style={{ color: 'var(--color-text-primary)' }}>Innov:</strong> {args[3]?.toString()}</span>
            <span><strong style={{ color: 'var(--color-text-primary)' }}>UX:</strong> {args[4]?.toString()}</span>
            <span><strong style={{ color: 'var(--color-text-primary)' }}>Impact:</strong> {args[5]?.toString()}</span>
            <span><strong style={{ color: 'var(--color-accent-primary)' }}>Total:</strong> {args[6]?.toString()}/40</span>
          </div>
        );
      case 'ProjectRegistered':
        return (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>#{args[0]?.toString()}</strong> — {args[1]} |
            Team: {args[2]} | Category: {args[3]}
          </div>
        );
      case 'HackathonConfigured':
        return (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            Hackathon: <strong style={{ color: 'var(--color-text-primary)' }}>{args[0]}</strong>
          </div>
        );
      case 'JudgeStatusChanged':
        return (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            Judge: <strong style={{ color: 'var(--color-text-primary)' }}>{args[1]}</strong> ({args[0]?.slice(0,10)}...) —{' '}
            <span style={{ color: args[2] ? 'var(--color-accent-success)' : 'var(--color-accent-danger)' }}>
              {args[2] ? 'Authorized' : 'Revoked'}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <div>
          <h1 className="page-title">
            <History size={24} style={{ display: 'inline', marginRight: 10, verticalAlign: 'middle' }} />
            Blockchain Transaction Log
          </h1>
          <p className="page-subtitle">
            All on-chain events emitted by the HackathonJudging contract. This is the immutable audit trail.
            {blockRange && <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 8 }}>Blocks {blockRange}</span>}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadEvents} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          Refresh
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

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <p>Fetching on-chain events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Blocks size={28} /></div>
          <div className="empty-state-title">No Events Found</div>
          <div className="empty-state-desc">
            No contract events found in the recent block range. Deploy the contract and run the seed script to populate data.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((event, i) => {
            const style = EVENT_STYLES[event.type] || EVENT_STYLES.ScoreSubmitted;
            return (
              <div key={i} className="card" style={{ padding: 'var(--space-md)', transition: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                  {/* Event type badge */}
                  <div style={{
                    width: 10, borderRadius: 4, alignSelf: 'stretch',
                    background: style.color, flexShrink: 0, minHeight: 40
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em', color: style.color,
                        background: style.bg, padding: '2px 8px', borderRadius: 4
                      }}>
                        {style.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        Block #{event.blockNumber}
                      </span>
                      {event.transactionHash && (
                        <span
                          className="tx-hash"
                          onClick={() => navigator.clipboard?.writeText(event.transactionHash)}
                          title="Click to copy transaction hash"
                        >
                          <ExternalLink size={9} />
                          {event.transactionHash.slice(0, 20)}...
                        </span>
                      )}
                    </div>
                    {renderEventDetails(event)}
                  </div>

                  <Activity size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
