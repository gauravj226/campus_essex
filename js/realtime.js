// realtime.js - Real-time info: bus times, opening hours, events, busyness

const ESSEX_OPENING_HOURS = {
  library: {
    name: 'Albert Sloman Library',
    hours: {
      monday: '08:00-23:00', tuesday: '08:00-23:00', wednesday: '08:00-23:00',
      thursday: '08:00-23:00', friday: '08:00-22:00',
      saturday: '10:00-20:00', sunday: '10:00-23:00'
    }
  },
  sportscentre: {
    name: 'Sports Centre',
    hours: {
      monday: '07:00-22:00', tuesday: '07:00-22:00', wednesday: '07:00-22:00',
      thursday: '07:00-22:00', friday: '07:00-21:00',
      saturday: '08:00-20:00', sunday: '09:00-20:00'
    }
  },
  square4: {
    name: 'Square 4 Restaurant',
    hours: {
      monday: '08:00-20:00', tuesday: '08:00-20:00', wednesday: '08:00-20:00',
      thursday: '08:00-20:00', friday: '08:00-19:00',
      saturday: '10:00-15:00', sunday: 'Closed'
    }
  },
  subar: {
    name: 'Students Union Bar',
    hours: {
      monday: '12:00-23:00', tuesday: '12:00-23:00', wednesday: '12:00-00:00',
      thursday: '12:00-23:00', friday: '12:00-02:00',
      saturday: '12:00-02:00', sunday: '12:00-22:00'
    }
  },
  healthcentre: {
    name: 'Health Centre',
    hours: {
      monday: '08:30-18:00', tuesday: '08:30-18:00', wednesday: '08:30-18:00',
      thursday: '08:30-18:00', friday: '08:30-17:30',
      saturday: 'Closed', sunday: 'Closed'
    }
  }
};

const BUS_INFO = {
  '61C': {
    name: 'Colchester - University Shuttle',
    operator: 'First Essex',
    frequency: 'Every 10-20 mins',
    firstBus: '07:15',
    lastBus: '23:30',
    info: 'Connects University to Colchester town centre'
  },
  'U1': {
    name: 'University Internal Shuttle',
    operator: 'University of Essex',
    frequency: 'Every 30 mins',
    firstBus: '08:00',
    lastBus: '17:30',
    info: 'Links Colchester, Loughton and Southend campuses'
  }
};

let updateInterval = null;

export function initRealtime() {
  updateLiveInfo();
  updateInterval = setInterval(updateLiveInfo, 60000); // Update every minute
  
  // Listen for visibility changes to pause/resume updates
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(updateInterval);
    } else {
      updateLiveInfo();
      updateInterval = setInterval(updateLiveInfo, 60000);
    }
  });
}

function updateLiveInfo() {
  updateOpeningHours();
  updateBusTimes();
  updateBusynessIndicators();
  updateDateTime();
}

function updateDateTime() {
  const now = new Date();
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');
  
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-GB', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
  }
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}

function updateOpeningHours() {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[now.getDay()];
  const currentTime = now.getHours() * 60 + now.getMinutes();

  Object.entries(ESSEX_OPENING_HOURS).forEach(([key, venue]) => {
    const el = document.getElementById(`hours-${key}`);
    if (!el) return;

    const hours = venue.hours[today];
    if (hours === 'Closed') {
      el.textContent = 'Closed today';
      el.className = 'hours-badge closed';
      return;
    }

    const [open, close] = hours.split('-').map(t => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    });

    if (currentTime < open) {
      const opensIn = open - currentTime;
      el.textContent = `Opens in ${opensIn >= 60 ? Math.floor(opensIn/60)+'h ' : ''}${opensIn % 60}m`;
      el.className = 'hours-badge closed';
    } else if (currentTime >= close) {
      el.textContent = 'Closed now';
      el.className = 'hours-badge closed';
    } else {
      const closingIn = close - currentTime;
      if (closingIn <= 60) {
        el.textContent = `Closes in ${closingIn}m`;
        el.className = 'hours-badge closing-soon';
      } else {
        el.textContent = `Open until ${hours.split('-')[1]}`;
        el.className = 'hours-badge open';
      }
    }
  });
}

function updateBusTimes() {
  const busContainer = document.getElementById('bus-times');
  if (!busContainer) return;

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const busHTML = Object.entries(BUS_INFO).map(([number, bus]) => {
    const [firstH, firstM] = bus.firstBus.split(':').map(Number);
    const [lastH, lastM] = bus.lastBus.split(':').map(Number);
    const firstMins = firstH * 60 + firstM;
    const lastMins = lastH * 60 + lastM;

    let status, nextBus;
    if (currentMins < firstMins) {
      status = 'not-started';
      nextBus = `First bus at ${bus.firstBus}`;
    } else if (currentMins > lastMins) {
      status = 'finished';
      nextBus = 'Service ended for today';
    } else {
      status = 'running';
      // Calculate approximate next bus based on frequency
      const freqMatch = bus.frequency.match(/(\d+)/);
      if (freqMatch) {
        const freq = parseInt(freqMatch[1]);
        const sinceFirst = currentMins - firstMins;
        const nextBusMins = freq - (sinceFirst % freq);
        nextBus = nextBusMins <= 2 ? 'Due now' : `In ~${nextBusMins} min${nextBusMins !== 1 ? 's' : ''}`;
      } else {
        nextBus = bus.frequency;
      }
    }

    return `
      <div class="bus-item status-${status}">
        <div class="bus-number">${number}</div>
        <div class="bus-info">
          <div class="bus-name">${bus.name}</div>
          <div class="bus-next">${nextBus}</div>
        </div>
        <div class="bus-freq">${bus.frequency}</div>
      </div>
    `;
  }).join('');

  busContainer.innerHTML = busHTML;
}

function updateBusynessIndicators() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;

  // Simplified busyness model based on typical patterns
  const getBusyness = (location) => {
    if (isWeekend) {
      if (location === 'library') return hour >= 11 && hour <= 18 ? 'moderate' : 'quiet';
      return 'quiet';
    }
    // Weekday patterns
    if (hour < 8 || hour > 20) return 'quiet';
    if (hour >= 12 && hour <= 14) return location === 'square4' ? 'busy' : 'moderate';
    if (hour >= 9 && hour <= 11) return location === 'library' ? 'moderate' : 'quiet';
    if (hour >= 14 && hour <= 17) return 'moderate';
    return 'quiet';
  };

  const locations = ['library', 'square4', 'sportscentre', 'subar'];
  locations.forEach(loc => {
    const el = document.getElementById(`busyness-${loc}`);
    if (!el) return;
    const level = getBusyness(loc);
    const labels = { quiet: 'Quiet now', moderate: 'Moderately busy', busy: 'Busy right now' };
    el.textContent = labels[level];
    el.className = `busyness-badge ${level}`;
  });
}

export function getOpeningHours(venueKey) {
  return ESSEX_OPENING_HOURS[venueKey] || null;
}

export function isVenueOpen(venueKey) {
  const venue = ESSEX_OPENING_HOURS[venueKey];
  if (!venue) return null;

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[now.getDay()];
  const hours = venue.hours[today];

  if (hours === 'Closed') return false;

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [open, close] = hours.split('-').map(t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  });

  return currentTime >= open && currentTime < close;
}

export function destroyRealtime() {
  if (updateInterval) clearInterval(updateInterval);
}
