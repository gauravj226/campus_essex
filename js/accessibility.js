// Essex Campus Navigator - js/accessibility.js
// Accessible routing toggle + step-free route awareness

import { setAccessibilityMode, isAccessibilityMode, showToast } from './app.js';

const toggle = document.getElementById('accessibility-toggle');
const banner = document.createElement('div');
banner.className = 'accessibility-banner';
banner.innerHTML = '♿ Step-free routing enabled';
document.body.appendChild(banner);

// Restore saved preference
const saved = localStorage.getItem('essex_accessibility_mode') === 'true';
if (saved) enableAccessibility(false);

toggle.addEventListener('click', () => {
  if (isAccessibilityMode()) {
    disableAccessibility();
  } else {
    enableAccessibility(true);
  }
});

function enableAccessibility(announce = true) {
  setAccessibilityMode(true);
  toggle.classList.add('active');
  toggle.title = 'Accessibility mode ON - click to disable';
  banner.classList.add('active');
  localStorage.setItem('essex_accessibility_mode', 'true');
  if (announce) showToast('♿ Accessibility mode ON - step-free routes prioritised', 'info', 4000);

  // Tell MazeMap to prefer accessible routes
  if (window.Mazemap && window.Mazemap.Pathfinder) {
    try {
      // MazeMap supports accessible routing via route options
      document.dispatchEvent(new CustomEvent('accessibility-changed', { detail: { enabled: true } }));
    } catch (e) {}
  }
}

function disableAccessibility() {
  setAccessibilityMode(false);
  toggle.classList.remove('active');
  toggle.title = 'Enable accessibility mode';
  banner.classList.remove('active');
  localStorage.setItem('essex_accessibility_mode', 'false');
  showToast('Accessibility mode OFF', 'info', 3000);
  document.dispatchEvent(new CustomEvent('accessibility-changed', { detail: { enabled: false } }));
}

// Keyboard shortcut: Alt+A to toggle accessibility
document.addEventListener('keydown', e => {
  if (e.altKey && e.key === 'a') {
    e.preventDefault();
    toggle.click();
  }
});

// Export for other modules
export { enableAccessibility, disableAccessibility };
