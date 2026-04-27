import { loadLandmarks, findNearestLandmark } from './landmarks.js';
import {
  bearingDegrees,
  cardinalDirectionFromBearing,
  classifyTurn,
  cumulativeDistanceMeters,
  distanceToPolylineMeters,
  estimateWalkTimeMinutes,
  haversineDistanceMeters,
  isOffRoute
} from './navigation-utils.js';

const ROUTE_SOURCE_ID = 'human-nav-route-source';
const UPCOMING_LAYER_ID = 'human-nav-route-upcoming';
const COMPLETED_LAYER_ID = 'human-nav-route-completed';

const DEFAULT_OFF_ROUTE_THRESHOLD_METERS = 15;
const WAYPOINT_REACHED_METERS = 8;
const WAYPOINT_APPROACH_METERS = 25;

export function createNavigationController(options) {
  return new NavigationController(options);
}

class NavigationController {
  constructor({ map, pathfinder, getAccessibilityMode, showToast, getCurrentUserLngLat }) {
    this.map = map;
    this.pathfinder = pathfinder;
    this.getAccessibilityMode = getAccessibilityMode;
    this.showToast = showToast;
    this.getCurrentUserLngLat = getCurrentUserLngLat;

    this.routePoints = [];
    this.destination = null;
    this.instructions = [];
    this.currentStepIndex = 0;
    this.isActive = false;
    this.lastRerouteAt = 0;
    this.pendingPrepStep = null;
    this.voiceEnabled = true;

    this.ui = this.bindUI();
    this.bindDeviceOrientation();
    this.attachControls();
  }

  bindUI() {
    return {
      panel: document.getElementById('navigation-panel'),
      current: document.getElementById('nav-current-instruction'),
      next: document.getElementById('nav-next-instruction'),
      distance: document.getElementById('nav-distance'),
      time: document.getElementById('nav-time'),
      progressText: document.getElementById('nav-progress-text'),
      progressFill: document.getElementById('nav-progress-fill'),
      arrow: document.getElementById('nav-arrow'),
      compass: document.getElementById('nav-compass')
    };
  }

  attachControls() {
    document.getElementById('nav-next-btn')?.addEventListener('click', () => this.advanceInstruction(true));
    document.getElementById('nav-prev-btn')?.addEventListener('click', () => this.goBackInstruction());
    document.getElementById('nav-stop-btn')?.addEventListener('click', () => this.stopNavigation(true));
    document.getElementById('nav-mute-btn')?.addEventListener('click', (event) => {
      this.voiceEnabled = !this.voiceEnabled;
      event.currentTarget.textContent = this.voiceEnabled ? 'Mute' : 'Unmute';
      this.showToast(this.voiceEnabled ? 'Voice guidance enabled' : 'Voice guidance muted', 'info', 1800);
    });
  }

  bindDeviceOrientation() {
    window.addEventListener('deviceorientationabsolute', (event) => {
      if (!this.isActive || !Number.isFinite(event.alpha)) return;
      const heading = 360 - event.alpha;
      this.updateCompass(heading);
    });

    window.addEventListener('deviceorientation', (event) => {
      if (!this.isActive || !Number.isFinite(event.alpha)) return;
      const heading = 360 - event.alpha;
      this.updateCompass(heading);
    });
  }

  async startNavigationToPoi({ poi, destinationName }) {
    const destination = this.extractPoiLngLat(poi);
    if (!destination) {
      this.showToast('Destination coordinates unavailable for navigation', 'error');
      return false;
    }

    const userPos = this.getCurrentUserLngLat?.();
    if (!userPos) {
      this.showToast('Waiting for your location before starting navigation', 'info');
      return false;
    }

    await loadLandmarks();

    const routePoints = await this.calculateRoute(userPos, destination);
    if (!routePoints.length) {
      this.showToast('Could not calculate an indoor route. Falling back to map directions.', 'error');
      return false;
    }

    this.destination = {
      name: destinationName || poi?.properties?.title || 'Destination',
      lngLat: destination,
      poi
    };

    this.routePoints = routePoints;
    this.instructions = this.buildHumanizedInstructions(routePoints, this.destination.name);
    this.currentStepIndex = 0;
    this.pendingPrepStep = null;
    this.isActive = true;

    this.ensureRouteLayers();
    this.renderRoute();
    this.renderInstructionPanel();

    this.ui.panel?.classList.add('active');
    this.speakInstruction(this.instructions[0]?.text);
    this.showToast(`Turn-by-turn navigation started to ${this.destination.name}`, 'success');

    return true;
  }

