import { useEffect, useState, useCallback } from 'react';
import {
  getShelterRequests,
  acceptRequest,
  rejectRequest,
  fulfillRequest,
} from '../../api/axios';
import { getRoadRoute } from '../../services/routingService';
import { useSocket } from '../../context/SocketContext';
import Layout from '../../components/Layout';
import MapView from '../../components/MapView';
import '../../styles/layout.css';

// ── Priority badge styles ────────────────────────────────────────────
const PRIORITY_STYLES = {
  critical: { bg: '#7f1d1d', color: '#fef2f2', border: '#ef4444', label: 'CRITICAL' },
  high:     { bg: '#7c2d12', color: '#fff7ed', border: '#f97316', label: 'HIGH'     },
  medium:   { bg: '#713f12', color: '#fefce8', border: '#eab308', label: 'MEDIUM'   },
  low:      { bg: '#14532d', color: '#f0fdf4', border: '#22c55e', label: 'LOW'      },
};

const PriorityBadge = ({ priority, score }) => {
  const s = PRIORITY_STYLES[priority] || PRIORITY_STYLES.low;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <span style={{
        background: s.bg, color: s.color,
        border: `1.5px solid ${s.border}`,
        borderRadius: '5px', padding: '0.2rem 0.65rem',
        fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.08em',
      }}>
        {s.label}
      </span>
      {score != null && (
        <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>
          Score: {score}
        </span>
      )}
    </div>
  );
};

const TagList = ({ items, color = '#EF3333' }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
    {items.map((t) => (
      <span key={t} style={{
        background: '#fff0f0', color, border: `1px solid ${color}40`,
        borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700,
        textTransform: 'uppercase',
      }}>{t}</span>
    ))}
  </div>
);

const Flag = ({ active, label }) => active ? (
  <span style={{
    background: '#fef2f2', color: '#EF3333', border: '1px solid #fecaca',
    borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700,
  }}>{label}</span>
) : null;

const RejectModal = ({ request, onConfirm, onClose }) => {
  const [notes, setNotes] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.75rem', width: 420, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <h3 style={{ margin: '0 0 0.5rem', color: '#111827' }}>Reject Request</h3>
        <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.87rem' }}>
          Rejecting will forward this request to the next nearest shelter. Please provide a reason.
        </p>
        <textarea
          className="form-input"
          rows={3}
          placeholder="Reason for rejection (e.g. No medical staff available, capacity full)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ resize: 'none' }}
        />
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--danger" onClick={() => onConfirm(notes)}>Confirm Reject</button>
        </div>
      </div>
    </div>
  );
};

