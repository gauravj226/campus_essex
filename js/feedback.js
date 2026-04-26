// feedback.js - Community feedback, ratings, and issue reporting

const FEEDBACK_KEY = 'essex_feedback';
const RATINGS_KEY = 'essex_ratings';

let feedbackData = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
let ratingsData = JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}');

export function initFeedback() {
  setupFeedbackButton();
  setupRatingWidgets();
  setupReportIssueButton();
  loadCommunityFeedback();
}

function setupFeedbackButton() {
  const feedbackBtn = document.getElementById('feedback-btn');
  const feedbackModal = document.getElementById('feedback-modal');
  const closeFeedback = document.getElementById('close-feedback');
  const feedbackForm = document.getElementById('feedback-form');

  if (feedbackBtn && feedbackModal) {
    feedbackBtn.addEventListener('click', () => {
      feedbackModal.classList.add('active');
    });
  }

  if (closeFeedback && feedbackModal) {
    closeFeedback.addEventListener('click', () => {
      feedbackModal.classList.remove('active');
    });
  }

  if (feedbackForm) {
    feedbackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitFeedback(feedbackForm);
    });
  }

  // Close on backdrop click
  if (feedbackModal) {
    feedbackModal.addEventListener('click', (e) => {
      if (e.target === feedbackModal) feedbackModal.classList.remove('active');
    });
  }
}

function submitFeedback(form) {
  const typeEl = form.querySelector('[name="feedback-type"]');
  const locationEl = form.querySelector('[name="feedback-location"]');
  const messageEl = form.querySelector('[name="feedback-message"]');
  const ratingEl = form.querySelector('[name="feedback-rating"]:checked');

  if (!messageEl || !messageEl.value.trim()) {
    showFormError('Please enter your feedback message.');
    return;
  }

  const entry = {
    id: Date.now(),
    type: typeEl ? typeEl.value : 'general',
    location: locationEl ? locationEl.value : '',
    message: messageEl.value.trim(),
    rating: ratingEl ? parseInt(ratingEl.value) : null,
    timestamp: new Date().toISOString(),
    helpful: 0
  };

  feedbackData.unshift(entry);
  // Keep last 50 feedback items
  feedbackData = feedbackData.slice(0, 50);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackData));

  form.reset();
  const modal = document.getElementById('feedback-modal');
  if (modal) modal.classList.remove('active');

  if (window.showToast) {
    window.showToast('Thank you for your feedback! It helps improve the campus experience.', 'success', 4000);
  }

  loadCommunityFeedback();
}

function setupRatingWidgets() {
  document.querySelectorAll('.star-rating').forEach(widget => {
    const locationKey = widget.dataset.location;
    const stars = widget.querySelectorAll('.star');
    
    // Load saved rating
    const saved = ratingsData[locationKey];
    if (saved) highlightStars(stars, saved);

    stars.forEach((star, index) => {
      star.addEventListener('mouseover', () => highlightStars(stars, index + 1));
      star.addEventListener('mouseout', () => {
        const current = ratingsData[locationKey] || 0;
        highlightStars(stars, current);
      });
      star.addEventListener('click', () => {
        const rating = index + 1;
        ratingsData[locationKey] = rating;
        localStorage.setItem(RATINGS_KEY, JSON.stringify(ratingsData));
        highlightStars(stars, rating);
        updateAverageRating(locationKey);
        if (window.showToast) {
          window.showToast(`Rated ${rating}/5 stars. Thanks!`, 'success', 2000);
        }
      });
    });
  });
}

function highlightStars(stars, count) {
  stars.forEach((star, i) => {
    star.classList.toggle('active', i < count);
  });
}

function updateAverageRating(locationKey) {
  // In a real app this would aggregate from server
  // For now simulate with local data
  const el = document.getElementById(`avg-rating-${locationKey}`);
  if (!el) return;
  
  const userRating = ratingsData[locationKey];
  if (userRating) {
    el.textContent = `Your rating: ${userRating}/5`;
  }
}

function setupReportIssueButton() {
  const reportBtn = document.getElementById('report-issue-btn');
  const reportModal = document.getElementById('report-modal');
  const closeReport = document.getElementById('close-report');
  const reportForm = document.getElementById('report-form');

  if (reportBtn && reportModal) {
    reportBtn.addEventListener('click', () => {
      // Pre-fill location from current map view if available
      const locationInput = reportModal.querySelector('[name="report-location"]');
      if (locationInput && window.currentLocation) {
        locationInput.value = window.currentLocation;
      }
      reportModal.classList.add('active');
    });
  }

  if (closeReport && reportModal) {
    closeReport.addEventListener('click', () => {
      reportModal.classList.remove('active');
    });
  }

  if (reportForm) {
    reportForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitReport(reportForm);
    });
  }
}

function submitReport(form) {
  const typeEl = form.querySelector('[name="report-type"]');
  const locationEl = form.querySelector('[name="report-location"]');
  const descEl = form.querySelector('[name="report-description"]');

  if (!descEl || !descEl.value.trim()) {
    showFormError('Please describe the issue.');
    return;
  }

  const report = {
    id: Date.now(),
    type: typeEl ? typeEl.value : 'other',
    location: locationEl ? locationEl.value : 'Unknown',
    description: descEl.value.trim(),
    timestamp: new Date().toISOString(),
    status: 'submitted'
  };

  // Save to local storage
  const reports = JSON.parse(localStorage.getItem('essex_reports') || '[]');
  reports.unshift(report);
  localStorage.setItem('essex_reports', JSON.stringify(reports.slice(0, 20)));

  form.reset();
  const modal = document.getElementById('report-modal');
  if (modal) modal.classList.remove('active');

  if (window.showToast) {
    window.showToast('Issue reported. The campus team will look into it.', 'success', 4000);
  }
}

function loadCommunityFeedback() {
  const container = document.getElementById('community-feedback');
  if (!container) return;

  if (feedbackData.length === 0) {
    container.innerHTML = '<p class="no-feedback">No feedback yet. Be the first to share your thoughts!</p>';
    return;
  }

  const recent = feedbackData.slice(0, 5);
  container.innerHTML = recent.map(item => `
    <div class="feedback-item type-${item.type}">
      <div class="feedback-header">
        <span class="feedback-type-badge">${formatType(item.type)}</span>
        ${item.location ? `<span class="feedback-location">${item.location}</span>` : ''}
        ${item.rating ? `<span class="feedback-stars">${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</span>` : ''}
        <span class="feedback-time">${timeAgo(item.timestamp)}</span>
      </div>
      <p class="feedback-message">${escapeHtml(item.message)}</p>
      <div class="feedback-actions">
        <button class="helpful-btn" data-id="${item.id}">
          👍 Helpful (${item.helpful})
        </button>
      </div>
    </div>
  `).join('');

  // Helpful buttons
  container.querySelectorAll('.helpful-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const item = feedbackData.find(f => f.id === id);
      if (item) {
        item.helpful++;
        localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackData));
        btn.textContent = `👍 Helpful (${item.helpful})`;
        btn.disabled = true;
      }
    });
  });
}

function formatType(type) {
  const labels = {
    general: 'General', navigation: 'Navigation', accessibility: 'Accessibility',
    food: 'Food & Drink', facilities: 'Facilities', suggestion: 'Suggestion'
  };
  return labels[type] || type;
}

function timeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showFormError(message) {
  if (window.showToast) {
    window.showToast(message, 'error', 3000);
  }
}

export { feedbackData };
