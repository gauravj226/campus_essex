# Humanised Navigation (Colchester) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver landmark-aware, turn-by-turn campus navigation with live progression, rerouting, and voice guidance.

**Architecture:** Keep `app.js` as orchestrator, move navigation logic into `js/navigation.js`, and keep pure geometry/routing helpers in `js/navigation-utils.js`. Store campus landmark data in `data/landmarks.colchester.json` and use it to convert route waypoints into recognisable human cues.

**Tech Stack:** MazeMap JS v2, Mapbox line layers, browser Geolocation API, SpeechSynthesis API, local JSON data.

---

### Task 1: Landmark Data Foundation

**Files:**
- Create: `data/landmarks.colchester.json`
- Create: `js/landmarks.js`

- [ ] **Step 1: Define landmark schema and populate Colchester dataset**
- [ ] **Step 2: Add loader and nearest-landmark query helpers**
- [ ] **Step 3: Verify JSON load path from browser runtime**

### Task 2: Navigation Core + Utilities

**Files:**
- Create: `js/navigation-utils.js`
- Create: `js/navigation.js`
- Test: `tests/navigation-utils.test.mjs`

- [ ] **Step 1: Add failing tests for distance, turn classification, and off-route checks**
- [ ] **Step 2: Implement utility functions to satisfy tests**
- [ ] **Step 3: Build navigation controller for route building, instruction generation, and progression**

### Task 3: UI + Route Rendering

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`

- [ ] **Step 1: Add turn-by-turn panel with arrow, compass, progress, and controls**
- [ ] **Step 2: Add responsive styles for desktop/mobile readability**
- [ ] **Step 3: Draw completed/upcoming route line layers**

### Task 4: App Integration

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Integrate navigation controller with MazeMap pathfinder**
- [ ] **Step 2: Wire "Start Live Navigation" from route panel**
- [ ] **Step 3: Feed GPS updates into progression/off-route rerouting**
- [ ] **Step 4: Keep fallback external directions for route failures**

### Task 5: Verification

**Files:**
- Test: `tests/navigation-utils.test.mjs`

- [ ] **Step 1: Run utility test suite**
- [ ] **Step 2: Run JS syntax checks**
- [ ] **Step 3: Validate no missing module references**

