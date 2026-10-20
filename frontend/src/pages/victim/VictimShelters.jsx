import { useEffect, useState } from 'react';
import { fetchPublicShelters } from '../../api/axios';
import { getRoadRoute } from '../../services/routingService';
import Layout from '../../components/Layout';
import MapView from '../../components/MapView';
import '../../styles/layout.css';

const VictimShelters = () => {
  const [shelters, setShelters]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState(null);
  const [victimLocation, setVictimLocation] = useState(null);
  const [locating, setLocating]           = useState(false);
  const [routeCoords, setRouteCoords]     = useState(null);
  const [routeInfo, setRouteInfo]         = useState(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [mapCenter, setMapCenter]         = useState([20.5937, 78.9629]);
  const [error, setError]                 = useState('');

  // 1. Fetch real active verified shelters from backend
  useEffect(() => {
    fetchPublicShelters()
      .then((res) => {
        const list = res.data.data.shelters || [];
        setShelters(list);
        if (list.length > 0 && list[0].latitude && list[0].longitude) {
          setMapCenter([parseFloat(list[0].latitude), parseFloat(list[0].longitude)]);
        }
      })
      .catch((err) => {
        console.error('Failed to load registered shelters:', err);
        setError('Unable to load registered shelters right now.');
      })
      .finally(() => setLoading(false));
  }, []);

  // 2. Real browser GPS detection for victim
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [parseFloat(pos.coords.latitude.toFixed(6)), parseFloat(pos.coords.longitude.toFixed(6))];
        setVictimLocation(coords);
        setMapCenter(coords);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError('Could not acquire your GPS location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 3. Calculate road route between victim's current GPS location and selected shelter
  const handleCalculateRoute = async (shelter) => {
    setSelected(shelter);

    if (!victimLocation) {
      setError('Please click "Detect My Location" first so we can route from your current position.');
      return;
    }

    setRoutingLoading(true);
    setError('');

    try {
      const res = await getRoadRoute(
        victimLocation,
        [parseFloat(shelter.latitude), parseFloat(shelter.longitude)]
      );

      if (res.success) {
        setRouteCoords(res.coordinates);
        setRouteInfo({
          distanceFormatted: res.distanceFormatted,
          durationFormatted: res.durationFormatted,
          isRoadRoute: res.isRoadRoute,
          warning: res.warning,
        });
      } else {
        setError(res.error || 'Could not find road path to this shelter.');
      }
    } catch (e) {
      setError('Routing calculation failed.');
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleSelectShelter = (s) => {
    setSelected(s);
    if (s.latitude && s.longitude) {
      setMapCenter([parseFloat(s.latitude), parseFloat(s.longitude)]);
    }
  };

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Find Registered Shelters</h1>
            <p className="page-subtitle">
              Interactive map of verified disaster relief centers and emergency shelters near you.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleDetectLocation}
              disabled={locating}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {locating ? 'Acquiring GPS...' : victimLocation ? '📍 Location Updated' : '📍 Detect My Location'}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: '1.25rem' }}>
            <span className="alert-mark">!</span>
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Main Leaflet OpenStreetMap Map */}
          <div>
            {loading ? (
              <div className="spinner-wrap" style={{ height: 480 }}><div className="spinner" /></div>
            ) : (
              <MapView
                height="500px"
                center={mapCenter}
                zoom={12}
                currentLocation={victimLocation ? { lat: victimLocation[0], lng: victimLocation[1], label: 'You are here' } : null}
                shelters={shelters}
                selectedId={selected?.shelter_id}
                onSelectShelter={handleSelectShelter}
                routeCoordinates={routeCoords}
                routeInfo={routeInfo}
              />
            )}
          </div>

          {/* Shelters Sidebar List */}
          <div className="panel" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="panel-title">{shelters.length} Verified Shelters</h2>
            </div>

            {shelters.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-sub">No verified shelters found in the database.</div>
              </div>
            ) : (
              <div>
                {shelters.map((s) => {
                  const isSelected = selected?.shelter_id === s.shelter_id;
                  const availableCap = (s.total_capacity || s.capacity || 0) - (s.current_occupancy || s.occupancy || 0);

                  return (
                    <div
                      key={s.shelter_id}
                      onClick={() => handleSelectShelter(s)}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        background: isSelected ? '#fff8f8' : 'transparent',
                        borderLeft: isSelected ? '4px solid #EF3333' : '4px solid transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                          {s.shelter_name || s.name}
                        </div>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700,
                          color: availableCap > 0 ? '#16a34a' : '#dc2626',
                          background: availableCap > 0 ? '#f0fdf4' : '#fef2f2',
                          padding: '2px 6px', borderRadius: '4px'
                        }}>
                          {availableCap > 0 ? `${availableCap} free` : 'Full'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                        {s.address || `GPS: ${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)}`}
                      </div>

                      <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>
                        <strong>Facilities:</strong> {s.facilities || s.accepted_types || 'General shelter'}
                      </div>

                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn--sm"
                          style={{
                            background: '#2563eb', color: '#ffffff', border: 'none',
                            fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px',
                            fontWeight: 600, cursor: 'pointer',
                          }}
                          disabled={routingLoading}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCalculateRoute(s);
                          }}
                        >
                          {routingLoading && isSelected ? 'Routing...' : '🚗 Show Road Route'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Selected Shelter Details Panel */}
        {selected && (
          <div className="panel" style={{ marginTop: '1.5rem' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="panel-title">🏠 {selected.shelter_name || selected.name}</h2>
              <span className="badge badge--verified">Verified Active Shelter</span>
            </div>
            <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Address / Location</div>
                <div style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '2px' }}>{selected.address || 'GPS Location Registered'}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  {parseFloat(selected.latitude).toFixed(5)}, {parseFloat(selected.longitude).toFixed(5)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Capacity Status</div>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f172a', marginTop: '2px' }}>
                  {selected.current_occupancy ?? selected.occupancy ?? 0} / {selected.total_capacity ?? selected.capacity ?? 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                  {Math.max(0, (selected.total_capacity || selected.capacity || 0) - (selected.current_occupancy || selected.occupancy || 0))} beds currently available
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Accepted Resources</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '4px' }}>
                  {(selected.facilities || selected.accepted_types || 'shelter').split(',').map((f) => (
                    <span key={f} style={{
                      background: '#f1f5f9', color: '#334155', borderRadius: '4px',
                      padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase'
                    }}>
                      {f.trim()}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Contact</div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600, marginTop: '2px' }}>
                  {selected.phone || 'Emergency desk'}
                </div>
                {selected.email && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{selected.email}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default VictimShelters;
