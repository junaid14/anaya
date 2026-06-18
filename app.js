/* Anaya — Care. Support. Peace of Mind. | Main Application Script v2.0 */

// ====== DATA ======
// patients: [{id, name, age, type, units, colorIdx}]
// readings stored per-patient: glucoReadings_{id}

let patients = JSON.parse(localStorage.getItem('glucoPatients') || '[]');
let currentPatientId = localStorage.getItem('glucoCurrentPatient') || null;
let readings = [];
let manualHba1c = []; // [{id, val, date, notes, ts}]
let chartRange = 30;
let editingPatientId = null;

const AV_COLORS = ['av-0','av-1','av-2','av-3','av-4','av-5'];

function patient() { return patients.find(p => p.id === currentPatientId) || null; }

function getReadings(pid) {
  return JSON.parse(localStorage.getItem('glucoReadings_' + pid) || '[]');
}
function saveReadings(pid, data) {
  localStorage.setItem('glucoReadings_' + pid, JSON.stringify(data));
}
function getManualHba1c(pid) {
  return JSON.parse(localStorage.getItem('glucoHba1c_' + pid) || '[]');
}
function saveManualHba1cData(pid, data) {
  localStorage.setItem('glucoHba1c_' + pid, JSON.stringify(data));
}
function initials(name) { return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }

// ====== BOOT ======
window.onload = () => {
  initHardcodedSettings();
  applyTheme();
  updateApiKeyStatus();
  renderSubscriptions();
  if (patients.length === 0) {
    showPicker();
  } else if (currentPatientId && patients.find(p=>p.id===currentPatientId)) {
    loadPatient(currentPatientId);
  } else {
    showPicker();
  }
};

