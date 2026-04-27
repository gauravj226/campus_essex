// Essex Campus Navigator - js/app.js
// Core map initialisation, search, routing, toast notifications

import { createNavigationController } from './navigation.js';

const CAMPUS_ID = 2195;
const MAZEMAP_SEARCH = 'https://api.mazemap.com/search/equery/';

let map = null;
let highlighter = null;
let pathfinder = null;
let accessibilityMode = false;
let searchMarkers = [];
let currentUserLngLat = null;
let currentUserHeading = null;
let navigationController = null;
let userMarker = null;
let catSprite = null;
let previousUserLngLat = null;
let previousLocationTimestamp = null;
let destinationPopup = null;
let activePreview = null;

window.showToast = function(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: 'OK', error: 'X', info: 'i' };
  toast.innerHTML = `<span>${icons[type] || 'i'}</span><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), duration);
};

export function showToast(msg, type = 'info', duration = 3500) {
  window.showToast(msg, type, duration);
}

export function getMap() {
  return map;
}

export function isAccessibilityMode() {
  return accessibilityMode;
}

export function setAccessibilityMode(value) {
  accessibilityMode = value;
}

export function getCurrentUserLngLat() {
  return currentUserLngLat;
}

function initMap() {
  if (typeof Mazemap === 'undefined') {
    console.error('MazeMap not loaded');
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.2rem;color:#666;">Map loading... please refresh if this persists.</div>';
    }
    return;
  }

  try {
    map = new Mazemap.Map({
      container: 'map',
      campuses: CAMPUS_ID,
      center: { lng: 0.9439, lat: 51.8767 },
      zoom: 16,
      zLevel: 1,
      bearing: 0,
      pitch: 0
    });

    map.addControl(new Mazemap.mapboxgl.NavigationControl());
    map.addControl(new Mazemap.mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true
    }));

    initLiveGpsTracking();

    map.on('load', () => {
      highlighter = new Mazemap.Highlighter(map, {
        showFill: true,
        showOutline: true,
        fillColor: '#FF6600',
        outlineColor: '#00467F'
      });

      pathfinder = new Mazemap.Pathfinder(map);
      ensureNavigationController();

      window.showToast('Campus map loaded! Search for any location.', 'success');
      console.log('Essex Navigator ready | Campus ID:', CAMPUS_ID);
    });

    map.on('click', handleMapClick);
  } catch (error) {
    console.error('Map init error:', error);
  }
}

function ensureNavigationController() {
  if (navigationController || !map || !pathfinder) return navigationController;

  navigationController = createNavigationController({
    map,
    pathfinder,
    getAccessibilityMode: isAccessibilityMode,
    showToast,
    getCurrentUserLngLat
  });

  return navigationController;
}

function initLiveGpsTracking() {
  if (!('geolocation' in navigator)) return;

  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, heading, speed } = position.coords;
      const lngLat = [longitude, latitude];
      currentUserLngLat = lngLat;
      const movementHeading = Number.isFinite(heading) ? heading : calculateBearing(previousUserLngLat, lngLat);
      currentUserHeading = Number.isFinite(movementHeading) ? movementHeading : currentUserHeading;
      const derivedSpeed = estimateSpeedMps(previousUserLngLat, lngLat, previousLocationTimestamp, position.timestamp);
      const effectiveSpeed = Number.isFinite(speed) ? speed : derivedSpeed;

      if (!userMarker && map) {
        const markerEl = createCatMarkerElement();

        userMarker = new Mazemap.mapboxgl.Marker({ element: markerEl })
          .setLngLat(lngLat)
          .addTo(map);

        map.flyTo({ center: lngLat, zoom: 18 });
        showToast('Your location has been found!', 'success');
      } else if (userMarker) {
        userMarker.setLngLat(lngLat);
      }

      if (userMarker) {
        updateCatMarkerState({
          heading: currentUserHeading,
          speed: Number.isFinite(effectiveSpeed) ? effectiveSpeed : 0
        });
      }

      if (navigationController?.isNavigating()) {
        map.easeTo({
          center: lngLat,
          duration: 500,
          zoom: map.getZoom()
        });
      }

      navigationController?.onUserLocationUpdate({
        lngLat,
        heading: Number.isFinite(currentUserHeading) ? currentUserHeading : null
      });

      document.dispatchEvent(new CustomEvent('user-location-updated', {
        detail: {
          lngLat,
          heading: Number.isFinite(currentUserHeading) ? currentUserHeading : null,
          accuracy: position.coords.accuracy || null
        }
      }));

      previousUserLngLat = lngLat;
      previousLocationTimestamp = position.timestamp;
    },
    (error) => {
      console.error('GPS error:', error);
      if (error.code === error.PERMISSION_DENIED) showToast('Please enable location permissions', 'error');
      if (error.code === error.POSITION_UNAVAILABLE) showToast('Location unavailable', 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    }
  );
}

function createCatMarkerElement() {
  const markerEl = document.createElement('div');
  markerEl.className = 'cat-marker';

  const shadow = document.createElement('div');
  shadow.className = 'cat-shadow';
  markerEl.appendChild(shadow);

  catSprite = document.createElement('div');
  catSprite.className = 'cat-sprite idle';

  markerEl.appendChild(catSprite);

  return markerEl;
}

function updateCatMarkerState({ heading, speed }) {
  if (!userMarker || !catSprite) return;

  const markerElement = userMarker.getElement();
  if (Number.isFinite(heading)) {
    markerElement.style.transform = `translate(-50%, -50%) rotate(${heading}deg)`;
  }

  const moving = Number.isFinite(speed) ? speed > 0.3 : false;
  catSprite.classList.toggle('idle', !moving);
  catSprite.classList.toggle('moving', moving);

  if (moving && speed > 2) {
    catSprite.style.animationDuration = '0.42s';
  } else if (moving && speed > 0.7) {
    catSprite.style.animationDuration = '0.72s';
  } else if (moving) {
    catSprite.style.animationDuration = '0.95s';
  } else {
    catSprite.style.animationDuration = '2.0s';
  }

  catSprite.classList.toggle('facing-left', Number.isFinite(heading) && heading >= 90 && heading <= 270);
}

function handleMapClick() {
  const results = document.getElementById('search-results');
  if (results) results.classList.remove('active');
}

async function fetchPOIs(query) {
  const params = new URLSearchParams({
    q: query,
    campusid: CAMPUS_ID,
    rows: 8,
    start: 0
  });

  const response = await fetch(`${MAZEMAP_SEARCH}?${params}`);
  if (!response.ok) throw new Error('Search failed');

  const data = await response.json();
  return data.result || [];
}

function renderResults(pois, query) {
  const container = document.getElementById('search-results');
  if (!container) return;

  if (!pois.length) {
    container.innerHTML = `<div class="no-results">No results for "${query}"</div>`;
    container.classList.add('active');
    return;
  }

  container.innerHTML = pois.map((poi) => {
    const name = poi.title || poi.name || 'Unknown';
    const building = poi.buildingName || 'Colchester';
    return `
      <div class="result-item" data-poi-id="${poi.poiId || ''}" data-name="${escapeHtml(name)}">
        <div class="result-icon" aria-hidden="true"></div>
        <div class="result-text">
          <div class="result-name">${escapeHtml(name)}</div>
          <div class="result-building">${escapeHtml(building)}</div>
        </div>
        <button class="result-fav" aria-label="Save to favourites" title="Save to favourites">+</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.result-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      if (event.target.classList.contains('result-fav')) return;

      container.classList.remove('active');
      const poiId = parseInt(item.dataset.poiId, 10);
      const name = item.dataset.name;
      if (poiId) navigateToPOI(poiId, name);
    });

    const favBtn = item.querySelector('.result-fav');
    if (!favBtn) return;

    favBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const name = item.dataset.name;
      if (window.addFavourite) window.addFavourite({ name, poiId: parseInt(item.dataset.poiId, 10) });
      window.showToast(`"${name}" saved to favourites`, 'success', 2500);
    });
  });

  container.classList.add('active');
}

