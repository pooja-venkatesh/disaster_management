import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchShelterDashboard } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const ShelterDashboard = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShelterDashboard()
      .then((r) => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const profile = data?.profile;
  const stats   = data?.stats;

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Shelter Dashboard</h1>
            <p className="page-subtitle">
              {profile ? profile.shelter_name : 'Complete your profile setup to start receiving requests.'}
            </p>
          </div>
          <Link to="/shelter/requests" className="btn btn--primary">
            View Requests
          </Link>
        </div>

        {!profile && (
          <div className="alert alert--warning">
            <span className="alert-mark">!</span>
            <span>
              Your shelter profile is not set up. <Link to="/shelter/setup" style={{ color: '#EF3333', fontWeight: 600 }}>Set it up now</Link> to start receiving emergency requests.
            </span>
          </div>
        )}

        {profile && !profile.is_verified && (
          <div className="alert alert--info">
            <span className="alert-mark">i</span>
            <span>Your shelter is pending verification by the administration. You will receive requests once verified.</span>
          </div>
        )}

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <>
            {/* Stats */}
            {stats && (
              <div className="stat-row">
                <div className="stat-card stat-card--orange">
                  <div className="stat-number">{stats.pending_count ?? 0}</div>
                  <div className="stat-label">Pending</div>
                </div>
                <div className="stat-card stat-card--green">
                  <div className="stat-number">{stats.accepted_count ?? 0}</div>
                  <div className="stat-label">Accepted</div>
                </div>
                <div className="stat-card stat-card--red">
                  <div className="stat-number">{stats.rejected_count ?? 0}</div>
                  <div className="stat-label">Rejected</div>
                </div>
                <div className="stat-card stat-card--purple">
                  <div className="stat-number">{stats.fulfilled_count ?? 0}</div>
                  <div className="stat-label">Fulfilled</div>
                </div>
              </div>
            )}

            {/* Profile summary */}
            {profile && (
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Shelter Profile</h2>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`badge ${profile.is_verified ? 'badge--verified' : 'badge--unverified'}`}>
                      {profile.is_verified ? 'Verified' : 'Pending Verification'}
                    </span>
                    <Link to="/shelter/setup" className="btn btn--ghost btn--sm">Edit</Link>
                  </div>
                </div>
                <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</div>
                    <div style={{ fontWeight: 500, color: '#374151', marginTop: '0.2rem', fontSize: '0.875rem' }}>{profile.address || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capacity</div>
                    <div style={{ fontWeight: 700, color: '#111827', marginTop: '0.2rem', fontSize: '1.1rem' }}>
                      {profile.current_occupancy} / {profile.total_capacity}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accepted Types</div>
                    <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {(profile.accepted_types || '').split(',').map((t) => (
                        <span key={t} className="badge badge--assigned">{t.trim()}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pending requests */}
            {data?.pendingRequests?.length > 0 && (
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Pending Assignments</h2>
                  <Link to="/shelter/requests" className="btn btn--ghost btn--sm">View all</Link>
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Type</th><th>Title</th><th>Priority</th><th>Victim</th><th>Assigned</th><th></th></tr>
                  </thead>
                  <tbody>
                    {data.pendingRequests.map((r) => (
                      <tr key={r.assignment_id}>
                        <td><span className="badge badge--assigned">{r.type}</span></td>
                        <td style={{ fontWeight: 600, color: '#111827' }}>{r.title}</td>
                        <td><span className={`priority--${r.priority}`}>{r.priority}</span></td>
                        <td style={{ fontSize: '0.8rem', color: '#6b7280' }}>{r.victim_name}</td>
                        <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{new Date(r.assigned_at).toLocaleString()}</td>
                        <td>
                          <Link to="/shelter/requests" className="btn btn--primary btn--sm">Respond</Link>
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

export default ShelterDashboard;