function showPicker() {
  document.getElementById('pickerScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  renderPatientList();
}

function loadPatient(pid) {
  currentPatientId = pid;
  localStorage.setItem('glucoCurrentPatient', pid);
  readings = getReadings(pid);
  manualHba1c = getManualHba1c(pid);
  detailShowAll = false;
  activeTooltipIdx = -1;
  document.getElementById('pickerScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  const p = patient();
  // header badge
  document.getElementById('psAv').textContent = initials(p.name);
  document.getElementById('psAv').className = 'ps-av ' + AV_COLORS[p.colorIdx % 6];
  document.getElementById('psName').textContent = p.name.split(' ')[0];
  switchTab('dashboard');
  refreshAll();
  setDefaultDateTime();
  // Load saved AI insights for this patient after a brief layout settle
  setTimeout(loadSavedInsights, 100);
}

function goToPicker() { showPicker(); }

// ====== PATIENT LIST ======
function renderPatientList() {
  const el = document.getElementById('patientList');
  if (patients.length === 0) {
    el.innerHTML = `<div class="picker-empty"><div class="picker-empty-icon">👥</div><p>No patients yet.<br>Tap <strong>+ New Patient</strong> to add one.</p></div>`;
    return;
  }
  el.innerHTML = patients.map(p => {
    const r = getReadings(p.id);
    const mh = getManualHba1c(p.id);
    const last = r.length ? r[r.length-1] : null;
    const estHba1c = r.length >= 3 ? calcHba1c(r, p.units).toFixed(1) : null;
    const latestLab = mh.length ? mh[mh.length-1] : null;
    const hba1cStr = latestLab
      ? `Lab HbA1c ${latestLab.val}%${estHba1c?' · Est. '+estHba1c+'%':''}`
      : (estHba1c ? `Est. HbA1c ${estHba1c}%` : '');
    return `<div class="patient-card" onclick="loadPatient('${p.id}')">
      <div class="patient-av ${AV_COLORS[p.colorIdx%6]}">${initials(p.name)}</div>
      <div class="patient-info">
        <div class="patient-info-name">${p.name}</div>
        <div class="patient-info-sub">Age ${p.age} · ${p.type} · ${p.units}</div>
        <div class="patient-info-stats">${r.length} readings${hba1cStr?' · '+hba1cStr:''}${last?' · Last: '+last.val+' '+p.units:''}</div>
      </div>
      <button class="patient-del-btn" onclick="event.stopPropagation();confirmDeletePatient('${p.id}')">✕</button>
      <div class="patient-chevron">›</div>
    </div>`;
  }).join('');
}

// ====== ADD / EDIT PATIENT MODAL ======
function openAddPatient() {
  editingPatientId = null;
  document.getElementById('modalTitle').textContent = 'New Patient';
  document.getElementById('mName').value = '';
  document.getElementById('mAge').value = '';
  document.getElementById('mGender').value = 'male';
  document.getElementById('mDiabetesSince').value = '';
  document.getElementById('mType').value = 'Type 2';
  document.getElementById('mUnits').value = 'mg/dL';
  document.getElementById('mMedications').value = '';
  document.getElementById('mGeneralCondition').value = '';
  document.getElementById('patientModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('mName').focus(), 100);
}

function openEditPatient(pid) {
  const p = patients.find(x=>x.id===pid);
  if (!p) return;
  editingPatientId = pid;
  document.getElementById('modalTitle').textContent = 'Edit Patient';
  document.getElementById('mName').value = p.name;
  document.getElementById('mAge').value = p.age;
  document.getElementById('mGender').value = p.gender || 'male';
  document.getElementById('mDiabetesSince').value = p.diabetesSince || '';
  document.getElementById('mType').value = p.type;
  document.getElementById('mUnits').value = p.units;
  document.getElementById('mMedications').value = localStorage.getItem('glucoMeds_'+pid) || '';
  document.getElementById('mGeneralCondition').value = localStorage.getItem('glucoCond_'+pid) || '';
  document.getElementById('patientModal').classList.remove('hidden');
}

function closePatientModal() { document.getElementById('patientModal').classList.add('hidden'); }

function savePatientModal() {
  const name = document.getElementById('mName').value.trim();
  const age = parseInt(document.getElementById('mAge').value);
  const gender = document.getElementById('mGender').value;
  const diabetesSince = document.getElementById('mDiabetesSince').value ? parseInt(document.getElementById('mDiabetesSince').value) : null;
  const type = document.getElementById('mType').value;
  const units = document.getElementById('mUnits').value;
  if (!name) { showToast('Enter a name', true); return; }
  if (!age || age < 1 || age > 120) { showToast('Enter a valid age', true); return; }
  const meds = document.getElementById('mMedications').value.trim();
  const cond = document.getElementById('mGeneralCondition').value.trim();
  if (editingPatientId) {
    const p = patients.find(x=>x.id===editingPatientId);
    p.name = name; p.age = age; p.gender = gender; p.diabetesSince = diabetesSince; p.type = type; p.units = units;
    if (meds) localStorage.setItem('glucoMeds_'+editingPatientId, meds);
    if (cond) localStorage.setItem('glucoCond_'+editingPatientId, cond);
  } else {
    const id = 'p_' + Date.now();
    const colorIdx = patients.length;
    patients.push({ id, name, age, gender, diabetesSince, type, units, colorIdx });
    if (meds) localStorage.setItem('glucoMeds_'+id, meds);
    if (cond) localStorage.setItem('glucoCond_'+id, cond);
  }
  localStorage.setItem('glucoPatients', JSON.stringify(patients));
  closePatientModal();
  renderPatientList();
  showToast(editingPatientId ? 'Patient updated ✓' : `${name.split(' ')[0]} added ✓`);
}

function confirmDeletePatient(pid) {
  const p = patients.find(x=>x.id===pid);
  if (!p) return;
  if (!confirm(`Delete ${p.name} and all their readings? This cannot be undone.`)) return;
  patients = patients.filter(x=>x.id!==pid);
  localStorage.removeItem('glucoReadings_' + pid);
  localStorage.removeItem('glucoHba1c_' + pid);
  localStorage.setItem('glucoPatients', JSON.stringify(patients));
  renderPatientList();
  showToast('Patient deleted');
}

// ====== MANUAL HBA1C MODAL ======
function openEditHba1c(id) {
  const entry = manualHba1c.find(x=>x.id===id);
  if (!entry) return;
  document.getElementById('mHba1cId').value = id;
  document.getElementById('mHba1cVal').value = entry.val;
  document.getElementById('mHba1cDate').value = entry.date || new Date(entry.ts).toISOString().split('T')[0];
  document.getElementById('mHba1cNotes').value = entry.notes || '';
  document.getElementById('hba1cModalTitle').textContent = 'Edit Lab HbA1c';
  document.getElementById('hba1cModalSub').textContent = 'Update this lab result';
  const delBtn = document.getElementById('hba1cDeleteBtn');
  if (delBtn) delBtn.style.display = 'block';
  document.getElementById('hba1cModal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('mHba1cVal').focus(),100);
}

function openHba1cModal() {
  document.getElementById('mHba1cId').value = '';
  document.getElementById('mHba1cVal').value = '';
  document.getElementById('mHba1cDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('mHba1cNotes').value = '';
  document.getElementById('hba1cModalTitle').textContent = 'Log Lab HbA1c';
  document.getElementById('hba1cModalSub').textContent = 'Enter the result from your blood test';
  const delBtn = document.getElementById('hba1cDeleteBtn');
  if (delBtn) delBtn.style.display = 'none';
  document.getElementById('hba1cModal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('mHba1cVal').focus(),100);
}

function closeHba1cModal() { document.getElementById('hba1cModal').classList.add('hidden'); }

function saveManualHba1c() {
  const val = parseFloat(document.getElementById('mHba1cVal').value);
  const date = document.getElementById('mHba1cDate').value;
  const notes = document.getElementById('mHba1cNotes').value.trim();
  const editId = document.getElementById('mHba1cId').value;
  if (!val || val < 3 || val > 20) { showToast('Enter a valid HbA1c (3–20%)', true); return; }
  if (!date) { showToast('Select a date', true); return; }
  const ts = new Date(date+'T12:00:00').getTime();
  if (editId) {
    // Edit existing
    const idx = manualHba1c.findIndex(x=>x.id===parseInt(editId));
    if (idx !== -1) manualHba1c[idx] = { ...manualHba1c[idx], val, date, notes, ts };
    showToast('Lab result updated ✓');
  } else {
    // New entry
    const entry = { id: Date.now(), val, date, notes, ts };
    manualHba1c.push(entry);
    showToast('Lab HbA1c saved ✓');
  }
  manualHba1c.sort((a,b)=>a.ts-b.ts);
  saveManualHba1cData(currentPatientId, manualHba1c);
  closeHba1cModal();
  refreshDashboard();
  renderHba1c();
}
function deleteManualHba1c(id) {
  manualHba1c = manualHba1c.filter(x=>x.id!==id);
  saveManualHba1cData(currentPatientId, manualHba1c);
  showToast('Deleted');
  renderHba1c();
  refreshDashboard();
}
function showHba1cSub(sub, btn) {
  ['breakdown','lablog','inrange'].forEach(s=>{
    document.getElementById('hba1cSub'+s.charAt(0).toUpperCase()+s.slice(1)).style.display = s===sub?'block':'none';
  });
  document.querySelectorAll('.toggle-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}


let currentTabId = 'dashboard';
function switchTab(id, el) {
  const prev = currentTabId;
  currentTabId = id;

  // Update nav items — highlight + enlarge active
  document.querySelectorAll('.nav-item').forEach(t => {
    t.classList.remove('active');
    t.style.transform = '';
  });
  const navEl = el && el.classList && el.classList.contains('nav-item') ? el : document.getElementById('tab-'+id);
  if (navEl && navEl.classList.contains('nav-item')) {
    navEl.classList.add('active');
    navEl.style.transition = 'transform 0.25s cubic-bezier(.34,1.56,.64,1), color 0.2s';
  }

  // Slide direction based on tab order
  const order = ['dashboard','insights','profile','settings','add'];
  const prevIdx = order.indexOf(prev), newIdx = order.indexOf(id);
  const goRight = newIdx > prevIdx;

  document.querySelectorAll('.screen').forEach(s => {
    if (s.classList.contains('active')) {
      s.classList.remove('active');
      s.classList.add(goRight ? 'slide-left' : 'slide-right');
      setTimeout(() => s.classList.remove('slide-left','slide-right'), 350);
    }
  });

  const screen = document.getElementById('screen-'+id);
  if (screen) screen.classList.add('active');

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if (id==='dashboard') { drawChart(); refreshHba1c(); }
    if (id==='insights')  { loadSavedInsightsFull(); }
    if (id==='settings')  { loadSettingsScreen(); }
  if (id==='subscribe') { renderSubscriptions(); }
    if (id==='profile')   { populateProfileForm(); }
    if (id==='add')       { setDefaultDateTime(); }
  }));
}

// ====== READINGS ======
function setDefaultDateTime() {
  const now = new Date();
  document.getElementById('inputDate').value = now.toISOString().split('T')[0];
  document.getElementById('inputTime').value = now.toTimeString().slice(0,5);
}

function addReading() {
  const val = parseFloat(document.getElementById('inputGlucose').value);
  const meal = document.getElementById('inputMeal').value;
  const date = document.getElementById('inputDate').value;
  const time = document.getElementById('inputTime').value;
  const notes = document.getElementById('inputNotes').value.trim();
  if (!val || val < 20 || val > 600) { showToast('Enter a valid glucose value', true); return; }
  if (!date || !time) { showToast('Set date and time', true); return; }
  const r = { id: Date.now(), val, meal, date, time, notes, ts: new Date(date+'T'+time).getTime() };
  readings.push(r);
  readings.sort((a,b)=>a.ts-b.ts);
  saveReadings(currentPatientId, readings);
  document.getElementById('inputGlucose').value = '';
  document.getElementById('inputNotes').value = '';
  showToast('Reading saved ✓');
  refreshDashboard();
  renderHistory();
}

function deleteReading(id) {
  readings = readings.filter(r=>r.id!==id);
  saveReadings(currentPatientId, readings);
  refreshDashboard();
  refreshHba1c();
  showToast('Deleted');
}

// ====== STATUS ======
function getStatus(val, units) {
  const mm = units==='mmol/L';
  if (mm) {
    if (val < 4.0) return {label:'Low',color:'#f97316',key:'low'};
    if (val > 10.0) return {label:'High',color:'#ef4444',key:'high'};
    return {label:'Normal',color:'#22c55e',key:'normal'};
  }
  if (val < 70) return {label:'Low',color:'#f97316',key:'low'};
  if (val > 180) return {label:'High',color:'#ef4444',key:'high'};
  return {label:'Normal',color:'#22c55e',key:'normal'};
}

// ====== HBA1C CALC ======
// Nathan formula: HbA1c% = (avg_glucose_mg_dl + 46.7) / 28.7
function toMgdl(val, units) { return units==='mmol/L' ? val * 18.018 : val; }
function calcHba1c(rds, units) {
  if (rds.length === 0) return null;
  const avg = rds.reduce((s,r)=>s+toMgdl(r.val, units),0) / rds.length;
  return (avg + 46.7) / 28.7;
}
function hba1cToEag(hba1c) { return Math.round(28.7 * hba1c - 46.7); } // mg/dL
function hba1cInterp(h) {
  if (h < 5.7) return {label:'Normal',color:'#22c55e',segIdx:0};
  if (h < 6.5) return {label:'Pre-diabetes',color:'#84cc16',segIdx:1};
  if (h < 7.5) return {label:'Diabetes (Controlled)',color:'#facc15',segIdx:2};
  if (h < 9.0) return {label:'Diabetes (Elevated)',color:'#f97316',segIdx:3};
  return {label:'Diabetes (Very High)',color:'#ef4444',segIdx:4};
}

function calcHba1cForPeriod(days) {
  const cutoff = Date.now() - days * 86400000;
  const rds = days===0 ? readings : readings.filter(r=>r.ts>=cutoff);
  return rds.length >= 2 ? calcHba1c(rds, patient().units) : null;
}

function refreshHba1c() { renderHba1c(); }
function renderHba1c() {
  const p = patient();
  if (!p) return;
  const estHba1c = readings.length >= 3 ? calcHba1c(readings, p.units) : null;
  const latestLab = manualHba1c.length ? manualHba1c[manualHba1c.length-1] : null;
  // Use latest lab if available, else estimated, for band/interp
  const displayHba1c = latestLab ? latestLab.val : estHba1c;

  // Estimated box
  if (estHba1c) {
    document.getElementById('hba1cBig').textContent = estHba1c.toFixed(1);
    document.getElementById('hba1cBig').style.color = hba1cInterp(estHba1c).color;
  } else {
    document.getElementById('hba1cBig').textContent = '—';
    document.getElementById('hba1cBig').style.color = 'var(--muted)';
  }

  // Lab box
  if (latestLab) {
    document.getElementById('hba1cLabLatest').textContent = latestLab.val.toFixed(1);
    document.getElementById('hba1cLabLatest').style.color = hba1cInterp(latestLab.val).color;
    const labD = new Date(latestLab.ts);
    document.getElementById('hba1cLabDate').textContent = labD.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  } else {
    document.getElementById('hba1cLabLatest').textContent = '—';
    document.getElementById('hba1cLabLatest').style.color = 'var(--muted)';
    document.getElementById('hba1cLabDate').textContent = 'no lab logged';
  }

  // Band & interp (use lab if available, else estimated)
  if (displayHba1c) {
    const interp = hba1cInterp(displayHba1c);
    document.querySelectorAll('.hba1c-seg').forEach((seg,i)=>{
      seg.style.opacity = i===interp.segIdx?'1':'0.2';
    });
    const hba1cDiv=document.getElementById('hba1cInterpDiv'); if(hba1cDiv) hba1cDiv.innerHTML =
      `<span class="hba1c-interp" style="background:${interp.color}22;color:${interp.color};border:1px solid ${interp.color}44">${interp.label}</span>`;
  } else {
    const hba1cDiv=document.getElementById('hba1cInterpDiv'); if(hba1cDiv) hba1cDiv.innerHTML =
      '<div style="color:var(--muted);font-size:13px;padding:6px 0">Need ≥3 glucose readings or a lab result</div>';
  }

  // eAG from estimated
  if (estHba1c) {
    const eag = hba1cToEag(estHba1c);
    document.getElementById('eagVal').textContent = p.units==='mmol/L' ? (eag/18.018).toFixed(1) : eag;
    document.getElementById('eagUnit').textContent = p.units;
  } else {
    document.getElementById('eagVal').textContent = '—';
  }

  // Trend chart
  drawHba1cTrendChart();

  // Breakdown
  const periods = [{label:'Last 7 days',days:7},{label:'Last 14 days',days:14},{label:'Last 30 days',days:30},{label:'Last 90 days',days:90},{label:'All time',days:0}];
  (document.getElementById('hba1cBreakdown')||{innerHTML:''}).innerHTML = '<div class="hba1c-breakdown">' +
    periods.map(({label,days})=>{
      const h = calcHba1cForPeriod(days);
      if (!h) return `<div class="hba1c-br-row"><span style="color:var(--muted)">${label}</span><span style="color:var(--muted)">—</span></div>`;
      const ip = hba1cInterp(h);
      return `<div class="hba1c-br-row"><span style="color:var(--muted)">${label}</span><span style="color:${ip.color};font-weight:600">${h.toFixed(1)}%</span></div>`;
    }).join('') + '</div>';

  // Lab log list
  if (manualHba1c.length === 0) {
    const hba1cLabListEl = document.getElementById('hba1cLabList'); if(hba1cLabListEl) hba1cLabListEl.innerHTML = '<div class="empty" style="padding:20px 0"><div class="empty-icon">🧪</div><p>No lab results logged yet.<br>Tap <strong>+ Add</strong> above.</p></div>';
  } else {
    const hba1cLabListEl = document.getElementById('hba1cLabList'); if(hba1cLabListEl) hba1cLabListEl.innerHTML = [...manualHba1c].reverse().map(m=>{
      const ip = hba1cInterp(m.val);
      const d = new Date(m.ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const estAtTime = getEstimatedHba1cNearDate(m.ts);
      const diffStr = estAtTime ? ` · Est. was ${estAtTime.toFixed(1)}%` : '';
      return `<div class="hba1c-log-entry" onclick="openEditHba1c(${m.id})" style="cursor:pointer" title="Tap to edit">
        <div class="hba1c-log-dot" style="background:${ip.color}"></div>
        <div class="hba1c-log-info">
          <div class="hba1c-log-val" style="color:${ip.color}">${m.val.toFixed(1)}<small style="font-size:11px;color:var(--muted);font-family:'Poppins',Arial,sans-serif;font-weight:300"> %</small></div>
          <div class="hba1c-log-meta">${d}${m.notes?' · '+m.notes:''}${diffStr}</div>
        </div>
        <div class="hba1c-log-lab">${ip.label}</div>
        
      </div>`;
    }).join('');
  }

  // In-range
  const lo = p.units==='mmol/L'?4.0:70, hi = p.units==='mmol/L'?10.0:180;
  const total = readings.length;
  const inRange = readings.filter(r=>r.val>=lo&&r.val<=hi).length;
  const low = readings.filter(r=>r.val<lo).length;
  const high = readings.filter(r=>r.val>hi).length;
  const pct = v=>total?Math.round(v/total*100):0;
  document.getElementById('inRangeAnalysis').innerHTML = total === 0
    ? '<div style="color:var(--muted);font-size:13px;padding:8px 0">No glucose readings yet</div>'
    : `<div class="hba1c-br-row"><span>In Range (${lo}–${hi} ${p.units})</span><span style="color:#22c55e;font-weight:600">${pct(inRange)}% <small style="font-weight:400;color:var(--muted)">(${inRange}/${total})</small></span></div>
       <div class="hba1c-br-row"><span>Low (&lt;${lo} ${p.units})</span><span style="color:#f97316;font-weight:600">${pct(low)}% <small style="font-weight:400;color:var(--muted)">(${low}/${total})</small></span></div>
       <div class="hba1c-br-row" style="border-bottom:none"><span>High (&gt;${hi} ${p.units})</span><span style="color:#ef4444;font-weight:600">${pct(high)}% <small style="font-weight:400;color:var(--muted)">(${high}/${total})</small></span></div>
       <div style="margin-top:12px;height:10px;border-radius:6px;overflow:hidden;display:flex">
         <div style="width:${pct(inRange)}%;background:#22c55e"></div>
         <div style="width:${pct(low)}%;background:#f97316"></div>
         <div style="width:${pct(high)}%;background:#ef4444"></div>
       </div>`;
}

// Estimate HbA1c from readings within ±45 days of a given timestamp
function getEstimatedHba1cNearDate(ts) {
  const p = patient(); if (!p) return null;
  const window45 = 45*86400000;
  const nearby = readings.filter(r=>Math.abs(r.ts-ts)<=window45);
  return nearby.length>=3 ? calcHba1c(nearby,p.units) : null;
}

function drawHba1cTrendChart() {
  const canvas = document.getElementById('hba1cTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio||1;
  const W = canvas.parentElement.clientWidth;
  const H = 160;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  canvas.width=W*dpr; canvas.height=H*dpr;
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  const p = patient();
  // Build combined timeline points: lab entries + monthly estimated snapshots
  const labPts = manualHba1c.map(m=>({ts:m.ts, val:m.val, type:'lab'}));

  // Monthly estimated snapshots (last 6 months)
  const estPts = [];
  if (readings.length >= 3) {
    const now = Date.now();
    for (let i=5; i>=0; i--) {
      const monthEnd = now - i*30*86400000;
      const monthStart = monthEnd - 30*86400000;
      const slice = readings.filter(r=>r.ts>=monthStart&&r.ts<=monthEnd);
      if (slice.length>=2) {
        const h = calcHba1c(slice, p.units);
        estPts.push({ts: monthEnd - 15*86400000, val: h, type:'est'});
      }
    }
  }

  const allPts = [...labPts, ...estPts].sort((a,b)=>a.ts-b.ts);

  if (allPts.length < 2) {
    ctx.fillStyle='rgba(232,244,255,0.2)'; ctx.font='13px Arial,sans-serif'; ctx.textAlign='center';
    ctx.fillText('Need more data to show trend',W/2,H/2); return;
  }

  const vals = allPts.map(p=>p.val);
  const minV = Math.max(4, Math.min(...vals)-0.5);
  const maxV = Math.min(15, Math.max(...vals)+0.5);
  const pad={l:34,r:12,t:12,b:28};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const toX=i=>pad.l+(i/(allPts.length-1))*cW;
  const toY=v=>pad.t+cH-((v-minV)/(maxV-minV))*cH;

  // Reference lines: 5.7, 6.5
  [[5.7,'rgba(132,204,22,0.3)'],[6.5,'rgba(239,68,68,0.3)']].forEach(([v,c])=>{
    if (v>=minV&&v<=maxV) {
      ctx.strokeStyle=c; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(pad.l,toY(v)); ctx.lineTo(pad.l+cW,toY(v)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=c; ctx.font='9px Arial,sans-serif'; ctx.textAlign='left';
      ctx.fillText(v+'%',pad.l+2,toY(v)-3);
    }
  });

  // Grid + Y labels
  ctx.strokeStyle='rgba(99,178,255,0.07)'; ctx.lineWidth=1;
  [0,0.5,1].forEach(f=>{
    const y=pad.t+cH*(1-f);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cW,y);ctx.stroke();
    const v=minV+(maxV-minV)*f;
    ctx.fillStyle='rgba(232,244,255,0.35)'; ctx.font='10px Arial,sans-serif'; ctx.textAlign='right';
    ctx.fillText(v.toFixed(1),pad.l-4,y+3);
  });

  // Estimated line (dashed)
  const estOnly = allPts.filter(p=>p.type==='est');
  if (estOnly.length>=2) {
    ctx.beginPath(); ctx.strokeStyle='rgba(79,168,255,0.45)'; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
    estOnly.forEach((pt,i)=>{
      const idx=allPts.indexOf(pt);
      i===0?ctx.moveTo(toX(idx),toY(pt.val)):ctx.lineTo(toX(idx),toY(pt.val));
    });
    ctx.stroke(); ctx.setLineDash([]);
  }

  // Lab line (solid)
  const labOnly = allPts.filter(p=>p.type==='lab');
  if (labOnly.length>=2) {
    ctx.beginPath(); ctx.strokeStyle='var(--accent2)'; ctx.lineWidth=2.5; ctx.lineJoin='round';
    labOnly.forEach((pt,i)=>{
      const idx=allPts.indexOf(pt);
      i===0?ctx.moveTo(toX(idx),toY(pt.val)):ctx.lineTo(toX(idx),toY(pt.val));
    });
    ctx.stroke();
  }

  // Dots
  allPts.forEach((pt,i)=>{
    const ip=hba1cInterp(pt.val);
    ctx.beginPath();
    ctx.arc(toX(i),toY(pt.val),pt.type==='lab'?5:3,0,Math.PI*2);
    ctx.fillStyle=pt.type==='lab'?ip.color:'rgba(79,168,255,0.6)';
    ctx.fill();
    if(pt.type==='lab'){ctx.strokeStyle='rgba(10,22,40,0.5)';ctx.lineWidth=1;ctx.stroke();}
  });

  // X labels (dates)
  ctx.fillStyle='rgba(232,244,255,0.35)'; ctx.font='9px Arial,sans-serif'; ctx.textAlign='center';
  const step=Math.max(1,Math.floor(allPts.length/5));
  for(let i=0;i<allPts.length;i+=step){
    const d=new Date(allPts[i].ts);
    ctx.fillText((d.getMonth()+1)+'/'+d.getDate(),toX(i),H-6);
  }
}


// ====== REFRESH ======
function refreshAll() {
  refreshDashboard();
  refreshHba1c();
  renderTargetRange();
  updateUnitHint();
}

function refreshDashboard() {
  const p = patient();
  if (!p) return;
  const units = p.units;
  // Set units on all avg boxes
  ['avgFastingUnit','avgPreUnit','avgPostUnit','latestUnit'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = units;
  });
  const thirtyAgo = Date.now() - 30*86400000;
  const recent30 = readings.filter(r=>r.ts>=thirtyAgo);

  const mealAvg = (keywords) => {
    const subset = recent30.filter(r => keywords.some(k => (r.meal||'').toLowerCase().includes(k)));
    return subset.length ? (subset.reduce((s,r)=>s+r.val,0)/subset.length).toFixed(1) : '—';
  };

  document.getElementById('avgFasting').textContent = mealAvg(['fasting']);
  document.getElementById('avgPreMeal').textContent = mealAvg(['before']);
  document.getElementById('avgPostMeal').textContent = mealAvg(['after']);

  if (readings.length === 0) {
    document.getElementById('latestVal').textContent = '—';
    document.getElementById('latestStatus').textContent = '';
    document.getElementById('lastReadingMeta').textContent = 'No readings yet';
    document.getElementById('hba1cQuick').textContent = '—';
    document.getElementById('hba1cQuick').style.color = 'var(--muted)';
    return;
  }

  // Last reading
  const last = readings[readings.length-1];
  const status = getStatus(last.val, units);
  document.getElementById('latestVal').textContent = last.val;
  document.getElementById('latestStatus').textContent = status.label;
  document.getElementById('latestStatus').style.color = status.color;
  const d = new Date(last.ts);
  document.getElementById('lastReadingMeta').textContent =
    d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + ' · ' +
    d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) + ' · ' + (last.meal||'');

  // Est HbA1c — ALWAYS estimated from glucose, never lab value
  const estHba1c = readings.length >= 3 ? calcHba1c(readings, units) : null;
  const _hq = document.getElementById('hba1cQuick'); if(_hq){ _hq.textContent = estHba1c ? estHba1c.toFixed(1) : '—'; _hq.style.color = estHba1c ? hba1cInterp(estHba1c).color : 'var(--muted)'; }

  // Draw chart if dashboard is visible
  const dash = document.getElementById('screen-dashboard');
  if (dash && dash.classList.contains('active')) {
    requestAnimationFrame(()=>requestAnimationFrame(()=>drawChart()));
  }
}

function renderTargetRange() {
  const p = patient(); if (!p) return;
  const mg = p.units==='mg/dL';
  const _trEl = document.getElementById('targetRangeInfo'); if(_trEl) _trEl.innerHTML = `
    <div class="info-row"><div class="info-key">Fasting</div><div class="info-val">${mg?'70–100 mg/dL':'3.9–5.6 mmol/L'}</div></div>
    <div class="info-row"><div class="info-key">Before meal</div><div class="info-val">${mg?'80–130 mg/dL':'4.4–7.2 mmol/L'}</div></div>
    <div class="info-row"><div class="info-key">2hr after meal</div><div class="info-val">${mg?'<180 mg/dL':'<10.0 mmol/L'}</div></div>
    <div class="info-row"><div class="info-key">Bedtime</div><div class="info-val">${mg?'100–140 mg/dL':'5.6–7.8 mmol/L'}</div></div>`;
}

function updateUnitHint() {
  const p = patient(); if (!p) return;
  const _uhEl = document.getElementById('unitHint'); if(_uhEl) _uhEl.textContent = p.units==='mg/dL' ? 'mg/dL · Target: 70–180' : 'mmol/L · Target: 4.0–10.0';
}

function renderHistory() {
  // History tab removed — readings shown in dashboard chart detail list
  const el = document.getElementById('historyList');
  if (el) {
    const p = patient();
    if (!p || readings.length===0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>No readings yet.</p></div>'; return;
    }
    el.innerHTML = [...readings].reverse().map(r => {
      const s = getStatus(r.val, p.units);
      const grp = mealGroup(r.meal);
      const mealColor = MEAL_COLORS[grp] || '#94a3b8';
      const d = new Date(r.ts);
      const dateStr = d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
      const timeStr = d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
      return `<div class="log-entry" onclick="openEditReading(${r.id})" style="cursor:pointer">
        <div class="log-indicator" style="background:${s.color}"></div>
        <div class="log-info">
          <div class="log-val" style="color:${s.color}">${r.val}<small>${p.units}</small></div>
          <div class="log-meta">${dateStr} · ${timeStr}${r.notes?' · '+r.notes:''}</div>
        </div>
        <div class="log-meal" style="border-color:${mealColor}44;color:${mealColor}">${mealIcon(r.meal)} ${r.meal||''}</div>
        <button class="log-del" onclick="event.stopPropagation();deleteReading(${r.id})">✕</button>
      </div>`;
    }).join('');
  }
}

function populateProfileForm() {
  const p = patient(); if (!p) return;
  document.getElementById('editName').value = p.name;
  document.getElementById('editAge').value = p.age;
  document.getElementById('editGender').value = p.gender || 'male';
  document.getElementById('editDiabetesSince').value = p.diabetesSince || '';
  document.getElementById('editType').value = p.type;
  document.getElementById('editUnits').value = p.units;
  document.getElementById('editMedications').value = localStorage.getItem('glucoMeds_'+p.id) || '';
  document.getElementById('editGeneralCondition').value = localStorage.getItem('glucoCond_'+p.id) || '';

  document.getElementById('profileAv').textContent = initials(p.name);
  document.getElementById('profileAv').className = 'profile-big-av ' + AV_COLORS[p.colorIdx%6];
  document.getElementById('profileName').textContent = p.name;
  const genderLabel = p.gender==='female'?'Female':p.gender==='other'?'Other':'Male';
  const yr = new Date().getFullYear();
  const yearsLabel = p.diabetesSince ? (yr-p.diabetesSince)+' yrs (since '+p.diabetesSince+')' : '—';
  document.getElementById('profileAge').textContent = `Age ${p.age} · ${genderLabel} · ${p.type}`;
  const hasMeds = !!localStorage.getItem('glucoMeds_'+p.id);
  const hasCond = !!localStorage.getItem('glucoCond_'+p.id);
  document.getElementById('profileInfo').innerHTML = `
    <div class="info-row"><div class="info-key">Units</div><div class="info-val">${p.units}</div></div>
    <div class="info-row"><div class="info-key">Gender</div><div class="info-val">${genderLabel}</div></div>
    <div class="info-row"><div class="info-key">Diabetic since</div><div class="info-val">${yearsLabel}</div></div>
    <div class="info-row"><div class="info-key">Total readings</div><div class="info-val">${readings.length}</div></div>
    <div class="info-row"><div class="info-key">First reading</div><div class="info-val">${readings.length?new Date(readings[0].ts).toLocaleDateString():'—'}</div></div>
    <div class="info-row"><div class="info-key">Last reading</div><div class="info-val">${readings.length?new Date(readings[readings.length-1].ts).toLocaleDateString():'—'}</div></div>
    <div class="info-row"><div class="info-key">Medications</div><div class="info-val" style="color:${hasMeds?'var(--normal)':'var(--muted)'}">${hasMeds?'✅ Saved':'Not entered'}</div></div>
    <div class="info-row"><div class="info-key">General condition</div><div class="info-val" style="color:${hasCond?'var(--normal)':'var(--muted)'}">${hasCond?'✅ Saved':'Not entered'}</div></div>`;
}

function updateProfile() {
  const p = patient(); if (!p) return;
  const name = document.getElementById('editName').value.trim();
  const age = parseInt(document.getElementById('editAge').value);
  const gender = document.getElementById('editGender').value;
  const diabetesSince = document.getElementById('editDiabetesSince').value ? parseInt(document.getElementById('editDiabetesSince').value) : null;
  const type = document.getElementById('editType').value;
  const units = document.getElementById('editUnits').value;
  if (!name||!age) { showToast('Fill all fields', true); return; }
  p.name=name; p.age=age; p.gender=gender; p.diabetesSince=diabetesSince; p.type=type; p.units=units;
  localStorage.setItem('glucoPatients', JSON.stringify(patients));
  document.getElementById('psName').textContent = p.name.split(' ')[0];
  document.getElementById('psAv').textContent = initials(p.name);
  refreshAll();
  showToast('Profile updated ✓');
}

function saveMedications() {
  const p = patient(); if (!p) return;
  localStorage.setItem('glucoMeds_'+p.id, document.getElementById('editMedications').value.trim());
  showToast('Medications saved ✓'); populateProfileForm();
}

function saveGeneralCondition() {
  const p = patient(); if (!p) return;
  localStorage.setItem('glucoCond_'+p.id, document.getElementById('editGeneralCondition').value.trim());
  showToast('Remarks saved ✓'); populateProfileForm();
}

function saveReferenceAnalysis() {
  const p = patient(); if (!p) return;
  localStorage.setItem('glucoGlobalRef', APP_REFERENCE_ANALYSIS);
  showToast('Reference analysis saved ✓');
}


function deletePatient() {
  const p = patient(); if (!p) return;
  if (!confirm(`Delete ${p.name} and all their readings? This cannot be undone.`)) return;
  patients = patients.filter(x=>x.id!==currentPatientId);
  localStorage.removeItem('glucoReadings_'+currentPatientId);
  localStorage.removeItem('glucoHba1c_'+currentPatientId);
  localStorage.setItem('glucoPatients', JSON.stringify(patients));
  currentPatientId = null;
  localStorage.removeItem('glucoCurrentPatient');
  showPicker();
  showToast('Patient deleted');
}

// ====== CHART ======
function setRange(days, btn) {
  chartRange = days;
  detailShowAll = false;
  activeTooltipIdx = -1;
  document.querySelectorAll('.range-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  drawChart();
}

let chartFilteredCache = [];
let chartPadCache = {};
let activeTooltipIdx = -1;

function drawChart() {
  const canvas = document.getElementById('glucoseChart');
  if (!canvas) return;

  // Fix: get width from card, not canvas parent (which may be 0 if screen was hidden)
  const wrap = canvas.closest('.card') || canvas.parentElement;
  const W = wrap.getBoundingClientRect().width - 32; // subtract card padding
  if (!W || W < 10) {
    // Screen not visible yet — retry after layout
    requestAnimationFrame(drawChart);
    return;
  }

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio||1;
  const H = 200;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  if (readings.length===0) {
    ctx.fillStyle='rgba(232,244,255,0.2)'; ctx.font='14px Arial,sans-serif'; ctx.textAlign='center';
    ctx.fillText('No readings to display',W/2,H/2);
    renderChartDetailList([], null);
    return;
  }

  const now = Date.now();
  let filtered = chartRange===0 ? readings : readings.filter(r=>r.ts>=now-chartRange*86400000);
  if (filtered.length===0) filtered = readings.slice(-20);
  chartFilteredCache = filtered;

  const units = patient()?.units||'mg/dL';
  const ismmol = units==='mmol/L';
  const lo = ismmol?4.0:70, hi = ismmol?10.0:180;
  const vals = filtered.map(r=>r.val);
  const minV = Math.min(...vals,lo)*0.92;
  const maxV = Math.max(...vals,hi)*1.08;

  const pad={l:38,r:14,t:16,b:28};
  chartPadCache={pad,minV,maxV,W,H,filtered,units,ismmol,lo,hi};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const toX=i=>pad.l+(i/(filtered.length-1||1))*cW;
  const toY=v=>pad.t+cH-((v-minV)/(maxV-minV))*cH;

  // Target band
  ctx.fillStyle='rgba(34,197,94,0.07)';
  ctx.fillRect(pad.l,toY(hi),cW,toY(lo)-toY(hi));

  // Grid
  ctx.strokeStyle='rgba(99,178,255,0.08)'; ctx.lineWidth=1;
  [0.25,0.5,0.75,1].forEach(f=>{
    const y=pad.t+cH*(1-f);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cW,y);ctx.stroke();
  });

  // Y labels
  ctx.fillStyle='rgba(232,244,255,0.35)'; ctx.font='10px Arial,sans-serif'; ctx.textAlign='right';
  [0,0.5,1].forEach(f=>{
    const v=minV+(maxV-minV)*f;
    ctx.fillText(ismmol?v.toFixed(1):Math.round(v),pad.l-4,pad.t+cH*(1-f)+3);
  });

  // Area fill
  ctx.beginPath();
  ctx.moveTo(toX(0),toY(filtered[0].val));
  for(let i=1;i<filtered.length;i++) ctx.lineTo(toX(i),toY(filtered[i].val));
  ctx.lineTo(toX(filtered.length-1),pad.t+cH);
  ctx.lineTo(toX(0),pad.t+cH);
  ctx.closePath();
  const ag=ctx.createLinearGradient(0,pad.t,0,pad.t+cH);
  ag.addColorStop(0,'rgba(79,168,255,0.18)');ag.addColorStop(1,'rgba(79,168,255,0)');
  ctx.fillStyle=ag; ctx.fill();

  // Line
  ctx.beginPath(); ctx.strokeStyle='#4fa8ff'; ctx.lineWidth=2; ctx.lineJoin='round';
  ctx.moveTo(toX(0),toY(filtered[0].val));
  for(let i=1;i<filtered.length;i++) ctx.lineTo(toX(i),toY(filtered[i].val));
  ctx.stroke();

  drawChartInternal(canvas, ctx, W, H, dpr, pad, filtered, units, ismmol, lo, hi, minV, maxV, cW, cH, toX, toY);
  renderChartDetailList(filtered, units);
  setupChartTap(canvas);
}

function mealGroup(meal) {
  const m = (meal||'').toLowerCase();
  if (m.includes('fasting')) return 'fasting';
  if (m.includes('before')) return 'pre';
  if (m.includes('after')) return 'post';
  return 'other';
}

const MEAL_COLORS = {
  fasting: '#60a5fa',
  pre:     '#a78bfa',
  post:    '#34d399',
  other:   '#94a3b8',
};

function drawChartInternal(canvas, ctx, W, H, dpr, pad, filtered, units, ismmol, lo, hi, minV, maxV, cW, cH, toX, toY) {
  ctx.clearRect(0,0,W,H);

  // Target band
  ctx.fillStyle='rgba(34,197,94,0.07)';
  ctx.fillRect(pad.l,toY(hi),cW,toY(lo)-toY(hi));

  // Grid
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border') || 'rgba(99,178,255,0.08)';
  ctx.lineWidth=1;
  [0.25,0.5,0.75,1].forEach(f=>{
    const y=pad.t+cH*(1-f);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cW,y);ctx.stroke();
  });

  // Y labels
  const lightMode = document.body.classList.contains('light-mode');
  ctx.fillStyle = lightMode ? 'rgba(15,23,42,0.5)' : 'rgba(232,244,255,0.45)';
  ctx.font='11px Arial,sans-serif'; ctx.textAlign='right';
  [0,0.25,0.5,0.75,1].forEach(f=>{
    const v=minV+(maxV-minV)*f;
    ctx.fillText(ismmol?v.toFixed(1):Math.round(v),pad.l-4,pad.t+cH*(1-f)+3);
  });

  // Draw one line per meal group (sorted by time)
  const groups = ['fasting','pre','post','other'];
  groups.forEach(grp => {
    const pts = filtered
      .map((r,i)=>({r,i}))
      .filter(({r})=>mealGroup(r.meal)===grp);
    if (pts.length < 1) return;

    const color = MEAL_COLORS[grp];

    // Line connecting points of this group
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.moveTo(toX(pts[0].i), toY(pts[0].r.val));
      for (let k=1; k<pts.length; k++) {
        ctx.lineTo(toX(pts[k].i), toY(pts[k].r.val));
      }
      ctx.stroke();
    }

    // Dots
    pts.forEach(({r,i}) => {
      const isActive = i === activeTooltipIdx;
      const dotR = filtered.length > 40 ? 3 : 5;
      ctx.beginPath();
      ctx.arc(toX(i), toY(r.val), isActive ? dotR+3 : dotR, 0, Math.PI*2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isActive ? 'white' : (lightMode?'rgba(255,255,255,0.8)':'rgba(10,22,40,0.5)');
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.stroke();
      // Meal icon for small datasets
      if (filtered.length <= 15) {
        ctx.font='11px serif'; ctx.textAlign='center';
        ctx.fillText(mealIcon(r.meal), toX(i), toY(r.val)-(isActive?8:6)-4);
      }
    });
  });

  // X date labels — deduplicated, spread evenly, no repeats
  ctx.fillStyle = lightMode ? 'rgba(15,23,42,0.5)' : 'rgba(232,244,255,0.55)';
  ctx.font='10px Arial,sans-serif'; ctx.textAlign='center';
  ctx.setLineDash([]);
  // Build unique date labels with their x positions
  const seenDates = new Set();
  const labelPoints = [];
  filtered.forEach((r,i) => {
    const d = new Date(r.ts);
    const key = (d.getMonth()+1)+'/'+d.getDate();
    if (!seenDates.has(key)) {
      seenDates.add(key);
      labelPoints.push({label: key, x: toX(i)});
    }
  });
  // Show at most 6 labels spread evenly
  const maxLabels = 6;
  const stride = Math.max(1, Math.ceil(labelPoints.length / maxLabels));
  labelPoints.forEach((pt, i) => {
    if (i % stride === 0) ctx.fillText(pt.label, pt.x, H-6);
  });
}

function mealIcon(meal) {
  if (!meal) return '●';
  const m = meal.toLowerCase();
  if (m.includes('fasting')) return '💤';
  if (m.includes('before')) return '🍽️';
  if (m.includes('after')) return '🥘';
  if (m.includes('bedtime')) return '🌙';
  return '📍';
}

function setupChartTap(canvas) {
  if (canvas._tapBound) return; // already set up
  canvas._tapBound = true;

  const handler = (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    hitTestChart(x, y);
  };
  canvas.addEventListener('touchstart', handler, {passive:false});
  canvas.addEventListener('click', handler);

  document.addEventListener('touchstart', (e) => {
    if (!e.target.closest('.chart-tooltip') && e.target.id !== 'glucoseChart') {
      hideTooltip();
    }
  }, {passive:true});
}

function hitTestChart(x, y) {
  const {pad, minV, maxV, W, H, filtered, units} = chartPadCache;
  if (!filtered || filtered.length===0) return;
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const toX=i=>pad.l+(i/(filtered.length-1||1))*cW;
  const toY=v=>pad.t+cH-((v-minV)/(maxV-minV))*cH;

  let closest = -1, closestDist = Infinity;
  filtered.forEach((r,i)=>{
    const dx=x-toX(i), dy=y-toY(r.val);
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<closestDist){closestDist=dist;closest=i;}
  });

  if(closest>=0 && closestDist < 32) {
    activeTooltipIdx = closest;
    showTooltipForPoint(closest, toX(closest), toY(filtered[closest].val), W, H, units);
    redrawDotsOnly(); // just redraw dots, not full chart (avoids recursion)
  } else {
    hideTooltip();
    activeTooltipIdx = -1;
    redrawDotsOnly();
  }
}

function redrawDotsOnly() {
  const canvas = document.getElementById('glucoseChart');
  if (!canvas || !chartPadCache.filtered) return;
  const ctx = canvas.getContext('2d');
  const {pad, minV, maxV, W, H, filtered, units, ismmol, lo, hi} = chartPadCache;
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const toX=i=>pad.l+(i/(filtered.length-1||1))*cW;
  const toY=v=>pad.t+cH-((v-minV)/(maxV-minV))*cH;
  drawChartInternal(canvas, ctx, W, H, 1, pad, filtered, units, ismmol, lo, hi, minV, maxV, cW, cH, toX, toY);
}

function showTooltipForPoint(idx, dotX, dotY, W, H, units) {
  const r = chartFilteredCache[idx];
  if (!r) return;
  const s = getStatus(r.val, units);
  const tooltip = document.getElementById('chartTooltip');
  const d = new Date(r.ts);
  const timeStr = d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' · ' +
                  d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

  document.getElementById('ttVal').textContent = r.val;
  document.getElementById('ttVal').style.color = s.color;
  document.getElementById('ttUnit').textContent = units;
  document.getElementById('ttStatus').textContent = s.label;
  document.getElementById('ttStatus').style.color = s.color;
  document.getElementById('ttMeal').textContent = (mealIcon(r.meal)||'') + ' ' + (r.meal||'—');
  document.getElementById('ttTime').textContent = timeStr;
  const hasNote = r.notes && r.notes.trim();
  document.getElementById('ttNoteRow').style.display = hasNote ? 'flex' : 'none';
  document.getElementById('ttNote').textContent = r.notes || '';

  // Position: prefer above dot, flip if too close to top; left/right based on x
  const TW = 170, TH = hasNote ? 110 : 88;
  let left = dotX + 10;
  let top = dotY - TH - 10;
  if (top < 4) top = dotY + 14;
  if (left + TW > W - 4) left = dotX - TW - 10;
  if (left < 2) left = 2;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.classList.add('visible');
}

function hideTooltip() {
  activeTooltipIdx = -1;
  const t = document.getElementById('chartTooltip');
  if (t) t.classList.remove('visible');
}

// Detail list below chart
let detailShowAll = false;
function renderChartDetailList(filtered, units) {
  const el = document.getElementById('chartDetailList');
  if (!el || !filtered || filtered.length===0) {
    if(el) el.innerHTML=''; return;
  }
  const sorted = [...filtered].reverse();
  const SHOW = detailShowAll ? sorted.length : 5;
  const slice = sorted.slice(0, SHOW);
  const p = patient();

  let html = `<div class="chart-detail-title">Readings in this view (${filtered.length})</div>`;
  html += slice.map(r=>{
    const s = getStatus(r.val, units);
    const d = new Date(r.ts);
    const dateStr = d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    const timeStr = d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    return `<div class="chart-detail-item" onclick="openEditReading(${r.id})" style="cursor:pointer">
      <div class="cdi-dot" style="background:${s.color}"></div>
      <div class="cdi-info">
        <div class="cdi-top">
          <span class="cdi-val" style="color:${s.color}">${r.val}</span>
          <span class="cdi-unit">${units}</span>
          <span style="font-size:10px;color:${s.color};font-weight:600">${s.label}</span>
        </div>
        <div class="cdi-meta">${dateStr} · ${timeStr}${r.notes?' · 📝 '+r.notes:''}</div>
      </div>
      <div class="cdi-meal">${mealIcon(r.meal)} ${r.meal||''}</div>
    </div>`;
  }).join('');

  if (sorted.length > 5) {
    if (!detailShowAll) {
      html += `<div class="chart-detail-more" onclick="toggleDetailAll(true)">Show all ${sorted.length} readings ▾</div>`;
    } else {
      html += `<div class="chart-detail-more" onclick="toggleDetailAll(false)">Show less ▴</div>`;
    }
  }
  el.innerHTML = html;
}

function toggleDetailAll(show) {
  detailShowAll = show;
  renderChartDetailList(chartFilteredCache, patient()?.units||'mg/dL');
}


// ====== REPORT MODAL ======
let reportPeriodDays = 7;
let reportFormat = 'png';
let reportCanvasRef = null;
let _pdfWin = null; // pre-opened synchronously before async work (Safari requires this)

function openReportModal() {
  const p = patient();
  if (!p) return;
  if (readings.length === 0) { showToast('No readings to share', true); return; }
  // Always show with current selection visible — do NOT reset period so user sees last choice
  // but DO sync the pill UI to match reportPeriodDays
  ['7','14','30','90'].forEach(d => {
    const el = document.getElementById('rp'+d);
    if (el) el.classList.toggle('active', parseInt(d) === reportPeriodDays);
  });
  ['png','pdf'].forEach(f => {
    const el = document.getElementById('rfmt'+f.charAt(0).toUpperCase()+f.slice(1));
    if (el) el.classList.toggle('active', f === reportFormat);
  });
  updateReportPeriodInfo();
  updateReportFormatHint();
  document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('reportModal').classList.add('hidden');
}

function selectReportPeriod(days, btn) {
  reportPeriodDays = days;
  document.querySelectorAll('#periodPills .toggle-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  updateReportPeriodInfo();
}

function selectReportFormat(fmt, btn) {
  reportFormat = fmt;
  document.querySelectorAll('#formatPills .toggle-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  updateReportFormatHint();
}

function updateReportFormatHint() {
  const hints = {
    png: 'PNG: share to WhatsApp, Mail, save to Photos',
    pdf: 'PDF: opens print dialog — Save as PDF from there'
  };
  document.getElementById('reportFormatHint').textContent = hints[reportFormat] || '';
}

function updateReportPeriodInfo() {
  const cutoff = Date.now() - reportPeriodDays * 86400000;
  const count = readings.filter(r=>r.ts>=cutoff).length;
  const labCount = manualHba1c.filter(m=>m.ts>=cutoff).length;
  document.getElementById('reportPeriodInfo').textContent =
    `${count} glucose reading${count!==1?'s':''} · ${labCount} HbA1c lab result${labCount!==1?'s':''} in this period`;
}

async function generateReport() {
  // PDF: open window synchronously NOW — Safari blocks window.open() after any await
  if (reportFormat === 'pdf') {
    _pdfWin = window.open('', '_blank');
    if (!_pdfWin) { showToast('Enable popups to save PDF', true); return; }
    _pdfWin.document.write('<html><head><title>Anaya — Care. Support. Peace of Mind.</title></head><body style="background:#0a1e3d;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;font-size:18px">⏳ Building report…</body></html>');
  }
  closeReportModal();
  showToast('Building report…');
  await new Promise(r=>setTimeout(r,80));
  try {
    reportCanvasRef = await buildReportCanvas(reportPeriodDays);
    if (reportFormat === 'pdf') {
      doDownloadPdf();
    } else {
      const displayCanvas = document.getElementById('reportCanvas');
      displayCanvas.width = reportCanvasRef.width;
      displayCanvas.height = reportCanvasRef.height;
      displayCanvas.getContext('2d').drawImage(reportCanvasRef, 0, 0);
      document.getElementById('reportOverlay').classList.remove('hidden');
    }
  } catch(e) {
    console.error(e);
    if (_pdfWin) { _pdfWin.close(); _pdfWin = null; }
    showToast('Report generation failed', true);
  }
}

// Keep old name for any stray references
async function generateAndShareReport() { await generateReport(); }

function closeReport() {
  document.getElementById('reportOverlay').classList.add('hidden');
}

async function doShare() {
  if (!reportCanvasRef) return;
  const p = patient();
  const periodLabel = reportPeriodDays===7?'7d':reportPeriodDays===14?'14d':reportPeriodDays===30?'1m':'3m';
  const filename = `Anaya_${(p?.name||'report').replace(/\s+/g,'_')}_${periodLabel}_${new Date().toISOString().split('T')[0]}.png`;
  reportCanvasRef.toBlob(async (blob) => {
    const file = new File([blob], filename, {type:'image/png'});
    if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
      try { await navigator.share({files:[file], title:'Anaya Report', text:`Glucose report for ${p?.name}`}); return; }
      catch(e) {}
    }
    // Fallback to download
    doDownloadImage();
  }, 'image/png');
}

function doDownloadImage() {
  if (!reportCanvasRef) return;
  const p = patient();
  const periodLabel = reportPeriodDays===7?'7d':reportPeriodDays===14?'14d':reportPeriodDays===30?'1m':'3m';
  const filename = `Anaya_${(p?.name||'report').replace(/\s+/g,'_')}_${periodLabel}_${new Date().toISOString().split('T')[0]}.png`;
  reportCanvasRef.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 3000);
    showToast('PNG downloaded ✓');
  }, 'image/png');
}

function doDownloadPdf() {
  if (!reportCanvasRef) return;
  const p = patient();
  const periodLabel = {7:'7 Days',14:'14 Days',30:'1 Month',90:'3 Months'}[reportPeriodDays]||'';
  const dataUrl = reportCanvasRef.toDataURL('image/png');
  const win = _pdfWin || window.open('', '_blank');
  _pdfWin = null;
  if (!win) { showToast('Enable popups to save PDF', true); return; }
  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html><head>
<title>Anaya — ${p?.name||''} — ${periodLabel}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4 portrait;margin:0}
  html,body{background:#f1f5f9}
  .toolbar{position:fixed;top:0;left:0;right:0;height:56px;background:#0a1e3d;display:flex;align-items:center;gap:10px;padding:0 16px;z-index:99;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
  .toolbar h2{color:#7dd3fc;font-family:Georgia,serif;font-size:16px;flex:1}
  .tbtn{padding:9px 18px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:sans-serif}
  .tbtn.primary{background:#0ea5e9;color:white}
  .tbtn.sec{background:rgba(255,255,255,0.15);color:white}
  .hint{color:rgba(255,255,255,0.5);font-size:11px;font-family:sans-serif}
  .page-wrap{margin-top:64px;display:flex;justify-content:center;padding:16px 0 40px}
  img{width:210mm;max-width:100%;display:block;box-shadow:0 4px 32px rgba(0,0,0,0.15)}
  @media print{.toolbar{display:none}.page-wrap{margin-top:0;padding:0}img{width:100%;box-shadow:none}}
</style>
</head><body>
<div class="toolbar">
  <h2>Anaya · ${p?.name||''} · ${periodLabel}</h2>
  <span class="hint">In print dialog → set Destination to "Save as PDF"</span>
  <button class="tbtn primary" onclick="window.print()">🖨 Save as PDF</button>
  <button class="tbtn sec" onclick="window.close()">✕</button>
</div>
<div class="page-wrap"><img src="${dataUrl}" alt="Anaya Report"></div>
</body></html>`);
  win.document.close();
}


// ====== A4 LAB REPORT BUILDER (#16 #17 #19) ======
async function buildReportCanvas(periodDays) {
  const p = patient();
  if (!p) return null;
  const units = p.units;
  const ismmol = units === 'mmol/L';
  const cutoff = Date.now() - periodDays * 86400000;
  const allFiltered = [...readings].filter(r => r.ts >= cutoff).sort((a,b)=>a.ts-b.ts);
  const labInPeriod = manualHba1c.filter(m => m.ts >= cutoff);
  const periodLabel = {7:'7 Days',14:'14 Days',30:'1 Month',90:'3 Months'}[periodDays]||'';

  const SC = 2, PW = 794, mg = 44;

  // Compute stats
  const lo = ismmol?4.0:70, hiR = ismmol?10.0:180;
  const inRng = allFiltered.filter(r=>r.val>=lo&&r.val<=hiR).length;
  const lowC  = allFiltered.filter(r=>r.val<lo).length;
  const highC = allFiltered.filter(r=>r.val>hiR).length;
  const avgAll = allFiltered.length ? (allFiltered.reduce((s,r)=>s+r.val,0)/allFiltered.length) : 0;
  const mealAvgR = (kws) => {
    const sub = allFiltered.filter(r=>kws.some(k=>(r.meal||'').toLowerCase().includes(k)));
    return sub.length ? (sub.reduce((s,r)=>s+r.val,0)/sub.length).toFixed(1) : '—';
  };
  const avgFasting  = mealAvgR(['fasting']);
  const avgPre      = mealAvgR(['before']);
  const avgPost     = mealAvgR(['after']);
  const estHba1c    = allFiltered.length>=3 ? calcHba1c(allFiltered, units) : null;
  const latestLab   = labInPeriod.length ? labInPeriod[labInPeriod.length-1]
                     : (manualHba1c.length ? manualHba1c[manualHba1c.length-1] : null);
  const lastR       = allFiltered.length ? allFiltered[allFiltered.length-1] : null;

  // Dynamic height
  const hdrH    = 190;
  const patH    = 130;
  const hiBoxH  = 170; // highlights
  const chartH  = 230;
  const hba1cH  = 180;
  const labTblH = labInPeriod.length>0 ? 40 + labInPeriod.length*26 + 20 : 0;
  const tblRowH = 26;
  const tblH    = 52 + allFiltered.length * tblRowH + 20;
  const ftrH    = 60;
  const gap     = 20;
  const totalH  = hdrH+patH+hiBoxH+chartH+hba1cH+(labTblH>0?labTblH+gap:0)+tblH+ftrH+gap*7;

  const rc = document.createElement('canvas');
  rc.width = PW*SC; rc.height = totalH*SC;
  const c = rc.getContext('2d');
  c.scale(SC,SC);
  const W = PW;

  // ── BACKGROUND ─────────────────────────────────────────────────
  c.fillStyle='#ffffff'; c.fillRect(0,0,W,totalH);

  // ── HEADER ─────────────────────────────────────────────────────
  c.fillStyle='#0a1e3d'; c.fillRect(0,0,W,hdrH);
  c.fillStyle='#0ea5e9'; c.fillRect(0,hdrH-6,W,6);

  // Logo
  c.fillStyle='#ffffff'; c.font='bold 42px Georgia,serif'; c.textAlign='left';
  c.fillText('Anaya', mg, 54);
  c.fillStyle='#7dd3fc'; c.font='16px Arial,sans-serif';
  c.fillText('Comprehensive Diabetes Monitoring Report', mg, 78);

  // Right meta
  c.fillStyle='rgba(255,255,255,0.75)'; c.font='13px Arial,sans-serif'; c.textAlign='right';
  const df = new Date(cutoff).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  const dt = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  c.fillText('Period: '+periodLabel+' ('+df+' – '+dt+')', W-mg, 44);
  c.fillText('Generated: '+new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}), W-mg, 64);
  c.fillStyle='rgba(255,255,255,0.4)'; c.font='11px Arial,sans-serif';
  c.fillText('For personal use only · Not a medical document', W-mg, 82);

  // Header divider
  c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=0.5;
  c.beginPath(); c.moveTo(mg,96); c.lineTo(W-mg,96); c.stroke();

  // Header summary stats
  const hStats = [
    {label:'Total Readings', val:allFiltered.length.toString()},
    {label:'Avg Glucose',    val:allFiltered.length?avgAll.toFixed(1)+' '+units:'—'},
    {label:'In Range',       val:allFiltered.length?Math.round(inRng/allFiltered.length*100)+'%':'—'},
    {label:'Est. HbA1c',    val:estHba1c?estHba1c.toFixed(1)+'%':'—', color:estHba1c?interpColor(estHba1c):null},
    {label:'Lab HbA1c',     val:latestLab?latestLab.val.toFixed(1)+'%':'—', color:latestLab?interpColor(latestLab.val):null},
  ];
  const sw=(W-mg*2)/hStats.length;
  hStats.forEach((s,i)=>{
    const sx=mg+i*sw+sw/2;
    c.fillStyle=s.color||'#7dd3fc';
    c.font='bold 26px Georgia,serif'; c.textAlign='center';
    c.fillText(s.val, sx, 148);
    c.fillStyle='rgba(255,255,255,0.55)'; c.font='12px Arial,sans-serif';
    c.fillText(s.label, sx, 168);
  });

  let curY = hdrH + gap;

  // ── PATIENT INFO ────────────────────────────────────────────────
  rpSectionHeader(c, 'PATIENT INFORMATION', mg, curY, W);
  curY+=26;
  c.fillStyle='#f0f7ff'; rpRRect(c,mg,curY,W-mg*2,patH-26,8); c.fill();
  c.strokeStyle='#bfdbfe'; c.lineWidth=0.8; rpRRect(c,mg,curY,W-mg*2,patH-26,8); c.stroke();
  const pfs=[['Patient Name',p.name],['Age',p.age+' years'],['Type',p.type],
             ['Units',units],['Readings in Period',allFiltered.length.toString()],['Report Period',periodLabel]];
  const pcW=(W-mg*2-32)/3;
  pfs.forEach((f,i)=>{
    const col=i%3, row=Math.floor(i/3);
    const fx=mg+16+col*pcW, fy=curY+12+row*38;
    c.fillStyle='#4a6080'; c.font='10px Arial,sans-serif'; c.textAlign='left';
    c.fillText(f[0].toUpperCase(), fx, fy+10);
    c.fillStyle='#0a1e3d'; c.font='bold 15px Arial,sans-serif';
    c.fillText(f[1], fx, fy+26);
  });
  curY += patH - 26 + gap;

  // ── HIGHLIGHTS ──────────────────────────────────────────────────
  rpSectionHeader(c, 'KEY HIGHLIGHTS (LAST 30 DAYS)', mg, curY, W);
  curY+=26;
  const hBoxes=[
    {label:'Avg Fasting',   val:avgFasting,  unit:units, color:'#2563eb', bg:'#eff6ff'},
    {label:'Avg Pre-meal',  val:avgPre,      unit:units, color:'#7c3aed', bg:'#f5f3ff'},
    {label:'Avg Post-meal', val:avgPost,     unit:units, color:'#059669', bg:'#ecfdf5'},
    {label:'Est. HbA1c',   val:estHba1c?estHba1c.toFixed(1)+'%':'—', unit:'estimated', color:estHba1c?interpColor(estHba1c):'#64748b', bg:'#f0f9ff'},
    {label:'Last Reading',  val:lastR?lastR.val+' '+units:'—', unit:lastR?new Date(lastR.ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})+(', '+lastR.meal):'', color:lastR?getStatus(lastR.val,units).color:'#64748b', bg:'#fff7ed'},
    {label:'In Target Range',val:allFiltered.length?Math.round(inRng/allFiltered.length*100)+'%':'—', unit:inRng+'/'+allFiltered.length+' readings', color:'#16a34a', bg:'#f0fdf4'},
  ];
  const bW=(W-mg*2-20)/3, bH=60;
  hBoxes.forEach((b,i)=>{
    const col=i%3, row=Math.floor(i/3);
    const bx=mg+col*(bW+10), by=curY+row*(bH+8);
    c.fillStyle=b.bg; rpRRect(c,bx,by,bW,bH,8); c.fill();
    c.strokeStyle=b.color+'55'; c.lineWidth=0.8; rpRRect(c,bx,by,bW,bH,8); c.stroke();
    c.fillStyle='#4a6080'; c.font='10px Arial,sans-serif'; c.textAlign='left';
    c.fillText(b.label.toUpperCase(), bx+10, by+14);
    c.fillStyle=b.color; c.font='bold 22px Georgia,serif';
    c.fillText(b.val, bx+10, by+40);
    c.fillStyle='#64748b'; c.font='10px Arial,sans-serif';
    c.fillText(b.unit, bx+10, by+54);
  });
  curY += hiBoxH - 26 + gap;

  // ── GLUCOSE TREND CHART ─────────────────────────────────────────
  rpSectionHeader(c, 'GLUCOSE TREND — SEPARATE LINES BY MEAL TYPE', mg, curY, W);
  curY+=26;
  c.fillStyle='#f8fafc'; rpRRect(c,mg,curY,W-mg*2,chartH-26,8); c.fill();
  c.strokeStyle='#e2e8f0'; c.lineWidth=0.8; rpRRect(c,mg,curY,W-mg*2,chartH-26,8); c.stroke();
  if (allFiltered.length>=2) {
    rpDrawMealChart(c, allFiltered, units, ismmol, mg+14, curY+12, W-mg*2-28, chartH-26-24);
  } else {
    c.fillStyle='#94a3b8'; c.font='14px Arial,sans-serif'; c.textAlign='center';
    c.fillText('Not enough data (need ≥2 readings)', W/2, curY+(chartH-26)/2);
  }
  // Chart meal legend
  const mls=[{c:'#2563eb',l:'Fasting'},{c:'#7c3aed',l:'Pre-meal'},{c:'#059669',l:'Post-meal'},{c:'#94a3b8',l:'Other'}];
  let legX=mg+14;
  mls.forEach(ml=>{
    c.fillStyle=ml.c; c.beginPath(); c.arc(legX,curY+chartH-26-6,5,0,Math.PI*2); c.fill();
    c.fillStyle='#334155'; c.font='bold 11px Arial,sans-serif'; c.textAlign='left';
    c.fillText(ml.l, legX+8, curY+chartH-26-2);
    legX+=70;
  });
  curY+=chartH-26+gap;

  // ── HBA1C ───────────────────────────────────────────────────────
  rpSectionHeader(c, 'HbA1c ANALYSIS', mg, curY, W);
  curY+=26;
  const hbxW=(W-mg*2-10)/2;
  // Estimated box
  c.fillStyle=estHba1c?'#f0f9ff':'#f8fafc'; rpRRect(c,mg,curY,hbxW,88,8); c.fill();
  c.strokeStyle=estHba1c?'#0ea5e955':'#e2e8f0'; c.lineWidth=0.8; rpRRect(c,mg,curY,hbxW,88,8); c.stroke();
  c.fillStyle='#4a6080'; c.font='10px Arial,sans-serif'; c.textAlign='left';
  c.fillText('ESTIMATED HbA1c (FROM GLUCOSE LOG)', mg+12, curY+16);
  if (estHba1c) {
    const ip=hba1cInterp(estHba1c);
    c.fillStyle=ip.color; c.font='bold 36px Georgia,serif'; c.fillText(estHba1c.toFixed(1)+'%', mg+12, curY+58);
    c.fillStyle='#334155'; c.font='bold 13px Arial,sans-serif'; c.fillText(ip.label, mg+12, curY+78);
    const eag=hba1cToEag(estHba1c);
    c.fillStyle='#64748b'; c.font='12px Arial,sans-serif';
    c.fillText('eAG: '+(ismmol?(eag/18.018).toFixed(1):eag)+' '+units, mg+130, curY+78);
  } else {
    c.fillStyle='#94a3b8'; c.font='14px Arial,sans-serif'; c.fillText('Insufficient data', mg+12, curY+54);
  }
  // Lab box
  const lbx=mg+hbxW+10;
  c.fillStyle=latestLab?'#f0fdf4':'#f8fafc'; rpRRect(c,lbx,curY,hbxW,88,8); c.fill();
  c.strokeStyle=latestLab?'#16a34a55':'#e2e8f0'; c.lineWidth=0.8; rpRRect(c,lbx,curY,hbxW,88,8); c.stroke();
  c.fillStyle='#4a6080'; c.font='10px Arial,sans-serif'; c.textAlign='left';
  c.fillText('LATEST LAB HbA1c', lbx+12, curY+16);
  if (latestLab) {
    const ip=hba1cInterp(latestLab.val);
    c.fillStyle=ip.color; c.font='bold 36px Georgia,serif'; c.fillText(latestLab.val.toFixed(1)+'%', lbx+12, curY+58);
    const ld=new Date(latestLab.ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    c.fillStyle='#334155'; c.font='bold 13px Arial,sans-serif'; c.fillText(ip.label, lbx+12, curY+78);
    c.fillStyle='#64748b'; c.font='12px Arial,sans-serif'; c.fillText(ld, lbx+130, curY+78);
  } else {
    c.fillStyle='#94a3b8'; c.font='14px Arial,sans-serif'; c.fillText('No lab result recorded', lbx+12, curY+54);
  }
  curY+=88+10;

  // HbA1c reference bar
  rpHba1cRefBar(c, mg, curY, W-mg*2, 30, estHba1c, latestLab);
  curY+=30+10;

  // In-range bar
  if (allFiltered.length>0) {
    const pct=v=>Math.round(v/allFiltered.length*100);
    const barW=W-mg*2;
    c.fillStyle='#22c55e'; c.fillRect(mg, curY, barW*pct(inRng)/100, 14);
    c.fillStyle='#f97316'; c.fillRect(mg+barW*pct(inRng)/100, curY, barW*pct(lowC)/100, 14);
    c.fillStyle='#ef4444'; c.fillRect(mg+barW*(pct(inRng)+pct(lowC))/100, curY, barW*pct(highC)/100, 14);
    c.fillStyle='#334155'; c.font='11px Arial,sans-serif'; c.textAlign='left';
    c.fillText('In Range: '+pct(inRng)+'%  Low: '+pct(lowC)+'%  High: '+pct(highC)+'%', mg, curY+28);
    curY+=36;
  }
  curY+=gap;

  // Lab HbA1c table
  if (labInPeriod.length>0) {
    rpSectionHeader(c, 'LAB HbA1c HISTORY IN PERIOD', mg, curY, W);
    curY+=26;
    const lCols=[{x:mg,w:200,label:'Date'},{x:mg+200,w:120,label:'HbA1c (%)'},{x:mg+320,w:140,label:'Status'},{x:mg+460,w:W-mg-460-mg,label:'Notes'}];
    c.fillStyle='#e0f2fe'; c.fillRect(mg,curY,W-mg*2,26);
    c.fillStyle='#0369a1'; c.font='bold 12px Arial,sans-serif'; c.textAlign='left';
    lCols.forEach(col=>c.fillText(col.label, col.x+6, curY+18));
    curY+=26;
    labInPeriod.forEach((m,i)=>{
      if(i%2===0){c.fillStyle='#f8fafc';c.fillRect(mg,curY,W-mg*2,26);}
      const ip=hba1cInterp(m.val);
      c.fillStyle='#0f172a'; c.font='13px Arial,sans-serif'; c.textAlign='left';
      c.fillText(new Date(m.ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}), lCols[0].x+6, curY+18);
      c.fillStyle=ip.color; c.font='bold 13px Arial,sans-serif';
      c.fillText(m.val.toFixed(1)+'%', lCols[1].x+6, curY+18);
      c.fillStyle='#334155'; c.font='13px Arial,sans-serif';
      c.fillText(ip.label, lCols[2].x+6, curY+18);
      c.fillStyle='#64748b'; c.fillText(m.notes||'—', lCols[3].x+6, curY+18);
      c.strokeStyle='#e2e8f0'; c.lineWidth=0.5;
      c.beginPath();c.moveTo(mg,curY+26);c.lineTo(W-mg,curY+26);c.stroke();
      curY+=26;
    });
    curY+=gap;
  }

  // ── READINGS TABLE (newest to oldest) ──────────────────────────
  rpSectionHeader(c, 'ALL GLUCOSE READINGS — NEWEST TO OLDEST ('+allFiltered.length+' TOTAL)', mg, curY, W);
  curY+=26;
  const tCols=[
    {x:mg,    w:32,  label:'#'},
    {x:mg+32, w:115, label:'Date'},
    {x:mg+147,w:72,  label:'Time'},
    {x:mg+219,w:110, label:'Glucose'},
    {x:mg+329,w:56,  label:'Status'},
    {x:mg+385,w:140, label:'Meal Type'},
    {x:mg+525,w:W-mg-525-mg, label:'Notes'},
  ];
  // Table header
  c.fillStyle='#0a1e3d'; c.fillRect(mg, curY, W-mg*2, 30);
  c.fillStyle='#ffffff'; c.font='bold 12px Arial,sans-serif'; c.textAlign='left';
  tCols.forEach(col=>c.fillText(col.label, col.x+4, curY+20));
  curY+=30;

  const sortedDesc=[...allFiltered].reverse(); // newest first (#19)
  sortedDesc.forEach((r,i)=>{
    const s=getStatus(r.val,units);
    const grpC = {fasting:'#2563eb',pre:'#7c3aed',post:'#059669',other:'#94a3b8'}[mealGroup(r.meal)]||'#94a3b8';
    c.fillStyle=i%2===0?'#ffffff':'#f8fafc';
    c.fillRect(mg, curY, W-mg*2, tblRowH);
    // Row number (descending = newest first)
    c.fillStyle='#94a3b8'; c.font='12px Arial,sans-serif'; c.textAlign='left';
    c.fillText((i+1).toString(), tCols[0].x+4, curY+18);
    const d=new Date(r.ts);
    c.fillStyle='#0f172a';
    c.fillText(d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}), tCols[1].x+4, curY+18);
    c.fillText(d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}), tCols[2].x+4, curY+18);
    c.fillStyle=s.color; c.font='bold 13px Arial,sans-serif';
    c.fillText(r.val+' '+units, tCols[3].x+4, curY+18);
    c.fillStyle=s.color; c.font='12px Arial,sans-serif';
    c.fillText(s.label, tCols[4].x+4, curY+18);
    c.fillStyle=grpC; c.font='bold 12px Arial,sans-serif';
    c.fillText(r.meal||'', tCols[5].x+4, curY+18);
    if(r.notes){c.fillStyle='#64748b'; c.font='11px Arial,sans-serif'; c.fillText((r.notes||'').slice(0,28), tCols[6].x+4, curY+18);}
    c.strokeStyle='#e2e8f0'; c.lineWidth=0.4;
    c.beginPath();c.moveTo(mg,curY+tblRowH);c.lineTo(W-mg,curY+tblRowH);c.stroke();
    curY+=tblRowH;
  });

  curY+=gap;

  // ── FOOTER ─────────────────────────────────────────────────────
  c.fillStyle='#0a1e3d'; c.fillRect(0,curY,W,ftrH);
  c.fillStyle='#7dd3fc'; c.font='bold 16px Georgia,serif'; c.textAlign='left';
  c.fillText('Anaya', mg, curY+22);
  c.fillStyle='rgba(255,255,255,0.5)'; c.font='12px Arial,sans-serif';
  c.fillText('Personal Diabetes Monitoring App', mg, curY+40);
  c.fillStyle='rgba(255,255,255,0.35)'; c.font='11px Arial,sans-serif'; c.textAlign='right';
  c.fillText('This report is generated for personal health tracking only.', W-mg, curY+22);
  c.fillText('It is NOT a substitute for professional medical advice or laboratory testing.', W-mg, curY+40);

  return rc;
}

// ── Report helper functions ─────────────────────────────────────
function rpSectionHeader(c, text, mg, y, W) {
  c.fillStyle='#0a1e3d'; c.fillRect(mg, y, W-mg*2, 24);
  c.fillStyle='#0ea5e9'; c.fillRect(mg, y, 5, 24);
  c.fillStyle='#ffffff'; c.font='bold 12px Arial,sans-serif'; c.textAlign='left';
  c.fillText(text, mg+14, y+16);
}

function rpRRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// Keep old aliases
function sectionHeader(c,t,mg,y,W){rpSectionHeader(c,t,mg,y,W);}
function rRect(ctx,x,y,w,h,r){rpRRect(ctx,x,y,w,h,r);}
function roundRect(ctx,x,y,w,h,r){rpRRect(ctx,x,y,w,h,r);}

function interpColor(h) {
  if(h<5.7)  return '#16a34a';
  if(h<6.5)  return '#65a30d';
  if(h<7.5)  return '#ca8a04';
  if(h<9.0)  return '#ea580c';
  return '#dc2626';
}

function rpHba1cRefBar(c, x, y, w, h, estH, latestLab) {
  const segs=[{l:'Normal',r:'<5.7',color:'#4ade80',p:0.2},{l:'Pre-diab',r:'5.7–6.4',color:'#a3e635',p:0.15},
              {l:'Controlled',r:'6.5–7.4',color:'#fde047',p:0.2},{l:'Elevated',r:'7.5–8.9',color:'#fb923c',p:0.25},{l:'Very High',r:'≥9%',color:'#f87171',p:0.2}];
  let cx=x;
  segs.forEach(s=>{
    const sw=w*s.p;
    c.fillStyle=s.color+'55'; c.fillRect(cx,y,sw,h);
    c.strokeStyle=s.color+'88'; c.lineWidth=0.5; c.strokeRect(cx,y,sw,h);
    c.fillStyle='#334155'; c.font='9px Arial,sans-serif'; c.textAlign='center';
    c.fillText(s.l, cx+sw/2, y+11);
    c.fillStyle='#64748b'; c.fillText(s.r, cx+sw/2, y+23);
    cx+=sw;
  });
  if(estH){const pct=Math.min(1,Math.max(0,(estH-4)/8));const mx=x+w*pct;c.fillStyle='#0ea5e9';c.beginPath();c.moveTo(mx-6,y-2);c.lineTo(mx+6,y-2);c.lineTo(mx,y+h+5);c.closePath();c.fill();}
  if(latestLab){const pct=Math.min(1,Math.max(0,(latestLab.val-4)/8));const mx=x+w*pct;c.fillStyle='#16a34a';c.beginPath();c.moveTo(mx-6,y-2);c.lineTo(mx+6,y-2);c.lineTo(mx,y+h+5);c.closePath();c.fill();}
}

// Meal-type separate lines chart for report
function rpDrawMealChart(c, filtered, units, ismmol, x, y, w, h) {
  const lo=ismmol?4.0:70, hiR=ismmol?10.0:180;
  const vals=filtered.map(r=>r.val);
  const minV=Math.min(...vals,lo)*0.88, maxV=Math.max(...vals,hiR)*1.08;
  const pad={l:46,r:12,t:8,b:28};
  const cW=w-pad.l-pad.r, cH=h-pad.t-pad.b;
  const toX=i=>x+pad.l+(i/(filtered.length-1||1))*cW;
  const toY=v=>y+pad.t+cH-((v-minV)/(maxV-minV))*cH;

  // Target band
  c.fillStyle='rgba(34,197,94,0.08)';
  c.fillRect(x+pad.l,toY(hiR),cW,toY(lo)-toY(hiR));
  c.fillStyle='#16a34a'; c.font='9px Arial,sans-serif'; c.textAlign='left';
  c.fillText('Target', x+pad.l+4, toY(hiR)-3);

  // Grid
  c.strokeStyle='#e2e8f0'; c.lineWidth=0.5;
  [0,0.25,0.5,0.75,1].forEach(f=>{
    const gy=y+pad.t+cH*(1-f);
    c.beginPath();c.moveTo(x+pad.l,gy);c.lineTo(x+pad.l+cW,gy);c.stroke();
    const v=minV+(maxV-minV)*f;
    c.fillStyle='#64748b'; c.font='10px Arial,sans-serif'; c.textAlign='right';
    c.fillText(ismmol?v.toFixed(1):Math.round(v), x+pad.l-3, gy+3);
  });

  // Y axis label
  c.save(); c.translate(x+12, y+pad.t+cH/2); c.rotate(-Math.PI/2);
  c.fillStyle='#64748b'; c.font='10px Arial,sans-serif'; c.textAlign='center';
  c.fillText(units, 0, 0); c.restore();

  // Separate lines per meal group
  const rpMealColors={fasting:'#2563eb',pre:'#7c3aed',post:'#059669',other:'#94a3b8'};
  const groups=['fasting','pre','post','other'];
  groups.forEach(grp=>{
    const pts=filtered.map((r,i)=>({r,i})).filter(({r})=>mealGroup(r.meal)===grp);
    if(pts.length<1) return;
    const color=rpMealColors[grp];
    if(pts.length>=2){
      c.beginPath(); c.strokeStyle=color; c.lineWidth=2.5; c.lineJoin='round'; c.setLineDash([]);
      c.moveTo(toX(pts[0].i),toY(pts[0].r.val));
      for(let k=1;k<pts.length;k++) c.lineTo(toX(pts[k].i),toY(pts[k].r.val));
      c.stroke();
    }
    pts.forEach(({r,i})=>{
      c.beginPath(); c.arc(toX(i),toY(r.val),4,0,Math.PI*2);
      c.fillStyle=color; c.fill();
      c.strokeStyle='rgba(255,255,255,0.8)'; c.lineWidth=0.8; c.stroke();
    });
  });

  // X date labels
  c.fillStyle='#64748b'; c.font='9px Arial,sans-serif'; c.textAlign='center'; c.setLineDash([]);
  const step=Math.max(1,Math.floor(filtered.length/8));
  for(let i=0;i<filtered.length;i+=step){
    const d=new Date(filtered[i].ts);
    c.fillText(d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}), toX(i), y+pad.t+cH+20);
  }
}


// ====== AI DOCTOR INSIGHTS (streaming) ======
async function loadAiInsights() {
  const p = patient();
  if (!p) return;
  if (readings.length < 3) {
    document.getElementById('aiInsightsBodyFull').innerHTML =
      '<div style="font-size:14px;color:var(--muted)">Need at least 3 readings for AI analysis.</div>';
    return;
  }

  // Disable both Refresh buttons
  ['aiInsightsBtnFull'].forEach(id=>{
    const b=document.getElementById(id); if(b){b.disabled=true;b.textContent='⏳';}
  });

  const bodyEl = document.getElementById('aiInsightsBodyFull');
  bodyEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--accent);font-size:14px"><div style="font-size:32px;margin-bottom:10px">🩺</div><div>Analysing data for ' + p.name + '…</div><div style="margin-top:8px;font-size:12px;color:var(--muted)">May take a few seconds</div></div>';

  const units = p.units;
  const ismmol = units === 'mmol/L';
  const lo = ismmol ? 4.0 : 70, hi = ismmol ? 10.0 : 180;

  const ninetyAgo = Date.now() - 90*86400000;
  const thirtyAgo  = Date.now() - 30*86400000;
  const periodRdgs = readings.filter(r => r.ts >= ninetyAgo);
  const useRdgs    = periodRdgs.length >= 3 ? periodRdgs : readings;
  const periodLabel = periodRdgs.length >= 3 ? 'last 90 days' : 'all available data (' + readings.length + ' readings)';

  const mealAvg = (kws, src) => {
    const sub = src.filter(r => kws.some(k => (r.meal||'').toLowerCase().includes(k)));
    return sub.length ? sub.reduce((s,r)=>s+r.val,0)/sub.length : null;
  };
  const fmt = (v, n) => v !== null ? v.toFixed(1)+' '+units+' ('+n+' rdgs)' : 'No data';

  const fastSub  = useRdgs.filter(r=>(r.meal||'').toLowerCase().includes('fasting'));
  const preSub   = useRdgs.filter(r=>(r.meal||'').toLowerCase().includes('before'));
  const postSub  = useRdgs.filter(r=>(r.meal||'').toLowerCase().includes('after'));
  const bedSub   = useRdgs.filter(r=>(r.meal||'').toLowerCase().includes('bedtime'));

  const mealTrend = (sub) => {
    if (sub.length < 4) return 'insufficient data';
    const half = Math.floor(sub.length/2);
    const early = sub.slice(0,half).reduce((s,r)=>s+r.val,0)/half;
    const late  = sub.slice(half).reduce((s,r)=>s+r.val,0)/(sub.length-half);
    const diff  = (late-early).toFixed(1);
    return late > early+2 ? `worsening (+${diff} ${units})` : late < early-2 ? `improving (${diff} ${units})` : 'stable';
  };

  const highEp = useRdgs.filter(r=>r.val>hi).length;
  const lowEp  = useRdgs.filter(r=>r.val<lo).length;
  const inRng  = useRdgs.filter(r=>r.val>=lo&&r.val<=hi).length;
  const pctIn  = useRdgs.length ? Math.round(inRng/useRdgs.length*100) : 0;
  const maxVal = useRdgs.length ? Math.max(...useRdgs.map(r=>r.val)) : null;
  const minVal = useRdgs.length ? Math.min(...useRdgs.map(r=>r.val)) : null;

  const estH = readings.length>=3 ? calcHba1c(readings, units) : null;
  const labH = manualHba1c.length ? manualHba1c[manualHba1c.length-1] : null;

  const rdgLines = [...useRdgs].reverse().slice(0,20).map(r => {
    const d = new Date(r.ts);
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})+' '+
           d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})+' | '+
           r.val+' '+units+' | '+(r.meal||'Random')+(r.notes?' | '+r.notes:'');
  }).join('\n');

  const salutation = p.gender==='female' ? 'Ms.' : p.gender==='other' ? '' : 'Mr.';
  const addressName = salutation ? salutation+' '+p.name.split(' ').slice(-1)[0] : p.name;

  // Load extended profile data — cap lengths to control prompt size
  const medications     = (localStorage.getItem('glucoMeds_'+p.id) || '').slice(0, 600);
  const generalCond     = (localStorage.getItem('glucoCond_'+p.id) || '').slice(0, 500);
  const referenceRaw    = (localStorage.getItem('glucoGlobalRef') || '').slice(0, 1200);
  const referenceSection = referenceRaw
    ? `\nREFERENCE STYLE EXAMPLE (match this depth and personalisation):\n${referenceRaw}\n`
    : '';

  const yr = new Date().getFullYear();
  const diabetesDuration = p.diabetesSince ? (yr - p.diabetesSince) + ' years (since ' + p.diabetesSince + ')' : 'Unknown';
  const ageTargetNote = p.age >= 75 ? 'NOTE: Patient is 75+. Use relaxed targets: fasting 90–150 mg/dL, post-meal <200 mg/dL. Avoid hypoglycaemia.' : '';

  const prompt = `You are an experienced diabetologist and endocrinologist providing a detailed, personalised clinical assessment. You have full context about this patient. Be specific, use the actual numbers from the data, and write like a doctor who knows this patient well.

CRITICAL: Do NOT be generic. Reference the specific readings, dates, patterns and clinical context provided. Do NOT cut off or truncate — complete every section fully.
${ageTargetNote ? '\n'+ageTargetNote+'\n' : ''}
═══════════════════════════════════════
PATIENT PROFILE
═══════════════════════════════════════
Name:              ${p.name}
Gender:            ${p.gender==='female'?'Female':p.gender==='other'?'Other':'Male'}
Age:               ${p.age} years
Diabetes Type:     ${p.type}
Diabetes Duration: ${diabetesDuration}
Glucose Units:     ${units}
Target Range:      ${lo}–${hi} ${units}
Analysis Period:   ${periodLabel} (${useRdgs.length} readings)

CURRENT MEDICATIONS:
${medications || 'Not provided'}

GENERAL CONDITION & CLINICAL HISTORY:
${generalCond || 'Not provided'}
${referenceSection}
═══════════════════════════════════════
GLUCOSE DATA SUMMARY
═══════════════════════════════════════
Fasting avg:     ${fmt(mealAvg(['fasting'],useRdgs), fastSub.length)}  | Trend: ${mealTrend(fastSub)}
Pre-meal avg:    ${fmt(mealAvg(['before'],useRdgs),  preSub.length)}   | Trend: ${mealTrend(preSub)}
Post-meal avg:   ${fmt(mealAvg(['after'],useRdgs),   postSub.length)}  | Trend: ${mealTrend(postSub)}
Bedtime avg:     ${fmt(mealAvg(['bedtime'],useRdgs), bedSub.length)}
In target range: ${pctIn}% (${inRng}/${useRdgs.length} readings)
High episodes:   ${highEp} readings above ${hi} ${units}
Low episodes:    ${lowEp} readings below ${lo} ${units}
Peak reading:    ${maxVal} ${units}
Lowest reading:  ${minVal} ${units}
Est. HbA1c:      ${estH ? estH.toFixed(1)+'%' : 'insufficient data'}
Lab HbA1c:       ${labH ? labH.val+'% on '+new Date(labH.ts).toLocaleDateString('en-GB') : 'not recorded'}

INDIVIDUAL READINGS LOG (newest first, up to 30):
Date       | Time  | Value      | Meal Type        | Notes
${rdgLines}

═══════════════════════════════════════
ASSESSMENT REQUIRED
═══════════════════════════════════════
Write a complete, personalised clinical assessment for ${addressName}. Use these EXACT section headings. Minimum 4 sentences per section. Reference actual readings and numbers throughout.

## Overall Glucose Control
Summarise overall control. Reference HbA1c, time-in-range, highest/lowest readings and what they indicate clinically. Comment on the ${diabetesDuration} duration of diabetes and how that affects interpretation.

## Fasting Glucose Analysis
Detailed analysis of fasting readings — average, range, dawn phenomenon, overnight control. Compare to appropriate targets for this patient's age and condition. Reference specific fasting values from the log.

## Pre-Meal Glucose Analysis
Analyse pre-meal readings. Discuss whether glucose is adequately controlled before eating, possible medication timing issues, and patterns across different meals of the day.

## Post-Meal Glucose Analysis
Analyse post-meal spikes in detail. How high are they, how quickly does glucose return to range, which meals cause the worst spikes. Comment on carbohydrate impact if visible from notes.

## Trends & Patterns
Identify temporal patterns — time of day, day-to-day variability, week-on-week improvement or worsening. Note any specific concerning episodes. Comment on monitoring frequency and whether gaps in data affect assessment.

## Medication Effectiveness
Based on current medications listed above, assess whether the regimen appears adequate. Note timing concerns, potential adjustments to discuss with doctor, or signs of medication wearing off.

## Concerns & Risk Flags
Clinical concerns in priority order — hypoglycaemia risk, persistent highs, variability, HbA1c implications. Be direct and specific.

## Positive Observations
What is going well — consistent monitoring, improving readings, good fasting control, medication compliance signals.

## Personalised Recommendations
Give 6–8 specific, actionable recommendations tailored to THIS patient's data, age, medications and condition. Include: meal timing, testing schedule, lifestyle suggestions, red flags requiring urgent doctor visit, targets to aim for next review.

End with exactly this line:
⚠️ This assessment is AI-generated from glucose log data for personal awareness only. Always consult your doctor or diabetes care team for medical decisions.`;

  const snapId = currentPatientId;

  // Retry up to 3 times for transient errors
  let rawText = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      rawText = await geminiFetch(prompt);
      if (rawText) break;
    } catch(retryErr) {
      console.warn('AI attempt', attempt, 'failed:', retryErr.message);
      if (attempt < 3) {
        // Update button to show retry progress
        ['aiInsightsBtnFull'].forEach(id=>{
          const b=document.getElementById(id);
          if(b) b.textContent = `Retry ${attempt}/3…`;
        });
        await new Promise(r=>setTimeout(r, 1500 * attempt));
      } else {
        throw retryErr;
      }
    }
  }
  try {
    if (!rawText || snapId !== currentPatientId) return;

    const { chipHtml, fullHtml } = formatAiInsights(rawText);

    // Dashboard chips
    // Dashboard AI card removed — chips only shown in Insights tab

    // Insights tab full view
    const fullEl = document.getElementById('aiInsightsBodyFull');
    if (fullEl) { fullEl.innerHTML = fullHtml; fullEl.style.overflow = 'visible'; }

    // Save everything
    localStorage.setItem('glucoInsights_'+snapId, JSON.stringify({
      chipHtml, fullHtml, rawText, ts: Date.now(), patientId: snapId
    }));

  } catch(e) {
    console.error('AI Insights error:', e);
    if (snapId !== currentPatientId) return;
    const errHtml = `<div style="font-size:14px;color:var(--high);padding:12px 0">⚠️ ${e.message||'Could not load insights. Try again.'}</div>`;
    const b1 = document.getElementById('aiInsightsBodyFull');
    if(b1) b1.innerHTML = errHtml;
  } finally {
    if (snapId === currentPatientId) {
      [document.getElementById('aiInsightsBtnFull')]
        .forEach(b => { if(b) { b.disabled=false; b.textContent='↻ Refresh'; }});
    }
  }
}

// Dashboard: compact chip summary
function loadSavedInsightsChips() {
  // Dashboard AI card removed — use loadSavedInsightsFull() on Insights tab
  return;
  if (!currentPatientId) return;
  const bodyEl = document.getElementById('aiInsightsBodyFull');
  const btn    = document.getElementById('aiInsightsBtn');
  if (!bodyEl) return;

  const raw = localStorage.getItem('glucoInsights_'+currentPatientId);
  if (!raw) {
    bodyEl.innerHTML = `<div style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0">Tap <strong style="color:var(--text)">Analyse</strong> for AI assessment</div>`;
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (data.patientId !== currentPatientId) {
      bodyEl.innerHTML = `<div style="font-size:13px;color:var(--muted);text-align:center;padding:12px 0">Tap <strong style="color:var(--text)">Analyse</strong></div>`;
      if(btn) btn.textContent = 'Analyse'; return;
    }
    // Use saved chipHtml if available, otherwise regenerate from fullHtml via formatAiInsights
    if (data.chipHtml) {
      bodyEl.innerHTML = data.chipHtml;
    } else if (data.rawText) {
      const { chipHtml } = formatAiInsights(data.rawText);
      bodyEl.innerHTML = chipHtml;
    } else {
      bodyEl.innerHTML = data.html || '';
    }
    if(btn) btn.textContent = '↻';
  } catch { bodyEl.innerHTML = ''; }
}

// Insights tab: full detailed view
function loadSavedInsightsFull() {
  if (!currentPatientId) return;
  const bodyEl = document.getElementById('aiInsightsBodyFull');
  const btn    = document.getElementById('aiInsightsBtnFull');
  if (!bodyEl) return;

  const raw = localStorage.getItem('glucoInsights_'+currentPatientId);
  if (!raw) {
    bodyEl.innerHTML = `<div style="font-size:13px;color:var(--muted);line-height:1.7;text-align:center;padding:20px 0">Tap <strong style="color:var(--text)">Analyse</strong> for a full clinical assessment.<br><br><span style="font-size:11px;opacity:0.7">⚠️ AI-generated guidance only. Not a substitute for your doctor.</span></div>`;
    if(btn) btn.textContent = 'Analyse'; return;
  }
  try {
    const data = JSON.parse(raw);
    if (data.patientId !== currentPatientId) {
      bodyEl.innerHTML = `<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px 0">Tap <strong style="color:var(--text)">Analyse</strong></div>`;
      if(btn) btn.textContent = 'Analyse'; return;
    }
    const d = new Date(data.ts);
    const timeStr = d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' · '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    // Use fullHtml if saved, else fallback to html
    const displayHtml = data.fullHtml || data.html || '';
    bodyEl.innerHTML = displayHtml +
      `<div style="margin-top:12px;font-size:11px;color:var(--muted);text-align:right;border-top:1px solid var(--border);padding-top:8px">Last analysed: ${timeStr}</div>`;
    if(btn) btn.textContent = '↻ Refresh';
  } catch { bodyEl.innerHTML = ''; }
}

// Keep old name working for patient load
function loadSavedInsights() { loadSavedInsightsChips(); loadSavedInsightsFull(); }

function formatAiInsights(text) {
  const cfg = {
    'Overall Glucose Control':      { icon:'🩺', color:'#5b9cf6' },
    'Fasting Glucose Analysis':     { icon:'💤', color:'#818cf8' },
    'Pre-Meal Glucose Analysis':    { icon:'🍽️', color:'#a78bfa' },
    'Post-Meal Glucose Analysis':   { icon:'🥘', color:'#22d3ee' },
    'Trends & Patterns':            { icon:'📈', color:'#60a5fa' },
    'Medication Effectiveness':     { icon:'💊', color:'#34d399' },
    'Concerns & Risk Flags':        { icon:'⚠️', color:'#f87171' },
    'Positive Observations':        { icon:'✅', color:'#4ade80' },
    'Personalised Recommendations': { icon:'💡', color:'#fbbf24' },
    // fallbacks
    'Overall Control':              { icon:'🩺', color:'#5b9cf6' },
    'Key Patterns':                 { icon:'📈', color:'#818cf8' },
    'Concerns':                     { icon:'⚠️', color:'#f87171' },
    "What's Going Well":            { icon:'✅', color:'#4ade80' },
    'Suggestions':                  { icon:'💡', color:'#fbbf24' },
    'Recommendations':              { icon:'💡', color:'#fbbf24' },
  };

  let chipHtml = '<div class="ai-summary-grid">';
  let fullHtml = '';

  const parts = text.split(/##\s+/);
  parts.forEach((part, idx) => {
    if (!part.trim()) return;
    const firstLine = part.split('\n')[0].trim();
    const body = part.slice(firstLine.length).trim();
    const s = cfg[firstLine] || { icon:'📋', color:'var(--accent)' };

    // Clean formatting
    const formatted = body
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^[-•]\s+/gm, '• ')
      .replace(/\n{2,}/g, '\n')
      .trim();

    // First sentence for chip summary line
    const plain = body.replace(/\*\*|\n/g, ' ').replace(/  +/g, ' ').trim();
    const summary = plain.split(/[.!?]/)[0].trim().slice(0, 90) + (plain.length > 90 ? '…' : '');

    // Chip for dashboard
    chipHtml += `<div class="ai-chip" onclick="toggleChip(this)" style="animation-delay:${idx * 0.05}s;border-left-color:${s.color}">
      <div class="ai-chip-icon">${s.icon}</div>
      <div class="ai-chip-content">
        <div class="ai-chip-label" style="color:${s.color}">${firstLine}</div>
        <div class="ai-chip-value">${summary}</div>
        <div class="ai-chip-detail">${formatted.replace(/\n/g,'<br>')}</div>
      </div>
      <span class="ai-chip-arrow">⌄</span>
    </div>`;

    // Full card for insights tab
    fullHtml += `<div class="ai-section" style="background:${s.color}12;border-radius:14px;padding:14px 16px;margin-bottom:10px;border-left:3px solid ${s.color};animation:fadeUp 0.3s ease ${idx*0.06}s both">
      <div style="font-size:13px;font-weight:700;color:${s.color};margin-bottom:8px">${s.icon} ${firstLine}</div>
      <div style="font-size:14px;color:var(--text);line-height:1.8">${formatted.replace(/\n/g,'<br>')}</div>
    </div>`;
  });

  chipHtml += `<div style="text-align:center;margin-top:8px">
    <button onclick="switchTab('insights',document.getElementById('tab-insights'))"
      style="background:none;border:none;color:var(--accent);font-size:13px;font-weight:700;cursor:pointer;font-family:'Poppins',Arial,sans-serif;padding:4px">
      View full analysis →
    </button>
  </div></div>`;

  fullHtml += `<div style="margin-top:12px;font-size:12px;color:var(--muted);font-style:italic;text-align:center;padding:8px;border-top:1px solid var(--border)">
    ⚠️ AI-generated from glucose log data. Always consult your doctor.
  </div>`;

  return { chipHtml, fullHtml };
}



function toggleChip(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return;
  const isExpanded = el.classList.toggle('expanded');
  const arrow = el.querySelector('.ai-chip-arrow');
  if (arrow) arrow.textContent = isExpanded ? '⌃' : '⌄';
}




// ====== LOG MODE TOGGLE ======
function setLogMode(mode, btn) {
  document.querySelectorAll('#logModePills .toggle-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('logPanelManual').style.display  = mode==='manual' ? 'block' : 'none';
  document.getElementById('logPanelOcr').style.display     = mode==='ocr'    ? 'block' : 'none';
  document.getElementById('logPanelVoice').style.display   = mode==='voice'  ? 'block' : 'none';
  if (mode==='voice') initVoice();
}

// ====== OCR / IMAGE ANALYSIS (#21) ======
let ocrPendingReadings = [];

async function handleOcrFile(input, sourceType) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  // Show image preview
  if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    document.getElementById('ocrPreviewImg').src = url;
    document.getElementById('ocrPreview').style.display = 'block';
  } else {
    document.getElementById('ocrPreview').style.display = 'none';
  }

  document.getElementById('ocrResults').style.display = 'none';
  document.getElementById('ocrStatus').style.display = 'block';
  document.getElementById('ocrStatusText').textContent = 'Analysing with AI…';

  try {
    const base64 = await fileToBase64(file);
    const isPdf = file.type === 'application/pdf';
    const mediaType = isPdf ? 'application/pdf' : file.type;
    const p = patient();
    const units = p?.units || 'mg/dL';
    const isGlucometer = sourceType === 'glucometer';

    // Current date/time for glucometer default
    const now = new Date();
    const nowDate = now.toISOString().split('T')[0];
    const nowTime = now.toTimeString().slice(0,5);

    const prompt = isGlucometer
      ? `This is a photo of a glucometer display showing a live blood glucose reading.

Extract the glucose value shown on the screen.

Return ONLY a JSON array with ONE entry:
[{"val": <number>, "date": "${nowDate}", "time": "${nowTime}", "meal": "Random", "notes": "From glucometer photo", "source": "glucometer"}]

Units context: ${units}. If the display shows mg/dL and patient uses mmol/L (or vice versa), convert accordingly.
If you cannot read the value clearly, still return the array with val: null.
Return ONLY the JSON array, no explanation.`

      : `This is a medical lab report document. Your task is to find ALL blood glucose related test results.

Look for tests named: Fasting Blood Glucose, Fasting Blood Sugar, FBS, FPG, Random Blood Glucose, RBS, Post-Prandial Blood Sugar, PPBS, 2hr Post-Glucose, HbA1c, Glycated Haemoglobin, GTT results, or any glucose measurement.

Also look for:
- Sample collection date and time (usually labelled "Collection Date", "Sample Date", "Collected On", etc.)
- The test values and their units

For each glucose reading found, return a JSON object with:
- val: numeric value (convert to ${units} if needed)
- date: sample collection date as YYYY-MM-DD (from the report, NOT today's date)
- time: sample collection time as HH:MM (from the report, or null if not found)
- meal: map the test type — "Fasting" for FBS/FPG, "After meal (2hr)" for PPBS/2hr post, "Random" for RBS, "Random" for HbA1c
- notes: include the original test name e.g. "FBS", "PPBS", "HbA1c: 7.2%"
- source: "labreport"

Return ONLY a JSON array. No explanation, no markdown. Example:
[{"val":98,"date":"2024-03-15","time":"07:30","meal":"Fasting","notes":"FBS","source":"labreport"}]`;

    const data = await geminiFetch(prompt, base64, mediaType);
    const clean = data.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();

    let extracted;
    try {
      extracted = JSON.parse(clean);
    } catch(parseErr) {
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) extracted = JSON.parse(match[0]);
      else throw new Error('Could not parse AI response: ' + clean.slice(0,100));
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      document.getElementById('ocrStatusText').textContent = '❓ No glucose readings found. Try a clearer photo or different file.';
      return;
    }

    // Filter out null vals but keep for display
    ocrPendingReadings = extracted;
    renderOcrResults(extracted, units, isGlucometer);
    document.getElementById('ocrStatus').style.display = 'none';
    document.getElementById('ocrResults').style.display = 'block';

  } catch(e) {
    console.error('OCR error:', e);
    document.getElementById('ocrStatusText').textContent = '⚠️ Error: ' + (e.message||'Could not analyse. Try again or enter manually.');
  }
}

function renderOcrResults(extracted, units, isGlucometer) {
  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0,5);
  document.getElementById('ocrResultsList').innerHTML = extracted.map((r,i) => {
    const hasVal = r.val && r.val > 0;
    const statusColor = hasVal ? getStatus(r.val, units).color : 'var(--muted)';
    const statusLabel = hasVal ? getStatus(r.val, units).label : 'Unknown';
    // Glucometer: use current time as default; lab report: use extracted date
    const defaultDate = isGlucometer ? today : (r.date || today);
    const defaultTime = isGlucometer ? nowTime : (r.time || '');
    const sourceBadge = r.source === 'labreport'
      ? `<span style="font-size:11px;background:rgba(125,211,252,0.15);border:1px solid rgba(125,211,252,0.3);border-radius:6px;padding:2px 7px;color:var(--accent2)">🧪 Lab Report</span>`
      : `<span style="font-size:11px;background:rgba(79,168,255,0.12);border:1px solid rgba(79,168,255,0.25);border-radius:6px;padding:2px 7px;color:var(--accent)">📸 Glucometer</span>`;
    return `
    <div style="background:var(--bg3);border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-family:'Poppins',Arial,sans-serif;font-size:28px;color:${statusColor}">${hasVal?r.val:'?'}</span>
        <span style="font-size:13px;color:var(--muted);font-weight:600">${units}</span>
        <span style="font-size:13px;color:${statusColor};font-weight:700">${statusLabel}</span>
        <span style="margin-left:auto">${sourceBadge}</span>
      </div>
      ${r.notes?`<div style="font-size:12px;color:var(--muted);margin-bottom:8px;font-style:italic">📋 ${r.notes}</div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="flex:1;min-width:130px">
          <div style="font-size:11px;color:var(--text);font-weight:700;text-transform:uppercase;margin-bottom:4px">Glucose Value</div>
          <input type="number" value="${hasVal?r.val:''}" placeholder="Enter value"
            onchange="ocrPendingReadings[${i}].val=parseFloat(this.value)"
            style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:15px;font-weight:700;font-family:'Poppins',Arial,sans-serif;-webkit-appearance:none;outline:none">
        </div>
        <div style="flex:1;min-width:120px">
          <div style="font-size:11px;color:var(--text);font-weight:700;text-transform:uppercase;margin-bottom:4px">Date ${isGlucometer?'(now)':''}</div>
          <input type="date" value="${defaultDate}"
            onchange="ocrPendingReadings[${i}].date=this.value"
            style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;font-family:'Poppins',Arial,sans-serif;-webkit-appearance:none;outline:none">
        </div>
        <div style="flex:1;min-width:100px">
          <div style="font-size:11px;color:var(--text);font-weight:700;text-transform:uppercase;margin-bottom:4px">Time ${isGlucometer?'(now)':''}</div>
          <input type="time" value="${defaultTime}"
            onchange="ocrPendingReadings[${i}].time=this.value"
            style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;font-family:'Poppins',Arial,sans-serif;-webkit-appearance:none;outline:none">
        </div>
        <div style="flex:1;min-width:140px">
          <div style="font-size:11px;color:var(--text);font-weight:700;text-transform:uppercase;margin-bottom:4px">Meal Type</div>
          <select onchange="ocrPendingReadings[${i}].meal=this.value"
            style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;font-family:'Poppins',Arial,sans-serif;-webkit-appearance:none;outline:none">
            ${['Fasting','Before meal','After meal (1hr)','After meal (2hr)','Bedtime','Random'].map(m=>`<option ${m===r.meal?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
  }).join('');
}

function saveAllOcrReadings(fromVoice) {
  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0,5);
  const src = fromVoice === 'voice' ? ocrPendingReadings : ocrPendingReadings;
  let saved = 0;
  src.forEach(r => {
    const val = parseFloat(r.val);
    if (!val || val < 20 || val > 600) return;
    const d = r.date || today;
    const t = r.time || nowTime;
    readings.push({
      id: Date.now()+saved,
      val,
      meal: r.meal || 'Random',
      date: d, time: t,
      notes: r.notes || '',
      ts: new Date(d+'T'+t).getTime()
    });
    saved++;
  });
  readings.sort((a,b)=>a.ts-b.ts);
  saveReadings(currentPatientId, readings);
  ocrPendingReadings = [];
  // Reset all panels
  ['ocrResults','ocrPreview','ocrStatus','voiceResults','voiceTranscript','voiceAiStatus'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display='none';
  });
  // voiceAnalyseBtn removed from UI
  const vs = document.getElementById('voiceStatus'); if(vs) vs.textContent='Tap to start speaking';
  refreshDashboard(); renderHistory();
  showToast(`${saved} reading${saved!==1?'s':''} saved ✓`);
  setLogMode('manual', document.getElementById('logModeManual'));
}

function clearOcrResults() {
  ocrPendingReadings = [];
  ['ocrResults','ocrPreview','ocrStatus'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display='none';
  });
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

// ====== VOICE INPUT (#21 fixed) ======
let voiceRecognition = null;
let voiceTranscriptText = '';
let voiceRecording = false;
let voiceLang = 'en-IN';
let voiceSilenceTimer = null;
let voiceFinalText = '';
const VOICE_SILENCE_MS = 2000; // auto-analyse after 2s silence

function setVoiceLang(lang, btn) {
  voiceLang = lang;
  document.querySelectorAll('#voiceLangPills .toggle-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // Reset recognition so it uses new lang next start
  if (voiceRecognition) { try { voiceRecognition.abort(); } catch{} voiceRecognition = null; }
}

function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const s = document.getElementById('voiceStatus');
    if(s) s.textContent = '⚠️ Voice not supported. Use Safari on iPhone.';
    const b = document.getElementById('voiceMicBtn');
    if(b) b.disabled = true;
    return false;
  }
  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = voiceLang;
  voiceRecognition.continuous = true;       // keep listening
  voiceRecognition.interimResults = true;   // show live transcript
  voiceRecognition.maxAlternatives = 1;

  voiceRecognition.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t + ' ';
      else interim += t;
    }
    if (final) voiceFinalText += final;
    voiceTranscriptText = (voiceFinalText + interim).trim();

    const el = document.getElementById('voiceTranscript');
    if (el) { el.style.display='block'; el.textContent = '"' + voiceTranscriptText + '"'; }

    // Reset silence countdown every time speech is detected
    resetSilenceTimer();
  };

  voiceRecognition.onerror = (e) => {
    if (e.error === 'no-speech') return; // ignore, keep listening
    clearSilenceTimer();
    voiceRecording = false;
    const s = document.getElementById('voiceStatus');
    if(s) s.textContent = e.error==='not-allowed'
      ? '⚠️ Microphone permission denied. Allow in Settings.'
      : '⚠️ Error: '+e.error+'. Tap to retry.';
    resetMicBtn();
  };

  voiceRecognition.onend = () => {
    // Only handle onend if we didn't trigger it via stopAndAnalyse
    if (voiceRecording) {
      // Unexpected end — restart if still recording
      try { voiceRecognition.start(); } catch {}
    }
  };

  return true;
}

function resetSilenceTimer() {
  clearSilenceTimer();
  if (!voiceTranscriptText.trim()) return;

  // Animate silence bar countdown
  const bar = document.getElementById('voiceSilenceBar');
  const fill = document.getElementById('voiceSilenceFill');
  if(bar) bar.style.display='block';
  if(fill){ fill.style.transition='none'; fill.style.width='100%'; }
  // Trigger reflow then animate
  setTimeout(()=>{
    if(fill){ fill.style.transition=`width ${VOICE_SILENCE_MS}ms linear`; fill.style.width='0%'; }
  },30);

  voiceSilenceTimer = setTimeout(()=>{
    if(voiceTranscriptText.trim()) stopAndAnalyse();
  }, VOICE_SILENCE_MS);
}

function clearSilenceTimer() {
  if(voiceSilenceTimer){ clearTimeout(voiceSilenceTimer); voiceSilenceTimer=null; }
  const bar = document.getElementById('voiceSilenceBar');
  const fill = document.getElementById('voiceSilenceFill');
  if(bar) bar.style.display='none';
  if(fill){ fill.style.transition='none'; fill.style.width='100%'; }
}

function stopAndAnalyse() {
  voiceRecording = false;
  clearSilenceTimer();
  try { voiceRecognition.stop(); } catch {}
  resetMicBtn();
  const s = document.getElementById('voiceStatus');
  if(s) s.textContent = 'Got it — analysing…';
  analyseVoiceTranscript();
}

function resetMicBtn() {
  const btn = document.getElementById('voiceMicBtn');
  if(btn){ btn.style.background='linear-gradient(135deg,var(--accent),#1d6fa8)'; btn.textContent='🎤'; }
}

function toggleVoiceRecording() {
  if (voiceRecording) {
    // Manual stop — immediately analyse if there's text
    stopAndAnalyse();
    return;
  }
  if (!voiceRecognition && !initVoice()) return;
  // Reset state
  voiceTranscriptText = ''; voiceFinalText = '';
  const el = document.getElementById('voiceTranscript'); if(el){ el.style.display='none'; el.textContent=''; }
  document.getElementById('voiceResults').style.display='none';
  document.getElementById('voiceAiStatus').style.display='none';
  clearSilenceTimer();

  try {
    voiceRecognition.lang = voiceLang;
    voiceRecognition.start();
    voiceRecording = true;
    const btn = document.getElementById('voiceMicBtn');
    if(btn){ btn.style.background='linear-gradient(135deg,#ef4444,#b91c1c)'; btn.textContent='⏹'; }
    const s = document.getElementById('voiceStatus');
    if(s) s.textContent='🔴 Listening… tap to stop';
  } catch(e) {
    const s = document.getElementById('voiceStatus');
    if(s) s.textContent='⚠️ Could not start microphone. '+e.message;
  }
}

async function analyseVoiceTranscript() {
  const text = voiceTranscriptText.trim();
  if (!text) {
    const s=document.getElementById('voiceStatus'); if(s) s.textContent='Nothing recorded. Tap to try again.';
    return;
  }
  document.getElementById('voiceAiStatus').style.display = 'block';
  document.getElementById('voiceResults').style.display = 'none';

  const p = patient();
  const units = p?.units || 'mg/dL';
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];
  const nowTime = now.toTimeString().slice(0,5);

  const prompt = `Extract a blood glucose reading from this spoken text (may be in English, Hindi, or Hinglish):
"${text}"

Today is ${todayDate}, current time is ${nowTime}.
Patient glucose units: ${units}.

Hindi/Hinglish mappings to help you:
- "sugar", "shakar", "glucose", "blood sugar" = glucose reading
- "khali pet" / "bhooke" / "fasting" = Fasting
- "khane se pehle" / "before meal" = Before meal
- "khane ke baad" / "after meal" / "lunch ke baad" / "dinner ke baad" = After meal
- "raat ko" / "sone se pehle" / "bedtime" = Bedtime
- "kal" = yesterday, "aaj" = today, "kal subah" = yesterday morning
- "subah" = morning (~7-9am), "dopahar" = afternoon (~1pm), "shaam" = evening (~6pm), "raat" = night (~9pm)
- Numbers in Hindi: ek=1, do=2, teen=3, char=4, paanch=5, chhe=6, saat=7, aath=8, nau=9, das=10

Return ONLY a JSON array with one object — no explanation:
[{"val":<number>,"date":"<YYYY-MM-DD>","time":"<HH:MM>","meal":"<Fasting|Before meal|After meal (1hr)|After meal (2hr)|Bedtime|Random>","notes":"<original speech snippet or null>"}]

Use today's date and current time as defaults if not specified. Convert units if needed.`;

  try {
    const raw = (await geminiFetch(prompt)).replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
    let extracted;
    try { extracted = JSON.parse(raw); }
    catch { const m=raw.match(/\[[\s\S]*?\]/); extracted = m ? JSON.parse(m[0]) : null; }

    document.getElementById('voiceAiStatus').style.display = 'none';

    if (!extracted || !Array.isArray(extracted) || !extracted[0]?.val) {
      const s=document.getElementById('voiceStatus');
      if(s) s.textContent='❓ Could not find a number. Say e.g. "sugar 126 fasting" and try again.';
      resetMicBtn();
      return;
    }

    ocrPendingReadings = extracted;
    // Render into voiceResultsList using renderOcrResults
    renderOcrResults(extracted, units, true);
    document.getElementById('voiceResultsList').innerHTML = document.getElementById('ocrResultsList').innerHTML;
    document.getElementById('ocrResultsList').innerHTML = '';
    document.getElementById('voiceResults').style.display = 'block';
    const s=document.getElementById('voiceStatus'); if(s) s.textContent='✅ Reading extracted — review and save';

  } catch(e) {
    console.error('Voice AI error:', e);
    document.getElementById('voiceAiStatus').innerHTML =
      '<div style="font-size:24px;margin-bottom:6px">⚠️</div>' + (e.message||'Error. Tap mic to try again.');
  }
}

function clearVoiceResults() {
  ocrPendingReadings = []; voiceTranscriptText = ''; voiceFinalText = '';
  clearSilenceTimer();
  ['voiceResults','voiceTranscript','voiceAiStatus'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display='none';
  });
  const vs=document.getElementById('voiceStatus'); if(vs) vs.textContent='Tap to start speaking';
  resetMicBtn();
}


// ====== HARDCODED APP SETTINGS (set by developer) ======
const APP_ADMIN_EMAIL    = 'YOUR_EMAIL@gmail.com';         // ← replace with your email
const APP_GEMINI_KEY     = 'YOUR_GEMINI_API_KEY_HERE';     // ← replace with your Gemini key
const APP_REFERENCE_ANALYSIS = `For an 81-year-old diabetic with a 24-year history of diabetes, these readings over the last week show a mixed but improving pattern:

Overall Assessment:
Positives — Fasting sugars are generally well controlled. No evidence of fasting hypoglycemia. For an elderly patient, avoiding low sugar is often more important than achieving very tight control.
Areas of concern — Post-meal sugars are the main issue. A 234 mg/dL reading after breakfast suggests a significant glucose spike. The 193 mg/dL pre-dinner reading indicates glucose remained elevated through the day.

Looking at the recent values:
- Fasting: 120 → acceptable.
- Before lunch: 167 → reasonable for an elderly diabetic.
- After breakfast (2hr): 234 → too high.
- Before dinner: 193 → higher than ideal.

This pattern suggests: 1) Morning medication may not be fully covering breakfast/lunch. 2) Breakfast carbohydrates may be causing a spike. 3) Overall control is improving compared with the earlier 311 mg/dL reading that occurred without medication.

Targets for an elderly patient — Many doctors are comfortable with: Fasting 90–130 mg/dL, Pre-meal 100–180 mg/dL, 2-hour post-meal <200 mg/dL, HbA1c roughly 7–8%.

I would continue monitoring for another 1–2 weeks and particularly record: Fasting, 2-hour after breakfast, Before dinner. Those three values will show whether further medication adjustment is needed.`;   // ← replace or extend

// Initialise from hardcoded values (overrides any saved localStorage values)
function initHardcodedSettings() {
  localStorage.setItem('anayaAdminEmail', APP_ADMIN_EMAIL);
  localStorage.setItem('glucoApiKey',     APP_GEMINI_KEY);
  localStorage.setItem('glucoGlobalRef',  APP_REFERENCE_ANALYSIS);
}


function getApiKey() {
  // Returns hardcoded key — set by developer in APP_GEMINI_KEY constant above
  return APP_GEMINI_KEY && APP_GEMINI_KEY !== 'YOUR_GEMINI_API_KEY_HERE' ? APP_GEMINI_KEY : '';
}
function openApiKeyModal(onSuccess) {
  const existing = getApiKey();
  const input = document.getElementById('apiKeyInput');
  if (input) { input.value = ''; input.placeholder = existing ? 'Enter new key to replace current…' : 'sk-ant-api03-…'; }
  document.getElementById('apiKeyError').style.display = 'none';
  document.getElementById('apiKeyModal').classList.remove('hidden');
  window._apiKeyOnSuccess = onSuccess || null;
  setTimeout(()=>{ document.getElementById('apiKeyInput')?.focus(); }, 200);
}
function closeApiKeyModal() {
  document.getElementById('apiKeyModal').classList.add('hidden');
  window._apiKeyOnSuccess = null;
}
function saveApiKey() {
  const raw = document.getElementById('apiKeyInput').value.trim();
  const errEl = document.getElementById('apiKeyError');
  if (!raw) {
    if (getApiKey()) { closeApiKeyModal(); if(window._apiKeyOnSuccess) window._apiKeyOnSuccess(); return; }
    errEl.textContent = 'Please enter your Gemini API key'; errEl.style.display='block'; return;
  }
  if (!raw.startsWith('AIza') && raw.length < 20) {
    errEl.textContent = 'Gemini keys start with AIza… — check and try again'; errEl.style.display='block'; return;
  }
  localStorage.setItem('glucoApiKey', raw);
  updateApiKeyStatus();
  closeApiKeyModal();
  showToast('API key saved 🔑');
  if (window._apiKeyOnSuccess) { window._apiKeyOnSuccess(); window._apiKeyOnSuccess = null; }
}
function clearApiKey() {
  if (!confirm('Remove API key? AI features will stop working.')) return;
  localStorage.removeItem('glucoApiKey');
  updateApiKeyStatus();
  showToast('API key removed');
}
function updateApiKeyStatus() {
  const key = APP_GEMINI_KEY && APP_GEMINI_KEY !== 'YOUR_GEMINI_API_KEY_HERE' ? APP_GEMINI_KEY : '';
  const s = document.getElementById('apiKeyStatus');
  const b = document.getElementById('apiKeyClearBtn');
  if (s) {
    s.textContent = key ? '✅ Active — AI features enabled' : '⚠️ Not configured';
    s.style.color = key ? 'var(--normal)' : 'var(--high)';
  }
  if (b) b.style.display = 'none'; // no clear button in read-only mode
}
// Central Gemini API fetch — used by all 3 AI features
async function geminiFetch(prompt, imageBase64, imageMimeType) {
  let key = getApiKey();
  if (!key) {
    return new Promise((resolve, reject) => {
      openApiKeyModal(() => {
        const k = getApiKey();
        if (!k) { reject(new Error('API key required — add it in Profile → API Key')); return; }
        geminiFetch(prompt, imageBase64, imageMimeType).then(resolve).catch(reject);
      });
    });
  }

  // Build Gemini content parts
  const parts = [];
  if (imageBase64 && imageMimeType) {
    parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
  }
  parts.push({ text: prompt });

  // Try models in order — fall back if one is overloaded or unavailable
  const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-001',
  ];

  let lastError = null;
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
        })
      });

      const rawText = await resp.text();

      if (!resp.ok) {
        let msg = 'HTTP ' + resp.status;
        try {
          const e = JSON.parse(rawText);
          msg = e?.error?.message || msg;
          if (resp.status === 400 && (msg.includes('API_KEY') || msg.includes('API key'))) {
            localStorage.removeItem('glucoApiKey'); updateApiKeyStatus();
            throw new Error('Invalid API key. Re-enter it in Profile tab.');
          }
        } catch(pe) { if(pe.message.includes('Invalid API') || pe.message.includes('Re-enter')) throw pe; }
        // 429 = overloaded, 503 = unavailable — try next model
        if (resp.status === 429 || resp.status === 503 || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded')) {
          lastError = new Error(msg); continue;
        }
        throw new Error(msg);
      }

      let data;
      try { data = JSON.parse(rawText); } catch { throw new Error('Could not parse Gemini response'); }
      if (data.error) {
        const msg = data.error.message || JSON.stringify(data.error);
        if (msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded')) {
          lastError = new Error(msg); continue;
        }
        throw new Error(msg);
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No text in Gemini response');
      return text; // success

    } catch(e) {
      // Re-throw auth errors immediately
      if (e.message.includes('Invalid API') || e.message.includes('Re-enter')) throw e;
      lastError = e;
      // Continue to next model
    }
  }
  throw lastError || new Error('All models unavailable. Please try again in a moment.');
}