  async calculateRoute(fromLngLat, toLngLat) {
    if (!this.pathfinder) return [];

    const accessible = Boolean(this.getAccessibilityMode?.());

    const candidates = [
      () => this.pathfinder.getRoute({ from: fromLngLat, to: toLngLat, accessible }),
      () => this.pathfinder.getRoute(fromLngLat, toLngLat, { accessible }),
      () => this.pathfinder.findPath(fromLngLat, toLngLat, { accessible }),
      () => this.pathfinder.route({ from: fromLngLat, to: toLngLat, accessible })
    ];

    for (const resolver of candidates) {
      try {
        const rawRoute = await resolver();
        const normalized = normalizeRoutePoints(rawRoute);
        if (normalized.length > 1) return normalized;
      } catch (error) {
        // Try next method signature.
      }
    }

    return [];
  }

  buildHumanizedInstructions(routePoints, destinationName) {
    if (!Array.isArray(routePoints) || routePoints.length < 2) return [];

    const decisionPoints = pickDecisionPoints(routePoints);
    const instructions = [];

    for (let i = 0; i < decisionPoints.length; i++) {
      const current = decisionPoints[i];
      const next = decisionPoints[i + 1];
      const previous = decisionPoints[i - 1];
      const segmentDistance = next ? cumulativeDistanceMeters([current, next]) : 0;
      const nearest = findNearestLandmark(current, { maxDistanceMeters: 20 });
      const turnType = previous && next ? classifyTurn(turnDelta(previous, current, next)) : (i === 0 ? 'straight' : 'arrive');

      const text = this.composeInstructionText({
        index: i,
        total: decisionPoints.length,
        current,
        next,
        segmentDistance,
        nearest,
        turnType,
        destinationName
      });

      instructions.push({
        index: i,
        point: current,
        text,
        turnType,
        segmentDistance,
        etaMinutes: estimateWalkTimeMinutes(segmentDistance),
        landmark: nearest?.landmark || null
      });
    }

    return instructions;
  }

  composeInstructionText(context) {
    const { index, total, next, segmentDistance, nearest, turnType, destinationName } = context;

    if (index === total - 1) {
      const cue = nearest?.landmark?.visualCues?.[0];
      if (cue) return `You have arrived. ${destinationName} is here, look for ${cue}.`;
      return `You have arrived at ${destinationName}.`;
    }

    const landmarkName = nearest?.landmark?.name;
    const cue = nearest?.landmark?.visualCues?.[0];
    const meters = Math.max(5, Math.round(segmentDistance));

    if (index === 0) {
      const bearing = next ? bearingDegrees(context.current, next) : 0;
      const heading = cardinalDirectionFromBearing(bearing);
      if (landmarkName) {
        return `Head ${heading} towards ${landmarkName}. Continue for about ${meters} meters.`;
      }
      return `Head ${heading} and continue for about ${meters} meters.`;
    }

    if (turnType === 'left' || turnType === 'slight-left') {
      return cue
        ? `Turn left when you see ${cue}. Continue for about ${meters} meters.`
        : `Turn left and continue for about ${meters} meters.`;
    }

    if (turnType === 'right' || turnType === 'slight-right') {
      return cue
        ? `Turn right when you see ${cue}. Continue for about ${meters} meters.`
        : `Turn right and continue for about ${meters} meters.`;
    }

    if (turnType === 'u-turn') {
      return `Turn around and continue for about ${meters} meters.`;
    }

    if (landmarkName) {
      return `Continue past ${landmarkName} for about ${meters} meters.`;
    }

    return `Continue straight for about ${meters} meters.`;
  }

