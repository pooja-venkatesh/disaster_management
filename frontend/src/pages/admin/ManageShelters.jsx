import { useEffect, useState } from 'react';
import { fetchAllShelters, verifyShelter, unverifyShelter } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const ManageShelters = () => {
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [acting, setActing]     = useState(null);

  const load = () => {
    setLoading(true);
    fetchAllShelters(filter ? { verified: filter } : {})
      .then((r) => setShelters(r.data.data.shelters))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const handleVerify = async (id) => {
    setActing(id);
    try { await verifyShelter(id); load(); }
    catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setActing(null); }
  };

  const handleUnverify = async (id) => {
    if (!window.confirm('Revoke verification for this shelter?')) return;
    setActing(id);
    try { await unverifyShelter(id); load(); }
    catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setActing(null); }
  };

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Manage Shelters</h1>
            <p className="page-subtitle">Verify shelters to allow them to receive emergency request assignments.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {[['', 'All'], ['false', 'Pending Verification'], ['true', 'Verified']].map(([val, label]) => (
            <button
              key={val}
              className={`btn btn--sm ${filter === val ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="panel">
          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : shelters.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No shelters found</div>
              <div className="empty-state-sub">Shelter accounts will appear here once they set up their profiles.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shelter Name</th>
                  <th>Owner</th>
                  <th>Contact</th>
                  <th>Capacity</th>
                  <th>Accepts</th>
                  <th>Verified</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shelters.map((s) => (
                  <tr key={s.shelter_id}>
                    <td style={{ fontWeight: 700, color: '#111827' }}>{s.shelter_name}</td>
                    <td style={{ fontSize: '0.82rem', color: '#374151' }}>{s.name}</td>
                    <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                      <div>{s.email}</div>
                      {s.phone && <div>{s.phone}</div>}
                    </td>
                    <td style={{ fontWeight: 600, color: '#111827' }}>
                      {s.current_occupancy}/{s.total_capacity}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                        {(s.accepted_types || '').split(',').map((t) => (
                          <span key={t} className="badge badge--assigned" style={{ fontSize: '0.6rem' }}>{t.trim()}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.is_verified ? 'badge--verified' : 'badge--unverified'}`}>
                        {s.is_verified ? 'Verified' : 'Pending'}
                      </span>
                      {s.is_verified && s.verified_by_name && (
                        <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                          by {s.verified_by_name}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {s.address
                        ? <span title={s.address}>{s.address.length > 30 ? s.address.slice(0,30)+'…' : s.address}</span>
                        : `${s.latitude}, ${s.longitude}`
                      }
                    </td>
                    <td>
                      {s.is_verified ? (
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => handleUnverify(s.shelter_id)}
                          disabled={acting === s.shelter_id}
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          className="btn btn--success btn--sm"
                          onClick={() => handleVerify(s.shelter_id)}
                          disabled={acting === s.shelter_id}
                        >
                          {acting === s.shelter_id ? '...' : 'Verify'}
                        </button>
                      )}
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

export default ManageShelters;