// ====== EDIT READING (#7) ======
function openEditReading(id) {
  const r = readings.find(x=>x.id===id);
  if (!r) return;
  const p = patient();
  document.getElementById('editReadingId').value = id;
  document.getElementById('editGlucose').value = r.val;
  document.getElementById('editUnitHint').textContent = p?.units || 'mg/dL';
  document.getElementById('editMeal').value = r.meal || 'Random';
  document.getElementById('editReadingDate').value = r.date || new Date(r.ts).toISOString().split('T')[0];
  document.getElementById('editReadingTime').value = r.time || new Date(r.ts).toTimeString().slice(0,5);
  document.getElementById('editReadingNotes').value = r.notes || '';
  document.getElementById('editReadingModal').classList.remove('hidden');
}
function closeEditReading() {
  document.getElementById('editReadingModal').classList.add('hidden');
}
function saveEditReading() {
  const id = parseInt(document.getElementById('editReadingId').value);
  const val = parseFloat(document.getElementById('editGlucose').value);
  const meal = document.getElementById('editMeal').value;
  const date = document.getElementById('editReadingDate').value;
  const time = document.getElementById('editReadingTime').value;
  const notes = document.getElementById('editReadingNotes').value.trim();
  if (!val || val < 20 || val > 600) { showToast('Enter a valid glucose value', true); return; }
  if (!date || !time) { showToast('Set date and time', true); return; }
  const idx = readings.findIndex(x=>x.id===id);
  if (idx === -1) { showToast('Reading not found', true); return; }
  readings[idx] = { ...readings[idx], val, meal, date, time, notes, ts: new Date(date+'T'+time).getTime() };
  readings.sort((a,b)=>a.ts-b.ts);
  saveReadings(currentPatientId, readings);
  closeEditReading();
  showToast('Reading updated ✓');
  refreshDashboard();
  renderHistory();
}


