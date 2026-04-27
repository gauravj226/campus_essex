const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_WALKING_SPEED_MPS = 1.4;

export function haversineDistanceMeters(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return Infinity;
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  if ([lng1, lat1, lng2, lat2].some(v => typeof v !== 'number' || Number.isNaN(v))) return Infinity;

  const phi1 = degreesToRadians(lat1);
  const phi2 = degreesToRadians(lat2);
  const deltaPhi = degreesToRadians(lat2 - lat1);
  const deltaLambda = degreesToRadians(lng2 - lng1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function estimateWalkTimeMinutes(distanceMeters, speedMps = DEFAULT_WALKING_SPEED_MPS) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  if (!Number.isFinite(speedMps) || speedMps <= 0) return 0;

  const seconds = distanceMeters / speedMps;
  return Math.max(1, Math.round(seconds / 60));
}

export function findNearestLandmark(point, landmarks, options = {}) {
  if (!Array.isArray(point) || !Array.isArray(landmarks) || landmarks.length === 0) return null;

  const maxDistanceMeters = options.maxDistanceMeters ?? 20;
  const floor = options.floor;

  let best = null;
  for (const landmark of landmarks) {
    if (!landmark?.coordinates) continue;
    if (Number.isFinite(floor) && Number.isFinite(landmark.floor) && landmark.floor !== floor) continue;

    const distanceMeters = haversineDistanceMeters(point, landmark.coordinates);
    if (distanceMeters > maxDistanceMeters) continue;

    if (!best || distanceMeters < best.distanceMeters) {
      best = { landmark, distanceMeters };
    }
  }

  return best;
}

export function cardinalDirectionFromBearing(bearingDegrees) {
  if (!Number.isFinite(bearingDegrees)) return 'ahead';
  const bearing = normalizeBearing(bearingDegrees);

  if (bearing >= 337.5 || bearing < 22.5) return 'north';
  if (bearing < 67.5) return 'north-east';
  if (bearing < 112.5) return 'east';
  if (bearing < 157.5) return 'south-east';
  if (bearing < 202.5) return 'south';
  if (bearing < 247.5) return 'south-west';
  if (bearing < 292.5) return 'west';
  return 'north-west';
}

export function classifyTurn(deltaBearingDegrees) {
  if (!Number.isFinite(deltaBearingDegrees)) return 'straight';

  const delta = normalizeDeltaBearing(deltaBearingDegrees);
  const absDelta = Math.abs(delta);

  if (absDelta < 15) return 'straight';
  if (absDelta < 45) return delta > 0 ? 'slight-right' : 'slight-left';
  if (absDelta < 135) return delta > 0 ? 'right' : 'left';
  return 'u-turn';
}

export function distanceToPolylineMeters(point, polyline) {
  if (!Array.isArray(point) || !Array.isArray(polyline) || polyline.length < 2) return Infinity;

  const [px, py] = toLocalXY(point, point);
  let best = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;

    const [ax, ay] = toLocalXY(point, a);
    const [bx, by] = toLocalXY(point, b);
    const d = pointToSegmentDistance(px, py, ax, ay, bx, by);
    if (d < best) best = d;
  }

  return best;
}

export function isOffRoute(point, polyline, thresholdMeters = 15) {
  return distanceToPolylineMeters(point, polyline) > thresholdMeters;
}

export function cumulativeDistanceMeters(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistanceMeters(points[i - 1], points[i]);
  }
  return total;
}

export function bearingDegrees(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return 0;
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;

  const phi1 = degreesToRadians(lat1);
  const phi2 = degreesToRadians(lat2);
  const lambda1 = degreesToRadians(lng1);
  const lambda2 = degreesToRadians(lng2);

  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);

  return normalizeBearing(radiansToDegrees(Math.atan2(y, x)));
}

function toLocalXY(originLngLat, pointLngLat) {
  const [olng, olat] = originLngLat;
  const [lng, lat] = pointLngLat;
  const meanLatRad = degreesToRadians((olat + lat) / 2);

  const x = degreesToRadians(lng - olng) * EARTH_RADIUS_METERS * Math.cos(meanLatRad);
  const y = degreesToRadians(lat - olat) * EARTH_RADIUS_METERS;
  return [x, y];
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const cx = ax + t * abx;
  const cy = ay + t * aby;

  return Math.hypot(px - cx, py - cy);
}

function normalizeBearing(bearingDegrees) {
  let b = bearingDegrees % 360;
  if (b < 0) b += 360;
  return b;
}

function normalizeDeltaBearing(deltaBearingDegrees) {
  let d = deltaBearingDegrees % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function radiansToDegrees(radians) {
  return radians * (180 / Math.PI);
}

