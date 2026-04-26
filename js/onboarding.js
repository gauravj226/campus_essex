// onboarding.js - User onboarding and personalisation for Essex Campus Navigator

const ONBOARDING_KEY = 'essex_onboarding_complete';
const USER_PROFILE_KEY = 'essex_user_profile';

let userProfile = {
  name: '',
  role: '',
  campus: 'colchester',
  interests: [],
  onboardingComplete: false
};

export function initOnboarding() {
  const stored = localStorage.getItem(USER_PROFILE_KEY);
  if (stored) {
    userProfile = JSON.parse(stored);
  }

  const complete = localStorage.getItem(ONBOARDING_KEY);
  if (!complete) {
    showOnboardingModal();
  } else {
    applyUserProfile();
  }
}

export function getUserProfile() {
  return userProfile;
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
  showOnboardingModal();
}

function showOnboardingModal() {
  const modal = document.getElementById('onboarding-modal');
  if (!modal) return;
  modal.classList.add('active');
  setupOnboardingSteps();
}

function setupOnboardingSteps() {
  let currentStep = 0;
  const steps = document.querySelectorAll('.onboarding-step');
  const nextBtn = document.getElementById('onboarding-next');
  const prevBtn = document.getElementById('onboarding-prev');
  const finishBtn = document.getElementById('onboarding-finish');
  const progressDots = document.querySelectorAll('.progress-dot');

  function showStep(index) {
    steps.forEach((s, i) => {
      s.classList.toggle('active', i === index);
    });
    progressDots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
    if (prevBtn) prevBtn.style.display = index === 0 ? 'none' : 'block';
    if (nextBtn) nextBtn.style.display = index === steps.length - 1 ? 'none' : 'block';
    if (finishBtn) finishBtn.style.display = index === steps.length - 1 ? 'block' : 'none';
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentStep < steps.length - 1) {
        collectStepData(currentStep);
        currentStep++;
        showStep(currentStep);
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
      }
    });
  }

  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      collectStepData(currentStep);
      completeOnboarding();
    });
  }

  // Role selection buttons
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      userProfile.role = btn.dataset.role;
    });
  });

  // Campus selection
  document.querySelectorAll('.campus-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.campus-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      userProfile.campus = btn.dataset.campus;
    });
  });

  // Interest checkboxes
  document.querySelectorAll('.interest-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        userProfile.interests.push(cb.value);
      } else {
        userProfile.interests = userProfile.interests.filter(i => i !== cb.value);
      }
    });
  });

  showStep(0);
}

function collectStepData(stepIndex) {
  if (stepIndex === 0) {
    const nameInput = document.getElementById('onboarding-name');
    if (nameInput && nameInput.value.trim()) {
      userProfile.name = nameInput.value.trim();
    }
  }
}

function completeOnboarding() {
  userProfile.onboardingComplete = true;
  localStorage.setItem(ONBOARDING_KEY, 'true');
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfile));

  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.remove('active');

  applyUserProfile();
  showWelcomeMessage();
}

function applyUserProfile() {
  // Update greeting
  const greeting = document.getElementById('user-greeting');
  if (greeting && userProfile.name) {
    greeting.textContent = `Hi, ${userProfile.name}!`;
  }

  // Apply campus filter
  if (userProfile.campus) {
    document.body.dataset.campus = userProfile.campus;
  }

  // Apply role-based UI hints
  if (userProfile.role) {
    document.body.dataset.role = userProfile.role;
  }
}

function showWelcomeMessage() {
  const name = userProfile.name ? `, ${userProfile.name}` : '';
  const role = userProfile.role || 'visitor';
  
  // Show a toast welcome
  if (window.showToast) {
    window.showToast(`Welcome${name}! Your personalised campus map is ready. 🎓`, 'success', 5000);
  }

  // Pre-populate chat with a helpful first message based on role
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) {
    const suggestions = getRoleSuggestions(role);
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message bot-message';
    msgEl.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <p>Welcome${name}! I'm your campus assistant. Here are some things I can help you with:</p>
        <div class="quick-suggestions">
          ${suggestions.map(s => `<button class="suggestion-chip" onclick="document.getElementById('chat-input').value='${s}'; document.getElementById('chat-send').click()">${s}</button>`).join('')}
        </div>
      </div>
    `;
    chatMessages.appendChild(msgEl);
  }
}

function getRoleSuggestions(role) {
  const suggestions = {
    student: ['Where is the library?', 'Find a quiet study space', 'Where can I eat on campus?'],
    staff: ['Find my department building', 'Where is parking?', 'Meeting rooms near Square 4'],
    visitor: ['Campus entrance locations', 'Visitor parking', 'Reception and information'],
    researcher: ['Research labs locations', 'Graduate Centre', 'Conference rooms']
  };
  return suggestions[role] || suggestions.visitor;
}