function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  document.getElementById('themeToggle').textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('glucoTheme', isLight ? 'light' : 'dark');
  if (document.getElementById('screen-dashboard').classList.contains('active')) drawChart();
}
function applyTheme() {
  if (localStorage.getItem('glucoTheme') === 'light') {
    document.body.classList.add('light-mode');
    const btn = document.getElementById('themeToggle');
    if(btn) btn.textContent = '☀️';
  }
}


// ====== SETTINGS (Global) ======

function saveAdminEmail() {
  // Email is hardcoded — no user edit allowed
  showToast('Admin email is set by the developer', true);
}

function saveGlobalSettings() {
  // Settings are hardcoded — no user edit allowed
  showToast('Settings are configured by the developer', true);
}

function loadSettingsScreen() {
  // Display admin email (masked for privacy)
  const emailEl = document.getElementById('displayAdminEmail');
  if (emailEl) {
    const e = APP_ADMIN_EMAIL;
    const masked = e.includes('@') ? e.split('@')[0].slice(0,3) + '***@' + e.split('@')[1] : e;
    emailEl.textContent = masked;
  }
  // Display API key (masked)
  const keyEl = document.getElementById('displayApiKey');
  if (keyEl) {
    const k = APP_GEMINI_KEY;
    keyEl.textContent = k.length > 8 ? k.slice(0,6) + '••••••••' + k.slice(-4) : '••••••••';
  }
  // API key status
  const statusEl = document.getElementById('apiKeyStatus');
  if (statusEl) {
    statusEl.textContent = APP_GEMINI_KEY && APP_GEMINI_KEY !== 'YOUR_GEMINI_API_KEY_HERE'
      ? '✅ Active' : '⚠️ Not configured';
    statusEl.style.color = APP_GEMINI_KEY && APP_GEMINI_KEY !== 'YOUR_GEMINI_API_KEY_HERE'
      ? 'var(--normal)' : 'var(--high)';
  }
  // Reference analysis preview
  const refEl = document.getElementById('displayRefAnalysis');
  if (refEl) {
    refEl.textContent = APP_REFERENCE_ANALYSIS
      ? APP_REFERENCE_ANALYSIS.slice(0, 200) + '…'
      : 'Not configured';
  }
}


