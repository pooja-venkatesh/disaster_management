import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllShelters, fetchAllRequests, fetchUnresolvedRequests } from '../../api/axios';
import { getRoadRoute } from '../../services/routingService';
import Layout from '../../components/Layout';
import MapView from '../../components/MapView';
import '../../styles/layout.css';

const PRIORITY_COLORS = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#ca8a04',
  low:      '#16a34a',
};

const AdminDisasterMap = () => {
  const navigate = useNavigate();

  // Raw data from DB
  const [shelters, setShelters]         = useState([]);
  const [requests, setRequests]         = useState([]);
  const [unresolved, setUnresolved]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // Admin personal location
  const [adminLoc, setAdminLoc]         = useState(null);
  const [locating, setLocating]         = useState(false);

  // Filters
  const [showShelters, setShowShelters]       = useState(true);
  const [showActiveSos, setShowActiveSos]     = useState(true);
  const [showResolvedSos, setShowResolvedSos] = useState(false);
  const [showAlerts, setShowAlerts]           = useState(true);

  // Selection & Routing
  const [selectedEntity, setSelectedEntity]   = useState(null); // { type: 'shelter' | 'request', data: obj }
  const [routeCoords, setRouteCoords]         = useState(null);
  const [routeInfo, setRouteInfo]             = useState(null);
  const [routingLoading, setRoutingLoading]   = useState(false);
  const [mapCenter, setMapCenter]             = useState([20.5937, 78.9629]);

  // Load all real data from backend
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [shelterRes, reqRes, alertRes] = await Promise.allSettled([
        fetchAllShelters(),
        fetchAllRequests(),
        fetchUnresolvedRequests(),
      ]);

      const loadedShelters = shelterRes.status === 'fulfilled' ? shelterRes.value.data.data.shelters || [] : [];
      const loadedRequests = reqRes.status === 'fulfilled' ? reqRes.value.data.data.requests || [] : [];
      const loadedAlerts   = alertRes.status === 'fulfilled' ? alertRes.value.data.data.unresolved || [] : [];

      setShelters(loadedShelters);
      setRequests(loadedRequests);
      setUnresolved(loadedAlerts);

      // Auto-center on first entity with valid coordinates
      const firstValid = loadedShelters.find((s) => s.latitude && s.longitude && s.latitude != 0) ||
                         loadedRequests.find((r) => r.latitude && r.longitude && r.latitude != 0);
      if (firstValid) {
        setMapCenter([parseFloat(firstValid.latitude), parseFloat(firstValid.longitude)]);
      }
    } catch (e) {
      setError('Failed to fetch disaster data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Detect Admin Location
  const handleDetectAdminLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [parseFloat(pos.coords.latitude.toFixed(6)), parseFloat(pos.coords.longitude.toFixed(6))];
        setAdminLoc(coords);
        setMapCenter(coords);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError('Could not detect admin location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Filtered entities for MapView
  const displayedShelters = useMemo(() => {
    if (!showShelters) return [];
    return shelters.filter((s) => s.latitude && s.longitude && parseFloat(s.latitude) !== 0);
  }, [shelters, showShelters]);

  const displayedRequests = useMemo(() => {
    return requests.filter((r) => {
      if (!r.latitude || !r.longitude || parseFloat(r.latitude) === 0) return false;
      const isResolved = r.status === 'fulfilled' || r.status === 'cancelled';
      if (isResolved && !showResolvedSos) return false;
      if (!isResolved && !showActiveSos) return false;
      return true;
    });
  }, [requests, showActiveSos, showResolvedSos]);

  const displayedAlerts = useMemo(() => {
    if (!showAlerts) return [];
    return unresolved
      .filter((u) => u.latitude && u.longitude && parseFloat(u.latitude) !== 0)
      .map((u) => ({
        id: u.request_id,
        title: `CRITICAL ALERT: ${u.title}`,
        latitude: parseFloat(u.latitude),
        longitude: parseFloat(u.longitude),
        message: `${u.people_count || 1} people in critical need (${u.needs || 'Immediate dispatch required'}). Unresolved by local shelter.`,
      }));
  }, [unresolved, showAlerts]);

  // Click Shelter Handler
  const handleSelectShelter = (s) => {
    setSelectedEntity({ type: 'shelter', data: s });
    setRouteCoords(null);
    setRouteInfo(null);
    if (s.latitude && s.longitude) {
      setMapCenter([parseFloat(s.latitude), parseFloat(s.longitude)]);
    }
  };

  // Click SOS Handler
  const handleSelectRequest = (r) => {
    setSelectedEntity({ type: 'request', data: r });
    setRouteCoords(null);
    setRouteInfo(null);
    if (r.latitude && r.longitude) {
      setMapCenter([parseFloat(r.latitude), parseFloat(r.longitude)]);
    }
  };

  // Road Routing for Admin: Route between assigned shelter and victim
  const handleRouteToVictim = async (reqItem) => {
    const sLat = parseFloat(reqItem.shelter_latitude);
    const sLng = parseFloat(reqItem.shelter_longitude);
    const vLat = parseFloat(reqItem.latitude);
    const vLng = parseFloat(reqItem.longitude);

    if (isNaN(sLat) || isNaN(sLng) || isNaN(vLat) || isNaN(vLng)) {
      setError('Assigned shelter has not registered valid GPS coordinates.');
      return;
    }

    setRoutingLoading(true);
    setError('');

    try {
      const res = await getRoadRoute([sLat, sLng], [vLat, vLng]);
      if (res.success) {
        setRouteCoords(res.coordinates);
        setRouteInfo({
          distanceFormatted: res.distanceFormatted,
          durationFormatted: res.durationFormatted,
          isRoadRoute: res.isRoadRoute,
          warning: res.warning,
        });
      }
    } catch (e) {
      setError('Route calculation error.');
    } finally {
      setRoutingLoading(false);
    }
  };

  return (
    <Layout>
      <div className="animate-up">
        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h1 className="page-title">Disaster Operations Command Map</h1>
            <p className="page-subtitle">
              Real-time geospatial intelligence across registered shelters, active SOS incidents, and road networks.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleDetectAdminLocation}
              disabled={locating}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {locating ? 'Acquiring GPS...' : adminLoc ? '📍 Admin Center' : '📍 Detect My Location'}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={loadData}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: '1rem' }}>
            <span className="alert-mark">!</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Filter Controls Bar ──────────────────────────────── */}
        <div style={{
          background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
          padding: '0.75rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem',
          alignItems: 'center', marginBottom: '1.25rem', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
            Layers & Filters:
          </span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#16a34a' }}>
            <input
              type="checkbox"
              checked={showShelters}
              onChange={(e) => setShowShelters(e.target.checked)}
              style={{ accentColor: '#16a34a', width: 16, height: 16 }}
            />
            🏠 Shelters ({displayedShelters.length})
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>
            <input
              type="checkbox"
              checked={showActiveSos}
              onChange={(e) => setShowActiveSos(e.target.checked)}
              style={{ accentColor: '#dc2626', width: 16, height: 16 }}
            />
            🚨 Active SOS ({requests.filter((r) => r.status !== 'fulfilled' && r.status !== 'cancelled').length})
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#ea580c' }}>
            <input
              type="checkbox"
              checked={showAlerts}
              onChange={(e) => setShowAlerts(e.target.checked)}
              style={{ accentColor: '#ea580c', width: 16, height: 16 }}
            />
            ⚠️ Unresolved Alerts ({unresolved.length})
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
            <input
              type="checkbox"
              checked={showResolvedSos}
              onChange={(e) => setShowResolvedSos(e.target.checked)}
              style={{ accentColor: '#64748b', width: 16, height: 16 }}
            />
            ✓ Resolved SOS ({requests.filter((r) => r.status === 'fulfilled').length})
          </label>
        </div>

        {/* ── Main Map & Inspector Grid ────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Map View */}
          <div>
            {loading ? (
              <div className="spinner-wrap" style={{ height: 520 }}><div className="spinner" /></div>
            ) : (
              <MapView
                height="540px"
                center={mapCenter}
                zoom={11}
                currentLocation={adminLoc ? { lat: adminLoc[0], lng: adminLoc[1], label: 'Admin Station' } : null}
                shelters={displayedShelters}
                requests={displayedRequests}
                emergencyAlerts={displayedAlerts}
                selectedId={selectedEntity?.data?.shelter_id || selectedEntity?.data?.request_id}
                onSelectShelter={handleSelectShelter}
                onSelectRequest={handleSelectRequest}
                routeCoordinates={routeCoords}
                routeInfo={routeInfo}
              />
            )}
          </div>

          {/* Inspector Panel */}
          <div className="panel" style={{ maxHeight: '540px', overflowY: 'auto' }}>
            <div className="panel-header">
              <h2 className="panel-title">
                {selectedEntity ? (selectedEntity.type === 'shelter' ? '🏠 Shelter Inspector' : '🚨 Incident Inspector') : 'Incident & Facility Feed'}
              </h2>
            </div>

            {selectedEntity ? (
              <div style={{ padding: '1rem' }}>
                {selectedEntity.type === 'shelter' ? (
                  // Shelter Detail View
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#0f172a' }}>
                        {selectedEntity.data.shelter_name || selectedEntity.data.name}
                      </h3>
                      <span className={`badge ${selectedEntity.data.is_verified ? 'badge--verified' : 'badge--unverified'}`}>
                        {selectedEntity.data.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                      {selectedEntity.data.address || `GPS: ${selectedEntity.data.latitude}, ${selectedEntity.data.longitude}`}
                    </div>

                    <div style={{
                      margin: '12px 0', padding: '10px', background: '#f8fafc',
                      borderRadius: '8px', border: '1px solid #e2e8f0',
                      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Occupancy</span>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                          {selectedEntity.data.current_occupancy || 0} / {selectedEntity.data.total_capacity || 0}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Available</span>
                        <div style={{
                          fontWeight: 800, fontSize: '1.1rem',
                          color: ((selectedEntity.data.total_capacity || 0) - (selectedEntity.data.current_occupancy || 0)) > 0 ? '#16a34a' : '#dc2626'
                        }}>
                          {Math.max(0, (selectedEntity.data.total_capacity || 0) - (selectedEntity.data.current_occupancy || 0))} beds
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '8px' }}>
                      <strong>Services:</strong> {selectedEntity.data.accepted_types || selectedEntity.data.facilities || 'General Shelter'}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '8px' }}>
                      <strong>Manager:</strong> {selectedEntity.data.name} {selectedEntity.data.phone ? `(${selectedEntity.data.phone})` : ''}
                    </div>

                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '14px' }}>
                      Last Updated: {selectedEntity.data.updated_at ? new Date(selectedEntity.data.updated_at).toLocaleString('en-IN') : 'N/A'}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => navigate('/admin/shelters')}
                        style={{ flex: 1 }}
                      >
                        Manage Shelter
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setSelectedEntity(null)}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  // SOS Request Detail View
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{
                        background: PRIORITY_COLORS[selectedEntity.data.priority] || '#dc2626',
                        color: '#ffffff', padding: '2px 8px', borderRadius: '4px',
                        fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase'
                      }}>
                        {selectedEntity.data.priority} SOS #{selectedEntity.data.request_id}
                      </span>
                      <span className="badge badge--assigned" style={{ textTransform: 'capitalize' }}>
                        {selectedEntity.data.status}
                      </span>
                    </div>

                    <h3 style={{ margin: '8px 0 4px', fontSize: '1.05rem', color: '#0f172a' }}>
                      {selectedEntity.data.title}
                    </h3>

                    {selectedEntity.data.address && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        📍 {selectedEntity.data.address}
                      </div>
                    )}

                    <div style={{
                      margin: '12px 0', padding: '10px', background: '#f8fafc',
                      borderRadius: '8px', border: '1px solid #e2e8f0',
                      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>People Affected</span>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                          {selectedEntity.data.people_count || 1}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Score</span>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#b91c1c' }}>
                          {selectedEntity.data.priority_score ?? 'Auto'}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '8px' }}>
                      <strong>Needs:</strong> {selectedEntity.data.needs || 'General relief'}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '8px' }}>
                      <strong>Victim:</strong> {selectedEntity.data.victim_name} {selectedEntity.data.victim_phone ? `(${selectedEntity.data.victim_phone})` : ''}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '10px' }}>
                      <strong>Assigned Shelter:</strong> {selectedEntity.data.current_shelter || 'Pending assignment'}
                    </div>

                    {selectedEntity.data.description && (
                      <p style={{ fontSize: '0.8rem', color: '#64748b', background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                        "{selectedEntity.data.description}"
                      </p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
                      {selectedEntity.data.shelter_latitude && selectedEntity.data.latitude && (
                        <button
                          type="button"
                          className="btn btn--sm"
                          style={{
                            background: '#2563eb', color: '#fff', border: 'none',
                            fontWeight: 700, padding: '7px 12px'
                          }}
                          disabled={routingLoading}
                          onClick={() => handleRouteToVictim(selectedEntity.data)}
                        >
                          {routingLoading ? 'Calculating Road Route...' : '🚗 Show Road Route to Shelter'}
                        </button>
                      )}

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          style={{ flex: 1 }}
                          onClick={() => navigate('/admin/requests')}
                        >
                          View In Requests Table
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setSelectedEntity(null)}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Default List
              <div>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6', background: '#f8fafc', fontSize: '0.78rem', color: '#64748b' }}>
                  Click any marker on the map or item below to inspect and calculate road routes.
                </div>

                {displayedRequests.slice(0, 15).map((r) => (
                  <div
                    key={`feed-${r.request_id}`}
                    onClick={() => handleSelectRequest(r)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        background: PRIORITY_COLORS[r.priority] || '#dc2626',
                        color: '#fff', padding: '1px 6px', borderRadius: '3px',
                        fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase'
                      }}>
                        {r.priority}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem', marginTop: '4px' }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      {r.people_count || 1} people · {r.needs || 'Relief'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDisasterMap;
