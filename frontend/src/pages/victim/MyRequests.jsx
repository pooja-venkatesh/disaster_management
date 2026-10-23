import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyRequests, cancelRequest } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const MyRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [cancelling, setCancelling] = useState(null);

  const load = () => {
    setLoading(true);
    fetchMyRequests(filter ? { status: filter } : {})
      .then((r) => setRequests(r.data.data.requests))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this request?')) return;
    setCancelling(id);
    try {
      await cancelRequest(id);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel.');
    } finally {
      setCancelling(null);
    }
  };

  const STATUSES = ['', 'pending', 'assigned', 'accepted', 'fulfilled', 'unresolved', 'cancelled'];

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Requests</h1>
            <p className="page-subtitle">Track all your emergency requests and their current status.</p>
          </div>
          <Link to="/victim/request/new" className="btn btn--primary">+ New Request</Link>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {STATUSES.map((s) => (
            <button
              key={s || 'all'}
              className={`btn btn--sm ${filter === s ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setFilter(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        <div className="panel">
          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No requests found</div>
              <div className="empty-state-sub">Try changing the filter or submit a new request.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Current Shelter</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.request_id}>
                    <td style={{ color: '#9ca3af', fontSize: '0.78rem' }}>#{r.request_id}</td>
                    <td><span className="badge badge--assigned">{r.type}</span></td>
                    <td>
                      <Link to={`/victim/requests/${r.request_id}`} style={{ color: '#EF3333', fontWeight: 600 }}>
                        {r.title}
                      </Link>
                    </td>
                    <td><span className={`badge badge--${r.status}`}>{r.status}</span></td>
                    <td style={{ fontSize: '0.8rem', color: '#6b7280' }}>{r.current_shelter_name || '—'}</td>
                    <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Link to={`/victim/requests/${r.request_id}`} className="btn btn--ghost btn--sm">View</Link>
                        {['pending', 'assigned'].includes(r.status) && (
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => handleCancel(r.request_id)}
                            disabled={cancelling === r.request_id}
                          >
                            {cancelling === r.request_id ? '...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
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

export default MyRequests;