// ====== FAB ADD CHOICE ======
function openAddModal() {
  document.getElementById('addChoiceModal').classList.remove('hidden');
}
function closeAddChoice() {
  document.getElementById('addChoiceModal').classList.add('hidden');
}

// Make hero card tap open edit for last reading
function openLastReadingEdit() {
  if (!readings.length) { switchTab('add',null); return; }
  const last = readings[readings.length-1];
  openEditReading(last.id);
}


// ====== CONFIRM DELETE FUNCTIONS ======
function confirmDeleteReading() {
  const id = parseInt(document.getElementById('editReadingId').value);
  if (!id) return;
  if (confirm('Delete this glucose reading? This cannot be undone.')) {
    closeEditReading();
    deleteReading(id);
    showToast('Reading deleted');
  }
}

function confirmDeleteHba1c() {
  const id = document.getElementById('mHba1cId').value;
  if (!id) return;
  if (confirm('Delete this HbA1c lab result? This cannot be undone.')) {
    closeHba1cModal();
    deleteManualHba1c(parseInt(id));
  }
}


// ====== SUBSCRIPTION SYSTEM ======
let subscriptions = JSON.parse(localStorage.getItem('anayaSubscriptions') || '[]');
let editingSubId = null;

function saveSubscriptions() {
  localStorage.setItem('anayaSubscriptions', JSON.stringify(subscriptions));
}

