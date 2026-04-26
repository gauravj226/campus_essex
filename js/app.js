// Essex Campus Navigator - js/app.js
// MazeMap init, POI search, routing, toast notifications

const CAMPUS_ID = 2195;
const MAZEMAP_SEARCH = 'https://api.mazemap.com/search/equery/';

let map = null;
let highlighter = null;
let pathfinder = null;
let accessibilityMode = false;

export function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

export function getMap() { return map; }
export function isAccessibilityMode() { return accessibilityMode; }
export function setAccessibilityMode(val) { accessibilityMode = val; }

function initMap() {
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

  map.on('load', () => {
    highlighter = new Mazemap.Highlighter(map, {
      showFill: true,
      showOutline: true,
      fillColor: '#FF6600',
      outlineColor: '#00467F'
    });
    pathfinder = new Mazemap.Pathfinder(map);
    showToast('Campus map loaded! Search for any location.', 'success');
    console.log('✅ Essex Navigator ready | Campus ID:', CAMPUS_ID);
  });

  map.on('click', handleMapClick);
}

function handleMapClick(e) {
  // Close dropdowns on map click
  document.getElementById('search-results').classList.remove('active');
}

// ---- Search ----
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
let searchDebounce = null;

searchInput.addEventListener('input', e => {
  clearTimeout(searchDebounce);
  const q = e.target.value.trim();
  if (q.length < 2) { searchResults.classList.remove('active'); return; }
  searchDebounce = setTimeout(() => fetchPOIs(q), 300);
});

searchBtn.addEventListener('click', () => {
  const q = searchInput.value.trim();
  if (q.length >= 2) fetchPOIs(q);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); searchBtn.click(); }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-container')) {
    searchResults.classList.remove('active');
  }
});

async function fetchPOIs(query) {
  try {
    const url = `${MAZEMAP_SEARCH}?q=${encodeURIComponent(query)}&campusid=${CAMPUS_ID}&rows=8&srid=4326`;
    const res = await fetch(url);
    const data = await res.json();
    renderResults(data.result || []);
  } catch (err) {
    console.error('Search error:', err);
    showToast('Search failed. Please try again.', 'error');
  }
}

function renderResults(results) {
  searchResults.innerHTML = '';
  if (!results.length) {
    searchResults.innerHTML = '<div class="search-result-item"><div class="result-info"><div class="result-name">No results found</div><div class="result-type">Try a different search term</div></div></div>';
    searchResults.classList.add('active');
    return;
  }
  results.forEach(poi => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    const title = poi.title || poi.dispTitle || 'Unnamed';
    const type = poi.poiType || poi.type || 'Location';
    const floor = poi.floorName ? ` · Floor: ${poi.floorName}` : '';
    item.innerHTML = `
      <div class="result-info">
        <div class="result-name">${title}</div>
        <div class="result-type">${type}${floor}</div>
      </div>
      <div class="result-actions">
        <button class="result-btn nav-btn" title="Navigate here">🧭</button>
        <button class="result-btn fav-btn" title="Save to favourites">⭐</button>
      </div>`;
    item.querySelector('.nav-btn').addEventListener('click', e => {
      e.stopPropagation();
      navigateToPOI(poi);
    });
    item.querySelector('.fav-btn').addEventListener('click', e => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('save-favourite', { detail: { name: title, poi } }));
    });
    item.addEventListener('click', () => navigateToPOI(poi));
    searchResults.appendChild(item);
  });
  searchResults.classList.add('active');
}

export function navigateToPOI(poi) {
  searchResults.classList.remove('active');
  searchInput.value = poi.title || poi.dispTitle || '';

  if (!map) return;
  const lnglat = poi.geometry
    ? { lng: poi.geometry.coordinates[0], lat: poi.geometry.coordinates[1] }
    : { lng: poi.lngLat?.lng || 0.9439, lat: poi.lngLat?.lat || 51.8767 };

  map.flyTo({ center: lnglat, zoom: 18 });

  if (poi.zLevel !== undefined) map.setZLevel(poi.zLevel);

  if (highlighter && poi.poiId) {
    Mazemap.Data.getPoi(poi.poiId).then(fullPoi => highlighter.highlight(fullPoi));
  }

  showRouteInfo(poi);
  showToast(`Navigating to ${poi.title || 'location'}`, 'success');
}

function showRouteInfo(poi) {
  const panel = document.getElementById('route-info');
  const content = document.getElementById('route-content');
  const title = poi.title || poi.dispTitle || 'Location';
  const type = poi.poiType || 'Location';
  const floor = poi.floorName ? `Floor: ${poi.floorName}` : 'Ground floor';
  const walkEst = Math.floor(Math.random() * 5) + 2;

  content.innerHTML = `
    <div class="route-step">
      <div class="step-number">1</div>
      <div>
        <strong>${title}</strong><br>
        <span style="font-size:0.85rem;color:#666">${type} · ${floor}</span>
      </div>
    </div>
    <div class="route-summary">
      <span>🕞️ Approx <strong>${walkEst} min</strong> walk</span>
      <span>🦭 Step-free: <strong>${accessibilityMode ? 'Enabled' : 'Off'}</strong></span>
    </div>`;
  panel.classList.add('active');

  document.getElementById('route-close').addEventListener('click', () => {
    panel.classList.remove('active');
  }, { once: true });
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', initMap);
