# CHANGELOG.md — Anaya
> All notable changes to this project. Newest first.

---

## [2.0.0] — June 2026 — Anaya Rebrand + Platform Expansion

### 🎨 Rebrand
- Renamed from **GlucoTrack** to **Anaya — Care. Support. Peace of Mind.**
- Full colour palette update: Teal `#1BAA9C` · Navy `#0D2C4D` · Coral `#FF7A7A` · Light `#E6F5F2`
- Font changed from DM Sans/DM Serif to **Poppins** (matches Anaya brand sheet)
- Liquid glass UI: `backdrop-filter: blur()` on cards, nav, hero — iOS-style translucent layers
- Shimmer highlight on card top edges
- Semicircular FAB cutout in bottom navigation bar
- FAB plus sign changed to white (was invisible dark colour on blue)
- All "GlucoTrack" references replaced with "Anaya" across all screens, modals, reports

### 🧭 Navigation
- Replaced top tab bar with **fixed bottom navigation**
- Tab order: 🏠 Home | 💊 Subscribe | ➕ FAB | 🩺 Insights | 👤 Profile
- App Settings moved out of nav — accessible via ⚙️ icon in header (admin only)
- Active tab highlights with spring scale animation (`cubic-bezier(.34,1.56,.64,1)`)
- Active tab icon enlarges from 20px to 24px
- Horizontal swipe between tabs with fluid `translateX` transition
- Swipe direction determines slide-left or slide-right animation

### 💊 Subscribe Tab (new)
- New screen: medication delivery subscription management
- **New Subscription modal**: medications (with "Adopt from Profile" button), delivery address, mobile, start/end date, frequency (Weekly/Fortnightly/Monthly)
- Active subscriptions list with status badges (Active/Paused)
- Pause/Resume and Stop actions — each triggers FormSubmit email to admin
- Tap any subscription card to edit or delete (bin icon with confirmation)
- Delete triggers FormSubmit notification email

### ✉️ Queries
- Send Query/Complaint from Profile tab → FormSubmit email to admin
- Removed duplicate from Subscribe tab

### ⚙️ App Settings (admin only)
- **Hardcoded** in `app.js`: `APP_ADMIN_EMAIL`, `APP_GEMINI_KEY`, `APP_REFERENCE_ANALYSIS`
- Settings screen shows read-only display: masked email, masked API key, reference analysis preview
- No user-editable inputs — developer sets values in source code
- `initHardcodedSettings()` runs on every app load, writes constants to localStorage for functions that read from it

### 🗑️ Delete with Confirmation
- Edit Reading modal: 🗑️ bin icon at top-right, `confirm()` before delete
- Edit Lab HbA1c modal: 🗑️ bin icon at top-right (hidden when adding new, shown when editing)
- Delete button removed from HbA1c lab history list rows — must use edit modal
- Delete button removed from glucose chart detail list — tap row to edit, delete from modal

### 📋 Profile Tab
- Added: Diabetic Since (year) field
- Added: Gender field (Male/Female/Other)
- Added: Medications textarea (up to 1,200 chars)
- Added: General Condition & Remarks textarea (up to 700 chars)
- Medications and General Condition now in patient creation modal (not just profile edit)
- Send Query/Complaint section added to bottom of Profile tab
- API Key card hidden from profile (moved to App Settings)

### 🗂️ Codebase Split
- Monolithic `diabetes-monitor.html` split into three files:
  - `index.html` — HTML structure and screens only
  - `style.css` — all styles and CSS variables
  - `app.js` — all JavaScript logic

---

## [1.9.0] — June 2026 — HbA1c Merge + History Removal

### Dashboard
- HbA1c tab merged into Dashboard: estimated vs lab compare boxes, trend chart, lab history, in-range analysis, eAG value
- History tab removed — readings accessible by tapping chart detail list items
- Hero card renamed "Last Reading" (was "Current Reading")
- Tapping hero card opens edit modal for most recent reading
- Tapping any reading in chart detail list opens edit modal
- Share Glucose Report button moved to bottom of dashboard

### HbA1c
- Tapping either compare box (Estimated / Lab) opens log modal
- Tapping any lab history entry opens edit modal (was delete-only)
- HbA1c tab and nav item removed

### AI Insights
- AI Summary card removed from Dashboard
- Full AI Insights now exclusively in Insights tab
- Dashboard "Analyse" button removed (use Insights tab)

---

## [1.8.0] — June 2026 — AI Insights Overhaul + Voice Fixes

### AI Doctor Insights
- New 8-section clinical format: Overall Control · Fasting · Pre-Meal · Post-Meal · Trends · Medication Effectiveness · Concerns · Positive Observations · Personalised Recommendations
- Age-aware targets: relaxed thresholds for patients 75+ (reduced hypoglycaemia risk)
- Gender-correct salutation (Mr./Ms./no title)
- Diabetes duration calculated from "Diabetic Since" year
- Medications and general condition included in AI prompt
- Global reference analysis style injected into prompt for consistent output depth
- Per-patient insights saved: chip summary for dashboard, full HTML for Insights tab
- Retry logic: 3 attempts with 1.5s/3s backoff on failure
- Button shows "Retry 1/3…" during retries
- Both Analyse buttons (dashboard + insights tab) sync state
- Sections formatted with colour-coded cards, bold headings, bullet support

