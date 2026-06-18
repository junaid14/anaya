# Anaya — Care. Support. Peace of Mind.
> Family health and medication management platform for senior citizens

---

## Vision

Anaya is a mobile-first health companion designed for elderly patients and their families. It tracks blood glucose, HbA1c trends, and manages medication subscriptions — all in a simple, accessible interface that works without any app store download.

Built as a Progressive Web App (PWA), Anaya runs entirely in the browser and can be added to the home screen of any iPhone or Android device. No installation, no login friction for basic use.

---

## Current Status

**Version:** 2.0 (active development)
**Platform:** Single HTML file → moving to 3-file split (index.html / style.css / app.js)
**Hosting:** GitHub Pages (static)
**AI Engine:** Google Gemini 1.5 Flash / 2.0 Flash / 2.5 Flash (with automatic fallback)

---

## Core Features (Live)

### Patient Management
- Multi-patient support with colour-coded avatars
- Per-patient profile: name, age, gender, diabetes type, diabetes duration (since year), medications, general condition
- Patient picker screen on launch

### Glucose Monitoring
- Manual glucose log with meal context (Fasting / Before meal / After meal 1hr-2hr / Bedtime / Random)
- OCR scanning — glucometer photo or lab report upload (AI extracts values)
- Voice input — speak readings in English or Hindi/Hinglish, AI interprets
- Trend chart with separate coloured lines per meal type (Fasting/Pre/Post/Other)
- 30-day default view, range selector (7D/14D/30D/All)
- Tap any reading on chart to edit

### HbA1c Tracking
- Estimated HbA1c from glucose log (Nathan formula)
- Manual lab result entry with date and notes
- Trend chart, reference band, eAG conversion
- Lab history list — tap any entry to edit

### AI Doctor Insights (Gemini)
- Full clinical assessment: 8 sections (Control, Fasting, Pre-meal, Post-meal, Trends, Medication Effectiveness, Concerns, Recommendations)
- Age-aware targets (relaxed for 75+)
- Gender-correct salutation
- Global reference analysis style for consistent output quality
- Per-patient saved insights — persists until manually refreshed
- Compact chip view on dashboard, full view on Insights tab
- 3-attempt retry on API failure with progress indicator

### Reports
- A4 lab-style PDF/PNG report generation
- Includes: patient info, highlights, trend chart (meal-type lines), HbA1c analysis, full readings table (newest first)
- Share via iOS share sheet or download

### Medication Subscription
- Subscribe to medication deliveries with: medications list, address, mobile, start/end date, frequency (Weekly/Fortnightly/Monthly)
- Adopt medications directly from patient profile
- Email notification on new subscription, pause, resume, stop
- View and manage active subscriptions

### Communication
- Send Query/Complaint from Profile tab → email to admin
- All emails via FormSubmit (no backend required)

### App Settings (Admin)
- Hardcoded: admin email, Gemini API key, reference analysis style
- Read-only display in app — no user editing

---

## Design System

**Brand:** Anaya
**Tagline:** Care. Support. Peace of Mind.
**Logo colours:** Teal `#1BAA9C` · Navy `#0D2C4D` · Coral `#FF7A7A` · Light `#E6F5F2`
**Font:** Poppins (Google Fonts)
**UI Style:** Liquid glass morphism — `backdrop-filter: blur()`, translucent layered cards, shimmer highlights
**Accessibility:** Senior-citizen focus — 16px+ base font, high contrast, large touch targets, simple navigation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (ES8) |
| Styling | Custom CSS with CSS variables, backdrop-filter |
| AI | Google Gemini API (REST, browser-direct) |
| OCR | Gemini Vision (image + PDF) |
| Voice | Web Speech API (Safari/Chrome) |
| Email | FormSubmit.co (no backend) |
| Charts | HTML5 Canvas (custom drawn) |
| Reports | Canvas → PNG/PDF |
| Storage | localStorage (per-device) |
| Hosting | GitHub Pages |
| PWA | Meta tags (full PWA manifest pending) |

---

## Repository Structure (after split)

```
/
├── index.html          # Shell: meta, links to CSS/JS, all HTML screens
├── style.css           # All styles, CSS variables, animations
├── app.js              # All JavaScript — data, logic, AI, charts
├── PROJECT.md
├── DATA_SCHEMA.md
├── ARCHITECTURE.md
├── TODO.md
├── HANDOFF.md
└── CHANGELOG.md
```

---

## Team / Owner

Built for: Personal use + neighbourhood deployment
Contact channel: Admin email hardcoded in `app.js` → `APP_ADMIN_EMAIL`
