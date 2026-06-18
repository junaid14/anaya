# DATA_SCHEMA.md — Anaya
> All data is stored in `localStorage` on the user's device. No server-side database exists yet.

---

## localStorage Keys

| Key | Type | Scope | Description |
|---|---|---|---|
| `glucoPatients` | JSON Array | Global | All patient profiles |
| `glucoReadings_{pid}` | JSON Array | Per patient | Glucose readings |
| `glucoHba1c_{pid}` | JSON Array | Per patient | Manual lab HbA1c entries |
| `glucoMeds_{pid}` | String | Per patient | Medications text |
| `glucoCond_{pid}` | String | Per patient | General condition / remarks |
| `glucoCurrentPatient` | String | Global | Last active patient ID |
| `glucoInsights_{pid}` | JSON Object | Per patient | Saved AI insights (chip + full HTML) |
| `glucoTheme` | String | Global | `'light'` or `'dark'` |
| `anayaSubscriptions` | JSON Array | Global | All medication subscriptions |
| `anayaAdminEmail` | String | Global | Admin email (set by `initHardcodedSettings`) |
| `glucoApiKey` | String | Global | Gemini API key (set by `initHardcodedSettings`) |
| `glucoGlobalRef` | String | Global | Reference analysis style (set by `initHardcodedSettings`) |

> **Note:** `anayaAdminEmail`, `glucoApiKey`, and `glucoGlobalRef` are written from hardcoded constants in `app.js` on every app load. They cannot be changed by users.

---

## Patient Object

```js
{
  id:            'p_1718000000000',   // 'p_' + Date.now()
  name:          'Arjun Hashmi',
  age:           81,
  gender:        'male',             // 'male' | 'female' | 'other'
  diabetesSince: 2001,               // year (integer) or null
  type:          'Type 2',           // 'Type 1'|'Type 2'|'Gestational'|'Pre-diabetes'|'Other'
  units:         'mg/dL',            // 'mg/dL' | 'mmol/L'
  colorIdx:      0                   // 0–5, maps to avatar colour class
}
```

**Extended profile** (stored separately in localStorage, not in patient object):
```
glucoMeds_{pid}  → string, up to 1200 chars
glucoCond_{pid}  → string, up to 700 chars
```

---

## Glucose Reading Object

```js
{
  id:    1718000000001,              // Date.now() + index offset (integer)
  val:   126,                        // numeric, in patient's units
  meal:  'Fasting',                  // see Meal Types below
  date:  '2024-06-15',              // YYYY-MM-DD string
  time:  '08:30',                   // HH:MM string (24h)
  notes: 'after walk',              // string, max 80 chars, optional
  ts:    1718438200000              // Unix ms timestamp (new Date(date+'T'+time).getTime())
}
```

### Meal Types (enum)
```
'Fasting'
'Before meal'
'After meal (1hr)'
'After meal (2hr)'
'Bedtime'
'Random'
```

### Meal Groups (derived, not stored)
```js
function mealGroup(meal) {
  if (meal.includes('fasting'))  return 'fasting';
  if (meal.includes('before'))   return 'pre';
  if (meal.includes('after'))    return 'post';
  return 'other';
}
```

### Status Classification

| Condition | mg/dL | mmol/L | Color |
|---|---|---|---|
| Low | < 70 | < 4.0 | `#FF7A7A` (coral) |
| Normal | 70–180 | 4.0–10.0 | `#1BAA9C` (teal) |
| High | > 180 | > 10.0 | `#FF7A7A` (coral) |

---

## Manual HbA1c Entry Object

```js
{
  id:    1718000000002,              // Date.now()
  val:   7.4,                        // float, 3.0–20.0 %
  date:  '2024-05-01',              // YYYY-MM-DD string
  notes: 'LabCorp fasting sample',  // string, max 60 chars, optional
  ts:    1714557600000              // Unix ms timestamp
}
```

### HbA1c Interpretation

| Range | Label | Color |
|---|---|---|
| < 5.7% | Normal | `#4ade80` |
| 5.7–6.4% | Pre-diabetes | `#a3e635` |
| 6.5–7.4% | Controlled | `#fde047` |
| 7.5–8.9% | Elevated | `#fb923c` |
| ≥ 9.0% | Very High | `#f87171` |

### HbA1c Formulas
```js
// Estimated HbA1c from avg glucose (Nathan formula)
HbA1c = (avg_mg_dl + 46.7) / 28.7

// Estimated Average Glucose (eAG) from HbA1c
eAG_mg_dl = 28.7 * HbA1c - 46.7
```

---

## AI Insights Object (saved per patient)

```js
{
  patientId: 'p_1718000000000',
  ts:         1718438200000,         // Unix ms — when analysis was run
  chipHtml:  '<div class="ai-summary-grid">…</div>',   // compact chips for dashboard
  fullHtml:  '<div class="ai-section">…</div>',        // full cards for Insights tab
  rawText:   '## Overall Glucose Control\n…'            // raw Gemini output
}
```

---

## Subscription Object

```js
{
  id:          1718000000003,        // Date.now()
  patient:     'Arjun Hashmi',
  age:         81,
  type:        'Type 2',
  medications: 'Metformin 500mg twice daily…',
  address:     'Flat 4B, Sunrise Apartments…',
  mobile:      '+91 98765 43210',
  start:       '2024-06-01',        // YYYY-MM-DD
  end:         '2024-12-31',        // YYYY-MM-DD or empty string (open-ended)
  frequency:   'monthly',           // 'weekly' | 'fortnightly' | 'monthly'
  status:      'active',            // 'active' | 'paused'
  createdAt:   '2024-06-01T10:30:00.000Z'  // ISO string
}
```

---

## Future Schema (Supabase — planned)

```sql
-- patients
CREATE TABLE patients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id),
  name          text NOT NULL,
  age           int,
  gender        text,
  diabetes_since int,
  diabetes_type text,
  units         text DEFAULT 'mg/dL',
  color_idx     int DEFAULT 0,
  medications   text,
  general_condition text,
  created_at    timestamptz DEFAULT now()
);

-- glucose_readings
CREATE TABLE glucose_readings (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  val        numeric NOT NULL,
  meal       text,
  notes      text,
  reading_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- hba1c_logs
CREATE TABLE hba1c_logs (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  val        numeric NOT NULL,
  notes      text,
  tested_at  timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- subscriptions
CREATE TABLE subscriptions (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  patient_id  uuid REFERENCES patients(id),
  medications text,
  address     text,
  mobile      text,
  start_date  date,
  end_date    date,
  frequency   text,
  status      text DEFAULT 'active',
  created_at  timestamptz DEFAULT now()
);
```
