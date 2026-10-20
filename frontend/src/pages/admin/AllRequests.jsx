import { useEffect, useState } from 'react';
import { fetchAllRequests } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const AllRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filters, setFilters]   = useState({ status: '', type: '', priority: '' });

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.status)   params.status   = filters.status;
    if (filters.type)     params.type     = filters.type;
    if (filters.priority) params.priority = filters.priority;
    fetchAllRequests(params)
      .then((r) => setRequests(r.data.data.requests))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  const STATUSES   = ['', 'pending', 'assigned', 'accepted', 'fulfilled', 'unresolved', 'cancelled'];
  const TYPES      = ['', 'SOS', 'food', 'water', 'medicine', 'shelter', 'clothing'];
  const PRIORITIES = ['', 'critical', 'high', 'medium', 'low'];

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">All Requests</h1>
            <p className="page-subtitle">System-wide view of every emergency request.</p>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 }}>
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Filter bar */}
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
          <div className="panel-body" style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Status</div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {STATUSES.map((s) => (
                    <button key={s || 'all'} className={`btn btn--sm ${filters.status === s ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setFilter('status', s)}>
                      {s || 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Type</div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {TYPES.map((t) => (
                    <button key={t || 'all'} className={`btn btn--sm ${filters.type === t ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setFilter('type', t)}>
                      {t || 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Priority</div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {PRIORITIES.map((p) => (
                    <button key={p || 'all'} className={`btn btn--sm ${filters.priority === p ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setFilter('priority', p)}>
                      {p || 'All'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No requests match your filters</div>
              <div className="empty-state-sub">Try adjusting the filters above.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Victim</th>
                  <th>Status</th>
                  <th>Current Shelter</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.request_id}>
                    <td style={{ color: '#9ca3af', fontSize: '0.78rem' }}>#{r.request_id}</td>
                    <td><span className="badge badge--assigned">{r.type}</span></td>
                    <td style={{ fontWeight: 600, color: '#111827', maxWidth: '200px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    </td>
                    <td><span className={`priority--${r.priority}`} style={{ fontWeight: 600 }}>{r.priority}</span></td>
                    <td style={{ fontSize: '0.82rem' }}>
                      <div style={{ fontWeight: 500, color: '#374151' }}>{r.victim_name}</div>
                      {r.victim_phone && <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>{r.victim_phone}</div>}
                    </td>
                    <td><span className={`badge badge--${r.status}`}>{r.status}</span></td>
                    <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.current_shelter || '—'}</td>
                    <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AllRequests;
