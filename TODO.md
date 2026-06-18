# TODO.md — Anaya
> Ordered by priority. Numbers match the original feature backlog.

---

## 🔴 Critical / Next Sprint

### PWA — Installable App (#new)
- [ ] Create `manifest.json` with Anaya name, icons, theme colours
- [ ] Create `sw.js` service worker for offline caching
- [ ] Generate icon set: 192×192 and 512×512 PNG (use Anaya logo from brand sheet)
- [ ] Link manifest in `index.html`
- [ ] Test auto-install prompt on Android Chrome
- [ ] Test Add to Home Screen on iOS Safari

### Bug Fixes (known)
- [ ] Voice input: confirm it auto-analyses on 2s silence across iOS Safari versions
- [ ] Chart X-axis: verify no date repetition with <5 readings
- [ ] Swipe: disable swipe when a modal is open (currently swipes behind modals)
- [ ] AI Insights: handle `RECITATION` error from Gemini gracefully

---

## 🟡 High Priority

### #1 — Supabase Integration
- [ ] Create Supabase project
- [ ] Get Project URL and anon key from user
- [ ] Install Supabase JS client via CDN
- [ ] Create tables: `patients`, `glucose_readings`, `hba1c_logs`, `subscriptions`
- [ ] Wrap all localStorage reads/writes with Supabase calls

### #2 — Row Level Security
- [ ] Enable RLS on all tables
- [ ] Policy: users can only read/write their own rows (`auth.uid() = user_id`)

### #3 — Authentication
- [ ] Email + password login screen (before patient picker)
- [ ] Sign up / forgot password flow
- [ ] Session persistence (Supabase handles this)
- [ ] Logout button in Profile tab

### #4 — Auto Table Creation
- [ ] On first login, run `CREATE TABLE IF NOT EXISTS` or use Supabase migrations

### #5 — localStorage → Supabase Migration
- [ ] On first login after Supabase integration, offer to migrate existing data
- [ ] Read from localStorage, write to Supabase, confirm, clear local

### #6 — Supabase Tables
- [ ] `patients` — see DATA_SCHEMA.md for full schema
- [ ] `glucose_readings`
- [ ] `hba1c_logs`
- [ ] `subscriptions`

---

## 🟢 Medium Priority

### #7 — Edit Existing Glucose Readings ✅ Done
Already implemented. Tap any reading in chart detail list or hero card to edit.

### #8 — Voice Call Alert via Twilio
- [ ] Collect from user: Twilio Account SID, Auth Token, Twilio phone number
- [ ] User records voice message in iPhone Voice Memos → upload MP3
- [ ] Host MP3 on CDN URL
- [ ] Supabase Edge Function triggers Twilio call on glucose threshold breach
- [ ] Retry once if no answer
- [ ] Cost: ~$0.01–0.02/min, $15 free trial credit

### #12 — Pinch to Zoom on Trend Chart
- [ ] Detect pinch gesture (two-finger spread/squeeze)
- [ ] Adjust visible date range dynamically
- [ ] Show zoom level indicator

### #18 — Font Size (senior accessibility)
- [ ] Add font size toggle: Normal / Large / Extra Large
- [ ] Persist preference in localStorage
- [ ] Apply via CSS class on `<body>`

---

## 🔵 Low Priority / Future

### Subscription System Enhancements
- [ ] Subscription confirmation email to patient's mobile (SMS via Twilio)
- [ ] Admin dashboard to view all subscriptions (separate admin page)
- [ ] Subscription renewal reminder email before end date

### Report Improvements (#16, #17)
- [ ] Fix PDF formatting on Windows (currently optimised for Safari/iOS)
- [ ] Add patient photo to report header
- [ ] Include medication list in report
- [ ] Report watermark / branding footer

### Family Connect Feature
- [ ] Share read-only view link with family member
- [ ] Family member gets alert when reading > threshold
- [ ] Requires Supabase + auth

### Medication Reminders
- [ ] Daily push notification for medication time
- [ ] Requires service worker + Push API
- [ ] iOS limitations: push only works if app is in home screen (PWA)

### BP / Weight Tracking
- [ ] Add vital signs log: blood pressure (systolic/diastolic), weight, SpO2
- [ ] Trend charts for each
- [ ] Include in AI Insights assessment

### Multi-language Support
- [ ] UI language toggle: English / Hindi
- [ ] Voice input already supports Hindi (`hi-IN`)
- [ ] Need translation strings for all UI labels

---

## ✅ Completed (from original backlog)

| # | Feature |
|---|---|
| #7 | Edit existing glucose log entries |
| #9 | Trend chart defaults to 30 days |
| #10 | Separate chart lines per meal type |
| #11 | Dark/light mode toggle |
| #13 | Larger fonts throughout |
| #14 | Dashboard stat boxes overhaul |
| #15 | Share Glucose Report button fixed |
| #16 | PDF report formatting |
| #17 | Report mirrors app (all sections) |
| #19 | Readings table newest to oldest |
| #20 | Font contrast throughout |
| #21 | OCR image analysis + Voice input |
