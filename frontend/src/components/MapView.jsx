import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/map.css';
import {
  createUserLocationIcon,
  createShelterIcon,
  createSosIcon,
  createDraggablePinIcon,
  createEmergencyBuzzerIcon,
} from './mapIcons';

/**
 * Controller to handle programmatic center/zoom updates and fitBounds
 */
const MapController = ({ center, zoom, bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length > 1) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
      } catch (e) {
        // Fallback to center if bounds calculation failed
        if (center) map.setView(center, zoom || 13);
      }
    } else if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom || 13, { animate: true });
    }
  }, [map, center?.[0], center?.[1], zoom, bounds]);

  return null;
};

/**
 * Draggable Marker Component
 */
const DraggableMapPin = ({ position, onDragEnd }) => {
  const markerRef = useRef(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker != null && onDragEnd) {
        const { lat, lng } = marker.getLatLng();
        onDragEnd({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) });
      }
    },
  };

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={createDraggablePinIcon()}
    >
      <Popup className="custom-map-popup">
        <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.85rem' }}>Selected Location</div>
        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: '3px' }}>
          Lat: {position[0].toFixed(5)}, Lng: {position[1].toFixed(5)}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '4px', fontWeight: 600 }}>
          Drag marker to adjust exact coordinates
        </div>
      </Popup>
    </Marker>
  );
};

/**
 * Reusable MapView Component
 * Designed for Victim, Shelter, and Admin dashboards.
 */
