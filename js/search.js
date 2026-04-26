// search.js - Enhanced search with NLP and MazeMap integration

const CAMPUS_ID = 2195;
const MAZEMAP_SEARCH_URL = 'https://api.mazemap.com/search/equery/';

// Campus location data for offline/local search
const CAMPUS_LOCATIONS = [
  { name: 'Albert Sloman Library', aliases: ['library', 'asl', 'books'], type: 'library', floor: 0, building: 'Library' },
  { name: 'Students Union (SU Bar)', aliases: ['su', 'su bar', 'students union', 'union'], type: 'social', building: 'SU' },
  { name: 'Square 4 Restaurant', aliases: ['sq4', 'square 4', 'canteen', 'food', 'eat'], type: 'food', building: 'Square 4' },
  { name: 'Health Centre', aliases: ['doctor', 'medical', 'gp', 'health', 'nurse'], type: 'health', building: 'Health Centre' },
  { name: 'Sports Centre', aliases: ['gym', 'sports', 'fitness', 'pool', 'swimming'], type: 'sport', building: 'Sports Centre' },
  { name: 'Wivenhoe House', aliases: ['hotel', 'wivenhoe', 'conference'], type: 'conference', building: 'Wivenhoe House' },
  { name: 'Colchester Institute', aliases: ['ci', 'institute', 'college'], type: 'education', building: 'CI' },
  { name: 'North Towers', aliases: ['north tower', 'accommodation', 'halls north'], type: 'accommodation', building: 'North Towers' },
  { name: 'South Towers', aliases: ['south tower', 'accommodation south'], type: 'accommodation', building: 'South Towers' },
  { name: 'IT Services', aliases: ['it', 'computer help', 'tech support', 'it helpdesk'], type: 'services', building: 'IT Services' },
  { name: 'Registry', aliases: ['registry', 'student records', 'admin', 'enrolment'], type: 'admin', building: 'Registry' },
  { name: 'Essex Business School', aliases: ['ebs', 'business school', 'management'], type: 'academic', building: 'EBS' },
  { name: 'STEM Centre', aliases: ['stem', 'science', 'engineering', 'computing'], type: 'academic', building: 'STEM' },
  { name: 'Ivor Crewe Lecture Hall', aliases: ['ivor crewe', 'lecture theatre', 'iclh'], type: 'lecture', building: 'ICLH' },
  { name: 'Car Park 1', aliases: ['parking', 'car park', 'park', 'park and ride'], type: 'transport', building: 'CP1' },
  { name: 'Bus Stop', aliases: ['bus', 'transport', 'shuttle', '61c'], type: 'transport', building: 'Bus Stop' },
  { name: 'Nightline', aliases: ['nightline', 'wellbeing', 'support', 'counselling'], type: 'support', building: 'Nightline' },
  { name: 'Graduate Centre', aliases: ['graduate', 'pgr', 'postgrad', 'phd'], type: 'academic', building: 'Graduate Centre' },
  { name: 'Silberrad Student Centre', aliases: ['silberrad', 'student centre', 'ssc', 'student hub'], type: 'services', building: 'SSC' },
  { name: 'Lakeside', aliases: ['lake', 'lakeside', 'ducks', 'outside'], type: 'outdoor', building: 'Lakeside' }
];

let searchHistory = JSON.parse(localStorage.getItem('essex_search_history') || '[]');

export function initSearch() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const clearBtn = document.getElementById('search-clear');

  if (!searchInput) return;

  // Auto-complete
  searchInput.addEventListener('input', debounce(handleSearchInput, 300));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch(searchInput.value);
    if (e.key === 'Escape') clearSearch();
  });

  if (searchBtn) searchBtn.addEventListener('click', () => performSearch(searchInput.value));
  if (clearBtn) clearBtn.addEventListener('click', clearSearch);

  // Show recent searches on focus
  searchInput.addEventListener('focus', showRecentSearches);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) hideSuggestions();
  });
}

