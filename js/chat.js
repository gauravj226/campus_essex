// Essex Campus Navigator - js/chat.js
// Conversational AI chatbot with local knowledge base fallback

import { navigateToPOI, showToast } from './app.js';

const CAMPUS_ID = 2195;
const API_ENDPOINT = '/api/chat';

const chatToggle = document.getElementById('chat-toggle');
const chatWidget = document.getElementById('chat-widget');
const chatClose = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

let conversationHistory = [];

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

function getWelcomeMessage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${greeting}! I'm your Essex campus guide. Ask me anything like:

- "Where is the Albert Sloman Library?"
- "How do I get to the Sports Centre?"
- "Where's the nearest coffee shop?"
- "Is Square 3 accessible by wheelchair?"`;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  addUserMessage(text);
  conversationHistory.push({ role: 'user', content: text });

  const typing = addTypingIndicator();

  // Try to answer from local KB first for speed
  const localAnswer = queryLocalKB(text);

  try {
    let reply;
    // Try the Vercel API endpoint first
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: conversationHistory.slice(-6) })
      });
      if (res.ok) {
        const data = await res.json();
        reply = data.reply;
      } else throw new Error('API unavailable');
    } catch {
      // Fallback to local KB
      reply = localAnswer || generateLocalResponse(text);
    }

    typing.remove();
    addBotMessage(reply);
    conversationHistory.push({ role: 'assistant', content: reply });

    // If reply contains a navigatable place, offer to navigate
    checkForNavigation(text, reply);

  } catch (err) {
    typing.remove();
    addBotMessage('Sorry, I had trouble with that. Try searching directly in the search bar above.');
  }
}

function queryLocalKB(query) {
  const q = query.toLowerCase();
  const kb = window.CAMPUS_KB || [];

  // Find best matching entry
  let best = null;
  let bestScore = 0;

  kb.forEach(entry => {
    const keywords = entry.keywords || [];
    const score = keywords.filter(k => q.includes(k.toLowerCase())).length;
    if (score > bestScore) { bestScore = score; best = entry; }
  });

  if (best && bestScore >= 1) {
    let response = best.answer;
    if (best.location) response += `\n\nLocation: ${best.location}`;
    if (best.floor) response += ` | Floor: ${best.floor}`;
    if (best.hours) response += `\nHours: ${best.hours}`;
    return response;
  }
  return null;
}

function generateLocalResponse(query) {
  const q = query.toLowerCase();

  if (q.includes('library') || q.includes('book')) {
    return 'The Albert Sloman Library is the main library on Colchester campus. It offers 24/7 access during term time, silent study zones, group study rooms, and printing facilities. Search "library" on the map to navigate there.';
  }
  if (q.includes('coffee') || q.includes('cafe') || q.includes('food') || q.includes('eat')) {
    return 'There are several cafes on campus: The Silberrad Student Centre has a Costa Coffee, Square 3 has the Hub Cafe, and the Essex Business School has a cafe too. Search "cafe" on the map to find the nearest one.';
  }
  if (q.includes('toilet') || q.includes('bathroom') || q.includes('wc') || q.includes('restroom')) {
    return 'Toilets are available in all major buildings. Accessible (gender-neutral) toilets are in: Albert Sloman Library (all floors), Silberrad Student Centre, Square 4, and the Essex Business School.';
  }
  if (q.includes('sports') || q.includes('gym') || q.includes('pool')) {
    return 'The Essex Sport Arena is located on the south side of campus. It includes a gym, swimming pool, sports hall, and climbing wall. Opening hours: Mon-Fri 6:30am-10pm, Sat-Sun 8am-8pm. Search "sports" on the map.';
  }
  if (q.includes('parking') || q.includes('car park')) {
    return 'Car parks are available on campus. Permit holders can park in designated zones. Visitor parking is available near the main entrance on Wivenhoe Park. Search "car park" on the map.';
  }
  if (q.includes('bus') || q.includes('transport')) {
    return 'The main bus stops are near the Library and at the University Square. Services 62 and 62A connect campus to Colchester town centre. The Park and Ride is also available from Hythe.';
  }
  if (q.includes('accessible') || q.includes('wheelchair') || q.includes('disability')) {
    return 'Essex campus has step-free access to most buildings. Enable accessibility mode (the ♿ button at the top) to see accessible routes. The Disability Services office is in the Silberrad Student Centre.';
  }
  if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
    return 'Hello! I am your Essex campus guide. Ask me about buildings, facilities, directions, or anything campus-related!';
  }
  if (q.includes('thank')) {
    return 'You are welcome! Let me know if you need help finding anything else on campus.';
  }

  return `I can help you find locations on Essex Colchester campus. Try asking about specific buildings (e.g. "Where is Square 3?"), facilities (e.g. "nearest cafe"), or services (e.g. "disability services"). You can also use the search bar at the top to search the live map directly.`;
}

async function checkForNavigation(query, reply) {
  const placeKeywords = ['library', 'sports', 'square 3', 'square 4', 'silberrad', 'essex business school', 'stem', 'health'];
  const found = placeKeywords.find(p => query.toLowerCase().includes(p) || reply.toLowerCase().includes(p));
  if (found) {
    setTimeout(() => {
      const navMsg = document.createElement('div');
      navMsg.className = 'chat-message';
      navMsg.innerHTML = `
        <div class="message-avatar">E</div>
        <div class="message-content">
          <button id="quick-nav-btn" style="background:var(--essex-orange);color:#fff;border:none;padding:8px 16px;border-radius:20px;cursor:pointer;font-weight:600;margin-top:4px">
            Navigate to ${found} on map
          </button>
        </div>`;
      chatMessages.appendChild(navMsg);
      navMsg.querySelector('#quick-nav-btn').addEventListener('click', () => {
        document.getElementById('search-input').value = found;
        document.getElementById('search-btn').click();
        chatWidget.classList.remove('active');
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 800);
  }
}

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-message user';
  div.innerHTML = `<div class="message-avatar">You</div><div class="message-content">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBotMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `<div class="message-avatar">E</div><div class="message-content">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `<div class="message-avatar">E</div><div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Load campus KB for local answering
fetch('./data/campus-kb.json')
  .then(r => r.json())
  .then(data => { window.CAMPUS_KB = data; })
  .catch(() => { window.CAMPUS_KB = []; });