function openNewSubscription() {
  editingSubId = null;
  document.getElementById('subEditId').value = '';
  document.getElementById('subModalTitle').textContent = 'New Subscription';
  document.getElementById('subDeleteBtn').style.display = 'none';
  document.getElementById('subMedications').value = '';
  document.getElementById('subAddress').value = '';
  document.getElementById('subMobile').value = '';
  document.getElementById('subStart').value = new Date().toISOString().split('T')[0];
  document.getElementById('subEnd').value = '';
  document.getElementById('subFrequency').value = 'monthly';
  document.getElementById('subscriptionModal').classList.remove('hidden');
}

function openEditSubscription(id) {
  const sub = subscriptions.find(s=>s.id===id);
  if (!sub) return;
  editingSubId = id;
  document.getElementById('subEditId').value = id;
  document.getElementById('subModalTitle').textContent = 'Edit Subscription';
  document.getElementById('subDeleteBtn').style.display = 'block';
  document.getElementById('subMedications').value = sub.medications || '';
  document.getElementById('subAddress').value = sub.address || '';
  document.getElementById('subMobile').value = sub.mobile || '';
  document.getElementById('subStart').value = sub.start || '';
  document.getElementById('subEnd').value = sub.end || '';
  document.getElementById('subFrequency').value = sub.frequency || 'monthly';
  document.getElementById('subscriptionModal').classList.remove('hidden');
}

