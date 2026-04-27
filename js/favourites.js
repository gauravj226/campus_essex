// Essex Campus Navigator - js/favourites.js
// Persistent favourites using localStorage with custom nicknames

import { navigateToPOI, showToast } from './app.js';

const STORAGE_KEY = 'essex_navigator_favourites';

const favToggle = document.getElementById('favourites-toggle');
const favPanel = document.getElementById('favourites-panel');
const favClose = document.getElementById('favourites-close');
const favList = document.getElementById('favourites-list');

favToggle.addEventListener('click', () => {
  favPanel.classList.toggle('active');
  if (favPanel.classList.contains('active')) renderFavourites();
});

favClose.addEventListener('click', () => favPanel.classList.remove('active'));

// Listen for save events from search results
window.addEventListener('save-favourite', e => {
  const { name, poi } = e.detail;
  promptNickname(name, poi);
});

// Called by app.js when user taps the star on a search result.
window.addFavourite = function addFavouriteFromSearch(payload) {
  if (!payload?.name) return;
  promptNickname(payload.name, payload);
};

function getFavourites() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveFavourites(favs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

function promptNickname(defaultName, poi) {
  const nickname = window.prompt(
    'Save this location to favourites!\nGive it a nickname (or press OK to use the default):',
    defaultName
  );
  if (nickname === null) return; // user cancelled

  const favs = getFavourites();
  const exists = favs.find(f => f.poi?.poiId === poi?.poiId && f.poi?.poiId);
  if (exists) {
    showToast('Already in your favourites!', 'info');
    return;
  }

  favs.unshift({
    id: Date.now(),
    nickname: nickname.trim() || defaultName,
    originalName: defaultName,
    poi,
    savedAt: new Date().toISOString()
  });

  saveFavourites(favs);
  showToast(`⭐ Saved "${nickname || defaultName}" to favourites!`, 'success');
  if (favPanel.classList.contains('active')) renderFavourites();
}

function renderFavourites() {
  const favs = getFavourites();
  favList.innerHTML = '';

  if (!favs.length) {
    favList.innerHTML = `
      <div class="empty-message">
        <div style="font-size:2.5rem;margin-bottom:12px">⭐</div>
        <p>No favourites yet.</p>
        <p style="margin-top:8px;font-size:0.875rem">Search for a location and tap the ⭐ star to save it here with a custom name like "My Lab" or "Morning Coffee Spot".</p>
      </div>`;
    return;
  }

  favs.forEach(fav => {
    const item = document.createElement('div');
    item.className = 'favourite-item';
    const savedDate = new Date(fav.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    item.innerHTML = `
      <div style="flex:1" class="fav-info">
        <div class="favourite-name">${escapeHtml(fav.nickname)}</div>
        <div class="favourite-location">${escapeHtml(fav.originalName !== fav.nickname ? fav.originalName : '')} Saved ${savedDate}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="result-btn rename-btn" title="Rename" style="opacity:0.6;font-size:1rem">✏️</button>
        <button class="favourite-delete" title="Remove from favourites" aria-label="Remove ${escapeHtml(fav.nickname)} from favourites">✕</button>
      </div>`;

    item.querySelector('.fav-info').addEventListener('click', () => {
      if (fav.poi?.poiId) {
        navigateToPOI(fav.poi.poiId, fav.originalName || fav.nickname);
        favPanel.classList.remove('active');
      }
    });

    item.querySelector('.rename-btn').addEventListener('click', e => {
      e.stopPropagation();
      const newName = window.prompt('Rename this favourite:', fav.nickname);
      if (newName && newName.trim()) {
        const favs2 = getFavourites();
        const idx = favs2.findIndex(f => f.id === fav.id);
        if (idx !== -1) { favs2[idx].nickname = newName.trim(); saveFavourites(favs2); }
        renderFavourites();
        showToast('Favourite renamed!', 'success');
      }
    });

    item.querySelector('.favourite-delete').addEventListener('click', e => {
      e.stopPropagation();
      const favs2 = getFavourites().filter(f => f.id !== fav.id);
      saveFavourites(favs2);
      renderFavourites();
      showToast('Removed from favourites', 'info');
    });

    favList.appendChild(item);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