const IncomingRequests = () => {
  const [requests, setRequests]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [rejectTarget, setRejectTarget]   = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError]                 = useState('');
  const [tab, setTab]                     = useState('pending');
  const [activeMapId, setActiveMapId]     = useState(null);
  const [routeState, setRouteState]       = useState({}); // { [assignId]: { coords, info, loading, error } }
  const { socket }                        = useSocket();

  const load = useCallback(async (t = tab) => {
    try {
      const res = await getShelterRequests(t);
      setRequests(res.data.data.requests || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { setLoading(true); load(tab); }, [tab]);

  // Real-time: new request assigned via socket
  useEffect(() => {
    if (!socket) return;
    const handler = () => load(tab);
    socket.on('request:assigned', handler);
    return () => socket.off('request:assigned', handler);
  }, [socket, load, tab]);

  const handleAccept = async (assignmentId) => {
    setActionLoading(assignmentId);
    setError('');
    try {
      await acceptRequest(assignmentId);
      load(tab);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept.');
    } finally { setActionLoading(null); }
  };

  const handleReject = async (notes) => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.assignment_id);
    setError('');
    try {
      await rejectRequest(rejectTarget.assignment_id, notes);
      setRejectTarget(null);
      load(tab);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject.');
    } finally { setActionLoading(null); }
  };

  const handleFulfill = async (assignmentId) => {
    setActionLoading(assignmentId);
    try {
      await fulfillRequest(assignmentId);
      load(tab);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark fulfilled.');
    } finally { setActionLoading(null); }
  };

  // Toggle map view and calculate actual road route
  const toggleMapView = async (r) => {
    const id = r.assignment_id;
    if (activeMapId === id) {
      setActiveMapId(null);
      return;
    }
    setActiveMapId(id);

    // If route already calculated, don't refetch
    if (routeState[id]?.coords) return;

    const sLat = parseFloat(r.shelter_lat);
    const sLng = parseFloat(r.shelter_lng);
    const vLat = parseFloat(r.latitude);
    const vLng = parseFloat(r.longitude);

    if (isNaN(sLat) || isNaN(sLng) || isNaN(vLat) || isNaN(vLng)) {
      setRouteState((prev) => ({
        ...prev,
        [id]: { error: 'Incomplete coordinates for road routing.' },
      }));
      return;
    }

    setRouteState((prev) => ({
      ...prev,
      [id]: { loading: true },
    }));

    try {
      const res = await getRoadRoute([sLat, sLng], [vLat, vLng]);
      setRouteState((prev) => ({
        ...prev,
        [id]: {
          coords: res.coordinates,
          info: {
            distanceFormatted: res.distanceFormatted,
            durationFormatted: res.durationFormatted,
            isRoadRoute: res.isRoadRoute,
            warning: res.warning,
          },
          loading: false,
        },
      }));
    } catch (e) {
      setRouteState((prev) => ({
        ...prev,
        [id]: { error: 'Failed to calculate road route.', loading: false },
      }));
    }
  };

  return (
    <Layout>
      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
        />
      )}

      <div className="animate-up">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Assigned Emergency Requests</h1>
            <p className="page-subtitle">
              Requests routed to your shelter by priority and proximity. Sorted CRITICAL → LOW.
            </p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => load(tab)}>
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: '1rem' }}>
            <span className="alert-mark">!</span>
            <span>{error}</span>
          </div>
        )}

        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {[
            { id: 'pending',  label: 'Pending Response' },
            { id: 'accepted', label: 'Accepted (En Route)' },
          ].map((t) => (
            <button
              key={t.id}
              className={`btn btn--sm ${tab === t.id ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => { setTab(t.id); setActiveMapId(null); }}
            >
              {t.label}
              {t.id === 'pending' && requests.length > 0 && tab === 'pending' && (
                <span style={{
                  marginLeft: '0.4rem', background: '#EF3333', color: '#fff',
                  borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem', fontWeight: 800,
                }}>
                  {requests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Request List */}
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No {tab} requests</div>
            <div className="empty-state-sub">New requests will appear here in real time.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {requests.map((r) => {
              const needs     = r.needs ? r.needs.split(',') : [];
              const isLoading = actionLoading === r.assignment_id;
              const isMapOpen = activeMapId === r.assignment_id;
              const currentRoute = routeState[r.assignment_id];

              const sLat = parseFloat(r.shelter_lat);
              const sLng = parseFloat(r.shelter_lng);
              const vLat = parseFloat(r.latitude);
              const vLng = parseFloat(r.longitude);

              // Prepare entities for MapView
              const mapShelters = (!isNaN(sLat) && !isNaN(sLng)) ? [{
                shelter_id: 0,
                shelter_name: 'Your Shelter Facility',
                latitude: sLat,
                longitude: sLng,
                is_verified: true,
              }] : [];

              const mapRequests = (!isNaN(vLat) && !isNaN(vLng)) ? [{
                request_id: r.request_id,
                title: r.title,
                priority: r.priority,
                latitude: vLat,
                longitude: vLng,
                people_count: r.people_count,
                needs: r.needs,
                status: r.request_status,
                address: r.address,
                victim_name: r.victim_name,
                victim_phone: r.victim_phone,
              }] : [];

              return (
                <div
                  key={r.assignment_id}
                  className="panel"
                  style={{
                    marginBottom: 0,
                    borderLeft: `4px solid ${PRIORITY_STYLES[r.priority]?.border || '#e4e6ea'}`,
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 1.25rem 0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <PriorityBadge priority={r.priority} score={r.priority_score} />
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: '1rem' }}>{r.title}</div>
                      <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                        Request #{r.request_id} · {new Date(r.created_at).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {r.distance_km != null && (
                        <>
                          <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#EF3333' }}>{r.distance_km} km</div>
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>crow-flight distance</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Details grid */}
                  <div style={{ padding: '0.5rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem 1rem', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>People</div>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: '1rem' }}>{r.people_count}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Victim</div>
                      <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.85rem' }}>{r.victim_name}</div>
                      {r.victim_phone && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{r.victim_phone}</div>}
                    </div>
                    {r.address && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '2px' }}>Reported Address</div>
                        <div style={{ fontSize: '0.82rem', color: '#374151' }}>{r.address}</div>
                      </div>
                    )}
                  </div>

                  {/* Needs + flags */}
                  <div style={{ padding: '0.65rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', borderBottom: '1px solid #f3f4f6' }}>
                    {needs.length > 0 && <TagList items={needs} />}
                    <Flag active={!!r.children_present} label="Children Present" />
                    <Flag active={!!r.elderly_present}  label="Elderly Present"  />
                    <Flag active={!!r.injured}           label="Injured Persons"  />
                    <Flag active={!!r.urgent_medical}    label="Urgent Medical"   />
                  </div>

                  {/* Description */}
                  {r.description && (
                    <div style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                      {r.description}
                    </div>
                  )}

                  {/* ── Real Road Routing & Map View ──────────────────── */}
                  {isMapOpen && (
                    <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                          🚗 Road Route: Shelter → Victim Location
                        </div>
                        {currentRoute?.loading && (
                          <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                            Calculating road path via OSRM...
                          </span>
                        )}
                      </div>

                      <MapView
                        height="340px"
                        center={!isNaN(vLat) && !isNaN(vLng) ? [vLat, vLng] : [20.5937, 78.9629]}
                        zoom={13}
                        shelters={mapShelters}
                        requests={mapRequests}
                        routeCoordinates={currentRoute?.coords || null}
                        routeInfo={currentRoute?.info || null}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ padding: '0.75rem 1.25rem', display: 'flex', gap: '0.6rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => toggleMapView(r)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                      >
                        {isMapOpen ? 'Hide Map' : '🗺️ View Location & Road Route'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      {tab === 'pending' && (
                        <>
                          <button
                            className="btn btn--ghost"
                            onClick={() => setRejectTarget(r)}
                            disabled={isLoading}
                          >
                            Reject
                          </button>
                          <button
                            className="btn btn--primary"
                            onClick={() => handleAccept(r.assignment_id)}
                            disabled={isLoading}
                          >
                            {isLoading ? 'Accepting...' : 'Accept Request'}
                          </button>
                        </>
                      )}
                      {tab === 'accepted' && (
                        <button
                          className="btn btn--primary"
                          onClick={() => handleFulfill(r.assignment_id)}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Saving...' : 'Mark as Fulfilled'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default IncomingRequests;