const MapView = ({
  height = '460px',
  center = [20.5937, 78.9629],
  zoom = 12,
  currentLocation = null,         // [lat, lng] or { lat, lng, label }
  draggableMarker = null,         // { position: [lat, lng], onDragEnd: fn }
  shelters = [],                  // array of shelter objects
  requests = [],                  // array of SOS emergency_request objects
  emergencyAlerts = [],           // array of emergency buzzer events
  routeCoordinates = null,        // array of [lat, lng]
  routeInfo = null,               // { distanceFormatted, durationFormatted, isRoadRoute, warning }
  selectedId = null,
  onSelectShelter = null,
  onSelectRequest = null,
  onDetectLocation = null,        // Optional quick detect button in map toolbar
  customOverlay = null,
}) => {
  // Normalize current location
  const currentPos = currentLocation
    ? (Array.isArray(currentLocation) ? currentLocation : [currentLocation.lat, currentLocation.lng])
    : null;
  const currentLabel = currentLocation?.label || 'Your Location';

  // Compute bounding box if multiple entities exist
  let bounds = null;
  if (routeCoordinates && routeCoordinates.length > 1) {
    bounds = routeCoordinates;
  }

  return (
    <div className="map-panel" style={{ height }}>
      {/* Route Information Overlay */}
      {routeInfo && (
        <div className="map-route-indicator">
          <div>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', display: 'block', fontWeight: 700 }}>
              {routeInfo.isRoadRoute ? 'Road Route' : 'Direct Path'}
            </span>
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
              {routeInfo.distanceFormatted || '—'}
            </span>
          </div>
          {routeInfo.durationFormatted && (
            <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '12px' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', display: 'block', fontWeight: 700 }}>
                Est. Travel Time
              </span>
              <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '1rem' }}>
                {routeInfo.durationFormatted}
              </span>
            </div>
          )}
          {routeInfo.warning && (
            <span style={{ fontSize: '0.7rem', color: '#ea580c', maxWidth: '160px' }}>
              {routeInfo.warning}
            </span>
          )}
        </div>
      )}

      {/* Optional Map Quick Action Toolbar */}
      {onDetectLocation && (
        <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 1000 }}>
          <button
            type="button"
            className="map-control-btn"
            onClick={onDetectLocation}
            title="Detect GPS Location"
          >
            🎯 Detect My Location
          </button>
        </div>
      )}

      {customOverlay}

      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapController center={center} zoom={zoom} bounds={bounds} />

        {/* Current User / Admin GPS Location */}
        {currentPos && !isNaN(currentPos[0]) && !isNaN(currentPos[1]) && (
          <>
            <Marker position={currentPos} icon={createUserLocationIcon(currentLabel)}>
              <Popup className="custom-map-popup">
                <div style={{ fontWeight: 700, color: '#1e293b' }}>{currentLabel}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  GPS: {currentPos[0].toFixed(5)}, {currentPos[1].toFixed(5)}
                </div>
              </Popup>
            </Marker>
            <Circle
              center={currentPos}
              radius={800}
              pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1.5 }}
            />
          </>
        )}

        {/* Draggable Marker (for location selection/adjustment) */}
        {draggableMarker?.position && !isNaN(draggableMarker.position[0]) && (
          <DraggableMapPin
            position={draggableMarker.position}
            onDragEnd={draggableMarker.onDragEnd}
          />
        )}

        {/* Registered Shelters */}
        {shelters.map((s) => {
          const lat = parseFloat(s.latitude);
          const lng = parseFloat(s.longitude);
          if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

          const isSelected = selectedId === s.shelter_id;
          const availableCap = (s.total_capacity || s.capacity || 0) - (s.current_occupancy || s.occupancy || 0);

          return (
            <Marker
              key={`shelter-${s.shelter_id}`}
              position={[lat, lng]}
              icon={createShelterIcon({ isVerified: s.is_verified, isSelected })}
              eventHandlers={{
                click: () => onSelectShelter && onSelectShelter(s),
              }}
            >
              <Popup className="custom-map-popup">
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                  🏠 {s.shelter_name || s.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  {s.address || `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`}
                </div>
                <div style={{
                  display: 'flex', gap: '8px', margin: '8px 0 4px',
                  background: '#f1f5f9', padding: '6px 8px', borderRadius: '6px',
                  fontSize: '0.75rem'
                }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Occupancy</span>
                    <strong>{s.current_occupancy ?? s.occupancy ?? 0} / {s.total_capacity ?? s.capacity ?? 0}</strong>
                  </div>
                  <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Available</span>
                    <strong style={{ color: availableCap > 0 ? '#16a34a' : '#dc2626' }}>
                      {availableCap > 0 ? `${availableCap} spaces` : 'Full'}
                    </strong>
                  </div>
                </div>
                {(s.accepted_types || s.facilities) && (
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>
                    <strong>Facilities:</strong> {s.accepted_types || s.facilities}
                  </div>
                )}
                {s.phone && (
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>
                    <strong>Contact:</strong> {s.phone} {s.email ? `(${s.email})` : ''}
                  </div>
                )}
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700,
                    color: s.is_verified ? '#16a34a' : '#d97706',
                    background: s.is_verified ? '#f0fdf4' : '#fffbeb',
                    padding: '2px 6px', borderRadius: '4px', border: `1px solid ${s.is_verified ? '#bbf7d0' : '#fef08a'}`
                  }}>
                    {s.is_verified ? 'Verified Shelter' : 'Pending Verification'}
                  </span>
                  {onSelectShelter && (
                    <button
                      type="button"
                      style={{
                        background: '#2563eb', color: '#fff', border: 'none',
                        borderRadius: '4px', padding: '3px 8px', fontSize: '0.72rem',
                        cursor: 'pointer', fontWeight: 600
                      }}
                      onClick={() => onSelectShelter(s)}
                    >
                      Select
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* SOS Emergency Requests */}
        {requests.map((r) => {
          const lat = parseFloat(r.latitude);
          const lng = parseFloat(r.longitude);
          if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

          const isSelected = selectedId === r.request_id;
          const priority = r.priority || 'medium';

          return (
            <Marker
              key={`request-${r.request_id}`}
              position={[lat, lng]}
              icon={createSosIcon({ priority, isSelected })}
              eventHandlers={{
                click: () => onSelectRequest && onSelectRequest(r),
              }}
            >
              <Popup className="custom-map-popup">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{
                    textTransform: 'uppercase', fontWeight: 800, fontSize: '0.68rem',
                    padding: '2px 6px', borderRadius: '4px',
                    background: priority === 'critical' ? '#fee2e2' : '#fef3c7',
                    color: priority === 'critical' ? '#b91c1c' : '#b45309',
                    border: `1px solid ${priority === 'critical' ? '#fca5a5' : '#fde68a'}`
                  }}>
                    {priority} SOS
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>#{r.request_id}</span>
                </div>

                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginTop: '4px' }}>
                  {r.title || 'Emergency Assistance Request'}
                </div>

                {r.address && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    {r.address}
                  </div>
                )}

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px',
                  background: '#f8fafc', padding: '6px 8px', borderRadius: '6px',
                  margin: '6px 0', fontSize: '0.75rem'
                }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>People:</span>
                    <strong>{r.people_count || 1}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>Status:</span>
                    <strong style={{ textTransform: 'capitalize' }}>{r.status || 'pending'}</strong>
                  </div>
                </div>

                {r.needs && (
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>
                    <strong>Needs:</strong> {r.needs}
                  </div>
                )}

                {r.victim_name && (
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>
                    <strong>Victim:</strong> {r.victim_name} {r.victim_phone ? `(${r.victim_phone})` : ''}
                  </div>
                )}

                {onSelectRequest && (
                  <div style={{ marginTop: '8px', textAlign: 'right' }}>
                    <button
                      type="button"
                      style={{
                        background: '#dc2626', color: '#fff', border: 'none',
                        borderRadius: '4px', padding: '3px 8px', fontSize: '0.72rem',
                        cursor: 'pointer', fontWeight: 600
                      }}
                      onClick={() => onSelectRequest(r)}
                    >
                      View SOS Details
                    </button>
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}

        {/* Emergency Buzzer Events */}
        {emergencyAlerts.map((a, idx) => {
          const lat = parseFloat(a.latitude);
          const lng = parseFloat(a.longitude);
          if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

          return (
            <Marker
              key={`alert-${a.id || idx}`}
              position={[lat, lng]}
              icon={createEmergencyBuzzerIcon()}
            >
              <Popup className="custom-map-popup">
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.88rem' }}>
                  🚨 {a.title || 'Emergency Buzzer Alert'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '3px' }}>
                  {a.message || 'Critical situation reported at this location'}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Road Route Display */}
        {routeCoordinates && routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#2563eb',
              weight: 5,
              opacity: 0.85,
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapView;
