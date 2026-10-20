import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitRequest } from '../../api/axios';
import Layout from '../../components/Layout';
import MapView from '../../components/MapView';
import '../../styles/layout.css';

const NEEDS_OPTIONS = [
  { id: 'food',    label: 'Food',    icon: '🍱', desc: 'Food supplies needed' },
  { id: 'water',   label: 'Water',   icon: '💧', desc: 'Drinking water needed' },
  { id: 'medical', label: 'Medical', icon: '🏥', desc: 'Medical attention needed' },
  { id: 'rescue',  label: 'Rescue',  icon: '🚨', desc: 'Physical rescue required' },
  { id: 'shelter', label: 'Shelter', icon: '🏠', desc: 'Safe shelter needed' },
];

const YesNoToggle = ({ label, hint, value, onChange }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.85rem 1rem', background: value ? '#fff8f8' : '#fafafa',
    border: `1.5px solid ${value ? '#EF3333' : '#e4e6ea'}`,
    borderRadius: '0.6rem', transition: 'all 0.2s', marginBottom: '0.6rem',
  }}>
    <div>
      <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>{label}</div>
      {hint && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{hint}</div>}
    </div>
    <div style={{ display: 'flex', gap: '0.4rem' }}>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          padding: '0.3rem 0.9rem', borderRadius: '5px', border: 'none',
          background: value === true ? '#EF3333' : '#f3f4f6',
          color: value === true ? '#fff' : '#6b7280',
          fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s',
        }}
      >Yes</button>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          padding: '0.3rem 0.9rem', borderRadius: '5px', border: 'none',
          background: value === false ? '#374151' : '#f3f4f6',
          color: value === false ? '#fff' : '#6b7280',
          fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s',
        }}
      >No</button>
    </div>
  </div>
);

