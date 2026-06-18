# HANDOFF.md — Anaya
> Everything a new developer needs to pick up this project from scratch.
> Last updated: June 2026 — v2.0 (3-file split)

---

## Quickstart (5 minutes)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/anaya.git
cd anaya

# 2. Open in browser — no build step, no npm, no dependencies
open index.html        # macOS
# or drag index.html into Chrome / Safari

# 3. Deploy to GitHub Pages
git add . && git commit -m "deploy" && git push
# Live at: https://YOUR_USERNAME.github.io/anaya
```

> ⚠️ All three files must be in the same directory: `index.html`, `style.css`, `app.js`
> Opening `index.html` locally via `file://` will fail to load CSS/JS on some browsers.
> Use a local server: `python3 -m http.server 8080` then open `http://localhost:8080`

---

## Before You Deploy — Required Setup

Open `app.js` and search for `HARDCODED APP SETTINGS`. You will find three constants near the top:

```js
const APP_ADMIN_EMAIL        = 'YOUR_EMAIL@gmail.com';
const APP_GEMINI_KEY         = 'YOUR_GEMINI_API_KEY_HERE';
const APP_REFERENCE_ANALYSIS = `...sample analysis text...`;
```

Replace all three before pushing to GitHub:

| Constant | What to put | Where to get it |
|---|---|---|
| `APP_ADMIN_EMAIL` | Your email address | Any email you own |
| `APP_GEMINI_KEY` | Your Gemini API key | [aistudio.google.com](https://aistudio.google.com) |
| `APP_REFERENCE_ANALYSIS` | A high-quality clinical analysis example | Your doctor's notes or the ChatGPT example already in the file |

These values are written to `localStorage` on every app load by `initHardcodedSettings()`. They are **not editable by users** — the App Settings screen shows them read-only.

### Getting a Free Gemini API Key
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with Google account
3. Click **Get API key** → **Create API key**
4. Copy the key (starts with `AIza…`)
5. Paste into `APP_GEMINI_KEY` in `app.js`
6. Free tier: 15 requests/min, 1,500/day — more than enough for this use case

### Setting Up FormSubmit Emails (one-time)
FormSubmit requires a one-time activation per email address:
1. Deploy the app to GitHub Pages first
2. Submit any subscription or query from the live app
3. FormSubmit sends a confirmation email to `APP_ADMIN_EMAIL`
4. Click the confirmation link in that email
5. All future emails will arrive automatically — no further action needed

---

## Repository Structure

```
anaya/
├── index.html          HTML structure — all screens, modals, navigation
├── style.css           All CSS — variables, layout, animations, glass effects
├── app.js              All JavaScript — data, logic, AI, charts, email
├── PROJECT.md          Product overview and feature list
├── DATA_SCHEMA.md      Data structures and future Supabase schema
├── ARCHITECTURE.md     System design, data flows, service map
├── TODO.md             Prioritised feature backlog
├── HANDOFF.md          This file — developer guide
└── CHANGELOG.md        Full version history
```

---

## How the App is Structured

### Three-File Architecture

| File | Contains | Lines |
|---|---|---|
| `index.html` | `<head>`, all `<div class="screen">` screens, all modals, bottom nav | ~693 |
| `style.css` | `:root` variables, layout, components, animations | ~412 |
| `app.js` | All functions — data, UI, AI, charts, subscriptions | ~3,100 |

### Screens
Each screen is `<div class="screen" id="screen-X">` in `index.html`. Only one is `.active` at a time.

| Screen ID | Nav access | Loaded by |
|---|---|---|
| `screen-dashboard` | 🏠 Home tab | `drawChart()` + `refreshHba1c()` |
| `screen-insights` | 🩺 Insights tab | `loadSavedInsightsFull()` |
| `screen-subscribe` | 💊 Subscribe tab | `renderSubscriptions()` |
| `screen-add` | ➕ FAB button | `setDefaultDateTime()` |
| `screen-profile` | 👤 Profile tab | `populateProfileForm()` |
| `screen-settings` | ⚙️ Header icon only | `loadSettingsScreen()` |

> **App Settings is intentionally hidden from the bottom nav.** It is accessed via the small ⚙️ gear icon in the app header — admin/developer use only.

### Bottom Navigation (user-facing tabs)
```
🏠 Home  |  💊 Subscribe  |  ➕ FAB  |  🩺 Insights  |  👤 Profile
```
Tab order for swipe gestures (defined in `TAB_ORDER` at the bottom of `app.js`):
```js
const TAB_ORDER = ['dashboard','subscribe','insights','profile','settings'];
```

### Navigation Flow
```
switchTab(id, el)
  1. Remove .active from all .screen divs
  2. Slide out current screen (left or right based on TAB_ORDER position)
  3. Add .active to screen-{id}
  4. Highlight nav item, spring-scale it
  5. Call screen-specific refresh:
       dashboard  → drawChart() + refreshHba1c()
       insights   → loadSavedInsightsFull()
       settings   → loadSettingsScreen()
       profile    → populateProfileForm()
       subscribe  → renderSubscriptions()
```

### App Boot Sequence
```
window.onload
  → initHardcodedSettings()    writes APP_* constants to localStorage
  → applyTheme()               restores dark/light mode
  → updateApiKeyStatus()       shows key status in settings
  → renderSubscriptions()      loads subscription list
  → if no patients → showPicker()
  → else loadPatient(lastId)
      → switch to dashboard
      → refreshAll()
      → loadSavedInsights()    restore cached AI insights
```

---

## Data Layer

All reads/writes go through these helpers in `app.js`:

```js
patient()                            // returns current patient object or null
getReadings(pid)                     // returns sorted array of glucose readings
saveReadings(pid, array)             // writes to localStorage
getManualHba1c(pid)                  // returns array of lab HbA1c entries
saveManualHba1cData(pid, array)      // writes to localStorage
```

**localStorage keys** — full reference in `DATA_SCHEMA.md`:
```
glucoPatients                  all patient profiles
glucoReadings_{pid}            glucose readings per patient
glucoHba1c_{pid}               lab HbA1c entries per patient
glucoMeds_{pid}                medications text
glucoCond_{pid}                general condition text
glucoCurrentPatient            last active patient ID
glucoInsights_{pid}            saved AI insights (chipHtml + fullHtml + rawText)
glucoTheme                     'light' or 'dark'
anayaSubscriptions             all subscriptions
anayaAdminEmail                set from APP_ADMIN_EMAIL on every load
glucoApiKey                    set from APP_GEMINI_KEY on every load
glucoGlobalRef                 set from APP_REFERENCE_ANALYSIS on every load
```

---

## AI — Gemini API

All AI calls go through `geminiFetch(prompt, imageBase64?, mimeType?)`:

```js
const text = await geminiFetch(prompt);               // text only
const text = await geminiFetch(prompt, b64, 'image/jpeg');  // image
const text = await geminiFetch(prompt, b64, 'application/pdf'); // PDF
```

- Uses `APP_GEMINI_KEY` — no user input needed
- Tries 4 models in order: `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-1.5-flash-001`
- Falls back automatically on 429 (rate limit) or 503 (unavailable)
- Returns raw text string — caller is responsible for JSON parsing
- For `loadAiInsights()`: 3-attempt retry loop with 1.5s / 3s backoff

**AI features:**
| Feature | Function | Input |
|---|---|---|
| Doctor Insights | `loadAiInsights()` | Patient profile + 90-day readings |
| Glucometer OCR | `handleOcrFile(input, 'glucometer')` | JPEG/PNG image |
| Lab report OCR | `handleOcrFile(input, 'labreport')` | Image or PDF |
| Voice input | `analyseVoiceTranscript()` | Text transcript (en/hi) |

---

## Email — FormSubmit

All emails use hidden HTML form POST to `https://formsubmit.co/${APP_ADMIN_EMAIL}`:

```js
// Pattern used throughout app.js
const form = document.createElement('form');
form.action = 'https://formsubmit.co/' + APP_ADMIN_EMAIL;
form.method = 'POST';
form.target = 'formsubmit_iframe';   // hidden iframe prevents page redirect
// ... addField() calls ...
document.body.appendChild(form);
form.submit();
document.body.removeChild(form);
```

**Triggers:**
| Action | Function | Email subject |
|---|---|---|
| New subscription | `startSubscription()` | "Anaya New Subscription — {name}" |
| Edit subscription | `startSubscription()` | "Anaya Updated Subscription — {name}" |
| Pause/Resume | `sendSubStatusEmail()` | "Anaya Subscription Paused/Resumed — {name}" |
| Stop | `sendSubStatusEmail()` | "Anaya Subscription Stopped — {name}" |
| Delete | `sendSubStatusEmail()` | "Anaya Subscription Deleted — {name}" |
| Query | `sendQueryEmail()` / `sendProfileQuery()` | "Anaya Query — {name}" |

---

## Common Tasks

### Add a new patient field
1. Add input to **patient modal** (`index.html` → `id="patientModal"`) — both new and edit use same modal
2. Add input to **profile edit card** (`index.html` → `screen-profile`)
3. Update `openAddPatient()` — reset the field
4. Update `openEditPatient(pid)` — load existing value
5. Update `savePatientModal()` — read and save the value
6. Update `populateProfileForm()` — populate edit card
7. Update `updateProfile()` — save changes
8. If relevant to AI: add to the prompt in `loadAiInsights()`

### Add a new screen
1. Add `<div class="screen" id="screen-X">` in `index.html`
2. Add nav button: `<button class="nav-item" id="tab-X" onclick="switchTab('X',this)">`
3. Add `'X'` to `TAB_ORDER` in the swipe handler at the bottom of `app.js`
4. Add `if (id==='X') { loadMyScreen(); }` inside `switchTab()` in `app.js`

### Change brand colours
Edit `:root` in `style.css`:
```css
:root {
  --anaya-teal:  #1BAA9C;   /* buttons, accents, chart lines */
  --anaya-navy:  #0D2C4D;   /* text, nav background */
  --anaya-coral: #FF7A7A;   /* low readings, high readings, alerts */
  --anaya-light: #E6F5F2;   /* light mode background */
  --accent:      #1BAA9C;   /* primary interactive colour */
  --bg:          #0a1a2e;   /* dark mode page background */
}
```

### Change AI Insights sections
1. Edit `## Section Title` headings in the prompt inside `loadAiInsights()` in `app.js`
2. Add the matching entry in `formatAiInsights()` → `cfg` object:
```js
'My New Section': { icon: '🔍', color: '#60a5fa' }
```

### Change subscription email fields
Edit `startSubscription()` in `app.js`. Each `addField('Label', value)` adds a row to the FormSubmit email table.

### Edit or delete a glucose reading
Tap any reading in:
- The **chart detail list** on Dashboard (labelled "tap to edit")
- The **hero Last Reading card** on Dashboard
Opens `openEditReading(id)` — modal has 🗑️ bin top-right with `confirm()` before delete.

### Edit or delete a lab HbA1c entry
Tap any entry in the **Lab History** list on Dashboard.
Opens `openEditHba1c(id)` — modal has 🗑️ bin top-right with `confirm()` before delete.
When adding new (via compare boxes), bin is hidden.

### Update the reference analysis style
Edit `APP_REFERENCE_ANALYSIS` in `app.js`. This is injected into every AI Insights prompt. Make it as detailed and clinically specific as possible — the AI mirrors the depth and tone of whatever example you provide.

---

## Known Limitations

| Limitation | Impact | Workaround / Plan |
|---|---|---|
| API key in client-side `app.js` | Key visible in source — anyone can read it | Acceptable for personal/family use. For public scale: proxy via Supabase Edge Function |
| localStorage only — no cloud sync | Data lost if browser storage is cleared. Not shared across devices | Supabase integration planned (TODO #1–6) |
| No authentication | Anyone with the URL can add patients and log readings | Add Supabase auth (TODO #3) or a simple PIN lock |
| iOS voice input | Web Speech API only works in Safari on iPhone — not Chrome iOS | Document this for users. Android Chrome works fine |
| iOS push notifications | PWA push not supported on iOS | Requires native wrapper (Capacitor/Cordova) for reliable iOS notifications |
| FormSubmit activation | First email from a new address requires a one-time confirmation click | One-time setup — see "Before You Deploy" above |
| Gemini high demand (429/503) | Occasional API failures during peak hours | Auto-retries 3× with fallback through 4 model versions |
| `saveGlobalSettings()` is a no-op | The function exists but does nothing — settings are hardcoded | Intentional. Settings must be changed in `app.js` source |
| PDF on Android | Print-to-PDF UX varies across Android browsers | Recommend Chrome on Android; Safari on iOS works well |
| File:// protocol | Loading `index.html` directly from filesystem may block CSS/JS | Use `python3 -m http.server` locally or deploy to GitHub Pages |

---

## Environment

| Item | Detail |
|---|---|
| Build tool | None — plain HTML/CSS/JS |
| Package manager | None — no npm, no node_modules |
| Transpilation | None — ES8+ used directly (async/await, optional chaining, template literals) |
| Browser support | Safari 15+ · Chrome 90+ · Firefox 90+ |
| Canvas API | Charts and A4 PDF report generation |
| Web Speech API | Voice input — Safari (iOS) and Chrome (desktop/Android) only |
| Gemini API | Direct browser fetch — CORS allowed via `application/json` content type |
| FormSubmit | HTML form POST via hidden iframe — no CORS issues |

---

## Contacts / Access

| Resource | Location |
|---|---|
| GitHub repo | `https://github.com/YOUR_USERNAME/anaya` |
| Live app | `https://YOUR_USERNAME.github.io/anaya` |
| Gemini Console | [aistudio.google.com](https://aistudio.google.com) |
| FormSubmit docs | [formsubmit.co](https://formsubmit.co) |
| Supabase (future) | [supabase.com](https://supabase.com) |
| Brand assets | Anaya brand sheet (attached) — logo, Poppins font, colour palette |
| Font | [Poppins on Google Fonts](https://fonts.google.com/specimen/Poppins) |