export async function navigateToPOI(poiId, name) {
  if (!map || !highlighter) return;

  try {
    const poi = await Mazemap.Data.getPoi(poiId);
    const lngLatObj = Mazemap.Util.getPoiLngLat(poi);
    const target = [lngLatObj.lng ?? lngLatObj[0], lngLatObj.lat ?? lngLatObj[1]];

    map.flyTo({ center: target, zoom: 19, speed: 0.8 });
    map.setZLevel(poi.properties?.zLevel || 1);
    highlighter.highlight(poi);

    searchMarkers.forEach((marker) => marker.remove());
    searchMarkers = [];

    const markerEl = document.createElement('div');
    markerEl.className = 'search-result-marker';
    markerEl.title = name;

    const marker = new Mazemap.mapboxgl.Marker({ element: markerEl })
      .setLngLat(target)
      .addTo(map);

    searchMarkers.push(marker);
    showDestinationDirectionsCard(target, poi, name || poi.properties?.title || 'Destination');

    const input = document.getElementById('search-input');
    if (input) input.value = name || '';

    const results = document.getElementById('search-results');
    if (results) results.classList.remove('active');

    await previewRoute(poi, name);
  } catch (error) {
    console.error('Navigation error:', error);
    window.showToast('Could not navigate to that location', 'error');
  }
}