  onUserLocationUpdate({ lngLat, heading }) {
    if (!this.isActive || !Array.isArray(this.routePoints) || this.routePoints.length < 2) return;

    this.updateCompass(heading);
    this.updateArrowToNextPoint(lngLat, heading);

    this.evaluateProgress(lngLat);
    this.evaluateOffRoute(lngLat);
    this.renderRoute();
  }

  evaluateProgress(userLngLat) {
    const currentInstruction = this.instructions[this.currentStepIndex];
    if (!currentInstruction) return;

    const distanceToCurrent = haversineDistanceMeters(userLngLat, currentInstruction.point);

    if (distanceToCurrent <= WAYPOINT_REACHED_METERS && this.currentStepIndex < this.instructions.length - 1) {
      this.advanceInstruction(false);
      return;
    }

    const nextInstruction = this.instructions[Math.min(this.currentStepIndex + 1, this.instructions.length - 1)];
    if (!nextInstruction) return;

    const distanceToNext = haversineDistanceMeters(userLngLat, nextInstruction.point);
    if (distanceToNext <= WAYPOINT_APPROACH_METERS && this.pendingPrepStep !== nextInstruction.index) {
      this.pendingPrepStep = nextInstruction.index;
      this.speakInstruction(`Get ready: ${nextInstruction.text}`);
      this.vibrate([100, 50, 100]);
      this.showToast('Get ready for the next maneuver', 'info', 1600);
    }

    this.renderInstructionPanel(userLngLat);
  }

  evaluateOffRoute(userLngLat) {
    if (!this.routePoints.length) return;

    if (!isOffRoute(userLngLat, this.routePoints, DEFAULT_OFF_ROUTE_THRESHOLD_METERS)) return;

    const now = Date.now();
    if (now - this.lastRerouteAt < 12000) return;
    this.lastRerouteAt = now;

    this.showToast('Recalculating route...', 'info');
    this.rerouteFrom(userLngLat).catch(() => {
      this.showToast('Could not reroute automatically. Continue carefully.', 'error');
    });
  }

  async rerouteFrom(userLngLat) {
    if (!this.destination?.lngLat) return;

    const newRoute = await this.calculateRoute(userLngLat, this.destination.lngLat);
    if (!newRoute.length) return;

    this.routePoints = newRoute;
    this.instructions = this.buildHumanizedInstructions(newRoute, this.destination.name);
    this.currentStepIndex = 0;
    this.pendingPrepStep = null;

    this.renderRoute();
    this.renderInstructionPanel(userLngLat);
    this.speakInstruction(this.instructions[0]?.text);
  }

  advanceInstruction(isManual) {
    if (this.currentStepIndex >= this.instructions.length - 1) {
      this.stopNavigation(false);
      this.showToast(`Arrived at ${this.destination?.name || 'destination'}`, 'success');
      this.speakInstruction(`Arrived at ${this.destination?.name || 'your destination'}.`);
      this.vibrate([200, 80, 200]);
      return;
    }

    this.currentStepIndex += 1;
    this.pendingPrepStep = null;
    this.renderInstructionPanel();

    const current = this.instructions[this.currentStepIndex];
    this.speakInstruction(current?.text);

    if (isManual) {
      this.showToast(`Moved to step ${this.currentStepIndex + 1}`, 'info', 1400);
    }
  }

  goBackInstruction() {
    if (this.currentStepIndex === 0) return;
    this.currentStepIndex -= 1;
    this.pendingPrepStep = null;
    this.renderInstructionPanel();
    this.speakInstruction(this.instructions[this.currentStepIndex]?.text);
  }

  stopNavigation(manual = false) {
    this.isActive = false;
    this.routePoints = [];
    this.instructions = [];
    this.currentStepIndex = 0;
    this.pendingPrepStep = null;
    this.destination = null;

    this.ui.panel?.classList.remove('active');
    this.updateRouteSource([], []);

    if (manual) this.showToast('Navigation stopped', 'info', 1400);
  }