function closeSubscriptionModal() {
  document.getElementById('subscriptionModal').classList.add('hidden');
  editingSubId = null;
}

function adoptMedicationsFromProfile() {
  const p = patient();
  const meds = p ? (localStorage.getItem('glucoMeds_'+p.id)||'') : '';
  if (!meds) { showToast('No medications in profile yet', true); return; }
  document.getElementById('subMedications').value = meds;
  showToast('Medications adopted from profile ✓');
}

async function startSubscription() {
  const p = patient();
  const meds     = document.getElementById('subMedications').value.trim();
  const address  = document.getElementById('subAddress').value.trim();
  const mobile   = document.getElementById('subMobile').value.trim();
  const start    = document.getElementById('subStart').value;
  const end      = document.getElementById('subEnd').value;
  const freq     = document.getElementById('subFrequency').value;
  if (!meds)    { showToast('Enter medications', true); return; }
  if (!address) { showToast('Enter delivery address', true); return; }
  if (!mobile)  { showToast('Enter mobile number', true); return; }
  if (!start)   { showToast('Select start date', true); return; }

  const adminEmail = localStorage.getItem('anayaAdminEmail') || '';
  if (!adminEmail) { showToast('Admin email not configured in App Settings', true); return; }

  const freqLabel = {weekly:'Weekly',fortnightly:'Fortnightly',monthly:'Monthly'}[freq]||freq;
  const action = editingSubId ? 'Updated' : 'New';

  // Build subscription object
  const sub = {
    id: editingSubId || Date.now(),
    patient: p ? p.name : 'Unknown',
    age: p ? p.age : '',
    type: p ? p.type : '',
    medications: meds, address, mobile, start, end, frequency: freq,
    status: 'active', createdAt: editingSubId ? (subscriptions.find(s=>s.id===editingSubId)||{}).createdAt || new Date().toISOString() : new Date().toISOString()
  };

  if (editingSubId) {
    const idx = subscriptions.findIndex(s=>s.id===editingSubId);
    if (idx !== -1) subscriptions[idx] = sub;
  } else {
    subscriptions.push(sub);
  }
  saveSubscriptions();

  // Send email via FormSubmit
  const emailBody = `
Anaya — ${action} Medication Subscription

Patient: ${sub.patient} | Age: ${sub.age} | Diabetes: ${sub.type}
Mobile: ${mobile}
Address: ${address}
Medications: ${meds}
Frequency: ${freqLabel}
Start: ${start} | End: ${end || 'Open-ended'}
Status: Active
Submitted: ${new Date().toLocaleString()}
  `.trim();

  try {
    const form = document.createElement('form');
    form.action = 'https://formsubmit.co/'+adminEmail;
    form.method = 'POST';
    form.style.display = 'none';
    form.target = 'formsubmit_iframe';
    const addField = (n,v)=>{ const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;form.appendChild(i); };
    addField('_subject', `Anaya ${action} Subscription — ${sub.patient}`);
    addField('_captcha', 'false');
    addField('_template', 'table');
    addField('Patient Name', sub.patient);
    addField('Age', sub.age);
    addField('Mobile', mobile);
    addField('Address', address);
    addField('Medications', meds);
    addField('Frequency', freqLabel);
    addField('Start Date', start);
    addField('End Date', end || 'Open-ended');
    addField('Action', action);
    document.body.appendChild(form);
    let iframe = document.getElementById('formsubmit_iframe');
    if (!iframe) { iframe=document.createElement('iframe');iframe.name='formsubmit_iframe';iframe.style.display='none';document.body.appendChild(iframe); }
    form.submit();
    document.body.removeChild(form);
    closeSubscriptionModal();
    renderSubscriptions();
    showToast(`Subscription ${action.toLowerCase()} & email sent ✓`);
  } catch(e) {
    closeSubscriptionModal();
    renderSubscriptions();
    showToast('Subscription saved (email may have failed)', true);
  }
}

