# ARCHITECTURE.md — Anaya

---

## Overview

Anaya is a **zero-backend PWA** — a single-page app that runs entirely in the user's browser. There is no server, no database, no authentication server. All data lives in `localStorage`. External services are called directly from the browser using public APIs.

```
┌─────────────────────────────────────────────────┐
│                   USER DEVICE                    │
│                                                  │
│   ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│   │index.html│  │ style.css│  │   app.js    │  │
│   └──────────┘  └──────────┘  └─────────────┘  │
│          │             │              │           │
│          └─────────────┴──────────────┘           │
│                        │                          │
│              ┌─────────▼──────────┐               │
│              │    localStorage     │               │
│              │ patients/readings   │               │
│              │ hba1c/subscriptions │               │
│              └────────────────────┘               │
└───────────────────┬─────────────┬─────────────────┘
                    │             │
         ┌──────────▼──┐   ┌──────▼──────────┐
         │ Gemini API  │   │  FormSubmit.co  │
         │(AI/OCR/Voice│   │  (Email relay)  │
         └─────────────┘   └─────────────────┘
```

---

## File Structure

### `index.html` (~690 lines)
- `<head>` — meta tags, PWA config, links to style.css
- All HTML screens as `<div class="screen" id="screen-X">` divs
- All modals
- Bottom navigation
- Link to app.js

### `style.css` (~420 lines)
- CSS custom properties (`:root` variables — Anaya brand palette)
- Light mode override (`body.light-mode`)
- Liquid glass card styles (`backdrop-filter`)
- Bottom nav with semicircular FAB cutout
- Screen transition animations
- Component styles: hero card, stat boxes, charts, modals, pills, chips

### `app.js` (~3100 lines)
Organised into labelled sections:
```
DATA           — localStorage read/write helpers
BOOT           — app init, patient picker, loadPatient()
PATIENT LIST   — renderPatientList(), add/edit/delete patient
HBA1C MODAL    — openHba1cModal(), openEditHba1c(), saveManualHba1c()
SWITCH TAB     — switchTab(), screen transitions
READINGS       — addReading(), deleteReading(), setDefaultDateTime()
STATUS         — getStatus() — low/normal/high classification
HBA1C CALC     — calcHba1c(), hba1cInterp(), renderHba1c()
REFRESH        — refreshAll(), refreshDashboard()
PROFILE        — populateProfileForm(), updateProfile()
CHART          — drawChart(), drawChartInternal(), setupChartTap()
REPORT MODAL   — generateReport(), buildReportCanvas()
AI INSIGHTS    — loadAiInsights(), formatAiInsights(), loadSavedInsights*()
LOG MODE       — setLogMode(), OCR, Voice input
OCR            — handleOcrFile(), renderOcrResults(), saveAllOcrReadings()
VOICE          — initVoice(), toggleVoiceRecording(), analyseVoiceTranscript()
APP SETTINGS   — hardcoded constants, initHardcodedSettings(), geminiFetch()
EDIT READING   — openEditReading(), saveEditReading()
THEME          — toggleTheme(), applyTheme()
FAB            — openAddModal(), openLastReadingEdit()
CONFIRM DELETE — confirmDeleteReading(), confirmDeleteHba1c()
SUBSCRIPTION   — full subscription CRUD + FormSubmit emails
QUERY          — sendProfileQuery(), sendQueryEmail()
UTILS          — showToast(), exportData(), clearReadings()
SWIPE          — touch gesture handler
```

---

## Screen Architecture

```
App Shell
├── Picker Screen (#picker)          — patient selection on launch
└── Main App (#mainApp)
    ├── Header                       — Anaya logo, patient name, 🌙, ⚙️
    ├── Screens Container
    │   ├── screen-dashboard         — hero card, stats, chart, HbA1c, share
    │   ├── screen-insights          — AI Doctor Insights (full), target ranges
    │   ├── screen-subscribe         — subscription management
    │   ├── screen-add               — log reading (manual/scan/voice)
    │   ├── screen-profile           — patient profile, medications, query
    │   └── screen-settings          — app settings (read-only, admin)
    └── Bottom Nav
        ├── tab-dashboard (🏠 Home)
        ├── tab-subscribe (💊 Subscribe)
        ├── FAB (➕ teal circle)
        ├── tab-insights (🩺 Insights)
        └── tab-profile (👤 Profile)
        [⚙️ Settings accessible via header gear icon only]
```

---

## Navigation Flow

