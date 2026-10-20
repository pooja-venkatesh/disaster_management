/**
 * routingService.js
 * Modular road routing provider using OpenStreetMap / OSRM API.
 * 
 * Fetches actual road network geometry, distance, and duration between two GPS points.
 * Leaflet-compatible [latitude, longitude] output.
 */

// Simple in-memory cache to prevent duplicate OSRM requests
const routeCache = new Map();

/**
 * Format duration in seconds to a human-readable string (e.g., "14 mins" or "1 hr 25 mins")
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0 min';
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) return `${totalMins} min${totalMins === 1 ? '' : 's'}`;
  const hours = Math.floor(totalMins / 60);
  const mins  = totalMins % 60;
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
};

/**
 * Format distance in meters to kilometers (e.g., "3.4 km")
 */
export const formatDistance = (meters) => {
  if (!meters || meters <= 0) return '0.0 km';
  return `${(meters / 1000).toFixed(1)} km`;
};

/**
 * Request real road route from start to destination using OSRM
 * 
 * @param {{ lat: number, lng: number } | [number, number]} origin - [lat, lng] or {lat, lng}
 * @param {{ lat: number, lng: number } | [number, number]} destination - [lat, lng] or {lat, lng}
 * @returns {Promise<{
 *   success: boolean,
 *   coordinates: Array<[number, number]>, // Leaflet [lat, lng] pairs
 *   distanceMeters: number,
 *   distanceFormatted: string,
 *   durationSeconds: number,
 *   durationFormatted: string,
 *   isRoadRoute: boolean,
 *   summary?: string,
 *   error?: string
 * }>}
 */
export const getRoadRoute = async (origin, destination) => {
  const startLat = parseFloat(Array.isArray(origin) ? origin[0] : origin?.lat ?? origin?.latitude);
  const startLng = parseFloat(Array.isArray(origin) ? origin[1] : origin?.lng ?? origin?.longitude);
  const endLat   = parseFloat(Array.isArray(destination) ? destination[0] : destination?.lat ?? destination?.latitude);
  const endLng   = parseFloat(Array.isArray(destination) ? destination[1] : destination?.lng ?? destination?.longitude);

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
    return {
      success: false,
      coordinates: [],
      error: 'Invalid coordinates provided for route calculation.',
      isRoadRoute: false,
    };
  }

  const cacheKey = `${startLat.toFixed(5)},${startLng.toFixed(5)};${endLat.toFixed(5)},${endLng.toFixed(5)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  // OSRM coordinates format: longitude,latitude;longitude,latitude
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      // GeoJSON coordinates are [longitude, latitude], Leaflet needs [latitude, longitude]
      const leafLatLongs = primaryRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      const result = {
        success: true,
        coordinates: leafLatLongs,
        distanceMeters: primaryRoute.distance,
        distanceFormatted: formatDistance(primaryRoute.distance),
        durationSeconds: primaryRoute.duration,
        durationFormatted: formatDuration(primaryRoute.duration),
        summary: primaryRoute.legs?.[0]?.summary || 'Road Route',
        isRoadRoute: true,
      };

      routeCache.set(cacheKey, result);
      return result;
    } else {
      throw new Error(data.message || 'No road route found between points');
    }
  } catch (err) {
    console.warn('OSRM road routing fallback:', err.message);
    // Graceful fallback: return direct straight connection so map doesn't crash
    const directLine = [
      [startLat, startLng],
      [endLat, endLng],
    ];

    return {
      success: true,
      coordinates: directLine,
      distanceMeters: 0,
      distanceFormatted: 'Direct Line',
      durationSeconds: 0,
      durationFormatted: 'N/A',
      isRoadRoute: false,
      warning: 'Road network routing currently unavailable. Displaying direct path.',
    };
  }
};
