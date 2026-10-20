import L from 'leaflet';

/**
 * Custom SVG DivIcons for Leaflet
 * Crisp, responsive, high-DPI compatible and independent of external image CDNs.
 */

// 1. Current User / Admin GPS Location Icon
export const createUserLocationIcon = (label = 'You') => L.divIcon({
  className: 'custom-map-icon user-location-marker',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
      <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(37, 99, 235, 0.25); animation: pulse-ring 2s infinite ease-out;"></div>
      <div style="width: 20px; height: 20px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
      </div>
      ${label ? `<span style="position: absolute; top: 38px; white-space: nowrap; background: #1e293b; color: #ffffff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${label}</span>` : ''}
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

// 2. Shelter Icon (Green / Emerald with House SVG)
export const createShelterIcon = ({ isVerified = true, isSelected = false } = {}) => L.divIcon({
  className: `custom-map-icon shelter-marker ${isSelected ? 'selected' : ''}`,
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
      <div style="
        width: ${isSelected ? '40px' : '34px'};
        height: ${isSelected ? '40px' : '34px'};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${isSelected ? '#b91c1c' : (isVerified ? '#059669' : '#d97706')};
        border: 2.5px solid #ffffff;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      ">
        <svg style="transform: rotate(45deg); width: 18px; height: 18px; fill: #ffffff;" viewBox="0 0 24 24">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </div>
      <div style="
        width: 10px; height: 4px;
        background: rgba(0,0,0,0.25);
        border-radius: 50%;
        margin-top: 2px;
      "></div>
    </div>
  `,
  iconSize: [36, 42],
  iconAnchor: [18, 42],
  popupAnchor: [0, -42],
});

// 3. Victim / SOS Emergency Icon (Crimson / Priority-coded with Warning/Exclamation SVG)
export const createSosIcon = ({ priority = 'critical', isSelected = false } = {}) => {
  const colorMap = {
    critical: '#dc2626', // Bright red
    high:     '#ea580c', // Dark orange
    medium:   '#ca8a04', // Amber/Yellow
    low:      '#16a34a', // Green
  };
  const color = colorMap[priority?.toLowerCase()] || '#dc2626';

  return L.divIcon({
    className: `custom-map-icon sos-marker ${isSelected ? 'selected' : ''}`,
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="
          width: ${isSelected ? '42px' : '36px'};
          height: ${isSelected ? '42px' : '36px'};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: ${color};
          border: 2.5px solid #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: ${priority === 'critical' ? 'sos-bounce 1.5s infinite ease-in-out' : 'none'};
        ">
          <svg style="transform: rotate(45deg); width: 20px; height: 20px; fill: #ffffff;" viewBox="0 0 24 24">
            <path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        </div>
        <div style="
          width: 10px; height: 4px;
          background: rgba(0,0,0,0.3);
          border-radius: 50%;
          margin-top: 2px;
        "></div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
};

// 4. Draggable Pin for Location Setup / Adjustment
export const createDraggablePinIcon = () => L.divIcon({
  className: 'custom-map-icon draggable-pin-marker',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
      <div style="
        background: #111827;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 20px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        white-space: nowrap;
        margin-bottom: 2px;
        border: 1px solid #374151;
      ">
        📍 Drag to adjust
      </div>
      <div style="
        width: 38px;
        height: 38px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: #ef4444;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 14px rgba(239,68,68,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="transform: rotate(45deg); width: 12px; height: 12px; border-radius: 50%; background: #ffffff;"></div>
      </div>
    </div>
  `,
  iconSize: [40, 68],
  iconAnchor: [20, 68],
  popupAnchor: [0, -68],
});

// 5. Emergency Alert / Buzzer Event Marker
export const createEmergencyBuzzerIcon = () => L.divIcon({
  className: 'custom-map-icon emergency-buzzer-marker',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #dc2626;
        border: 3px solid #ffffff;
        box-shadow: 0 0 16px rgba(220, 38, 38, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: buzzer-pulse 1s infinite alternate;
      ">
        <svg style="width: 20px; height: 20px; fill: #ffffff;" viewBox="0 0 24 24">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});
