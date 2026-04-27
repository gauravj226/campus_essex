import { findNearestLandmark as findNearest, haversineDistanceMeters } from './navigation-utils.js';

const LANDMARK_DATA_URL = 'data/landmarks.colchester.json';
let cachedLandmarks = null;

export async function loadLandmarks() {
  if (cachedLandmarks) return cachedLandmarks;

  try {
    const response = await fetch(LANDMARK_DATA_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Landmark load failed: ${response.status}`);

    const data = await response.json();
    cachedLandmarks = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to load landmarks:', error);
    cachedLandmarks = [];
  }

  return cachedLandmarks;
}

export function getLandmarks() {
  return cachedLandmarks || [];
}

export function resetLandmarkCache() {
  cachedLandmarks = null;
}

export function findNearestLandmark(point, options = {}) {
  const landmarks = getLandmarks();
  return findNearest(point, landmarks, options);
}

export function findNearbyLandmarks(point, options = {}) {
  const landmarks = getLandmarks();
  const maxDistanceMeters = options.maxDistanceMeters ?? 30;
  const floor = options.floor;

  return landmarks
    .map(landmark => ({
      landmark,
      distanceMeters: haversineDistanceMeters(point, landmark.coordinates)
    }))
    .filter(item => {
      if (item.distanceMeters > maxDistanceMeters) return false;
      if (Number.isFinite(floor) && Number.isFinite(item.landmark.floor) && item.landmark.floor !== floor) return false;
      return true;
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

