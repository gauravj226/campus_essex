// Essex Campus Navigator - js/app.js
// Core map initialisation, search, routing, toast notifications

const CAMPUS_ID = 2195;
const MAZEMAP_SEARCH = 'https://api.mazemap.com/search/equery/';

let map = null;
let highlighter = null;
let pathfinder = null;
let accessibilityMode = false;
let searchMarkers = []; // Track search result markers
let currentUserLngLat = null;

// Make showToast globally available for other modules
window.showToast = function(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
};

export function showToast(msg, type = 'info', duration = 3500) {
  window.showToast(msg, type, duration);
}

export function getMap() { return map; }
export function isAccessibilityMode() { return accessibilityMode; }
export function setAccessibilityMode(val) { accessibilityMode = val; }

function initMap() {
  // Check MazeMap is loaded
  if (typeof Mazemap === 'undefined') {
    console.error('MazeMap not loaded');
    document.getElementById('map').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.2rem;color:#666;">Map loading... please refresh if this persists.</div>';
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

        // Enhanced GPS tracking with live position updates
    let userMarker = null;
    let userAccuracyCircle = null;
    let watchId = null;
    
    // Start watching user position
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, heading } = position.coords;
          const lngLat = [longitude, latitude];
          currentUserLngLat = lngLat;
          
          // Update or create user marker
          if (!userMarker) {
            // Create custom user location marker
            const el = document.createElement('div');
            el.className = 'user-location-marker';
            el.innerHTML = '🟢'; // Blue circle emoji
            el.style.fontSize = '24px';
            el.style.transform = 'translate(-50%, -50%)';
            
            userMarker = new Mazemap.mapboxgl.Marker({ element: el })
              .setLngLat(lngLat)
              .addTo(map);
            
            // Center map on user location (first time)
            map.flyTo({ center: lngLat, zoom: 18 });
            showToast('📍 Your location has been found!', 'success');
          } else {
            // Update marker position
            userMarker.setLngLat(lngLat);
          }
          
          // Rotate marker based on heading if available
          if (heading !== null && heading !== undefined) {
            const markerEl = userMarker.getElement();
            markerEl.style.transform = `translate(-50%, -50%) rotate(${heading}deg)`;
          }
          
          console.log(`📍 User position updated: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)`);
        },
        (error) => {
          console.error('GPS error:', error);
          if (error.code === error.PERMISSION_DENIED) {
            showToast('Please enable location permissions', 'error');
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            showToast('Location unavailable', 'error');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    map.on('load', () => {
      highlighter = new Mazemap.Highlighter(map, {
        showFill: true,
        showOutline: true,
        fillColor: '#FF6600',
        outlineColor: '#00467F'
      });
      pathfinder = new Mazemap.Pathfinder(map);
      window.showToast('Campus map loaded! Search for any location.', 'success');
      console.log('✅ Essex Navigator ready | Campus ID:', CAMPUS_ID);
    });

    map.on('click', handleMapClick);
  } catch (e) {
    console.error('Map init error:', e);
  }
}

function handleMapClick(e) {
  // Close dropdowns on map click
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
  const res = await fetch(`${MAZEMAP_SEARCH}?${params}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
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

  container.innerHTML = pois.map(poi => `
    <div class="result-item" data-poi-id="${poi.poiId || ''}" data-name="${poi.title || poi.name || ''}">
      <div class="result-icon">📍</div>
      <div class="result-text">
        <div class="result-name">${poi.title || poi.name || 'Unknown'}</div>
        <div class="result-building">${poi.buildingName || poi.campusName || ''}</div>
      </div>
      <button class="result-fav" aria-label="Save to favourites" title="Save to favourites">&#11088;</button>
    </div>
  `).join('');

  container.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('result-fav')) return;
      container.classList.remove('active');
      const poiId = parseInt(item.dataset.poiId);
      const name = item.dataset.name;
      if (poiId) navigateToPOI(poiId, name);
    });
    const favBtn = item.querySelector('.result-fav');
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = item.dataset.name;
        if (window.addFavourite) window.addFavourite({ name, poiId: parseInt(item.dataset.poiId) });
        window.showToast(`"${name}" saved to favourites`, 'success', 2500);
      });
    }
  });

  container.classList.add('active');
}

export async function navigateToPOI(poiId, name) {
  if (!map || !highlighter) return;
  try {
    const poi = await Mazemap.Data.getPoi(poiId);
    const lngLat = Mazemap.Util.getPoiLngLat(poi);
    const zLevel = poi.properties.floorName || 1;

    map.flyTo({ center: lngLat, zoom: 19, speed: 0.8 });
    map.setZLevel(poi.properties.zLevel || 1);
    highlighter.highlight(poi);

        // Add permanent marker for the searched location
    // Clear previous search markers
    searchMarkers.forEach(m => m.remove());
    searchMarkers = [];
    
    // Create new marker
    const el = document.createElement('div');
    el.className = 'search-result-marker';
    el.innerHTML = '📍'; // Pin emoji
    el.style.fontSize = '32px';
    el.style.transform = 'translate(-50%, -100%)';
    el.title = name;
    
    const marker = new Mazemap.mapboxgl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(map);
    
    searchMarkers.push(marker);

    // Close search
    const input = document.getElementById('search-input');
    if (input) input.value = name || '';
    const results = document.getElementById('search-results');
    if (results) results.classList.remove('active');

    showRouteInfo(poi, name);
  } catch (e) {
    console.error('Navigation error:', e);
    window.showToast('Could not navigate to that location', 'error');
  }
}

function showRouteInfo(poi, name) {
  const panel = document.getElementById('route-info');
  const content = document.getElementById('route-content');
  if (!panel || !content) return;

  const props = poi.properties || {};
  content.innerHTML = `
    <div class="route-destination">
      <h4>📍 ${name || props.title || 'Location'}</h4>
      ${props.buildingName ? `<p>Building: ${props.buildingName}</p>` : ''}
      ${props.floorName ? `<p>Floor: ${props.floorName}</p>` : ''}
      ${props.categories ? `<p>Type: ${props.categories.join(', ')}</p>` : ''}
    </div>
    <button id="start-route-btn" class="route-btn">Get Directions</button>
  `;

  panel.classList.add('active');

  document.getElementById('start-route-btn')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Loading directions...';
    try {
      const lngLat = Mazemap.Util.getPoiLngLat(poi);
      const destination = {
        lat: lngLat.lat ?? lngLat[1],
        lng: lngLat.lng ?? lngLat[0]
      };
      await openDirections(destination, name || props.title || 'Destination');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

function getCurrentLocation() {
  if (currentUserLngLat) {
    return Promise.resolve({ lat: currentUserLngLat[1], lng: currentUserLngLat[0] });
  }

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

async function openDirections(destination, label) {
  try {
    const origin = await getCurrentLocation();
    const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=walking`;
    window.open(navUrl, '_blank', 'noopener,noreferrer');
    window.showToast(`Opening directions to ${label}`, 'success');
  } catch (error) {
    const navUrl = `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`;
    window.open(navUrl, '_blank', 'noopener,noreferrer');
    window.showToast('Location unavailable. Opened destination in maps.', 'info');
  }
}

