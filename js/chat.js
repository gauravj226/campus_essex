// Essex Campus Navigator - js/chat.js
// Conversational AI chatbot with built-in Essex campus knowledge

import { navigateToPOI, showToast } from './app.js';

const CAMPUS_ID = 2195;

const chatToggle = document.getElementById('chat-toggle');
const chatWidget = document.getElementById('chat-widget');
const chatClose = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

let conversationHistory = [];

// Built-in Essex Campus Knowledge Base
const CAMPUS_KB = {
  library: {
    name: 'Albert Sloman Library',
    poiId: 'poi-library',
    keywords: ['library', 'books', 'study', 'reading', 'albert sloman'],
    answer: 'The Albert Sloman Library is the main library at Essex. It has 4 floors with study spaces, computers, and a vast collection of books and journals.',
    hours: 'Mon-Fri: 8:00-22:00, Sat-Sun: 9:00-18:00'
  },
  hexagon: {
    name: 'The Hexagon',
    keywords: ['hexagon', 'theatre', 'performance', 'shows'],
    answer: 'The Hexagon is Essex\'s main performance venue, hosting theatre shows, concerts, and events throughout the year.',
    hours: 'Event dependent'
  },
  silberrad: {
    name: 'Silberrad Student Centre',
    keywords: ['silberrad', 'student centre', 'union', 'su', 'bar', 'food'],
    answer: 'The Silberrad Student Centre is the heart of student life. It has the SU bar, shops, cafes, and student services.',
    hours: 'Mon-Fri: 8:00-23:00'
  },
  sport: {
    name: 'Sports Centre',
    keywords: ['sport', 'gym', 'fitness', 'swimming', 'pool'],
    answer: 'The Sports Centre has a gym, swimming pool, sports halls, and fitness classes. Day passes and memberships available.',
    hours: 'Mon-Fri: 6:30-22:00, Weekends: 8:00-20:00'
  },
  coffee: {
    name: 'Coffee Shops',
    keywords: ['coffee', 'cafe', 'starbucks', 'costa'],
    answer: 'Campus has several coffee options: Starbucks in the library, Costa in Square 3, and independent cafes in various buildings.',
    hours: 'Typically 8:00-18:00'
  },
  accommodation: {
    keywords: ['accommodation', 'halls', 'residence', 'towers', 'living'],
    answer: 'Essex has several accommodation towers including South Courts, Quays, and The Meadows. All are within walking distance of campus facilities.'
  },
  parking: {
    keywords: ['parking', 'car', 'park', 'vehicle'],
    answer: 'Main car parks are CP1 (near library) and CP5 (near Square 4). Permits required for regular parking. Visitor parking available.'
  }
};

// Toggle chat widget
chatToggle.addEventListener('click', () => {
  chatWidget.classList.toggle('active');
  if (chatWidget.classList.contains('active') && chatMessages.children.length === 0) {
    addBotMessage(getWelcomeMessage());
  }
  chatInput.focus();
});

chatClose.addEventListener('click', () => chatWidget.classList.remove('active'));

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// Welcome message based on time
function getWelcomeMessage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${greeting}! 👋 I'm your Essex Campus Navigator assistant. Ask me about:\n\n• Building locations\n• Opening hours\n• Campus facilities\n• Directions\n\nTry: "Where is the library?" or "Find coffee"`;
}

// Send message
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  
  chatInput.value = '';
  addUserMessage(text);
  conversationHistory.push({ role: 'user', content: text });
  
  const typing = addTypingIndicator();
  
  // Generate response from KB
  setTimeout(() => {
    const reply = queryKnowledgeBase(text);
    typing.remove();
    addBotMessage(reply);
    conversationHistory.push({ role: 'assistant', content: reply });
    
    // Check if we should offer navigation
    checkForNavigation(text);
  }, 500);
}

// Query knowledge base
function queryKnowledgeBase(query) {
  const q = query.toLowerCase();
  
  // Check for greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)/.test(q)) {
    return 'Hello! How can I help you navigate Essex campus today? Try asking about specific buildings or facilities.';
  }
  
  // Check for thanks
  if (/^(thanks|thank you|cheers)/.test(q)) {
    return 'You\'re welcome! Let me know if you need anything else.';
  }
  
  // Search knowledge base
  let bestMatch = null;
  let bestScore = 0;
  
  Object.entries(CAMPUS_KB).forEach(([key, entry]) => {
    const score = entry.keywords.filter(k => q.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  });
  
  if (bestMatch && bestScore > 0) {
    let response = bestMatch.answer;
    if (bestMatch.hours) response += `\n\n⏰ ${bestMatch.hours}`;
    if (bestMatch.name) {
      response += `\n\n📍 Would you like directions to ${bestMatch.name}? Click the search button above and enter "${bestMatch.name}".`;
    }
    return response;
  }
  
  // Handle location/direction queries
  if (/where|find|locate|direction|how to get/.test(q)) {
    return 'I can help you find locations on campus! Try asking about:\n\n• Library\n• Student Centre\n• Sports facilities\n• Coffee shops\n• Lecture theatres\n\nOr use the search bar at the top to search any building by name.';
  }
  
  // Handle time queries
  if (/open|hours|time|when/.test(q)) {
    return 'Most campus facilities are open:\n\n📚 Library: Mon-Fri 8am-10pm\n☕ Cafes: Daily 8am-6pm\n🏋️ Sports: Mon-Fri 6:30am-10pm\n\nSpecific building hours vary. What location are you interested in?';
  }
  
  // Default response
  return 'I\'m here to help with Essex campus navigation! I can assist with:\n\n• Finding buildings and facilities\n• Opening hours\n• Campus directions\n\nTry asking "Where is [building name]?" or use the search bar above to find any location.';
}

// Check if user wants navigation
function checkForNavigation(query) {
  const q = query.toLowerCase();
  if (/take me|navigate|directions|show me/.test(q)) {
    Object.entries(CAMPUS_KB).forEach(([key, entry]) => {
      if (entry.keywords.some(k => q.includes(k)) && entry.name) {
        showToast(`Use the search bar to find "${entry.name}"`, 'info');
      }
    });
  }
}

// UI helper functions
function addUserMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'chat-message user';
  msg.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBotMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'chat-message bot';
  msg.innerHTML = `<div class="message-content">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingIndicator() {
  const typing = document.createElement('div');
  typing.className = 'chat-message bot typing';
  typing.innerHTML = '<div class="message-content"><span></span><span></span><span></span></div>';
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return typing;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