function deleteSubscription() {
  const id = editingSubId;
  if (!id) return;
  if (!confirm('Delete this subscription?')) return;
  subscriptions = subscriptions.filter(s=>s.id!==id);
  saveSubscriptions();
  closeSubscriptionModal();
  renderSubscriptions();
  sendSubStatusEmail(id, 'Deleted');
  showToast('Subscription deleted');
}

function pauseSubscription(id) {
  const sub = subscriptions.find(s=>s.id===id);
  if (!sub) return;
  const newStatus = sub.status==='paused' ? 'active' : 'paused';
  sub.status = newStatus;
  saveSubscriptions();
  renderSubscriptions();
  sendSubStatusEmail(id, newStatus==='paused'?'Paused':'Resumed');
  showToast('Subscription '+newStatus);
}

function stopSubscription(id) {
  if (!confirm('Stop this subscription? It will be removed.')) return;
  const sub = subscriptions.find(s=>s.id===id);
  subscriptions = subscriptions.filter(s=>s.id!==id);
  saveSubscriptions();
  renderSubscriptions();
  sendSubStatusEmail(id, 'Stopped');
  showToast('Subscription stopped');
}

function sendSubStatusEmail(id, status) {
  const adminEmail = localStorage.getItem('anayaAdminEmail') || '';
  if (!adminEmail) return;
  const sub = subscriptions.find(s=>s.id===id) || {};
  const p = patient();
  const form = document.createElement('form');
  form.action = 'https://formsubmit.co/'+adminEmail;
  form.method = 'POST'; form.style.display='none'; form.target='formsubmit_iframe';
  const addField = (n,v)=>{ const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;form.appendChild(i); };
  addField('_subject', `Anaya Subscription ${status} — ${p?p.name:'Unknown'}`);
  addField('_captcha','false'); addField('_template','table');
  addField('Patient', p?p.name:'Unknown'); addField('Status', status);
  addField('Medications', sub.medications||'');
  addField('Timestamp', new Date().toLocaleString());
  document.body.appendChild(form); form.submit(); document.body.removeChild(form);
}

function renderSubscriptions() {
  const el = document.getElementById('subscriptionList');
  if (!el) return;
  if (!subscriptions.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No active subscriptions.<br>Tap <strong style="color:var(--text)">+ New Subscription</strong> above.</div>';
    return;
  }
  const freqLabel = {weekly:'Weekly',fortnightly:'Fortnightly',monthly:'Monthly'};
  el.innerHTML = subscriptions.map(s=>{
    const statusColor = s.status==='paused'?'#fbbf24':s.status==='active'?'#1BAA9C':'#f87171';
    const statusLabel = (s.status||'active').charAt(0).toUpperCase()+(s.status||'active').slice(1);
    return `<div style="background:var(--bg3);border-radius:14px;padding:14px 16px;margin-bottom:10px;border:1px solid var(--border);cursor:pointer" onclick="openEditSubscription(${s.id})">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${freqLabel[s.frequency]||s.frequency} Delivery</div>
        <div style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${statusColor}22;color:${statusColor}">${statusLabel}</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">📱 ${s.mobile}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">📍 ${s.address.slice(0,50)}${s.address.length>50?'…':''}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">💊 ${s.medications.slice(0,60)}${s.medications.length>60?'…':''}</div>
      <div style="display:flex;gap:8px">
        <button onclick="event.stopPropagation();pauseSubscription(${s.id})" style="flex:1;padding:8px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.3);border-radius:10px;color:#fbbf24;font-size:12px;font-weight:600;cursor:pointer;font-family:'Poppins',Arial,sans-serif">
          ${s.status==='paused'?'▶ Resume':'⏸ Pause'}
        </button>
        <button onclick="event.stopPropagation();stopSubscription(${s.id})" style="flex:1;padding:8px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.3);border-radius:10px;color:#f87171;font-size:12px;font-weight:600;cursor:pointer;font-family:'Poppins',Arial,sans-serif">
          ⏹ Stop
        </button>
      </div>
    </div>`;
  }).join('');
}

function sendProfileQuery() {
  const textEl = document.getElementById('profileQueryText');
  if (!textEl || !textEl.value.trim()) { showToast('Please type your query', true); return; }
  const adminEmail = localStorage.getItem('anayaAdminEmail') || '';
  if (!adminEmail) { showToast('Admin email not set in App Settings', true); return; }
  const p = patient();
  const form = document.createElement('form');
  form.action = 'https://formsubmit.co/'+adminEmail;
  form.method = 'POST'; form.style.display='none'; form.target='formsubmit_iframe';
  const addField=(n,v)=>{ const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;form.appendChild(i); };
  addField('_subject','Anaya Query — '+(p?p.name:'User'));
  addField('_captcha','false'); addField('_template','table');
  addField('Patient',p?p.name:'Unknown');
  addField('Message',textEl.value.trim());
  addField('Timestamp',new Date().toLocaleString());
  document.body.appendChild(form);
  let iframe=document.getElementById('formsubmit_iframe');
  if(!iframe){iframe=document.createElement('iframe');iframe.name='formsubmit_iframe';iframe.style.display='none';document.body.appendChild(iframe);}
  form.submit();
  document.body.removeChild(form);
  textEl.value='';
  showToast('Query sent ✓');
}

async function sendQueryEmail() {
  const textEl = document.getElementById('profileQueryText');
  const text = textEl ? textEl.value.trim() : '';
  if (!text) { showToast('Please type your query', true); return; }
  const adminEmail = localStorage.getItem('anayaAdminEmail') || '';
  if (!adminEmail) { showToast('Admin email not configured in App Settings (⚙️)', true); return; }
  const p = patient();
  const form = document.createElement('form');
  form.action = 'https://formsubmit.co/'+adminEmail;
  form.method = 'POST'; form.style.display='none'; form.target='formsubmit_iframe';
  const addField = (n,v)=>{ const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;form.appendChild(i); };
  addField('_subject', `Anaya Query — ${p?p.name:'User'}`);
  addField('_captcha','false'); addField('_template','table');
  addField('Patient', p?p.name:'Unknown'); addField('Message', text);
  addField('Timestamp', new Date().toLocaleString());
  document.body.appendChild(form); form.submit(); document.body.removeChild(form);
  if (textEl) textEl.value = '';
  showToast('Query sent ✓');
}

function showToast(msg, warn=false) {
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast'+(warn?' warn':'')+' show';
  setTimeout(()=>t.className='toast'+(warn?' warn':''),2400);
}

function exportData() {
  const p=patient();
  if (!p||(readings.length===0&&manualHba1c.length===0)){showToast('No data to export',true);return;}
  const estHba1c = readings.length>=3 ? calcHba1c(readings,p.units).toFixed(1)+'%' : 'N/A';
  const latestLab = manualHba1c.length ? manualHba1c[manualHba1c.length-1].val.toFixed(1)+'%' : 'N/A';
  let csv = `Patient,${p.name}\nAge,${p.age}\nType,${p.type}\nUnits,${p.units}\nEst. HbA1c (all-time),${estHba1c}\nLatest Lab HbA1c,${latestLab}\n`;
  if (manualHba1c.length) {
    csv += `\nLab HbA1c Results\nDate,HbA1c (%),Notes\n`;
    csv += manualHba1c.map(m=>[new Date(m.ts).toLocaleDateString(),m.val,m.notes||''].join(',')).join('\n');
    csv += '\n';
  }
  if (readings.length) {
    csv += `\nGlucose Readings\nDate,Time,Glucose (${p.units}),Meal,Notes\n`;
    csv += readings.map(r=>{const d=new Date(r.ts);return[d.toLocaleDateString(),d.toLocaleTimeString(),r.val,r.meal,r.notes||''].join(',');}).join('\n');
  }
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='anaya_'+p.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().split('T')[0]+'.csv';
  a.click();
  showToast('CSV exported ✓');
}

function clearReadings() {
  if(!confirm('Clear all readings for this patient?'))return;
  readings=[];
  saveReadings(currentPatientId,readings);
  refreshDashboard();renderHistory();
  showToast('Readings cleared');
}

window.addEventListener('resize',()=>{
  if(document.getElementById('screen-dashboard').classList.contains('active'))drawChart();
});

// ====== SWIPE BETWEEN TABS ======
(function(){
  const TAB_ORDER = ['dashboard','subscribe','insights','profile','settings'];
  let tx=0, ty=0;
  document.addEventListener('touchstart', e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
  document.addEventListener('touchend', e=>{
    const dx=e.changedTouches[0].clientX-tx;
    const dy=e.changedTouches[0].clientY-ty;
    if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.5) return;
    const screens=document.querySelectorAll('.screen');
    let cur='dashboard';
    screens.forEach(s=>{if(s.classList.contains('active')) cur=s.id.replace('screen-','');});
    const idx=TAB_ORDER.indexOf(cur);
    let next=-1;
    if(dx<0 && idx<TAB_ORDER.length-1) next=idx+1;
    if(dx>0 && idx>0) next=idx-1;
    if(next<0) return;
    const nextId=TAB_ORDER[next];
    const btn=document.getElementById('tab-'+nextId);
    if(nextId==='add'){openAddModal();return;}
    if(btn) switchTab(nextId,btn);
  },{passive:true});
})();


