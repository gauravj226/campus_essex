// Essex Campus Navigator - js/accessibility.js
// Accessible routing toggle + step-free route awareness

import { setAccessibilityMode, isAccessibilityMode, showToast } from './app.js';

const toggle = document.getElementById('accessibility-toggle');
const banner = document.getElementById('accessibility-banner');

// Restore saved preference
const saved = localStorage.getItem('essex_accessibility_mode') === 'true';
if (toggle && saved) enableAccessibility(false);

if (toggle) {
  toggle.addEventListener('click', () => {
    if (isAccessibilityMode()) {
      disableAccessibility();
    } else {
      enableAccessibility(true);
    }
  });
}

function enableAccessibility(announce = true) {
  if (!toggle) return;

  setAccessibilityMode(true);
  toggle.classList.add('active');
  toggle.title = 'Accessibility mode ON - click to disable';
  if (banner) banner.classList.add('active');

  localStorage.setItem('essex_accessibility_mode', 'true');
  if (announce) showToast('Accessibility mode ON - step-free routes prioritised', 'info', 4000);

  document.dispatchEvent(new CustomEvent('accessibility-changed', { detail: { enabled: true } }));
}

function disableAccessibility() {
  if (!toggle) return;

  setAccessibilityMode(false);
  toggle.classList.remove('active');
  toggle.title = 'Enable accessibility mode';
  if (banner) banner.classList.remove('active');

  localStorage.setItem('essex_accessibility_mode', 'false');
  showToast('Accessibility mode OFF', 'info', 3000);
  document.dispatchEvent(new CustomEvent('accessibility-changed', { detail: { enabled: false } }));
}

// Keyboard shortcut: Alt+A to toggle accessibility
document.addEventListener('keydown', e => {
  if (toggle && e.altKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    toggle.click();
  }
});

export { enableAccessibility, disableAccessibility };
