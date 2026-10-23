import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchVictimDashboard } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const STATUS_COLOR = {
  pending:    'stat-card--orange',
  assigned:   'stat-card--blue',
  accepted:   'stat-card--green',
  fulfilled:  'stat-card--purple',
  unresolved: 'stat-card--red',
};

const VictimDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVictimDashboard()
      .then((r) => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Hello, {user?.name}</h1>
            <p className="page-subtitle">Manage your emergency requests and track their status.</p>
          </div>
          <Link to="/victim/request/new" className="btn btn--primary">
            + New Request
          </Link>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <>
            {/* Stats */}
            <div className="stat-row">
              {[
                { label: 'Total',      value: data?.stats?.total,      cls: 'stat-card--gray' },
                { label: 'Pending',    value: data?.stats?.pending,    cls: 'stat-card--orange' },
                { label: 'Assigned',   value: data?.stats?.assigned,   cls: 'stat-card--blue' },
                { label: 'Accepted',   value: data?.stats?.accepted,   cls: 'stat-card--green' },
                { label: 'Fulfilled',  value: data?.stats?.fulfilled,  cls: 'stat-card--purple' },
                { label: 'Unresolved', value: data?.stats?.unresolved, cls: 'stat-card--red' },
              ].map((s) => (
                <div key={s.label} className={`stat-card ${s.cls}`}>
                  <div className="stat-number">{s.value ?? 0}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Unresolved alert */}
            {data?.stats?.unresolved > 0 && (
              <div className="alert alert--error">
                <span className="alert-mark">!</span>
                <span>
                  You have <strong>{data.stats.unresolved} unresolved</strong> request(s).
                  Government/Admin has been notified and will intervene.
                </span>
              </div>
            )}

            {/* Recent Requests */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Recent Requests</h2>
                <Link to="/victim/requests" className="btn btn--ghost btn--sm">View all</Link>
              </div>
              {data?.recentRequests?.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">No requests yet</div>
                  <div className="empty-state-sub">Submit your first emergency request to get help.</div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Current Shelter</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recentRequests?.map((r) => (
                      <tr key={r.request_id}>
                        <td><span className="badge badge--assigned">{r.type}</span></td>
                        <td>
                          <Link to={`/victim/requests/${r.request_id}`} style={{ color: '#EF3333', fontWeight: 600 }}>
                            {r.title}
                          </Link>
                        </td>
                        <td><span className={`badge badge--${r.status}`}>{r.status}</span></td>
                        <td style={{ color: '#6b7280', fontSize: '0.8rem' }}>{r.current_shelter || '—'}</td>
                        <td style={{ color: '#6b7280', fontSize: '0.78rem' }}>
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default VictimDashboard;