  renderInstructionPanel(userLngLat) {
    if (!this.ui.panel) return;

    const current = this.instructions[this.currentStepIndex];
    const next = this.instructions[this.currentStepIndex + 1];

    if (this.ui.current) this.ui.current.textContent = current?.text || 'No active instruction';
    if (this.ui.next) this.ui.next.textContent = next ? `Next: ${next.text}` : 'Next: Arrival';

    const remaining = this.computeRemainingDistance(userLngLat);
    if (this.ui.distance) this.ui.distance.textContent = `${Math.max(0, Math.round(remaining))}m`;
    if (this.ui.time) this.ui.time.textContent = `${estimateWalkTimeMinutes(remaining)} min`;

    if (this.ui.progressText) {
      const currentStep = Math.min(this.currentStepIndex + 1, Math.max(this.instructions.length, 1));
      const totalSteps = Math.max(this.instructions.length, 1);
      this.ui.progressText.textContent = `Step ${currentStep} of ${totalSteps}`;
    }

    if (this.ui.progressFill) {
      const ratio = this.instructions.length <= 1 ? 1 : this.currentStepIndex / (this.instructions.length - 1);
      this.ui.progressFill.style.width = `${Math.round(ratio * 100)}%`;
    }
  }

  computeRemainingDistance(userLngLat) {
    if (!this.routePoints.length) return 0;

    if (!Array.isArray(userLngLat)) return cumulativeDistanceMeters(this.routePoints.slice(this.closestRoutePointIndexForCurrentStep()));

    const nearestIndex = nearestRoutePointIndex(userLngLat, this.routePoints);
    const tailDistance = cumulativeDistanceMeters(this.routePoints.slice(nearestIndex));
    return tailDistance;
  }

  closestRoutePointIndexForCurrentStep() {
    if (!this.instructions.length || !this.routePoints.length) return 0;
    const target = this.instructions[this.currentStepIndex]?.point;
    if (!target) return 0;
    return nearestRoutePointIndex(target, this.routePoints);
  }

  updateArrowToNextPoint(userLngLat, heading) {
    if (!this.ui.arrow) return;

    const target = this.instructions[this.currentStepIndex + 1]?.point || this.destination?.lngLat;
    if (!target || !userLngLat) return;

    const distanceToTarget = haversineDistanceMeters(userLngLat, target);
    const bearingToTarget = bearingDegrees(userLngLat, target);
    const rotation = Number.isFinite(heading) ? bearingToTarget - heading : bearingToTarget;
    this.ui.arrow.style.transform = `rotate(${rotation}deg)`;

    if (distanceToTarget <= 10) {
      this.ui.arrow.style.background = '#d32f2f';
    } else if (distanceToTarget <= 25) {
      this.ui.arrow.style.background = '#f9a825';
    } else {
      this.ui.arrow.style.background = '#1e88e5';
    }
  }

  updateCompass(heading) {
    if (!this.ui.compass || !Number.isFinite(heading)) return;
    this.ui.compass.textContent = `${Math.round((heading + 360) % 360)}°`;
  }