function setupSearch() {
  const input = document.getElementById('search-input');
  const btn = document.getElementById('search-btn');
  const results = document.getElementById('search-results');

  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query.length < 2) {
      if (results) results.classList.remove('active');
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const pois = await fetchPOIs(query);
        renderResults(pois, query);
      } catch (e) {
        // silent fail
      }
    }, 350);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimer);
      const query = input.value.trim();
      if (query) fetchPOIs(query).then(pois => renderResults(pois, query)).catch(() => {});
    }
    if (e.key === 'Escape') {
      if (results) results.classList.remove('active');
    }
  });

  if (btn) {
    btn.addEventListener('click', () => {
      const query = input.value.trim();
      if (query) fetchPOIs(query).then(pois => renderResults(pois, query)).catch(() => {});
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container') && results) {
      results.classList.remove('active');
    }
  });
}

function setupPanels() {
  // Favourites toggle
  const favToggle = document.getElementById('favourites-toggle');
  const favPanel = document.getElementById('favourites-panel');
  const favClose = document.getElementById('favourites-close');
  if (favToggle && favPanel) {
    favToggle.addEventListener('click', () => favPanel.classList.toggle('active'));
  }
  if (favClose && favPanel) {
    favClose.addEventListener('click', () => favPanel.classList.remove('active'));
  }

  // Route close
  const routeClose = document.getElementById('route-close');
  const routePanel = document.getElementById('route-info');
  if (routeClose && routePanel) {
    routeClose.addEventListener('click', () => routePanel.classList.remove('active'));
  }
}

function setupOnboarding() {
  const modal = document.getElementById('onboarding-modal');
  if (!modal) return;

  const complete = localStorage.getItem('essex_onboarding_complete');
  if (complete) return; // Skip if already done

  modal.classList.add('active');

  let step = 0;
  const steps = modal.querySelectorAll('.onboarding-step');
  const dots = modal.querySelectorAll('.progress-dot');
  const nextBtn = document.getElementById('onboarding-next');
  const prevBtn = document.getElementById('onboarding-prev');
  const finishBtn = document.getElementById('onboarding-finish');

  function showStep(i) {
    steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
    if (prevBtn) prevBtn.style.display = i === 0 ? 'none' : 'inline-block';
    if (nextBtn) nextBtn.style.display = i === steps.length - 1 ? 'none' : 'inline-block';
    if (finishBtn) finishBtn.style.display = i === steps.length - 1 ? 'inline-block' : 'none';
  }

  modal.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      localStorage.setItem('essex_user_role', btn.dataset.role);
    });
  });

  if (nextBtn) nextBtn.addEventListener('click', () => { if (step < steps.length - 1) showStep(++step); });
  if (prevBtn) prevBtn.addEventListener('click', () => { if (step > 0) showStep(--step); });
  if (finishBtn) finishBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('onboarding-name');
    if (nameInput && nameInput.value.trim()) {
      localStorage.setItem('essex_user_name', nameInput.value.trim());
    }
    localStorage.setItem('essex_onboarding_complete', 'true');
    modal.classList.remove('active');
    window.showToast('Welcome to Essex Campus Navigator!', 'success', 4000);
  });

  showStep(0);
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupSearch();
  setupPanels();
  setupOnboarding();
});