function showDestinationDirectionsCard(targetLngLat, poi, name) {
  if (!map) return;
  if (destinationPopup) destinationPopup.remove();

  const card = document.createElement('div');
  card.className = 'map-direction-card';
  card.innerHTML = `
    <div class="map-direction-title">${escapeHtml(name)}</div>
    <button class="map-direction-btn" type="button">Directions</button>
  `;
  card.querySelector('.map-direction-btn')?.addEventListener('click', async () => {
    await previewRoute(poi, name);
    openRoutePanel();
  });

  destinationPopup = new Mazemap.mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 22
  })
    .setLngLat(targetLngLat)
    .setDOMContent(card)
    .addTo(map);
}

async function previewRoute(poi, name) {
  ensureNavigationController();
  if (!navigationController) {
    console.error('previewRoute: navigationController not initialized');
    return;
  }

  let plan = null;
  try {
    plan = await navigationController.previewRouteToPoi({
      poi,
      destinationName: name || poi?.properties?.title || 'Destination'
    });
  } catch (error) {
    console.error('previewRoute: Route calculation failed:', error);
    plan = null;
  }

  if (!plan) {
    showToast('Could not prepare route preview.', 'error');
    const content = document.getElementById('route-content');
    if (content) {
      content.innerHTML = `
        <div class="preview-empty">
          Could not prepare route preview from current location. Please move the map and try again.
        </div>
      `;
    }
    openRoutePanel();
    return;
  }

  activePreview = { plan, poi, name: name || poi?.properties?.title || 'Destination' };
  showRouteInfo(activePreview);
}

