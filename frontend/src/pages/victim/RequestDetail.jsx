import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchRequestDetail } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const dotClass = (status) => {
  if (status === 'accepted') return 'timeline-dot--accepted';
  if (status === 'rejected') return 'timeline-dot--rejected';
  return 'timeline-dot--pending';
};

const RequestDetail = () => {
  const { id } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequestDetail(id)
      .then((r) => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    // Poll for updates every 15s if request is active
    const interval = setInterval(() => {
      fetchRequestDetail(id)
        .then((r) => setData(r.data.data))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <Layout><div className="spinner-wrap"><div className="spinner" /></div></Layout>;
  if (!data)   return <Layout><div className="alert alert--error"><span>Request not found.</span></div></Layout>;

  const { request: req, timeline } = data;

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <Link to="/victim/requests" style={{ fontSize: '0.82rem', color: '#6b7280' }}>
              &larr; Back to My Requests
            </Link>
            <h1 className="page-title" style={{ marginTop: '0.4rem' }}>{req.title}</h1>
            <p className="page-subtitle">Request #{req.request_id} &middot; Submitted {new Date(req.created_at).toLocaleString()}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <span className={`badge badge--${req.status}`} style={{ fontSize: '0.82rem', padding: '0.3rem 0.9rem' }}>{req.status}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left — details */}
          <div>
            <div className="panel">
              <div className="panel-header"><h2 className="panel-title">Request Details</h2></div>
              <div className="panel-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Type</div>
                    <span className="badge badge--assigned">{req.type}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Priority</div>
                    <span className={`priority--${req.priority}`} style={{ fontWeight: 700 }}>{req.priority}</span>
                  </div>
                  {req.address && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Location</div>
                      <div style={{ fontSize: '0.875rem', color: '#374151' }}>{req.address}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{req.latitude}, {req.longitude}</div>
                    </div>
                  )}
                  {req.description && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Description</div>
                      <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{req.description}</div>
                    </div>
                  )}
                  {req.admin_notes && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Admin Notes</div>
                      <div className="alert alert--info" style={{ margin: 0 }}>
                        <span>{req.admin_notes}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right — timeline */}
          <div className="panel">
            <div className="panel-header"><h2 className="panel-title">Assignment Timeline</h2></div>
            <div className="panel-body">
              {timeline.length === 0 ? (
                <div style={{ fontSize: '0.855rem', color: '#9ca3af', textAlign: 'center', padding: '1rem 0' }}>
                  Finding nearest shelter...
                </div>
              ) : (
                <div className="timeline">
                  {timeline.map((t, i) => (
                    <div key={t.assignment_id} className="timeline-item">
                      <div className={`timeline-dot ${dotClass(t.status)}`} />
                      <div className="timeline-header">
                        <span className="timeline-title">{t.shelter_name}</span>
                        <span className={`badge badge--${t.status === 'pending' ? 'assigned' : t.status}`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="timeline-body">
                        {t.shelter_address && <div>{t.shelter_address}</div>}
                        <div className="timeline-time">
                          Assigned: {new Date(t.assigned_at).toLocaleString()}
                          {t.responded_at && ` · Responded: ${new Date(t.responded_at).toLocaleString()}`}
                        </div>
                        {t.shelter_notes && (
                          <div style={{ marginTop: '0.25rem', color: '#EF3333', fontSize: '0.78rem' }}>
                            Note: {t.shelter_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Final status */}
                  {req.status === 'fulfilled' && (
                    <div className="timeline-item">
                      <div className="timeline-dot timeline-dot--fulfilled" />
                      <div className="timeline-header">
                        <span className="timeline-title">Request Fulfilled</span>
                        <span className="badge badge--fulfilled">done</span>
                      </div>
                    </div>
                  )}
                  {req.status === 'unresolved' && (
                    <div className="timeline-item">
                      <div className="timeline-dot timeline-dot--unresolved" />
                      <div className="timeline-header">
                        <span className="timeline-title">Escalated to Administration</span>
                        <span className="badge badge--unresolved">unresolved</span>
                      </div>
                      <div className="timeline-body">Government authorities have been notified.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RequestDetail;