const NewRequest = () => {
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [locating, setLocating] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  const [form, setForm] = useState({
    title:            '',
    description:      '',
    people_count:     1,
    needs:            [],
    children_present: false,
    elderly_present:  false,
    injured:          false,
    urgent_medical:   false,
    latitude:         '',
    longitude:        '',
    address:          '',
  });

  const toggleNeed = (id) => {
    setForm((f) => ({
      ...f,
      needs: f.needs.includes(id) ? f.needs.filter((n) => n !== id) : [...f.needs, id],
    }));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Please use an updated modern browser.');
      return;
    }

    setLocating(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const acc = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;

        setForm((f) => ({
          ...f,
          latitude:  lat,
          longitude: lng,
        }));
        setGpsAccuracy(acc);
        setLocationConfirmed(true);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please enable location permissions in your browser bar.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location information is unavailable from your device. Please try moving to an area with clear reception.');
            break;
          case err.TIMEOUT:
            setError('Location request timed out. Please click "Detect My Location" again.');
            break;
          default:
            setError('Could not detect location. Please check browser settings.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleMarkerDragEnd = (newCoords) => {
    setForm((f) => ({
      ...f,
      latitude:  newCoords.lat,
      longitude: newCoords.lng,
    }));
    setLocationConfirmed(false); // prompt victim to confirm newly adjusted pin
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) return setError('Please describe your emergency briefly.');
    if (form.needs.length === 0) return setError('Please select at least one type of assistance needed.');
    if (!form.latitude || !form.longitude) {
      return setError('Real GPS coordinates are required. Please click "Detect My Location" above.');
    }
    if (!locationConfirmed) {
      return setError('Please click "Confirm Location" after adjusting your map pin.');
    }

    setLoading(true);
    try {
      const res = await submitRequest({
        title:            form.title,
        description:      form.description,
        latitude:         parseFloat(form.latitude),
        longitude:        parseFloat(form.longitude),
        address:          form.address,
        people_count:     form.people_count,
        needs:            form.needs,
        children_present: form.children_present,
        elderly_present:  form.elderly_present,
        injured:          form.injured,
        urgent_medical:   form.urgent_medical,
      });
      navigate(`/victim/requests/${res.data.data.request_id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasCoords = form.latitude !== '' && form.longitude !== '';
  const mapCenter = hasCoords ? [parseFloat(form.latitude), parseFloat(form.longitude)] : [20.5937, 78.9629];

  return (
    <Layout>
      <div className="animate-up" style={{ maxWidth: 740, margin: '0 auto' }}>
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title">New Emergency Request</h1>
            <p className="page-subtitle">Provide factual information. The system calculates priority and routes to the nearest verified shelter.</p>
          </div>
        </div>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: '1.25rem' }}>
            <span className="alert-mark">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── Section 1: Situation ─────────────────────────────── */}
          <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <div className="panel-header">
              <h2 className="panel-title">1. Situation Overview</h2>
            </div>
            <div className="panel-body">
              <div className="form-group">
                <label className="form-label">Brief Title *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Flooding in building, family trapped on 1st floor"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Detailed Description</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Describe current conditions, water level, power supply, specific dangers..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: People Count ──────────────────────────── */}
          <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <div className="panel-header">
              <h2 className="panel-title">2. Number of People Needing Assistance</h2>
            </div>
            <div className="panel-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, people_count: Math.max(1, f.people_count - 1) }))}
                  style={{
                    width: 44, height: 44, borderRadius: '8px', border: '1.5px solid #e4e6ea',
                    background: '#fff', fontSize: '1.3rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >−</button>
                <div style={{
                  fontSize: '2rem', fontWeight: 800, color: '#111827',
                  minWidth: 60, textAlign: 'center',
                }}>
                  {form.people_count}
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, people_count: f.people_count + 1 }))}
                  style={{
                    width: 44, height: 44, borderRadius: '8px', border: '1.5px solid #e4e6ea',
                    background: '#fff', fontSize: '1.3rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >+</button>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  {form.people_count === 1 ? 'person' : 'people'} in your party
                </span>
              </div>
            </div>
          </div>

          {/* ── Section 3: Assistance Categories ─────────────────── */}
          <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <div className="panel-header">
              <h2 className="panel-title">3. Required Assistance Categories *</h2>
            </div>
            <div className="panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {NEEDS_OPTIONS.map((opt) => {
                  const selected = form.needs.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => toggleNeed(opt.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.85rem 1rem', borderRadius: '0.6rem',
                        border: `1.5px solid ${selected ? '#EF3333' : '#e4e6ea'}`,
                        background: selected ? '#fff8f8' : '#fafafa',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '1.4rem' }}>{opt.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: selected ? '#EF3333' : '#111827' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{opt.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Section 4: Vulnerable Persons ────────────────────── */}
          <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <div className="panel-header">
              <h2 className="panel-title">4. Vulnerable Persons & Medical Situation</h2>
            </div>
            <div className="panel-body">
              <YesNoToggle
                label="Are there children present?"
                hint="Children under 12 years old"
                value={form.children_present}
                onChange={(v) => setForm({ ...form, children_present: v })}
              />
              <YesNoToggle
                label="Are there elderly persons present?"
                hint="Persons aged 65 or above"
                value={form.elderly_present}
                onChange={(v) => setForm({ ...form, elderly_present: v })}
              />
              <YesNoToggle
                label="Is anyone injured?"
                hint="Physical injuries requiring attention"
                value={form.injured}
                onChange={(v) => setForm({ ...form, injured: v })}
              />
              <YesNoToggle
                label="Is there an urgent medical requirement?"
                hint="Critical condition, unconscious, heart condition, severe bleeding etc."
                value={form.urgent_medical}
                onChange={(v) => setForm({ ...form, urgent_medical: v })}
              />
            </div>
          </div>

          {/* ── Section 5: Real GPS Map & Location ───────────────── */}
          <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="panel-title">5. Emergency GPS Location *</h2>
              {locationConfirmed && (
                <span style={{
                  background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                  padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 700,
                }}>
                  ✓ Location Confirmed
                </span>
              )}
            </div>
            <div className="panel-body">
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
                Responders need your real location to navigate to you. Click below to detect your current browser GPS coordinates.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleDetectLocation}
                  disabled={locating}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {locating ? '📡 Acquiring GPS Satellite Signal...' : hasCoords ? '📡 Re-detect GPS Location' : '📍 Detect My Location'}
                </button>

                {hasCoords && !locationConfirmed && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setLocationConfirmed(true)}
                    style={{ background: '#16a34a', color: '#ffffff', border: 'none', fontWeight: 700 }}
                  >
                    ✓ Confirm This Pin Location
                  </button>
                )}
              </div>

              {/* Real Interactive Leaflet OpenStreetMap */}
              <div style={{ marginBottom: '1rem' }}>
                {hasCoords ? (
                  <>
                    <div style={{
                      background: '#fffbeb', border: '1px solid #fde68a',
                      borderRadius: '6px', padding: '8px 12px', fontSize: '0.78rem',
                      color: '#92400e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                      <span>📍</span>
                      <span>
                        <strong>Your detected location:</strong> You can drag the red marker on the map if the GPS pin needs adjustment.
                      </span>
                    </div>

                    <MapView
                      height="380px"
                      center={mapCenter}
                      zoom={15}
                      draggableMarker={{
                        position: mapCenter,
                        onDragEnd: handleMarkerDragEnd,
                      }}
                    />

                    <div style={{
                      marginTop: '8px', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', fontSize: '0.76rem', color: '#64748b',
                    }}>
                      <span>
                        Latitude: <strong>{form.latitude}</strong> &nbsp;|&nbsp; Longitude: <strong>{form.longitude}</strong>
                        {gpsAccuracy && ` (Accuracy ~${gpsAccuracy}m)`}
                      </span>
                      {!locationConfirmed ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Pin moved — please confirm location</span>
                      ) : (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Ready for dispatch</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{
                    height: '220px', borderRadius: '0.75rem', border: '2px dashed #cbd5e1',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', background: '#f8fafc', padding: '1rem', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>🗺️</div>
                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.95rem' }}>Real OpenStreetMap GPS Detection</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', maxWidth: '380px', marginTop: '4px' }}>
                      Click <strong>"Detect My Location"</strong> to load your exact coordinates onto an interactive OpenStreetMap.
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Address / Landmark (optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Street name, floor, apartment number, or visible landmarks"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* ── System Info ──────────────────────────────────────── */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.6rem',
            padding: '0.85rem 1rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#475569',
          }}>
            <strong>Automatic Priority Dispatch:</strong> Priority is determined internally by our scoring algorithm based on vulnerable occupants, injury status, and assistance type. Victims do not manually set priority levels.
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || !hasCoords}
            style={{ width: '100%', padding: '0.95rem', fontSize: '1rem', fontWeight: 700 }}
          >
            {loading ? 'Submitting SOS Request...' : '🚨 Submit Emergency Request'}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default NewRequest;
