import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchShelterProfile, saveShelterProfile } from '../../api/axios';
import Layout from '../../components/Layout';
import MapView from '../../components/MapView';
import '../../styles/layout.css';

const RESOURCE_TYPES = ['food', 'water', 'medicine', 'shelter', 'clothing'];

const ShelterSetup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    shelter_name: '', address: '', latitude: '', longitude: '',
    total_capacity: '', accepted_types: ['shelter'],
  });
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [locating, setLocating]         = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [gpsAccuracy, setGpsAccuracy]   = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchShelterProfile()
      .then((r) => {
        const p = r.data.data.profile;
        if (p) {
          const lat = p.latitude ? parseFloat(p.latitude) : '';
          const lng = p.longitude ? parseFloat(p.longitude) : '';
          setForm({
            shelter_name:   p.shelter_name || '',
            address:        p.address || '',
            latitude:       lat,
            longitude:      lng,
            total_capacity: p.total_capacity || '',
            accepted_types: (p.accepted_types || 'shelter').split(',').map((s) => s.trim()),
          });
          if (lat && lng) setLocationConfirmed(true);
        }
      })
      .catch(() => { /* New profile — start fresh */ })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const toggleType = (t) => {
    setForm((f) => ({
      ...f,
      accepted_types: f.accepted_types.includes(t)
        ? f.accepted_types.filter((x) => x !== t)
        : [...f.accepted_types, t],
    }));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
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
            setError('Location permission denied. Please allow access in your browser location settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('GPS position is currently unavailable from your device.');
            break;
          case err.TIMEOUT:
            setError('GPS request timed out. Please try again.');
            break;
          default:
            setError('Could not detect shelter location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMarkerDragEnd = (newCoords) => {
    setForm((f) => ({
      ...f,
      latitude:  newCoords.lat,
      longitude: newCoords.lng,
    }));
    setLocationConfirmed(false); // require confirming adjusted location
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);

    if (!form.shelter_name.trim()) return setError('Shelter name is required.');
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return setError('Valid GPS coordinates are required. Use "Detect My Location" or adjust the map pin.');
    }
    if (!locationConfirmed) {
      return setError('Please click "Confirm Shelter Location" after moving the pin.');
    }

    setSaving(true);
    try {
      await saveShelterProfile({
        shelter_name:   form.shelter_name,
        address:        form.address,
        latitude:       lat,
        longitude:      lng,
        total_capacity: parseInt(form.total_capacity) || 50,
        accepted_types: form.accepted_types,
      });
      setSuccess('Shelter profile saved. Database coordinates registered for disaster dispatch.');
      setTimeout(() => navigate('/shelter/dashboard'), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save shelter profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><div className="spinner-wrap"><div className="spinner" /></div></Layout>;

  const hasCoords = form.latitude !== '' && form.longitude !== '';
  const mapCenter = hasCoords ? [parseFloat(form.latitude), parseFloat(form.longitude)] : [20.5937, 78.9629];

  return (
    <Layout>
      <div className="animate-up" style={{ maxWidth: 840, margin: '0 auto' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Shelter Profile & Location Setup</h1>
            <p className="page-subtitle">
              Register your physical facility coordinates on OpenStreetMap so emergency requests can be routed to you.
            </p>
          </div>
        </div>

        {error   && <div className="alert alert--error"><span className="alert-mark">!</span> {error}</div>}
        {success && <div className="alert alert--success"><span className="alert-mark">✓</span> {success}</div>}

        <div className="panel">
          <div className="panel-header"><h2 className="panel-title">Facility Details</h2></div>
          <div className="panel-body">
            <form onSubmit={handleSubmit}>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Shelter / Organization Name *</label>
                  <input
                    className="form-input"
                    name="shelter_name"
                    value={form.shelter_name}
                    onChange={handleChange}
                    placeholder="e.g. Central City Community Shelter"
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Total Bed Capacity *</label>
                  <input
                    className="form-input"
                    type="number"
                    name="total_capacity"
                    value={form.total_capacity}
                    onChange={handleChange}
                    min="1"
                    placeholder="e.g. 150"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Postal / Street Address</label>
                <input
                  className="form-input"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Street name, landmark, postal district"
                />
              </div>

              {/* ── Real Map Location Setup ──────────────────────────── */}
              <div className="form-field" style={{ marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem' }}>
                    Shelter GPS Coordinates (Source of Truth) *
                  </label>
                  {locationConfirmed && (
                    <span style={{
                      background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700
                    }}>
                      ✓ Location Confirmed
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  Responders and victims rely on exact GPS coordinates for road routing. Use the detector and adjust the pin to your entrance.
                </p>

                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={handleDetectLocation}
                    disabled={locating}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {locating ? 'Acquiring GPS Signal...' : hasCoords ? '📡 Re-detect Location' : '📍 Detect My Location'}
                  </button>

                  {hasCoords && !locationConfirmed && (
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => setLocationConfirmed(true)}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700 }}
                    >
                      ✓ Confirm Shelter Location
                    </button>
                  )}
                </div>

                {hasCoords ? (
                  <div>
                    <div style={{
                      background: '#fffbeb', border: '1px solid #fde68a',
                      borderRadius: '6px', padding: '6px 10px', fontSize: '0.76rem',
                      color: '#92400e', marginBottom: '6px'
                    }}>
                      📍 <strong>Pinpoint facility:</strong> Drag the red pin directly onto your shelter facility or main gate.
                    </div>

                    <MapView
                      height="360px"
                      center={mapCenter}
                      zoom={15}
                      draggableMarker={{
                        position: mapCenter,
                        onDragEnd: handleMarkerDragEnd,
                      }}
                    />

                    <div style={{
                      marginTop: '6px', display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.75rem', color: '#64748b'
                    }}>
                      <span>
                        Latitude: <strong>{form.latitude}</strong> &nbsp;|&nbsp; Longitude: <strong>{form.longitude}</strong>
                        {gpsAccuracy && ` (~${gpsAccuracy}m precision)`}
                      </span>
                      {!locationConfirmed ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Unconfirmed pin — click confirm</span>
                      ) : (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Location verified</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    height: '180px', borderRadius: '0.75rem', border: '2px dashed #cbd5e1',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', background: '#f8fafc', padding: '1rem', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '4px' }}>🗺️</div>
                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.9rem' }}>OpenStreetMap Coordinate Registration</div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', maxWidth: '360px', marginTop: '3px' }}>
                      Click <strong>"Detect My Location"</strong> to place your shelter on the interactive map.
                    </div>
                  </div>
                )}
              </div>

              {/* Resource Categories */}
              <div className="form-field" style={{ marginTop: '1.25rem' }}>
                <label className="form-label">Available Relief Services & Facilities</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.25rem' }}>
                  {RESOURCE_TYPES.map((t) => {
                    const active = form.accepted_types.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleType(t)}
                        style={{
                          padding: '0.45rem 1rem',
                          borderRadius: '100px',
                          border: `2px solid ${active ? '#EF3333' : '#e5e7eb'}`,
                          background: active ? '#fff0f0' : '#f9fafb',
                          color: active ? '#EF3333' : '#6b7280',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'all 0.15s',
                          textTransform: 'capitalize',
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--lg"
                disabled={saving || !hasCoords}
                style={{ width: '100%', marginTop: '1.5rem', fontWeight: 700 }}
              >
                {saving ? 'Saving Shelter Profile...' : 'Save & Register Shelter Location'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ShelterSetup;