function showRouteInfo(previewState) {
  const panel = document.getElementById('route-info');
  const content = document.getElementById('route-content');
  if (!panel || !content) return;

  const { plan, poi, name } = previewState || {};
  if (!plan || !poi) {
    content.innerHTML = `<div class="preview-empty">No route data available yet.</div>`;
    return;
  }
  const properties = poi?.properties || {};
  const steps = Array.isArray(plan.instructions) && plan.instructions.length
    ? plan.instructions
    : [{
        text: `Head towards ${name || properties.title || 'your destination'} following the highlighted route.`
      }];

  const instructionsHtml = steps.map((instruction, idx) => `
    <div class="preview-step">
      <div class="preview-step-num">${idx + 1}</div>
      <div class="preview-step-text">${escapeHtml(instruction.text)}</div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="route-destination">
      <h4>${escapeHtml(name || properties.title || 'Location')}</h4>
      ${properties.buildingName ? `<p>Building: ${escapeHtml(properties.buildingName)}</p>` : ''}
      ${properties.floorName ? `<p>Floor: ${escapeHtml(properties.floorName)}</p>` : ''}
      <p>Distance: ${Math.round(plan.distanceMeters)}m • ETA: ${plan.etaMinutes} min</p>
    </div>
    <div class="preview-steps">${instructionsHtml}</div>
    <button id="start-route-btn" class="route-btn">Start Live Navigation</button>
  `;
  openRoutePanel();

  document.getElementById('start-route-btn')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Calculating route...';

    try {
      ensureNavigationController();
      if (!navigationController) {
        showToast('Navigation is still loading, please try again in a moment.', 'info');
        return;
      }

      const started = await navigationController?.startNavigationToPoi({
        poi,
        destinationName: name || properties.title || 'Destination',
        plan: plan
      });

      if (!started) {
        showToast('Unable to start navigation right now. Check location permission and try again.', 'error');
      } else {
        closeRoutePanel();
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

function openRoutePanel() {
  const panel = document.getElementById('route-info');
  if (!panel) return;
  panel.classList.add('active');
}

function closeRoutePanel() {
  const panel = document.getElementById('route-info');
  if (!panel) return;
  panel.classList.remove('active');
}

function calculateBearing(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return null;
  const lat1 = from[1] * Math.PI / 180;
  const lat2 = to[1] * Math.PI / 180;
  const dLon = (to[0] - from[0]) * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

function estimateSpeedMps(from, to, prevTs, currTs) {
  if (!Array.isArray(from) || !Array.isArray(to)) return 0;
  if (!Number.isFinite(prevTs) || !Number.isFinite(currTs) || currTs <= prevTs) return 0;
  const deltaSec = (currTs - prevTs) / 1000;
  if (deltaSec <= 0) return 0;

  const meters = distanceMeters(from, to);
  return meters / deltaSec;
}

function distanceMeters(from, to) {
  const R = 6371000;
  const dLat = ((to[1] - from[1]) * Math.PI) / 180;
  const dLon = ((to[0] - from[0]) * Math.PI) / 180;
  const lat1 = (from[1] * Math.PI) / 180;
  const lat2 = (to[1] * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function setupSearch() {
  const input = document.getElementById('search-input');
  const button = document.getElementById('search-btn');
  const results = document.getElementById('search-results');

  if (!input) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();

    if (query.length < 2) {
      results?.classList.remove('active');
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const pois = await fetchPOIs(query);
        renderResults(pois, query);
      } catch (error) {
        console.error('Search input error:', error);
      }
    }, 350);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      clearTimeout(debounceTimer);
      const query = input.value.trim();
      if (query) {
        fetchPOIs(query).then((pois) => renderResults(pois, query)).catch(() => {});
      }
    }

    if (event.key === 'Escape') {
      results?.classList.remove('active');
    }
  });

  button?.addEventListener('click', () => {
    const query = input.value.trim();
    if (query) {
      fetchPOIs(query).then((pois) => renderResults(pois, query)).catch(() => {});
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-container')) {
      results?.classList.remove('active');
    }
  });
}

function setupPanels() {
  const favToggle = document.getElementById('favourites-toggle');
  const favPanel = document.getElementById('favourites-panel');
  const favClose = document.getElementById('favourites-close');

  if (favToggle && favPanel) {
    favToggle.addEventListener('click', () => favPanel.classList.toggle('active'));
  }

  if (favClose && favPanel) {
    favClose.addEventListener('click', () => favPanel.classList.remove('active'));
  }

  const routeClose = document.getElementById('route-close');
  const routePanel = document.getElementById('route-info');
  if (routeClose && routePanel) {
    routeClose.addEventListener('click', () => closeRoutePanel());
  }
}

function setupOnboarding() {
  const modal = document.getElementById('onboarding-modal');
  if (!modal) return;

  const complete = localStorage.getItem('essex_onboarding_complete');
  if (complete) return;

  modal.classList.add('active');

  let step = 0;
  const steps = modal.querySelectorAll('.onboarding-step');
  const dots = modal.querySelectorAll('.progress-dot');
  const nextBtn = document.getElementById('onboarding-next');
  const prevBtn = document.getElementById('onboarding-prev');
  const finishBtn = document.getElementById('onboarding-finish');

  function showStep(index) {
    steps.forEach((el, i) => el.classList.toggle('active', i === index));
    dots.forEach((el, i) => el.classList.toggle('active', i === index));
    if (prevBtn) prevBtn.style.display = index === 0 ? 'none' : 'inline-block';
    if (nextBtn) nextBtn.style.display = index === steps.length - 1 ? 'none' : 'inline-block';
    if (finishBtn) finishBtn.style.display = index === steps.length - 1 ? 'inline-block' : 'none';
  }

  modal.querySelectorAll('.role-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.role-btn').forEach((other) => other.classList.remove('selected'));
      btn.classList.add('selected');
      localStorage.setItem('essex_user_role', btn.dataset.role);
    });
  });

  nextBtn?.addEventListener('click', () => {
    if (step < steps.length - 1) showStep(++step);
  });

  prevBtn?.addEventListener('click', () => {
    if (step > 0) showStep(--step);
  });

  finishBtn?.addEventListener('click', () => {
    const nameInput = document.getElementById('onboarding-name');
    if (nameInput?.value.trim()) {
      localStorage.setItem('essex_user_name', nameInput.value.trim());
    }
    localStorage.setItem('essex_onboarding_complete', 'true');
    modal.classList.remove('active');
    showToast('Welcome to Essex Campus Navigator!', 'success', 3500);
  });

  showStep(0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupSearch();
  setupPanels();
  setupOnboarding();
});