```
App Load
  → initHardcodedSettings()
  → applyTheme()
  → if no patients → showPicker() [add first patient]
  → else loadPatient(lastPatientId)
    → switchTab('dashboard')
    → refreshAll()
    → loadSavedInsights()

switchTab(id)
  → animate out current screen (slide-left / slide-right)
  → animate in new screen
  → trigger screen-specific refresh:
      dashboard  → drawChart() + refreshHba1c()
      insights   → loadSavedInsightsFull()
      settings   → loadSettingsScreen()
      profile    → populateProfileForm()
      subscribe  → renderSubscriptions()

Swipe gesture (touch)
  → TAB_ORDER = [dashboard, subscribe, insights, profile, settings]
  → dx > 50px && dx > 1.5*dy → switchTab(adjacent)
```

---

## Data Flow

### Adding a Glucose Reading
```
User input → addReading()
  → validate (val 20–600, date, time)
  → push to readings[]
  → saveReadings(pid, readings)  [→ localStorage]
  → refreshDashboard()
  → renderHistory() [no-op if history screen removed]
```

### AI Insights
```
loadAiInsights()
  → build prompt (patient profile + 90-day stats + 30 readings)
  → geminiFetch(prompt)
    → retry loop (3 attempts, 1.5s/3s backoff)
    → fetch → Gemini API → raw text
  → formatAiInsights(rawText)
    → returns { chipHtml, fullHtml }
  → render chipHtml → dashboard aiInsightsBody
  → render fullHtml → insights tab aiInsightsBodyFull
  → save to localStorage glucoInsights_{pid}
```

### OCR / Image Analysis
```
handleOcrFile(input, 'glucometer'|'labreport')
  → fileToBase64(file)
  → build prompt (different for glucometer vs lab report)
  → geminiFetch(prompt, base64, mimeType)
  → parse JSON from response
  → renderOcrResults() [editable review cards]
  → user edits → saveAllOcrReadings()
```

### Voice Input
```
toggleVoiceRecording()
  → Web Speech API (lang: en-IN or hi-IN)
  → continuous:true, interimResults:true
  → 2s silence timer → stopAndAnalyse()
  → analyseVoiceTranscript()
    → geminiFetch(Hindi/Hinglish prompt)
    → parse {val, date, time, meal, notes}
    → renderOcrResults() for review
```

### Subscription Email
```
startSubscription()
  → validate fields
  → build subscription object
  → push to subscriptions[]
  → saveSubscriptions() [→ localStorage]
  → create hidden <form> → FormSubmit.co/${APP_ADMIN_EMAIL}
  → form.submit() via hidden iframe
  → showToast()
```

---

## External Services

### Google Gemini API
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Auth:** API key in query param `?key=`
- **Models tried (in order):** gemini-2.5-flash → gemini-2.0-flash → gemini-2.0-flash-lite → gemini-1.5-flash-001
- **Key location:** `APP_GEMINI_KEY` constant in `app.js`
- **Usage:** AI Insights, OCR image analysis, voice transcript interpretation

### FormSubmit.co
- **Method:** Hidden HTML form POST to `https://formsubmit.co/{email}`
- **Auth:** None (email is the key)
- **Used for:** New subscription, subscription pause/stop, user query
- **Email address:** `APP_ADMIN_EMAIL` constant in `app.js`

---

## PWA Status

| Feature | Status |
|---|---|
| Responsive mobile layout | ✅ |
| Add to Home Screen (manual) | ✅ (via Safari Share menu) |
| Full-screen mode | ✅ (`apple-mobile-web-app-capable`) |
| `manifest.json` | ❌ Not yet created |
| Service Worker | ❌ Not yet implemented |
| Offline support | ❌ Requires service worker |
| Auto install prompt (Android) | ❌ Requires manifest |
| App icon (PNG set) | ❌ Pending design assets |

---

## Security Notes

1. **API key is client-side** — the Gemini API key is visible in `app.js` source. This is acceptable for personal/family use but not for public deployment. For public scale, route through a backend proxy.
2. **No authentication** — any person with the URL can add patients. For neighbourhood deployment consider adding a simple PIN.
3. **FormSubmit** — email address is visible in source. FormSubmit has spam protection but consider rate limiting for public use.
4. **localStorage** — data is device-local and cleared if user clears browser data. No backup mechanism currently.

---

## Planned Architecture (v3 — Supabase)

```
Browser (PWA)
  ↕  REST/Realtime
Supabase
  ├── Auth (email/password per user)
  ├── PostgreSQL (patients, readings, hba1c, subscriptions)
  ├── Row Level Security (per-user data isolation)
  └── Storage (voice recordings for Twilio)
  ↕
Render/Railway (background jobs)
  └── Twilio (automated voice call alerts)
```
