# 🎓 Essex Campus Navigator

**Humanised, AI-powered campus wayfinding for University of Essex**

An intelligent navigation system that wraps MazeMap with conversational search, accessibility routing, and personalized features — addressing all the UX gaps in the current Essex Maps implementation.

## 🚀 Live Demo

**GitHub Pages**: `https://gauravj226.github.io/campus_essex/`

## ✨ Features

### Core Improvements Over Current System
- 🤖 **Conversational AI Assistant** - Natural language queries ("Where's the nearest quiet study space?")
- ♿ **Accessibility-First Routing** - Step-free paths, lift-accessible routes
- ⭐ **Personal Favourites** - Save locations with custom nicknames ("My Lab", "Morning Coffee Spot")
- 📱 **PWA Offline Support** - Works without internet in basements/low-signal areas
- 🎯 **Smart Onboarding** - Guided tour for first-time users
- 🔍 **Enhanced Search** - Fuzzy matching, semantic search, natural language
- 📍 **Live Context** - Walking time estimates, busyness indicators
- 🎨 **Modern UI/UX** - Clean, mobile-first design

## 🛠️ Quick Setup

### Option 1: Automated Setup Script (Recommended)

```bash
# Clone the repo
git clone https://github.com/gauravj226/campus_essex.git
cd campus_essex

# Run the setup script to generate all files
python3 setup_project.py

# Commit and push
git add .
git commit -m "Add complete project structure"
git push origin main
```

### Option 2: Manual Setup

Files are already in the repo. Just:

```bash
git clone https://github.com/gauravj226/campus_essex.git
cd campus_essex
```

## 💻 Local Development

```bash
# Serve locally
python3 -m http.server 8000
# or
npx http-server .

# Open http://localhost:8000
```

## ☁️ Deployment

### GitHub Pages (Static Frontend)

1. Go to **Settings → Pages**
2. Source: **Deploy from branch**
3. Branch: **main** / root
4. Save

Your site will be live at `https://gauravj226.github.io/campus_essex/`

### Vercel (AI Backend + Frontend)

1. Import the repo to Vercel
2. Add environment variable:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```
3. Deploy

**Get free Groq API key**: https://console.groq.com/keys

## 🏗️ Architecture

```
GitHub Pages (Static)          Vercel (Serverless)
─────────────────────          ───────────────────
├─ index.html                     ├─ api/chat.js (RAG)
├─ css/styles.css                 └─ FAISS vector search
├─ js/
│   ├─ app.js (MazeMap)
│   ├─ chat.js
│   ├─ favourites.js
│   ├─ accessibility.js
│   └─ onboarding.js
└─ data/campus-kb.json
```

## 📚 Tech Stack

| Layer | Tool | Cost |
|-------|------|------|
| Map Engine | MazeMap JS API | Free |
| Static Hosting | GitHub Pages | Free |
| Serverless Functions | Vercel | Free tier |
| LLM | Groq (LLaMA 3.3) | Free tier |
| Vector Search | FAISS (local) | Free |
| Campus Data | MazeMap Data API | Free |

**Total cost: £0/month**

## 📋 Project Structure

```
campus_essex/
├── index.html              # Main app entry point
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline)
├── css/
│   └── styles.css          # Complete styling
├── js/
│   ├── app.js              # MazeMap init & routing
│   ├── chat.js             # RAG chatbot widget
│   ├── favourites.js       # localStorage system
│   ├── accessibility.js    # Accessible routing
│   └── onboarding.js       # First-time tour
├── api/
│   └── chat.js             # Vercel serverless RAG
├── data/
│   └── campus-kb.json      # Campus knowledge base
├── assets/
│   ├── icon-192.png
│   └── icon-512.png
├── vercel.json             # Vercel config
├── setup_project.py        # Auto-generate all files
└── README.md
```

## 🛣️ Roadmap

- [ ] Indoor navigation with floor switching
- [ ] Voice-guided navigation
- [ ] AR wayfinding overlay
- [ ] Live event integration (timetables, campus events)
- [ ] Crowd-sourced accessibility reports
- [ ] Multi-language support

## 📝 License

MIT License - Free to use, modify, and distribute

## 👥 Contributing

Pull requests welcome! This is a student-led improvement project.

## 🔗 Resources

- **MazeMap API**: https://api.mazemap.com/
- **Essex Campus ID**: `2195`
- **Original Essex Maps**: https://findyourway.essex.ac.uk/
- **Groq (Free LLM API)**: https://console.groq.com/

---

**Built with ❤️ by Gaurav Jain | University of Essex**
