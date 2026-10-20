import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminDashboard } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const AdminDashboard = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminDashboard()
      .then((r) => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">System Overview</h1>
            <p className="page-subtitle">Real-time status of the entire disaster resource network.</p>
          </div>
          <Link to="/admin/unresolved" className="btn btn--primary">
            View Unresolved
          </Link>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <>
            {data?.requestStats?.unresolved > 0 && (
              <div className="alert alert--error">
                <span className="alert-mark">!</span>
                <span>
                  <strong>{data.requestStats.unresolved} unresolved emergency request(s)</strong> require immediate intervention.{' '}
                  <Link to="/admin/unresolved" style={{ color: '#991b1b', fontWeight: 700 }}>Intervene now</Link>
                </span>
              </div>
            )}

            {/* Users */}
            <h2 style={{ fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>Users</h2>
            <div className="stat-row" style={{ marginBottom: '1.75rem' }}>
              <div className="stat-card stat-card--gray">
                <div className="stat-number">{data?.userStats?.total_users ?? 0}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-card stat-card--red">
                <div className="stat-number">{data?.userStats?.victims ?? 0}</div>
                <div className="stat-label">Victims</div>
              </div>
              <div className="stat-card stat-card--green">
                <div className="stat-number">{data?.userStats?.shelters ?? 0}</div>
                <div className="stat-label">Shelters</div>
              </div>
              <div className="stat-card stat-card--purple">
                <div className="stat-number">{data?.userStats?.admins ?? 0}</div>
                <div className="stat-label">Admins</div>
              </div>
            </div>

            {/* Requests */}
            <h2 style={{ fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>Requests</h2>
            <div className="stat-row" style={{ marginBottom: '1.75rem' }}>
              {[
                { label: 'Total',     value: data?.requestStats?.total_requests, cls: 'stat-card--gray' },
                { label: 'Pending',   value: data?.requestStats?.pending,        cls: 'stat-card--orange' },
                { label: 'Assigned',  value: data?.requestStats?.assigned,       cls: 'stat-card--blue' },
                { label: 'Accepted',  value: data?.requestStats?.accepted,       cls: 'stat-card--green' },
                { label: 'Fulfilled', value: data?.requestStats?.fulfilled,      cls: 'stat-card--purple' },
                { label: 'Unresolved',value: data?.requestStats?.unresolved,     cls: 'stat-card--red' },
              ].map((s) => (
                <div key={s.label} className={`stat-card ${s.cls}`}>
                  <div className="stat-number">{s.value ?? 0}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Shelters */}
            <h2 style={{ fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>Shelters</h2>
            <div className="stat-row" style={{ marginBottom: '1.75rem' }}>
              <div className="stat-card stat-card--gray">
                <div className="stat-number">{data?.shelterStats?.total_shelters ?? 0}</div>
                <div className="stat-label">Total Shelters</div>
              </div>
              <div className="stat-card stat-card--green">
                <div className="stat-number">{data?.shelterStats?.verified ?? 0}</div>
                <div className="stat-label">Verified</div>
              </div>
              <div className="stat-card stat-card--orange">
                <div className="stat-number">{data?.shelterStats?.pending_verification ?? 0}</div>
                <div className="stat-label">Pending Verification</div>
              </div>
            </div>

            {/* Recent Unresolved */}
            {data?.recentUnresolved?.length > 0 && (
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Recent Unresolved Emergencies</h2>
                  <Link to="/admin/unresolved" className="btn btn--danger btn--sm">View all</Link>
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Type</th><th>Title</th><th>Priority</th><th>Victim</th><th>Phone</th><th>Submitted</th><th></th></tr>
                  </thead>
                  <tbody>
                    {data.recentUnresolved.map((r) => (
                      <tr key={r.request_id}>
                        <td><span className="badge badge--assigned">{r.type}</span></td>
                        <td style={{ fontWeight: 600, color: '#111827' }}>{r.title}</td>
                        <td><span className={`priority--${r.priority}`}>{r.priority}</span></td>
                        <td style={{ fontSize: '0.82rem', color: '#374151' }}>{r.victim_name}</td>
                        <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{r.victim_phone || '—'}</td>
                        <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{new Date(r.created_at).toLocaleString()}</td>
                        <td>
                          <Link to="/admin/unresolved" className="btn btn--primary btn--sm">Intervene</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;