### Voice Input (fixes)
- Auto-analyses after 2 seconds of silence — no manual button tap needed
- Silence countdown bar animation
- Language selector: English / Hindi / Hinglish
- `hi-IN` recognition with Hindi vocabulary mapping in AI prompt
- Continuous listening mode (was stopping after first pause)
- Final + interim transcript accumulation

### Patient Profile
- Added: Diabetic Since (year)
- Added: Reference Analysis field (global, not per-patient — later hardcoded)

---

## [1.7.0] — June 2026 — Subscribe System + Queries + Global Settings

- Subscription modal with full delivery details
- FormSubmit email integration for subscriptions and queries
- Admin email centralised as a setting
- Gemini API key moved to app settings
- Reference analysis style centralised (global, not per-patient)
- Send Query/Complaint added to Profile tab
- Subscription list rendering with pause/stop actions

---

## [1.6.0] — May 2026 — Design Overhaul (Apple Health Style)

### Visual
- Deep charcoal background (`#111827`) with soft blue accents
- Glass morphism cards with `backdrop-filter`
- Framer-style animations: `fadeUp`, screen slide transitions
- Bottom navigation replaces top tabs
- Floating Action Button (FAB) for add reading
- Active tab: scale + colour highlight

### Dashboard Simplification
- 3-stat row: Avg Fasting · Avg Pre-meal · Avg Post-meal (30-day)
- Last Reading hero card (large, prominent)
- Est. HbA1c fix: always from glucose log, never from lab value
- 7-day trend chart remains; defaults now 30 days (#9)

### Trend Chart
- Separate coloured lines per meal type (#10):
  - 🔵 Blue — Fasting
  - 🟣 Purple — Pre-meal (Before)
  - 🟢 Green — Post-meal (After)
  - ⚪ Grey — Other/Random/Bedtime
- X-axis date deduplication (no repeating dates)
- Chart defaults to 30-day view

---

## [1.5.0] — May 2026 — OCR + Voice Input

### Image Upload / OCR (#21)
- Two distinct flows:
  - **Glucometer photo**: extracts reading, auto-fills current date/time
  - **Lab report (image or PDF)**: searches for glucose tests (FBS/PPBS/HbA1c), extracts sample collection date/time, labels with 🧪 badge
- Robust JSON parsing with fallback regex extraction
- Editable review cards before saving

### Voice Input (#21)
- Microphone button in Log tab
- Web Speech API (`hi-IN` and `en-IN`)
- AI interprets natural speech including Hindi/Hinglish
- Review card before saving

---

## [1.4.0] — May 2026 — AI Doctor Insights (first version)

- AI Doctor Insights card on Dashboard
- Sends 30-day stats + last 10 readings to Claude/Gemini
- 5 sections: Overall Control · Key Patterns · Concerns · What's Going Well · Suggestions
- Switched from Anthropic API to Google Gemini (free tier)
- Model fallback chain: gemini-2.5-flash → 2.0-flash → 2.0-flash-lite → 1.5-flash-001
- Per-patient insights saved to localStorage
- Insights persist until Refresh tapped

---

## [1.3.0] — April 2026 — Reports + PDF

### Report Generation
- A4 lab-style report canvas (794px wide, dynamic height)
- Sections: patient info, highlights (fasting/pre/post avg, last reading, HbA1c, in-range %), trend chart (meal-type coloured lines), HbA1c analysis (estimated vs lab, reference bar), lab history table, full readings table
- Readings table: all readings, newest to oldest (#19)
- Share as PNG (Web Share API) or Download
- PDF: opens new tab with print dialog → Save as PDF
- PDF fix: window opened synchronously before `async` to bypass Safari popup blocker

### Pill selector fixes
- Period pills (7D/14D/1M/3M) and format pills (PNG/PDF) — unique IDs, single-select

---

## [1.2.0] — April 2026 — Multi-Patient + HbA1c

- Multi-patient support with colour-coded avatars (6 colours)
- Patient picker screen on launch
- Per-patient isolated data in localStorage
- HbA1c tab: estimated from glucose (Nathan formula) vs lab comparison
- Manual lab HbA1c entry with date and notes
- HbA1c trend chart
- In-range analysis (% in target, % low, % high)
- eAG (estimated average glucose) calculation
- HbA1c reference band with 5 segments

---

## [1.1.0] — March 2026 — Glucose Log + Chart

- Manual glucose log: value, meal type, date, time, notes
- Meal types: Fasting · Before meal · After meal (1hr/2hr) · Bedtime · Random
- Glucose trend chart (Canvas API)
  - Green shaded target band
  - Colour-coded dots by status (low/normal/high)
  - Tap-to-tooltip
  - Range buttons: 7D/14D/30D/All
- History tab with reverse-chronological list
- Delete readings
- Status classification: Low (<70) · Normal (70–180) · High (>180) mg/dL
- Target ranges card

---

## [1.0.0] — February 2026 — Initial Release (GlucoTrack)

- Single patient, single screen
- Manual glucose entry
- Basic stats: latest reading, 7-day average, estimated HbA1c
- localStorage persistence
- iPhone Safari PWA via GitHub Pages
- DM Sans + DM Serif Display fonts
- Dark mode default