  ensureRouteLayers() {
    if (!this.map) return;

    if (!this.map.getSource(ROUTE_SOURCE_ID)) {
      this.map.addSource(ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: { state: 'completed' }, geometry: { type: 'LineString', coordinates: [] } },
            { type: 'Feature', properties: { state: 'upcoming' }, geometry: { type: 'LineString', coordinates: [] } }
          ]
        }
      });
    }

    if (!this.map.getLayer(COMPLETED_LAYER_ID)) {
      this.map.addLayer({
        id: COMPLETED_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        filter: ['==', ['get', 'state'], 'completed'],
        paint: {
          'line-color': '#7f8c8d',
          'line-width': 5,
          'line-opacity': 0.8
        }
      });
    }

    if (!this.map.getLayer(UPCOMING_LAYER_ID)) {
      this.map.addLayer({
        id: UPCOMING_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        filter: ['==', ['get', 'state'], 'upcoming'],
        paint: {
          'line-color': '#1e88e5',
          'line-width': 6,
          'line-opacity': 0.9
        }
      });
    }
  }

  renderRoute() {
    if (!this.routePoints.length) {
      this.updateRouteSource([], []);
      return;
    }

    const splitIndex = this.closestRoutePointIndexForCurrentStep();
    const completed = this.routePoints.slice(0, splitIndex + 1);
    const upcoming = this.routePoints.slice(Math.max(0, splitIndex));
    this.updateRouteSource(completed, upcoming);
  }

  updateRouteSource(completedCoords, upcomingCoords) {
    const source = this.map?.getSource(ROUTE_SOURCE_ID);
    if (!source) return;

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { state: 'completed' },
          geometry: { type: 'LineString', coordinates: completedCoords }
        },
        {
          type: 'Feature',
          properties: { state: 'upcoming' },
          geometry: { type: 'LineString', coordinates: upcomingCoords }
        }
      ]
    });
  }

  speakInstruction(text) {
    if (!this.voiceEnabled || !text || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      // Silent fallback.
    }
  }

  vibrate(pattern) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  extractPoiLngLat(poi) {
    if (!poi) return null;

    try {
      const lngLat = window.Mazemap?.Util?.getPoiLngLat?.(poi);
      const normalized = normalizePoint(lngLat);
      if (normalized) return normalized;
    } catch (error) {
      // fall through to metadata coordinates.
    }

    const candidates = [
      poi?.geometry?.coordinates,
      poi?.properties?.coordinates,
      poi?.coordinates
    ];

    for (const candidate of candidates) {
      const normalized = normalizePoint(candidate);
      if (normalized) return normalized;
    }

    return null;
  }
}

function normalizeRoutePoints(rawRoute) {
  if (!rawRoute) return [];

  const directCandidates = [
    rawRoute?.path,
    rawRoute?.points,
    rawRoute?.waypoints,
    rawRoute?.geometry?.coordinates,
    rawRoute?.features?.[0]?.geometry?.coordinates
  ];

  for (const candidate of directCandidates) {
    if (!Array.isArray(candidate)) continue;

    const points = candidate
      .map(normalizePoint)
      .filter(Boolean);

    if (points.length > 1) return dedupeSequential(points);
  }

  return [];
}

function normalizePoint(pointLike) {
  if (!pointLike) return null;

  if (Array.isArray(pointLike) && pointLike.length >= 2) {
    const lng = Number(pointLike[0]);
    const lat = Number(pointLike[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }

  if (typeof pointLike === 'object') {
    const lng = Number(pointLike.lng ?? pointLike.lon ?? pointLike.longitude ?? pointLike[0]);
    const lat = Number(pointLike.lat ?? pointLike.latitude ?? pointLike[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }

  return null;
}

function dedupeSequential(points) {
  if (points.length <= 1) return points;
  const deduped = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const previous = deduped[deduped.length - 1];
    const current = points[i];
    if (previous[0] === current[0] && previous[1] === current[1]) continue;
    deduped.push(current);
  }

  return deduped;
}

function pickDecisionPoints(routePoints) {
  const points = [routePoints[0]];

  for (let i = 1; i < routePoints.length - 1; i++) {
    const prev = routePoints[i - 1];
    const curr = routePoints[i];
    const next = routePoints[i + 1];

    const delta = Math.abs(turnDelta(prev, curr, next));
    const distanceFromLast = haversineDistanceMeters(points[points.length - 1], curr);

    const shouldKeep = delta >= 22 || distanceFromLast >= 35;
    if (shouldKeep) points.push(curr);
  }

  points.push(routePoints[routePoints.length - 1]);
  return dedupeSequential(points);
}

function turnDelta(prev, curr, next) {
  const incoming = bearingDegrees(prev, curr);
  const outgoing = bearingDegrees(curr, next);
  let delta = outgoing - incoming;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function nearestRoutePointIndex(point, routePoints) {
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < routePoints.length; i++) {
    const d = haversineDistanceMeters(point, routePoints[i]);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function computeDistanceToRoute(point, routePoints) {
  return distanceToPolylineMeters(point, routePoints);
}

