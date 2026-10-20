import { useEffect, useState } from 'react';
import { fetchUnresolvedRequests, resolveRequest } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const UnresolvedAlerts = () => {
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [notes, setNotes]         = useState('');
  const [resolving, setResolving] = useState(null);

  const load = () => {
    setLoading(true);
    fetchUnresolvedRequests()
      .then((r) => setRequests(r.data.data.requests))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleResolve = async () => {
    const id = modal;
    setResolving(id);
    setModal(null);
    try {
      await resolveRequest(id, { notes });
      setNotes('');
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resolve.');
    } finally {
      setResolving(null);
    }
  };

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Unresolved Emergencies</h1>
            <p className="page-subtitle">
              These requests were rejected by all nearby shelters and require direct government intervention.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="badge badge--unresolved" style={{ fontSize: '0.82rem', padding: '0.3rem 0.9rem' }}>
              {requests.length} unresolved
            </span>
          </div>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No unresolved emergencies</div>
            <div className="empty-state-sub">All requests are being handled by shelters.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {requests.map((r) => (
              <div
                key={r.request_id}
                className="panel"
                style={{ marginBottom: 0, borderLeft: '4px solid #EF3333' }}
              >
                <div className="panel-header">
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge badge--unresolved">UNRESOLVED</span>
                    <span className="badge badge--assigned">{r.type}</span>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{r.title}</h3>
                    <span className={`priority--${r.priority}`} style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                      {r.priority}
                    </span>
                  </div>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => { setModal(r.request_id); setNotes(''); }}
                    disabled={resolving === r.request_id}
                  >
                    {resolving === r.request_id ? 'Resolving...' : 'Mark Resolved'}
                  </button>
                </div>

                <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Victim</div>
                    <div style={{ fontWeight: 600, color: '#111827', marginTop: '0.2rem' }}>{r.victim_name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.victim_email}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</div>
                    <div style={{ fontWeight: 600, color: '#111827', marginTop: '0.2rem' }}>{r.victim_phone || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</div>
                    <div style={{ fontSize: '0.855rem', color: '#374151', marginTop: '0.2rem' }}>{r.address || 'Not specified'}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{r.latitude}, {r.longitude}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shelters Tried</div>
                    <div style={{ fontWeight: 700, fontSize: '1.5rem', color: '#EF3333', marginTop: '0.1rem', letterSpacing: '-0.04em' }}>
                      {r.shelters_tried}
                    </div>
                  </div>
                  {r.description && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</div>
                      <div style={{ fontSize: '0.855rem', color: '#374151', marginTop: '0.2rem', lineHeight: 1.5 }}>{r.description}</div>
                    </div>
                  )}
                  <div style={{ gridColumn: '1/-1', fontSize: '0.75rem', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem' }}>
                    Submitted: {new Date(r.created_at).toLocaleString()} &middot;
                    Last updated: {new Date(r.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resolve modal */}
        {modal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
          }}>
            <div style={{ background: '#fff', borderRadius: '1.1rem', padding: '1.75rem', width: '460px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 700 }}>Mark as Resolved</h3>
              <p style={{ fontSize: '0.855rem', color: '#6b7280', margin: '0 0 1rem', lineHeight: 1.5 }}>
                The victim will be notified that their request has been resolved by the administration.
              </p>
              <div className="form-field">
                <label className="form-label">Admin Notes <span className="optional">(optional)</span></label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. Victim relocated to government relief camp, Sector 7"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn--primary" onClick={handleResolve}>Confirm Resolution</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UnresolvedAlerts;