async function handleSearchInput(e) {
  const query = e.target.value.trim();
  if (query.length < 2) {
    hideSuggestions();
    return;
  }

  const localResults = searchLocal(query);
  showSuggestions(localResults, query);

  // Also fetch from MazeMap API
  try {
    const apiResults = await searchMazeMap(query);
    const combined = mergeSuggestions(localResults, apiResults);
    showSuggestions(combined, query);
  } catch (err) {
    // Fall back to local results only
  }
}

function searchLocal(query) {
  const q = query.toLowerCase();
  return CAMPUS_LOCATIONS
    .filter(loc => 
      loc.name.toLowerCase().includes(q) ||
      loc.aliases.some(a => a.includes(q)) ||
      loc.type.includes(q)
    )
    .slice(0, 5)
    .map(loc => ({
      name: loc.name,
      type: loc.type,
      building: loc.building,
      source: 'local'
    }));
}

async function searchMazeMap(query) {
  const params = new URLSearchParams({
    q: query,
    campusid: CAMPUS_ID,
    rows: 5,
    start: 0
  });
  const response = await fetch(`${MAZEMAP_SEARCH_URL}?${params}`);
  if (!response.ok) return [];
  const data = await response.json();
  return (data.result || []).map(r => ({
    name: r.title || r.name,
    type: r.poitype || 'location',
    building: r.buildingName || '',
    poiId: r.poiId,
    source: 'mazemap'
  }));
}

function mergeSuggestions(local, api) {
  const seen = new Set(local.map(r => r.name.toLowerCase()));
  const unique = api.filter(r => !seen.has(r.name.toLowerCase()));
  return [...local, ...unique].slice(0, 8);
}

export function performSearch(query) {
  if (!query.trim()) return;
  
  addToHistory(query);
  hideSuggestions();

  // Update search input
  const input = document.getElementById('search-input');
  if (input) input.value = query;

  // Dispatch search event for app.js to handle
  document.dispatchEvent(new CustomEvent('campus-search', {
    detail: { query: query.trim() }
  }));
}

function showSuggestions(results, query) {
  let dropdown = document.getElementById('search-suggestions');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'search-suggestions';
    dropdown.className = 'search-suggestions';
    const container = document.querySelector('.search-container');
    if (container) container.appendChild(dropdown);
  }

  if (!results.length) {
    hideSuggestions();
    return;
  }

  dropdown.innerHTML = results.map(r => `
    <div class="suggestion-item" data-name="${r.name}" data-poi="${r.poiId || ''}">
      <span class="suggestion-icon">${getTypeIcon(r.type)}</span>
      <div class="suggestion-text">
        <span class="suggestion-name">${highlightMatch(r.name, query)}</span>
        ${r.building ? `<span class="suggestion-building">${r.building}</span>` : ''}
      </div>
    </div>
  `).join('');

  dropdown.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      performSearch(item.dataset.name);
    });
  });

  dropdown.style.display = 'block';
}

function showRecentSearches() {
  if (searchHistory.length === 0) return;
  const input = document.getElementById('search-input');
  if (input && input.value.trim()) return;

  const recent = searchHistory.slice(0, 5).map(q => ({ name: q, type: 'history' }));
  showSuggestions(recent, '');
}

function hideSuggestions() {
  const dropdown = document.getElementById('search-suggestions');
  if (dropdown) dropdown.style.display = 'none';
}

function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) input.value = '';
  hideSuggestions();
  document.dispatchEvent(new CustomEvent('campus-search-cleared'));
}

function addToHistory(query) {
  searchHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 10);
  localStorage.setItem('essex_search_history', JSON.stringify(searchHistory));
}

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function getTypeIcon(type) {
  const icons = {
    library: '📚', food: '🍽️', sport: '🏋️', health: '🏥',
    accommodation: '🏠', academic: '🏫', transport: '🚌', social: '🍺',
    services: '⚙️', support: '💙', outdoor: '🌳', conference: '🏢',
    lecture: '🎤', admin: '💼', history: '🕒', location: '📍'
  };
  return icons[type] || '📍';
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export { CAMPUS_LOCATIONS, searchLocal };
