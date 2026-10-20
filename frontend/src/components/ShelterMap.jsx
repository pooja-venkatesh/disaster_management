import MapView from './MapView';

/**
 * ShelterMap backward-compatibility wrapper that delegates to the new reusable MapView
 */
const ShelterMap = ({
  height = '380px',
  center = [20.5937, 78.9629],
  zoom = 12,
  victimPos = null,
  shelters = [],
  selectedId = null,
  routeCoordinates = null,
  routeInfo = null,
}) => {
  return (
    <MapView
      height={height}
      center={center}
      zoom={zoom}
      currentLocation={victimPos ? { lat: victimPos[0], lng: victimPos[1], label: 'Your Location' } : null}
      shelters={shelters}
      selectedId={selectedId}
      routeCoordinates={routeCoordinates}
      routeInfo={routeInfo}
    />
  );
};

export default ShelterMap;
