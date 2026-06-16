/* HOLIDAY DATA STRUCTURE */
let publicHolidays = [
  {date: new Date(2026,7,15), name: 'Independence Day'},
  {date: new Date(2026,9,2),  name: 'Gandhi Jayanti'},
  {date: new Date(2027,0,26), name: 'Republic Day'},
  {date: new Date(2027,3,14), name: 'Dr. Ambedkar Jayanti'},
    {date: new Date(2027,0,14), name: 'Makar sankranti'}
];

/* STORE SEMESTER DATA FOR MANUAL UPDATES */
let semesterData = {s1: null, s2: null};

/* DATE UTILS */
function hols(){ return publicHolidays.map(h => h.date); }
function sameD(a,b){
  return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
}
function isHol(d){ return hols().some(h=>sameD(h,d)); }
function isWork(d){
  if(isHol(d)) return false;
  const w=d.getDay(), m=d.getDate();
  if(w===0) return false;
  if(w===6) return !((m>=1&&m<=7)||(m>=15&&m<=21));
  return true;
}
function addD(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function snap(b,o){ let d=addD(b,o); while(!isWork(d)) d=addD(d,1); return d; }
function addWD(s,n){ let d=new Date(s),f=1; while(f<n){d=addD(d,1);if(isWork(d))f++;} return d; }
function cntWD(f,t){ let c=0,d=new Date(f); while(d<=t){if(isWork(d))c++;d=addD(d,1);} return c; }
function fmt(d){
  if(!d) return '';
  const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return String(d.getDate()).padStart(2,'0')+'-'+M[d.getMonth()]+'-'+String(d.getFullYear()).slice(-2);
}
function parseFmt(txt){
  if(!txt) return null;
  const parts=txt.split('-');
  if(parts.length!==3) return null;
  const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day=parseInt(parts[0],10);
  const month=M.indexOf(parts[1]);
  const year=parseInt(parts[2],10);
  if(isNaN(day)||month===-1||isNaN(year)) return null;
  const fullYear=year>=50?1900+year:2000+year;
  return new Date(fullYear,month,day);
}

/* CALC DATES — target working days (user-controlled, default 94) */
const MIN_WD_DEFAULT = 94;

/* Read the target WD for a specific semester (fallback to default) */
function getTargetWD(semIndex){
  const id = semIndex === 's2' ? 'targetWD_s2' : 'targetWD_s1';
  const el = document.getElementById(id);
  if(!el) return MIN_WD_DEFAULT;
  const v = parseInt(el.value, 10);
  return (!isNaN(v) && v >= 60) ? v : MIN_WD_DEFAULT;
}

function calcEndDate(sd, semIndex) {
  const target = getTargetWD(semIndex);
  // baseline: 115 calendar days from start
  let se = snap(sd, 115);
  // Shrink if target < baseline count
  while(cntWD(sd, se) > target && !isWork(addD(se,-1))) se = addD(se,-1);
  while(cntWD(sd, se) > target){ se = addD(se,-1); while(!isWork(se)) se = addD(se,-1); }
  // Extend if target > current count
  while(cntWD(sd, se) < target) se = addD(se, 1);
  // Ensure end day is a working day
  while(!isWork(se)) se = addD(se, 1);
  return se;
}

/* Called when user changes either semester's target WD input */
function onTargetWDChange(semIndex){
  const id = semIndex === 's2' ? 'targetWD_s2' : 'targetWD_s1';
  const el = document.getElementById(id);
  const v = parseInt(el.value, 10);
  if(isNaN(v) || v < 60){ el.value = MIN_WD_DEFAULT; return; }
  if(v > 200) el.value = 200;
  gen(); // regenerate both semesters (fast, no issue)
}

function getExamWeek(num){
  // num=1 → I Sessional selector, num=2 → II Sessional selector
  const id = num===1 ? 'examWeek1' : 'examWeek2';
  const el = document.getElementById(id);
  return el ? parseInt(el.value,10) : (num===1?7:14);
}

/* Count public holidays that fall within a 7-day window starting on weekStart */
function countHolsInWeek(weekStart){
  let count = 0;
  for(let i = 0; i < 7; i++){
    const d = addD(weekStart, i);
    if(isHol(d)) count++;
  }
  return count;
}

/*
  Resolve the actual exam week to use.
  preferredWeek : the user-selected week number (e.g. 6 or 7)
  altWeek       : the other option (e.g. 7 or 6)
  classStart    : Date — semester class commencement
  semIndex      : 's1' | 's2'  (used to tag the notice)
  examNum       : 1 or 2  (used to tag the notice)

  Rule: if preferredWeek has ≥2 holidays AND altWeek has fewer holidays
        than preferredWeek → auto-switch to altWeek.
  Returns { week, offset, autoShifted, reason }
*/
function resolveExamWeek(preferredWeek, altWeek, classStart, semIndex, examNum){
  const prefOffset = (preferredWeek - 1) * 7;
  const altOffset  = (altWeek - 1) * 7;
  const prefStart  = addD(classStart, prefOffset);
  const altStart   = addD(classStart, altOffset);
  const prefHols   = countHolsInWeek(prefStart);
  const altHols    = countHolsInWeek(altStart);

  // Auto-shift if preferred week has ≥2 holidays AND the alt is better
  if(prefHols >= 2 && altHols < prefHols){
    return {
      week       : altWeek,
      offset     : altOffset,
      autoShifted: true,
      reason     : `Week ${preferredWeek} has ${prefHols} holiday${prefHols>1?'s':''} → auto-shifted to Week ${altWeek} (${altHols} holiday${altHols!==1?'s':''})`
    };
  }
  return {
    week       : preferredWeek,
    offset     : prefOffset,
    autoShifted: false,
    reason     : null
  };
}

/* Store per-semester auto-shift notices so semRows() can render them */
const examShiftNotices = { s1:{e1:null,e2:null}, s2:{e1:null,e2:null} };

function calc(sd, semIndex){
  const x={};

  // Compute semester end using per-semester target
  const se = calcEndDate(sd, semIndex);

  // How many extra calendar days did we need beyond the baseline 115?
  const baseEnd  = snap(sd, 115);
  const extraCal = Math.round((se - baseEnd) / 86400000);

  function snapE(offset) { return snap(addD(sd, offset + extraCal), 0); }
  function snapFixed(offset) { return snap(sd, offset); }

  // ── Resolve exam weeks (with holiday auto-shift) ──
  const pref1 = getExamWeek(1);   // user's choice: 6 or 7
  const alt1  = pref1 === 6 ? 7 : 6;
  const res1  = resolveExamWeek(pref1, alt1, sd, semIndex, 1);
  examShiftNotices[semIndex].e1 = res1.autoShifted ? res1.reason : null;

  const pref2 = getExamWeek(2);   // user's choice: 13 or 14
  const alt2  = pref2 === 13 ? 14 : 13;
  const res2  = resolveExamWeek(pref2, alt2, sd, semIndex, 2);
  examShiftNotices[semIndex].e2 = res2.autoShifted ? res2.reason : null;

  const exam1StartOffset = res1.offset;
  const exam2StartOffset = res2.offset;

  x.r6  = {f:snapFixed(-40), t:null};
  x.r7  = {f:snapFixed(0),   t:se};
  x.r8  = {f:null,           t:null};
  x.r10 = {f:sd,             t:null};

  // I Sessional exam — start at resolved week, end 7 working days later
  const r11 = snapFixed(exam1StartOffset);
  x.r11 = {f:r11, t:null};
  const r12end = addWD(r11, 7);
  x.r12 = {f:null, t:r12end};
  x.r13 = {f:null, t:null};
  x.r14 = {f:snapFixed(exam1StartOffset + 10), t:null};
  x.r15 = {f:snapFixed(exam1StartOffset + 12), t:null};

  // Sr. No. 9 — Commencement of Phase 2 classes = 1 day after I Sessional end
  x.r17 = {f:addD(r12end, 1), t:null};

  // II Sessional exam — start at resolved week, end 7 working days later
  const r18 = snapFixed(exam2StartOffset);
  x.r18 = {f:r18, t:null};
  x.r19 = {f:null, t:addWD(r18,7)};
  x.r20 = {f:null, t:null};

  // Tail dates
  x.r21 = {f:snapE(101), t:null};
  x.r22 = {f:snapE(105), t:null};
  x.r23 = {f:snapE(108), t:null};
  x.r24 = {f:snapE(112), t:se};
  x.r25 = {f:se,         t:null};
  x.r26 = {f:snapE(112), t:null};
  x.r27 = {f:se,         t:null};
  x.r28 = {f:snapE(115), t:snapE(123)};
  x.r29 = {f:snapE(124), t:snapE(136)};
  x.r30 = {f:snapE(136), t:snapE(149)};
  x.r31 = {f:snapE(149), t:snapE(162)};
  x.r32 = {f:snapE(130), t:null};
  x.r33 = {f:null,       t:null};

  const total = cntWD(sd, se);
  return {dates:x, total};
}

/* ROW DEFS */
const ROWS=[
  {t:'d',sr:1,  desc:'Announcement of Semester Commencement',k:'r6'},
  {t:'d',sr:2,  desc:'Semester Commencement',k:'r7'},
  {t:'d',sr:3,  desc:'Orientation / Induction Program / Registration',k:'r8'},
  {t:'s',text:'1st Spell of Instruction / Phase 1 Teaching'},
  {t:'d',sr:4,  desc:'Commencement of Classes',k:'r10',hl:true},
  {t:'d',sr:5,  desc:'I Sessional/ Mid Semester/ Internal Examination of Theory Subjects (@ 6th or 7th week after commencement of semester) - Start',k:'r11'},
  {t:'b',       desc:'I Sessional/ Mid Semester/ Internal Examination of Theory Subjects (@ 6th or 7th week after commencement of semester) - End',k:'r12'},
  {t:'d',sr:6,  desc:'I Sessional/ Mid Semester/ Internal Examination of Practical subjects if any (@ 6th or 7th week after commencement of semester)',k:'r13'},
  {t:'d',sr:7,  desc:'Submission of First Sessional/ Mid Semester/ Internal Examination to the University exam section on or before',k:'r14'},
  {t:'d',sr:8,  desc:'Academic/ Attendance Review - I',k:'r15'},
  {t:'s',text:'2nd Spell of Instruction / Phase 2 Teaching'},
  {t:'d',sr:9,  desc:'Commencement of Classes',k:'r17'},
  {t:'d',sr:10, desc:'II Sessional/ Mid Semester/ Internal Examination of Theory Subjects (@ 6th or 7th week after commencement of semester) - Start',k:'r18'},
  {t:'b',       desc:'II Sessional/ Mid Semester/ Internal Examination of Theory Subjects (@ 6th or 7th week after commencement of semester) - End',k:'r19'},
  {t:'d',sr:11, desc:'II Sessional/ Mid Semester/ Internal Examination of Practical subjects if any (@ 6th or 7th week after commencement of semester)',k:'r20'},
  {t:'d',sr:12, desc:'Submission of Second Sessional / Mid Semester/ Internal Examination to the University exam section on or before',k:'r21'},
  {t:'d',sr:13, desc:'Academic/ Attendance Review - II',k:'r22'},
  {t:'d',sr:14, desc:'Preparation of weak / slow learner students',k:'r23'},
  {t:'d',sr:15, desc:'Makeup classes for weak / slow learner/ students',k:'r24'},
  {t:'d',sr:16, desc:'Last day of teaching',k:'r25'},
  {t:'d',sr:17, desc:'Announcement of University Exams - End Semester Examination',k:'r26'},
  {t:'d',sr:18, desc:"Declaration of Eligible students' list for the End Semester Examination",k:'r27'},
  {t:'d',sr:19, desc:'Submission of University Exam form with regular exam fees',k:'r28'},
  {t:'d',sr:20, desc:'Submission of University Exam form with Late fees',k:'r29'},
  {t:'d',sr:21, desc:'End Semester Examination (Theory & Practical)',k:'r30'},
  {t:'d',sr:22, desc:'End Semester break / Internship',k:'r31'},
  {t:'d',sr:23, desc:'Announcement of Next Semester',k:'r32'},
  {t:'d',sr:24, desc:'Declaration of Current Semester Result',k:'r33'},
];

/* ─────────────────────────────────────────────────────────────────
   WEEK GAP HELPER
   Returns how many weeks have elapsed from classStart to a given date.
   "Week 1" = days 1-7 from classStart, "Week 2" = days 8-14, etc.
   Returns null if classStart or date is missing.
───────────────────────────────────────────────────────────────── */
function weekGapLabel(classStart, date){
  if(!classStart || !date) return null;
  // diff in calendar days (date - classStart)
  const diffDays = Math.round((date - classStart) / 86400000);
  if(diffDays < 0) return null;              // before class start — no label
  const wk = Math.floor(diffDays / 7) + 1;  // Week 1 starts on day 0
  return 'W' + wk;
}

/* Build week-gap cell HTML for a given date (uses "From" date of the row) */
function wkCell(classStart, dateObj){
  if(!dateObj) return '<td class="c-wk"><span class="c-wk-na">—</span></td>';
  const lbl = weekGapLabel(classStart, dateObj);
  if(lbl === null) return '<td class="c-wk"><span class="c-wk-na">—</span></td>';
  return `<td class="c-wk"><span class="c-wk-val">${lbl}</span></td>`;
}

/* BUILD HTML ROWS FOR ONE SEMESTER */
function semRows(label,result,isSecond,semIndex){
  const dates=result?result.dates:null;
  const total=result?result.total:null;

  /* classStart = commencement of classes (r10.f) — week gap reference point */
  const classStart = dates && dates.r10 ? dates.r10.f : null;

  let h='';
  if(isSecond) h+=`<tr class="sem-gap"><td colspan="5"></td></tr>`;
  h+=`<tr class="r-st"><td colspan="5">${label}</td></tr>`;

  /* ── Auto-shift notices (shown when holiday rule fires) ── */
  const notices = examShiftNotices[semIndex] || {};
  [notices.e1, notices.e2].forEach((msg, i) => {
    if(!msg) return;
    h+=`<tr class="r-shift-notice">
      <td colspan="5">
        <span class="shift-icon">⚠️</span>
        <strong>Exam ${i+1} auto-shifted:</strong> ${msg}
      </td>
    </tr>`;
  });

  /* Header — 5-col layout: Sr.No | Description | From | To | Week# */
  h+=`<tr class="r-dh">
    <th class="c-sr" rowspan="2" style="vertical-align:middle;">Sr.No</th>
    <th class="c-desc" rowspan="2" style="text-align:center;padding-left:2px;vertical-align:middle;">Description / Particulars</th>
    <th colspan="2" style="text-align:center;">Duration</th>
    <th class="c-wk c-wk-head" rowspan="2" style="vertical-align:middle;font-size:9px;letter-spacing:.02em;">Week<br>from Start</th>
  </tr>
  <tr class="r-dh">
    <th class="c-fr">From</th>
    <th class="c-to">To</th>
  </tr>`;

  ROWS.forEach(r=>{
    const dd=dates&&r.k?dates[r.k]:null;
    const fs=dd&&dd.f?fmt(dd.f):'';
    const ts=dd&&dd.t?fmt(dd.t):'';
    const fromDate = dd ? dd.f : null;   /* raw Date object for week calc */

    if(r.t==='s'){
      /* section row spans all 5 cols */
      h+=`<tr class="r-sec"><td colspan="5">${r.text}</td></tr>`;

    } else if(r.t==='d'){
      h+=`<tr class="r-d${r.hl?' r-hl':''}">
        <td class="c-sr">${r.sr}</td>
        <td class="c-desc">
          <input type="text" class="desc-input" data-sem="${semIndex}" data-key="${r.k}" value="${r.desc}" onchange="updateDescription(this)">
        </td>
        <td class="c-fr${fs?' dv':''}">
          ${fs?`<input type="text" class="date-input" data-sem="${semIndex}" data-key="${r.k}" data-type="f" value="${fs}" onchange="updateDate(this)">`:'' }
        </td>
        <td class="c-to${ts?' dv':''}">
          ${ts?`<input type="text" class="date-input" data-sem="${semIndex}" data-key="${r.k}" data-type="t" value="${ts}" onchange="updateDate(this)">`:'' }
        </td>
        ${wkCell(classStart, fromDate)}
      </tr>`;

    } else {
      /* sub-row */
      h+=`<tr class="r-sub">
        <td class="c-sr"></td>
        <td class="c-desc dc">
          <input type="text" class="desc-input" data-sem="${semIndex}" data-key="${r.k}" value="${r.desc}" onchange="updateDescription(this)">
        </td>
        <td class="c-fr${fs?' dv':''}">
          ${fs?`<input type="text" class="date-input" data-sem="${semIndex}" data-key="${r.k}" data-type="f" value="${fs}" onchange="updateDate(this)">`:'' }
        </td>
        <td class="c-to${ts?' dv':''}">
          ${ts?`<input type="text" class="date-input" data-sem="${semIndex}" data-key="${r.k}" data-type="t" value="${ts}" onchange="updateDate(this)">`:'' }
        </td>
        ${wkCell(classStart, fromDate)}
      </tr>`;
    }
  });

  /* footer — spans 4 data cols + 1 week col */
  h+=`<tr class="r-ft">
    <td colspan="3" style="text-align:center;letter-spacing:.04em;">Total Number of Working / Instructional Days</td>
    <td class="tc">${total!==null?total:'—'}</td>
    <td class="c-wk" style="background:var(--navy);border:.5px solid #aaa;"></td>
  </tr>`;
  return h;
}



function displayHolidays(){
  const list=document.getElementById('holidayList');
  const items=document.getElementById('holidayItems');
  if(publicHolidays.length===0){ list.style.display='none'; return; }
  list.style.display='flex';
  items.innerHTML='';
  publicHolidays.forEach((h,i)=>{
    const badge=document.createElement('span');
    badge.className='badge';
    badge.style.cssText='background:var(--rowhl);font-size:10px;padding:4px 10px;display:flex;align-items:center;gap:5px;';
    badge.innerHTML=`${fmt(h.date)}: ${h.name} <span style="cursor:pointer;color:var(--navy);font-weight:700;margin-left:5px;" onclick="removeHoliday(${i})">×</span>`;
    items.appendChild(badge);
  });
}

/* ── LOCALSTORAGE KEY ── */
const LS_KEY = 'academic_cal_holidays';

/* ── SAVE holidays to localStorage ── */
function saveHolidaysLS(){
  // Date objects can't be JSON.stringify'd directly → store as ISO strings
  const payload = publicHolidays.map(h => ({
    dateISO: h.date.toISOString(),
    name:    h.name
  }));
  localStorage.setItem(LS_KEY, JSON.stringify(payload));
}

/* ── LOAD holidays from localStorage (merges with defaults, no duplicates) ── */
function loadHolidaysLS(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return;                         // nothing saved yet → keep defaults
  try {
    const saved = JSON.parse(raw);
    // Rebuild publicHolidays from saved list (saved list is authoritative)
    publicHolidays = saved.map(h => ({
      date: new Date(h.dateISO),
      name: h.name
    }));
    publicHolidays.sort((a,b) => a.date - b.date);
  } catch(e) {
    // Corrupted data → keep defaults silently
    console.warn('Could not load saved holidays:', e);
  }
}

/* HOLIDAY MANAGEMENT */
function addHoliday(){
  const dateInput = document.getElementById('holDate');
  const nameInput = document.getElementById('holName');
  const dateVal   = dateInput.value, nameVal = nameInput.value.trim();
  if(!dateVal || !nameVal){ alert('Please enter both holiday date and name'); return; }
  const holidayDate = pd(dateVal);
  if(publicHolidays.some(h => sameD(h.date, holidayDate))){ alert('This date already exists as a holiday'); return; }
  publicHolidays.push({date: holidayDate, name: nameVal});
  publicHolidays.sort((a,b) => a.date - b.date);
  saveHolidaysLS();   // ← save to localStorage
  displayHolidays();
  gen();
  dateInput.value = ''; nameInput.value = '';
}

function removeHoliday(index){
  publicHolidays.splice(index, 1);
  saveHolidaysLS();   // ← save to localStorage
  displayHolidays();
  gen();
}

/* DATE UPDATE */
function updateDate(input){
  const semIndex=input.dataset.sem, key=input.dataset.key, type=input.dataset.type;
  const newDate=parseFmt(input.value);
  if(!newDate||!semesterData[semIndex]){
    alert('Invalid date format. Use dd-MMM-yy (e.g., 08-Jun-26)');
    input.value=input.defaultValue; return;
  }
  if(type==='f') semesterData[semIndex].dates[key].f=newDate;
  else if(type==='t') semesterData[semIndex].dates[key].t=newDate;
  recalculateWorkingDays(semIndex);
}

/* DESCRIPTION UPDATE */
function updateDescription(input){
  const semIndex=input.dataset.sem, key=input.dataset.key;
  const newDesc=input.value.trim();
  if(!semesterData[semIndex]) return;
  if(!semesterData[semIndex].descriptions) semesterData[semIndex].descriptions={};
  semesterData[semIndex].descriptions[key]=newDesc;
}

function recalculateWorkingDays(semIndex){
  if(!semesterData[semIndex]) return;
  const sd=semesterData[semIndex].dates.r7.f;
  const se=semesterData[semIndex].dates.r7.t;
  semesterData[semIndex].total=cntWD(sd,se);
  const semLabel=semIndex==='s1'?document.getElementById('s1lab').value:document.getElementById('s2lab').value;
  setBadge(semIndex==='s1'?'b1':'b2', semLabel, semesterData[semIndex]);
}

/* ── PRINT TABLE SELECTION ── */
function applyTableSelection(){
  const sel=document.querySelector('input[name="print-sel"]:checked');
  const choice=sel?sel.value:'both';
  const s1=document.getElementById('cal-body-s1');
  const s2=document.getElementById('cal-body-s2');
  if(!s1||!s2) return;
  s1.classList.toggle('print-hidden', choice==='s2');
  s2.classList.toggle('print-hidden', choice==='s1');
}

function printCalendar(){
  window.print();
}

/* CSS color string → ExcelJS ARGB hex (e.g. '#1a2e4a' → 'FF1A2E4A') */
function cssToArgb(cssColor){
  if(!cssColor||cssColor==='transparent'||cssColor==='inherit'||cssColor==='initial') return null;
  cssColor=cssColor.trim();
  if(cssColor.startsWith('#')){
    let h=cssColor.replace('#','').toUpperCase();
    if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if(h.length===6) return 'FF'+h;
    if(h.length===8) return h;
  }
  const m=cssColor.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if(m) return 'FF'+[m[1],m[2],m[3]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('').toUpperCase();
  return null;
}

/* ── DATES TABLE LOCALSTORAGE KEY ── */
const LS_DATES = 'academic_cal_dates_v1';

function saveDatesLS(){
  try {
    const payload = {
      s1: semesterData.s1 ? serializeSemDates('s1') : null,
      s2: semesterData.s2 ? serializeSemDates('s2') : null,
      generatedAt: new Date().toISOString(),
      examWeek1: document.getElementById('examWeek1') ? document.getElementById('examWeek1').value : '7',
      examWeek2: document.getElementById('examWeek2') ? document.getElementById('examWeek2').value : '14',
    };
    localStorage.setItem(LS_DATES, JSON.stringify(payload));
  } catch(e){ console.warn('Could not save dates table:', e); }
}

/* MAIN */
function pd(v){ const p=v.split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }

function gen(){
  const v1=document.getElementById('s1dt').value;
  const v2=document.getElementById('s2dt').value;
  const l1=document.getElementById('s1lab').value||'Term-I (Semester-5)';
  const l2=document.getElementById('s2lab').value||'Term-II (Semester-6)';
  const prog=document.getElementById('ptxt').value;
  document.getElementById('ptitle-bar').textContent=prog;
  const r1=v1?calc(pd(v1),'s1'):null;
  const r2=v2?calc(pd(v2),'s2'):null;
  semesterData.s1=r1; semesterData.s2=r2;
  document.getElementById('cal-body-s1').innerHTML=semRows(l1,r1,false,'s1');
  document.getElementById('cal-body-s2').innerHTML=semRows(l2,r2,true,'s2');
  setTimeout(applyTableSelection,10);
  const bar=document.getElementById('badges');
  if(r1||r2){
    bar.style.display='flex';
    setBadge('b1', l1, r1);
    setBadge('b2', l2, r2);
  }
  saveDatesLS();   // ← always save latest generated dates table
  saveFormLS();    // ← also save form state
}

function setBadge(id, label, result){
  const el = document.getElementById(id);
  if(!result){ el.textContent=''; el.style.background=''; return; }
  const n   = result.total;
  const semIdx = id === 'b1' ? 's1' : 's2';
  const tgt = getTargetWD(semIdx);
  const ok  = n >= tgt;
  el.textContent = label + ': ' + n + ' working days ' + (ok ? '✅ (target '+tgt+')' : '⚠️ Below target '+tgt+'!');
  el.style.background = ok ? '#e6f4ea' : '#fdecea';
  el.style.color = ok ? '#1a6b3a' : '#b71c1c';
  el.style.fontWeight = '600';
}

window.addEventListener('load', () => {
  loadHolidaysLS();   // ← restore saved holidays from localStorage first
  loadFormLS();       // ← restore saved form fields (dates, target WD, etc.) BEFORE generating
  displayHolidays();
  gen();
});

/* ═══════════════════════════════════════════════════
   LOCAL STORAGE — save/restore ALL form fields
═══════════════════════════════════════════════════ */
const LS_FORM = 'academic_cal_form_v2';

function saveFormLS(){
  const payload = {
    s1lab:    document.getElementById('s1lab').value,
    s2lab:    document.getElementById('s2lab').value,
    s1dt:     document.getElementById('s1dt').value,
    s2dt:     document.getElementById('s2dt').value,
    ptxt:     document.getElementById('ptxt').value,
    targetWD_s1: document.getElementById('targetWD_s1') ? document.getElementById('targetWD_s1').value : '94',
    targetWD_s2: document.getElementById('targetWD_s2') ? document.getElementById('targetWD_s2').value : '94',
    examWeek1: document.getElementById('examWeek1') ? document.getElementById('examWeek1').value : '7',
    examWeek2: document.getElementById('examWeek2') ? document.getElementById('examWeek2').value : '14',
    semDates: {
      s1: semesterData.s1 ? serializeSemDates('s1') : null,
      s2: semesterData.s2 ? serializeSemDates('s2') : null,
    },
    semDescs: {
      s1: semesterData.s1 && semesterData.s1.descriptions ? semesterData.s1.descriptions : {},
      s2: semesterData.s2 && semesterData.s2.descriptions ? semesterData.s2.descriptions : {},
    }
  };
  localStorage.setItem(LS_FORM, JSON.stringify(payload));
}

function serializeSemDates(idx){
  const d = semesterData[idx];
  if(!d || !d.dates) return null;
  const out = {};
  Object.keys(d.dates).forEach(k => {
    const v = d.dates[k];
    out[k] = {
      f: v.f ? v.f.toISOString() : null,
      t: v.t ? v.t.toISOString() : null,
    };
  });
  return out;
}

function loadFormLS(){
  const raw = localStorage.getItem(LS_FORM);
  if(!raw) return;
  try {
    const p = JSON.parse(raw);
    if(p.s1lab)    document.getElementById('s1lab').value    = p.s1lab;
    if(p.s2lab)    document.getElementById('s2lab').value    = p.s2lab;
    if(p.s1dt)     document.getElementById('s1dt').value     = p.s1dt;
    if(p.s2dt)     document.getElementById('s2dt').value     = p.s2dt;
    if(p.ptxt)     document.getElementById('ptxt').value     = p.ptxt;
    if(p.targetWD_s1){ const el=document.getElementById('targetWD_s1'); if(el) el.value=p.targetWD_s1; }
    if(p.targetWD_s2){ const el=document.getElementById('targetWD_s2'); if(el) el.value=p.targetWD_s2; }
    if(p.examWeek1){ const el=document.getElementById('examWeek1'); if(el) el.value=p.examWeek1; }
    if(p.examWeek2){ const el=document.getElementById('examWeek2'); if(el) el.value=p.examWeek2; }
  } catch(e){ console.warn('Could not load form state:', e); }
}

// Attach auto-save to all control inputs
function attachFormAutoSave(){
  ['s1lab','s2lab','s1dt','s2dt','ptxt','targetWD_s1','targetWD_s2','examWeek1','examWeek2'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', saveFormLS);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORT TO EXCEL  —  powered by ExcelJS + FileSaver.js
   ─────────────────────────────────────────────────────────────────
   Architecture
   ─────────────────────────────────────────────────────────────────
   exportExcel()
     └─ buildWorksheet(wb, semIndex, semLabel)   ← one sheet / term
          ├─ writeHeaderBlock()    university branding + title rows
          ├─ writeColumnHeaders()  Sr.No | Description | From | To
          ├─ writeDataRows()       every ROWS entry with correct style
          └─ writeFooterRow()      total working-day count
   ═══════════════════════════════════════════════════════════════════ */
/* ── Helper: load image from src URL → base64 string ── */
async function imgToBase64(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // result is "data:image/png;base64,XXXX" — strip prefix
        const b64 = reader.result.split(',')[1];
        resolve(b64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch(e) { return null; }
}

async function exportExcel() {

  /* ── guard ── */
  if (typeof ExcelJS === 'undefined') {
    alert('ExcelJS library not loaded. Please check your internet connection.');
    return;
  }

  /* ── read form values ── */
  const prog = document.getElementById('ptxt').value.trim()  || 'Academic Calendar';
  const l1   = document.getElementById('s1lab').value.trim() || 'Term-I';
  const l2   = document.getElementById('s2lab').value.trim() || 'Term-II';
  const univName  = 'DRS. KIRAN & PALLAVI PATEL GLOBAL UNIVERSITY';
  const univEstd  = 'Established Under Gujarat Private Universities (Amendment) Act, 2021 (Gujarat Act No. 15 of 2021) — Vadodara';

  /* ── Load logo images from folder (same directory as HTML file) ── */
  const logo1B64 = await imgToBase64('logo.png');
  const logo2B64 = await imgToBase64('logo2.png');

  /* ══════════════════════════════════════════════════════════
     SHARED STYLE TOKENS
     (ExcelJS uses ARGB hex — alpha channel first, e.g. FF1A2E4A)
  ══════════════════════════════════════════════════════════ */
  const C = {
    /* backgrounds */
    navy        : 'FF1A2E4A',   /* deep navy        */
    navy2       : 'FF243D60',   /* slightly lighter  */
    secGrey     : 'FFD6DCE4',   /* section header    */
    rowHl       : 'FFFFF8E1',   /* highlight yellow  */
    rowSub      : 'FFF5F0FF',   /* sub-row lavender  */
    rowAlt      : 'FFF4F6F9',   /* alternating grey  */
    white       : 'FFFFFFFF',

    /* fonts */
    fWhite      : 'FFFFFFFF',
    fGold       : 'FFF5E6C0',   /* light gold text   */
    fGoldDark   : 'FF000000',   /* programme title   → black */
    fNavy       : 'FF000000',   /* data text         → black */
    fMuted      : 'FF000000',   /* sub-row text      → black */
    fBlack      : 'FF000000',
  };

  /* border helper — ExcelJS border object */
  function bdrThin(color = '00000000') {
    const s = { style: 'thin', color: { argb: color || 'FF999999' } };
    return { top: s, bottom: s, left: s, right: s };
  }
  function bdrMedium(color = 'FF1A2E4A') {
    const s = { style: 'medium', color: { argb: color } };
    return { top: s, bottom: s, left: s, right: s };
  }

  /* fill helper */
  function fill(argb) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  }

  /* alignment helper — c = 0 Sr.No, 1 Desc, 2/3 date */
  function align(colIdx, wrap = true) {
    return {
      horizontal : colIdx === 1 ? 'left' : 'center',
      vertical   : 'middle',
      wrapText   : wrap,
    };
  }

  /* font helper */
  function font({ bold = false, italic = false, sz = 10,
                  color = C.fNavy, name = 'Calibri' } = {}) {
    return { bold, italic, size: sz, color: { argb: color }, name };
  }

  /* apply full style to a single cell */
  function styleCell(cell, colIdx, {
    fillArgb, fontOpts = {}, borderFn = bdrThin,
    borderColor, wrap = true, hAlign
  }) {
    if (fillArgb)   cell.fill      = fill(fillArgb);
    if (borderFn)   cell.border    = borderFn(borderColor);
    cell.font      = font(fontOpts);
    cell.alignment = hAlign
      ? { horizontal: hAlign, vertical: 'middle', wrapText: wrap }
      : align(colIdx, wrap);
  }

  /* merge + style all 4 cells of a header row */
  function writeFullRow(ws, rowNum, text, {
    fillArgb, fontOpts, borderFn, borderColor, hgt, hAlign = 'center'
  }) {
    const row = ws.getRow(rowNum);
    row.height = hgt || 22;

    /* set value only in first cell */
    const cellA = row.getCell(1);
    cellA.value = text;

    /* merge A:D */
    ws.mergeCells(rowNum, 1, rowNum, 4);

    /* style all 4 cells individually (ExcelJS needs each styled for border) */
    for (let c = 1; c <= 4; c++) {
      styleCell(row.getCell(c), c - 1, {
        fillArgb, fontOpts, borderFn, borderColor, hAlign
      });
    }
  }

  /* ══════════════════════════════════════════════════════════
     CORE SHEET BUILDER
  ══════════════════════════════════════════════════════════ */
  function buildWorksheet(wb, semIndex, semLabel) {
    const sd = semesterData[semIndex];   /* may be null if not generated */

    /* ── Build inline-style map from live DOM cells (TDC overrides) ── */
    const domStyleMap = (() => {
      const map = {};
      const tbody = document.getElementById('cal-body-' + semIndex);
      if (!tbody) return map;
      /* Data rows — keyed by data-key attribute on input inside td */
      tbody.querySelectorAll('input[data-key]').forEach(inp => {
        const tr = inp.closest('tr');
        const key = inp.dataset.key;
        [...tr.querySelectorAll('td,th')].forEach((cell, ci) => {
          if (ci >= 4) return; /* skip week column */
          const s = cell.getAttribute('style');
          if (s && s.trim()) map['key:' + key + ':' + ci] = s;
        });
      });
      /* Special rows (header / section / footer) — keyed by row class */
      [['r-st','st'],['r-ft','ft'],['r-sec','sec'],['r-dh','dh']].forEach(([cls,type]) => {
        tbody.querySelectorAll('tr.' + cls).forEach((tr, tri) => {
          [...tr.querySelectorAll('td,th')].forEach((cell, ci) => {
            if (ci >= 4) return;
            const s = cell.getAttribute('style');
            if (s && s.trim()) {
              const k = type + (tri > 0 ? tri : '') + ':' + ci;
              if (!map[k]) map[k] = s;
            }
          });
        });
      });
      return map;
    })();

    function parseInlineStyle(styleStr) {
      if (!styleStr) return {};
      const tmp = document.createElement('div');
      tmp.setAttribute('style', styleStr);
      const cs = tmp.style;
      const bg = cs.background || cs.backgroundColor;
      return {
        fillArgb  : cssToArgb(bg),
        fontColor : cssToArgb(cs.color),
        bold      : cs.fontWeight === 'bold' || parseInt(cs.fontWeight || 0) >= 700 ? true : null,
        italic    : cs.fontStyle === 'italic' ? true : null,
      };
    }

    function overrideExcelCell(cell, lookupKey) {
      const styleStr = domStyleMap[lookupKey];
      if (!styleStr) return;
      const ov = parseInlineStyle(styleStr);
      if (ov.fillArgb) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:ov.fillArgb } };
      const curFont = cell.font || {};
      cell.font = {
        ...curFont,
        ...(ov.fontColor ? { color:{ argb:ov.fontColor } } : {}),
        ...(ov.bold !== null ? { bold:ov.bold } : {}),
        ...(ov.italic !== null ? { italic:ov.italic } : {}),
      };
    }

    /* safe sheet name — strip chars Excel disallows */
    const sheetName = semLabel.replace(/[\\/*?:[\]]/g, '').substring(0, 31);
    const ws = wb.addWorksheet(sheetName, {
      pageSetup: {
        paperSize       : 9,          /* A4 */
        orientation     : 'landscape',
        fitToPage       : true,
        fitToWidth      : 1,
        fitToHeight     : 0,
        margins         : { left:0.5, right:0.5, top:0.5, bottom:0.5,
                            header:0.3, footer:0.3 },
      },
      views: [{ state: 'frozen', ySplit: 7 }],   /* freeze header block */
    });

    /* ── column widths ── */
    ws.columns = [
      { key: 'sr',   width: 7   },   /* A — Sr.No        */
      { key: 'desc', width: 104 },   /* B — Description  */
      { key: 'from', width: 15  },   /* C — From         */
      { key: 'to',   width: 15  },   /* D — To           */
    ];

    let ROW = 1;   /* ExcelJS rows are 1-indexed */

    /* ═══════════════════════════════════════════════════════════
       HEADER BLOCK — Professional University Header with Logos
       ROW 1+2 : Left Logo | University Name + Subtitle | Right Logo
       ROW 3   : Programme / Calendar title (full width)
       ROW 4   : Semester label (grey)
       ROW 5   : Sr.No (rowspan2) | Description (rowspan2) | Duration (colspan2)
       ROW 6   :                  |                         | From | To
    ═══════════════════════════════════════════════════════════ */

    /* ── helper: style ALL cells in a merged range (ExcelJS border requirement) ── */
    function styleRange(r1,c1,r2,c2,opts){
      for(let r=r1;r<=r2;r++){
        for(let c=c1;c<=c2;c++){
          const cell=ws.getCell(r,c);
          if(opts.fill)      cell.fill=opts.fill;
          if(opts.font)      cell.font=opts.font;
          if(opts.alignment) cell.alignment=opts.alignment;
          if(opts.border)    cell.border=opts.border;
        }
      }
    }

    /* ── ROW 1: A1:D1 fully merged — University Name centered (logos added later by user) ── */
    ws.getRow(1).height = 42;
    ws.getRow(2).height = 22;

    /* A1:D1 — full-width merge for university name */
    ws.mergeCells(1,1,1,4);
    styleRange(1,1,1,4,{
      fill  : fill(C.white),
      border: bdrMedium('FFCCCCCC')
    });
    { const c=ws.getCell(1,1);
      c.value=univName;
      c.font={bold:true,size:22,color:{argb:'FF000000'},name:'Calibri'};
      c.alignment={horizontal:'center',vertical:'middle',wrapText:false};
    }

    /* A2:D2 — full-width merge for established subtitle */
    ws.mergeCells(2,1,2,4);
    styleRange(2,1,2,4,{
      fill  : fill(C.white),
      border: bdrMedium('FFCCCCCC')
    });
    { const c=ws.getCell(2,1);
      c.value=univEstd;
      c.font={bold:false,italic:true,size:9,color:{argb:'FF333333'},name:'Calibri'};
      c.alignment={horizontal:'center',vertical:'middle',wrapText:false};
    }

    /* ── Logos float on top of merged cells ── */
    if(logo1B64){
      const id1=wb.addImage({base64:logo1B64,extension:'png'});
      ws.addImage(id1,{tl:{col:0,row:0},ext:{width:70,height:64},editAs:'absolute'});
    }
    if(logo2B64){
      const id2=wb.addImage({base64:logo2B64,extension:'png'});
      /* right-side logo — positioned near right edge of col D */
      ws.addImage(id2,{tl:{col:3.3,row:0},ext:{width:70,height:64},editAs:'absolute'});
    }

    ROW = 3;

    /* ── ROW 3: Programme / Calendar title ── */
    ws.getRow(ROW).height = 26;
    ws.mergeCells(ROW,1,ROW,4);
    for(let c=1;c<=4;c++){
      const cell=ws.getCell(ROW,c);
      if(c===1) cell.value=prog;
      cell.fill=fill(C.white);
      cell.font=font({bold:true,sz:13,color:C.fNavy});
      cell.alignment={horizontal:'center',vertical:'middle',wrapText:false};
      cell.border={
        top:{style:'thick',color:{argb:C.navy}},
        bottom:{style:'thick',color:{argb:C.navy}},
        left:{style:'medium',color:{argb:C.navy}},
        right:{style:'medium',color:{argb:C.navy}}
      };
    }
    ROW++;

    /* ── ROW 4: Semester label ── */
    ws.getRow(ROW).height = 22;
    ws.mergeCells(ROW,1,ROW,4);
    for(let c=1;c<=4;c++){
      const cell=ws.getCell(ROW,c);
      if(c===1) cell.value=semLabel;
      cell.fill=fill(C.secGrey);
      cell.font=font({bold:true,sz:12,color:C.fNavy});
      cell.alignment={horizontal:'center',vertical:'middle',wrapText:false};
      cell.border=bdrMedium(C.navy);
    }
    ROW++;

    /* ── ROW 5 (top tier): Sr.No rowspan2 | Description rowspan2 | Duration colspan2 ── */
    ws.getRow(ROW).height   = 18;
    ws.getRow(ROW+1).height = 18;

    /* Sr.No — A5:A6 merged */
    ws.mergeCells(ROW,1,ROW+1,1);
    { const c=ws.getCell(ROW,1);
      c.value='Sr.No';
      c.fill=fill(C.navy); c.font=font({bold:true,sz:11,color:C.fWhite});
      c.alignment={horizontal:'center',vertical:'middle',wrapText:false};
      c.border=bdrMedium(C.navy);
    }
    /* style the lower merged half of Sr.No */
    { const c=ws.getCell(ROW+1,1);
      c.fill=fill(C.navy); c.border=bdrMedium(C.navy);
    }

    /* Description — B5:B6 merged */
    ws.mergeCells(ROW,2,ROW+1,2);
    { const c=ws.getCell(ROW,2);
      c.value='Description / Particulars';
      c.fill=fill(C.navy); c.font=font({bold:true,sz:11,color:C.fWhite});
      c.alignment={horizontal:'center',vertical:'middle',wrapText:false};
      c.border=bdrMedium(C.navy);
    }
    { const c=ws.getCell(ROW+1,2);
      c.fill=fill(C.navy); c.border=bdrMedium(C.navy);
    }

    /* Duration — C5:D5 merged (top label) */
    ws.mergeCells(ROW,3,ROW,4);
    { const c=ws.getCell(ROW,3);
      c.value='Duration';
      c.fill=fill(C.navy); c.font=font({bold:true,sz:11,color:C.fWhite});
      c.alignment={horizontal:'center',vertical:'middle',wrapText:false};
      c.border=bdrMedium(C.navy);
    }
    { const c=ws.getCell(ROW,4);
      c.fill=fill(C.navy); c.border=bdrMedium(C.navy);
    }

    ROW++;   /* now ROW = 6 (sub-tier row) */

    /* ── ROW 6 (sub-tier): From | To ── */
    ['From','To'].forEach((lbl,i)=>{
      const c=ws.getCell(ROW,3+i);
      c.value=lbl;
      c.fill=fill(C.navy); c.font=font({bold:true,sz:11,color:C.fWhite});
      c.alignment={horizontal:'center',vertical:'middle',wrapText:false};
      c.border=bdrMedium(C.navy);
    });
    ROW++;   /* ROW = 7 — data starts here */

    /* ─────────────────────────────────────────────
       DATA ROWS
    ───────────────────────────────────────────── */
    let evenCtr = 0;   /* for alternating row tint */

    ROWS.forEach(r => {
      const dd   = sd && r.k ? sd.dates[r.k] : null;
      /* prefer manually-edited description stored in semesterData */
      const desc = (sd && sd.descriptions && sd.descriptions[r.k])
                    ? sd.descriptions[r.k]
                    : (r.desc || '');
      const fs   = dd && dd.f ? fmt(dd.f) : '';
      const ts   = dd && dd.t ? fmt(dd.t) : '';

      if (r.t === 's') {
        /* ── SECTION SEPARATOR ── */
        const secRowNum = ROW++;
        ws.mergeCells(secRowNum, 1, secRowNum, 4);
        /* set value & style on the merged master cell (top-left) AFTER merging */
        const secMaster = ws.getCell(secRowNum, 1);
        secMaster.value     = r.text;
        secMaster.fill      = fill(C.secGrey);
        secMaster.font      = font({ bold:true, sz:10, color:C.fNavy });
        secMaster.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
        secMaster.border    = bdrThin('FF999999');
        ws.getRow(secRowNum).height = 16;
        /* style the remaining merged cells for borders */
        for (let ci = 2; ci <= 4; ci++) {
          const cell = ws.getCell(secRowNum, ci);
          cell.fill   = fill(C.secGrey);
          cell.border = bdrThin('FF999999');
        }
        /* TDC live-preview overrides for section row */
        for (let ci = 0; ci < 4; ci++) overrideExcelCell(ws.getCell(secRowNum, ci + 1), 'sec:' + ci);
        evenCtr = 0;   /* reset alternation after section */

      } else if (r.t === 'd') {
        /* ── NORMAL DATA ROW ── */
        const bgArgb = r.hl
          ? C.rowHl
          : (evenCtr % 2 === 1 ? C.rowAlt : C.white);

        const dataRow = ws.getRow(ROW++);
        dataRow.height = 15;   /* compact data rows */

        const vals = [r.sr || '', desc, fs, ts];
        vals.forEach((v, ci) => {
          const cell = dataRow.getCell(ci + 1);
          cell.value     = v;
          cell.fill      = fill(bgArgb);
          cell.border    = bdrThin('FF999999');
          cell.font      = font({ sz:10, color:C.fNavy });
          cell.alignment = align(ci);
        });
        /* TDC live-preview overrides for data row */
        if (r.k) for (let ci = 0; ci < 4; ci++) overrideExcelCell(dataRow.getCell(ci + 1), 'key:' + r.k + ':' + ci);
        evenCtr++;

      } else {
        /* ── SUB-ROW (type 'b') ── */
        const subRow = ws.getRow(ROW++);
        subRow.height = 15;

        const vals = ['', '   ' + desc, fs, ts];
        vals.forEach((v, ci) => {
          const cell = subRow.getCell(ci + 1);
          cell.value     = v;
          cell.fill      = fill(C.rowSub);
          cell.border    = bdrThin('FF999999');
          cell.font      = font({ italic:true, sz:10, color:C.fMuted });
          cell.alignment = align(ci);
        });
        /* TDC live-preview overrides for sub-row */
        if (r.k) for (let ci = 0; ci < 4; ci++) overrideExcelCell(subRow.getCell(ci + 1), 'key:' + r.k + ':' + ci);
      }
    });

    /* ─────────────────────────────────────────────
       FOOTER ROW — total working days
    ───────────────────────────────────────────── */
    const totalVal = sd ? sd.total : '—';
    const ftRow    = ws.getRow(ROW);
    ftRow.height   = 20;

    const ftLabels = ['', 'Total Number of Working / Instructional Days', '', totalVal];
    ftLabels.forEach((v, ci) => {
      const cell = ftRow.getCell(ci + 1);
      cell.value     = v;
      cell.fill      = fill(C.navy);
      cell.border    = bdrMedium(C.navy);
      cell.font      = font({
        bold  : true,
        sz    : 11,
        color : C.fWhite,   /* white on navy footer bg */
      });
      cell.alignment = { horizontal:'center', vertical:'middle', wrapText:false };
    });
    /* TDC live-preview overrides for footer row */
    for (let ci = 0; ci < 4; ci++) overrideExcelCell(ftRow.getCell(ci + 1), 'ft:' + ci);
  }

  /* ══════════════════════════════════════════════════════════
     BUILD WORKBOOK & TRIGGER DOWNLOAD
  ══════════════════════════════════════════════════════════ */
  const wb = new ExcelJS.Workbook();

  /* workbook metadata */
  wb.creator  = 'KPGU Academic Calendar Generator';
  wb.created  = new Date();
  wb.modified = new Date();
  wb.properties.date1904 = false;

  /* one sheet per semester */
  buildWorksheet(wb, 's1', l1);
  buildWorksheet(wb, 's2', l2);

  /* derive filename from programme title */
  const ay    = prog.match(/AY[\s_][\d-]+/)?.[0] || 'AY-2026-27';
  const fname = 'Academic_Calendar_' + ay.replace(/[\s_]+/g, '_') + '.xlsx';

  /* generate buffer and save via FileSaver */
  try {
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    saveAs(blob, fname);
  } catch (err) {
    console.error('Excel export failed:', err);
    alert('Export failed: ' + err.message);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   TABLE DESIGN CUSTOMIZER (TDC) — Full Module
   ───────────────────────────────────────────────────────────────
   Architecture:
     TDC.init()            → wire click listeners on table
     TDC.setTarget()       → switch apply scope
     TDC.apply*()          → apply font/color/border to targets
     TDC.applyTheme()      → predefined themes
     TDC.undo() / redo()   → history stack
     TDC.save() / load()   → localStorage persistence
     TDC.reset()           → clear all custom styles
   ─────────────────────────────────────────────────────────────── */

const TDC = (() => {

  /* ── State ── */
  let selectedCell = null;   /* currently clicked <td> or <th> */
  let currentTarget = 'selection';

  /* ── Undo/Redo stacks (store snapshots of all inline styles) ── */
  const MAX_HISTORY = 50;
  let undoStack = [];
  let redoStack = [];

  /* ── localStorage key ── */
  const LS_TDC = 'tdc_custom_styles_v3';

  /* ══════════════════════════════════════════════════════════════
     INIT — wire table click + keyboard shortcuts
  ══════════════════════════════════════════════════════════════ */
  function init() {
    /* delegate click on the calendar table (covers both semester tbodies) */
    document.querySelector('.st').addEventListener('click', onTableClick);

    /* Keyboard: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo */
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    });

    /* reload styles when calendar is regenerated */
    const origGen = window.gen;
    window.gen = function(...args) {
      origGen.apply(this, args);
      setTimeout(() => { load(); updateHistInfo(); }, 30);
    };

    load();
    loadSavedThemes();
    updateHistInfo();
  }

  /* ══════════════════════════════════════════════════════════════
     CELL SELECTION
  ══════════════════════════════════════════════════════════════ */
  function onTableClick(e) {
    const cell = e.target.closest('td,th');
    if (!cell) return;

    /* clear previous selection highlight */
    document.querySelectorAll('.tdc-selected').forEach(c => c.classList.remove('tdc-selected'));
    document.querySelectorAll('.tdc-row-selected').forEach(r => r.classList.remove('tdc-row-selected'));

    selectedCell = cell;
    cell.classList.add('tdc-selected');

    /* read back cell's current computed style into toolbar controls */
    syncToolbarFromCell(cell);
    showStatus('Cell selected — adjust controls and apply ↑');
  }

  /* Sync toolbar state from a selected cell (best-effort) */
  function syncToolbarFromCell(cell) {
    const cs = cell.style;
    if (cs.color) document.getElementById('tdc-text-color').value = rgbToHex(cs.color) || '#1a2e4a';
    if (cs.backgroundColor) document.getElementById('tdc-bg-color').value = rgbToHex(cs.backgroundColor) || '#ffffff';
    if (cs.fontWeight === 'bold') document.getElementById('tdc-bold').classList.add('active');
    else document.getElementById('tdc-bold').classList.remove('active');
    if (cs.fontStyle === 'italic') document.getElementById('tdc-italic').classList.add('active');
    else document.getElementById('tdc-italic').classList.remove('active');
    if ((cs.textDecoration||'').includes('underline')) document.getElementById('tdc-underline').classList.add('active');
    else document.getElementById('tdc-underline').classList.remove('active');
  }

  /* ══════════════════════════════════════════════════════════════
     TARGET SELECTION
  ══════════════════════════════════════════════════════════════ */
  function setTarget(t, btn) {
    currentTarget = t;
    document.querySelectorAll('.tdc-target-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  /* ── Resolve which cells to apply to ── */
  function resolveCells() {
    const table = document.querySelector('.st');
    if (!table) return [];

    const allCells = () => [...table.querySelectorAll('td,th')];

    switch (currentTarget) {
      case 'selection':
        return selectedCell ? [selectedCell] : [];

      case 'row':
        if (!selectedCell) return alert('Click a cell first'), [];
        return [...selectedCell.closest('tr').querySelectorAll('td,th')];

      case 'col': {
        if (!selectedCell) return alert('Click a cell first'), [];
        const colIdx = selectedCell.cellIndex;
        return [...table.querySelectorAll('tr')].flatMap(tr => {
          const cells = [...tr.querySelectorAll('td,th')];
          return cells[colIdx] ? [cells[colIdx]] : [];
        });
      }

      case 'table':
        return allCells();

      case 'header':
        return [...table.querySelectorAll('.r-st td,.r-dh th,.r-ft td')];

      case 'section':
        return [...table.querySelectorAll('.r-sec td')];

      case 'highlight':
        return [...table.querySelectorAll('.r-hl td')];

      default:
        return [];
    }
  }

  /* ══════════════════════════════════════════════════════════════
     UNDO / REDO — snapshot the entire table's inline styles
  ══════════════════════════════════════════════════════════════ */
  function snapshot() {
    const table = document.querySelector('.st');
    if (!table) return null;
    const cells = [...table.querySelectorAll('td,th')];
    return cells.map(c => ({
      uid  : getCellUID(c),
      style: c.getAttribute('style') || ''
    }));
  }

  function pushUndo() {
    const s = snapshot();
    if (!s) return;
    undoStack.push(s);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];   /* clear redo on new action */
    updateHistInfo();
  }

  function restoreSnapshot(snap) {
    const table = document.querySelector('.st');
    if (!table || !snap) return;
    const cells = [...table.querySelectorAll('td,th')];
    snap.forEach(entry => {
      const cell = cells.find(c => getCellUID(c) === entry.uid);
      if (cell) cell.setAttribute('style', entry.style);
    });
  }

  function undo() {
    if (!undoStack.length) return showStatus('Nothing to undo');
    redoStack.push(snapshot());
    restoreSnapshot(undoStack.pop());
    updateHistInfo();
    save();
    showStatus('↩ Undone');
  }

  function redo() {
    if (!redoStack.length) return showStatus('Nothing to redo');
    undoStack.push(snapshot());
    restoreSnapshot(redoStack.pop());
    updateHistInfo();
    save();
    showStatus('↪ Redone');
  }

  /* Unique ID for a cell: tbody-id + row index + cell index */
  function getCellUID(cell) {
    const tr = cell.closest('tr');
    const tbody = tr.closest('tbody');
    const rows = [...tbody.querySelectorAll('tr')];
    return (tbody.id || 'tbody') + ':' + rows.indexOf(tr) + '_' + cell.cellIndex;
  }

  /* ══════════════════════════════════════════════════════════════
     APPLY FONT
  ══════════════════════════════════════════════════════════════ */
  function applyFont() {
    const family = document.getElementById('tdc-font-family').value;
    const size   = document.getElementById('tdc-font-size').value;
    if (!family && !size) return;
    const cells = resolveCells();
    if (!cells.length) return;
    pushUndo();
    cells.forEach(c => {
      if (family) c.style.setProperty('font-family', family, 'important');
      if (size)   c.style.setProperty('font-size', size, 'important');
    });
    save(); showStatus('Font applied');
  }

  /* ══════════════════════════════════════════════════════════════
     TOGGLE BOLD / ITALIC / UNDERLINE
  ══════════════════════════════════════════════════════════════ */
  function toggleStyle(prop) {
    const cells = resolveCells();
    if (!cells.length) { showStatus('Click a cell first'); return; }
    pushUndo();

    const btn = document.getElementById('tdc-' + prop);
    const isOn = btn.classList.toggle('active');

    cells.forEach(c => {
      switch (prop) {
        case 'bold':
          c.style.setProperty('font-weight', isOn ? 'bold' : 'normal', 'important');
          break;
        case 'italic':
          c.style.setProperty('font-style', isOn ? 'italic' : 'normal', 'important');
          break;
        case 'underline': {
          const cur = c.style.textDecoration || '';
          const newVal = isOn
            ? (cur.includes('underline') ? cur : (cur + ' underline').trim())
            : cur.replace('underline','').trim();
          c.style.setProperty('text-decoration', newVal || 'none', 'important');
          break;
        }
      }
    });
    save(); showStatus(prop + (isOn?' on':' off'));
  }

  /* ══════════════════════════════════════════════════════════════
     APPLY TEXT COLOR
  ══════════════════════════════════════════════════════════════ */
  function applyTextColor() {
    const color = document.getElementById('tdc-text-color').value;
    const cells = resolveCells();
    if (!cells.length) return;
    pushUndo();
    cells.forEach(c => {
      c.style.setProperty('color', color, 'important');
      c.querySelectorAll('input').forEach(inp => inp.style.setProperty('color', color, 'important'));
    });
    save(); showStatus('Text color applied');
  }

  /* ══════════════════════════════════════════════════════════════
     APPLY BACKGROUND COLOR
  ══════════════════════════════════════════════════════════════ */
  function applyBgColor() {
    const color = document.getElementById('tdc-bg-color').value;
    const cells = resolveCells();
    if (!cells.length) return;
    pushUndo();
    cells.forEach(c => {
      c.style.backgroundColor = color;
      c.style.setProperty('background', color, 'important');
    });
    save(); showStatus('Background color applied');
  }

  /* ══════════════════════════════════════════════════════════════
     APPLY BORDER
  ══════════════════════════════════════════════════════════════ */
  function applyBorder() {
    const color = document.getElementById('tdc-bdr-color').value;
    const width = document.getElementById('tdc-bdr-width').value;
    const style = document.getElementById('tdc-bdr-style').value;
    const side  = document.getElementById('tdc-bdr-side').value;
    const cells = resolveCells();
    if (!cells.length) return;
    pushUndo();

    const bdrVal = side === 'none' ? '' : `${width} ${style} ${color}`;

    cells.forEach(c => {
      if (side === 'all') {
        c.style.setProperty('border', bdrVal, 'important');
      } else if (side === 'none') {
        c.style.setProperty('border', 'none', 'important');
      } else if (side === 'outer') {
        c.style.setProperty('border-top',    bdrVal, 'important');
        c.style.setProperty('border-bottom', bdrVal, 'important');
        c.style.setProperty('border-left',   bdrVal, 'important');
        c.style.setProperty('border-right',  bdrVal, 'important');
      } else {
        c.style.setProperty('border-' + side, bdrVal, 'important');
      }
    });
    save(); showStatus('Border applied');
  }

  /* ══════════════════════════════════════════════════════════════
     APPLY TO ALL SATURDAYS
  ══════════════════════════════════════════════════════════════ */
  function applyToSaturdays() {
    /* Look at date cells and match those whose "From" text is a Saturday */
    const cells = [];
    document.querySelectorAll('.st tr').forEach(tr => {
      const dateCell = tr.querySelector('.c-fr');
      if (!dateCell) return;
      const inp = dateCell.querySelector('.date-input');
      if (!inp) return;
      const d = parseFmt(inp.value);
      if (d && d.getDay() === 6) {
        tr.querySelectorAll('td').forEach(c => cells.push(c));
      }
    });
    if (!cells.length) { showStatus('No Saturday rows found'); return; }
    pushUndo();
    const color = document.getElementById('tdc-bg-color').value;
    cells.forEach(c => c.style.setProperty('background', color, 'important'));
    save(); showStatus(`Saturday style applied to ${cells.length/5|0} rows`);
  }

  /* ══════════════════════════════════════════════════════════════
     APPLY TO ALL HOLIDAYS
  ══════════════════════════════════════════════════════════════ */
  function applyToHolidays() {
    const cells = [];
    document.querySelectorAll('.st tr').forEach(tr => {
      const dateCell = tr.querySelector('.c-fr');
      if (!dateCell) return;
      const inp = dateCell.querySelector('.date-input');
      if (!inp) return;
      const d = parseFmt(inp.value);
      if (d && isHol(d)) {
        tr.querySelectorAll('td').forEach(c => cells.push(c));
      }
    });
    if (!cells.length) { showStatus('No holiday rows found in current dates'); return; }
    pushUndo();
    const color = document.getElementById('tdc-bg-color').value;
    cells.forEach(c => c.style.setProperty('background', color, 'important'));
    save(); showStatus(`Holiday style applied to ${cells.length/5|0} rows`);
  }

  /* ══════════════════════════════════════════════════════════════
     PREDEFINED THEMES
  ══════════════════════════════════════════════════════════════ */
  const THEMES = {
    professional: {
      header : { bg:'#1a2e4a', color:'#ffffff', fontWeight:'bold' },
      section: { bg:'#d6dce4', color:'#1a2e4a', fontWeight:'600' },
      data   : { bg:'#ffffff', color:'#1a1a2e' },
      alt    : { bg:'#f4f6f9', color:'#1a1a2e' },
      hl     : { bg:'#fff8e1', color:'#1a1a2e' },
      footer : { bg:'#1a2e4a', color:'#ffffff', fontWeight:'bold' },
      border : '0.5px solid #aaaaaa',
    },
    dark: {
      header : { bg:'#1a1a1a', color:'#f5e6c0', fontWeight:'bold' },
      section: { bg:'#2d2d2d', color:'#f5e6c0', fontWeight:'600' },
      data   : { bg:'#222222', color:'#e0e0e0' },
      alt    : { bg:'#2a2a2a', color:'#e0e0e0' },
      hl     : { bg:'#3a3a1a', color:'#f5e6c0' },
      footer : { bg:'#111111', color:'#f5e6c0', fontWeight:'bold' },
      border : '0.5px solid #444444',
    },
    university: {
      header : { bg:'#003580', color:'#ffffff', fontWeight:'bold' },
      section: { bg:'#cce0ff', color:'#003580', fontWeight:'600' },
      data   : { bg:'#f0f6ff', color:'#002060' },
      alt    : { bg:'#e0eeff', color:'#002060' },
      hl     : { bg:'#fffde0', color:'#002060' },
      footer : { bg:'#003580', color:'#ffffff', fontWeight:'bold' },
      border : '0.5px solid #99b8d0',
    },
    minimal: {
      header : { bg:'#f8f8f8', color:'#333333', fontWeight:'600' },
      section: { bg:'#f0f0f0', color:'#555555', fontWeight:'600' },
      data   : { bg:'#ffffff', color:'#333333' },
      alt    : { bg:'#fafafa', color:'#333333' },
      hl     : { bg:'#fffce8', color:'#333333' },
      footer : { bg:'#eeeeee', color:'#333333', fontWeight:'600' },
      border : '0.5px solid #dddddd',
    },
    maroon: {
      header : { bg:'#7b1c2e', color:'#ffffff', fontWeight:'bold' },
      section: { bg:'#f2d5da', color:'#7b1c2e', fontWeight:'600' },
      data   : { bg:'#ffffff', color:'#2e0a11' },
      alt    : { bg:'#fdf4f5', color:'#2e0a11' },
      hl     : { bg:'#fff8e1', color:'#2e0a11' },
      footer : { bg:'#7b1c2e', color:'#ffffff', fontWeight:'bold' },
      border : '0.5px solid #c89099',
    },
  };

  function applyTheme(name) {
    const theme = THEMES[name];
    if (!theme) return;
    pushUndo();
    const table = document.querySelector('.st');
    if (!table) return;

    table.querySelectorAll('.r-st td,.r-dh th,.r-ft td').forEach(c => {
      applyStyleObj(c, theme.header);
      c.style.setProperty('border', theme.border, 'important');
    });
    table.querySelectorAll('.r-sec td').forEach(c => {
      applyStyleObj(c, theme.section);
      c.style.setProperty('border', theme.border, 'important');
    });
    table.querySelectorAll('.r-d td').forEach((c, i) => {
      const tr = c.closest('tr');
      if (tr.classList.contains('r-hl')) {
        applyStyleObj(c, theme.hl);
      } else {
        const rowIdx = [...table.querySelectorAll('.r-d')].indexOf(tr);
        applyStyleObj(c, rowIdx % 2 === 1 ? theme.alt : theme.data);
      }
      c.style.setProperty('border', theme.border, 'important');
    });
    table.querySelectorAll('.r-sub td').forEach(c => {
      applyStyleObj(c, theme.data);
      c.style.setProperty('border', theme.border, 'important');
    });

    /* push color to inputs inside cells */
    table.querySelectorAll('input.desc-input,input.date-input').forEach(inp => {
      const td = inp.closest('td');
      if (td && td.style.color) inp.style.setProperty('color', td.style.color, 'important');
    });

    save(); showStatus('Theme "' + name + '" applied');
  }

  function applyStyleObj(cell, obj) {
    if (obj.bg)         cell.style.setProperty('background', obj.bg, 'important');
    if (obj.color)      cell.style.setProperty('color', obj.color, 'important');
    if (obj.fontWeight) cell.style.setProperty('font-weight', obj.fontWeight, 'important');
  }

  /* ══════════════════════════════════════════════════════════════
     RESET ALL CUSTOM STYLES
  ══════════════════════════════════════════════════════════════ */
  function resetAll() {
    if (!confirm('Remove ALL custom styles and restore defaults?')) return;
    pushUndo();
    document.querySelectorAll('.st td,.st th').forEach(c => {
      c.removeAttribute('style');
      c.querySelectorAll('input').forEach(inp => inp.removeAttribute('style'));
    });
    localStorage.removeItem(LS_TDC);
    undoStack = []; redoStack = [];
    updateHistInfo();
    showStatus('All styles reset to defaults');
  }

  /* ══════════════════════════════════════════════════════════════
     LOCALSTORAGE — SAVE / LOAD
     Stores: array of { uid, style } for every cell that has an
     inline style attribute.
  ══════════════════════════════════════════════════════════════ */
  function save() {
    const table = document.querySelector('.st');
    if (!table) return;
    const entries = [];
    [...table.querySelectorAll('td,th')].forEach(c => {
      const s = c.getAttribute('style');
      if (s && s.trim()) entries.push({ uid: getCellUID(c), style: s });
    });
    try {
      localStorage.setItem(LS_TDC, JSON.stringify(entries));
    } catch(e) { console.warn('TDC: could not save styles', e); }
  }

  function load() {
    const raw = localStorage.getItem(LS_TDC);
    if (!raw) return;
    try {
      const entries = JSON.parse(raw);
      const table = document.querySelector('.st');
      if (!table || !entries.length) return;
      const cells = [...table.querySelectorAll('td,th')];
      entries.forEach(entry => {
        const cell = cells.find(c => getCellUID(c) === entry.uid);
        if (cell) cell.setAttribute('style', entry.style);
      });
      /* restore input colors */
      cells.forEach(c => {
        if (c.style.color) {
          c.querySelectorAll('input').forEach(inp => inp.style.setProperty('color', c.style.color, 'important'));
        }
      });
    } catch(e) { console.warn('TDC: could not load styles', e); }
  }

  /* ══════════════════════════════════════════════════════════════
     UTILITY
  ══════════════════════════════════════════════════════════════ */
  function showStatus(msg) {
    const el = document.getElementById('tdc-status');
    if (!el) return;
    el.textContent = '✓ ' + msg;
    el.style.display = 'inline-block';
    clearTimeout(el._t);
    el._t = setTimeout(() => el.style.display = 'none', 2500);
  }

  function updateHistInfo() {
    const el = document.getElementById('tdc-hist-info');
    if (el) el.textContent = `History: ${undoStack.length}/${MAX_HISTORY}`;
  }

  /* Convert rgb(r,g,b) string → #rrggbb hex */
  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return null;
    if (rgb.startsWith('#')) return rgb;
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return null;
    return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     SAVED CUSTOM THEMES
  ══════════════════════════════════════════════════════════════ */
  const LS_SAVED_THEMES = 'tdc_saved_themes_v1';
  let savedThemes = [];

  function loadSavedThemes() {
    try {
      const raw = localStorage.getItem(LS_SAVED_THEMES);
      savedThemes = raw ? JSON.parse(raw) : [];
    } catch(e) { savedThemes = []; }
    renderSavedThemes();
  }

  function saveSavedThemesLS() {
    try { localStorage.setItem(LS_SAVED_THEMES, JSON.stringify(savedThemes)); }
    catch(e) { console.warn('TDC: could not save custom themes', e); }
  }

  function promptSaveTheme() {
    const snap = snapshot();
    if (!snap || !snap.length) { showStatus('Generate the calendar first'); return; }
    const name = (window.prompt('Enter a name for this theme:', 'My Theme ' + (savedThemes.length + 1)) || '').trim();
    if (!name) return;
    savedThemes.push({ name, styles: snap });
    saveSavedThemesLS();
    renderSavedThemes();
    showStatus('Theme "' + name + '" saved');
  }

  function applyCustomTheme(idx) {
    const th = savedThemes[idx];
    if (!th) return;
    pushUndo();
    restoreSnapshot(th.styles);
    document.querySelectorAll('.st td,.st th').forEach(c => {
      if (c.style.color) c.querySelectorAll('input').forEach(inp => inp.style.setProperty('color', c.style.color, 'important'));
    });
    save();
    showStatus('Theme "' + th.name + '" applied');
  }

  function renameTheme(idx) {
    const th = savedThemes[idx];
    if (!th) return;
    const name = (window.prompt('Rename theme:', th.name) || '').trim();
    if (!name) return;
    th.name = name;
    saveSavedThemesLS();
    renderSavedThemes();
    showStatus('Renamed to "' + name + '"');
  }

  function updateTheme(idx) {
    const th = savedThemes[idx];
    if (!th) return;
    const snap = snapshot();
    if (!snap) return;
    th.styles = snap;
    saveSavedThemesLS();
    showStatus('Theme "' + th.name + '" updated with current styles');
  }

  function deleteTheme(idx) {
    const th = savedThemes[idx];
    if (!th) return;
    if (!window.confirm('Delete theme "' + th.name + '"?')) return;
    savedThemes.splice(idx, 1);
    saveSavedThemesLS();
    renderSavedThemes();
    showStatus('Theme deleted');
  }

  function renderSavedThemes() {
    const list = document.getElementById('tdc-saved-themes-list');
    if (!list) return;
    if (!savedThemes.length) {
      list.innerHTML = '<span class="tdc-empty-themes">No saved themes yet — customize the table then click 💾 Save Theme</span>';
      return;
    }
    list.innerHTML = savedThemes.map((th, i) => `
      <div class="tdc-saved-pill">
        <span class="tdc-saved-pill-name" title="Apply ${th.name}" onclick="TDC.applyCustomTheme(${i})">${th.name}</span>
        <div class="tdc-saved-pill-btns">
          <button class="tdc-saved-pill-btn" onclick="TDC.applyCustomTheme(${i})" title="Apply">Apply</button>
          <button class="tdc-saved-pill-btn" onclick="TDC.updateTheme(${i})" title="Update with current styles">Update</button>
          <button class="tdc-saved-pill-btn" onclick="TDC.renameTheme(${i})" title="Rename">Rename</button>
          <button class="tdc-saved-pill-btn del" onclick="TDC.deleteTheme(${i})" title="Delete">Del</button>
        </div>
      </div>
    `).join('');
  }

  /* ── Public API ── */
  return {
    init, setTarget, applyFont, toggleStyle,
    applyTextColor, applyBgColor, applyBorder,
    applyToSaturdays, applyToHolidays,
    applyTheme, resetAll, undo, redo, save, load,
    promptSaveTheme, applyCustomTheme, renameTheme, updateTheme, deleteTheme,
  };

})();


/* ── PATCH: extend window.onload to attach autosave + init table customizer ── */
window.addEventListener('load', () => {
  attachFormAutoSave();
  /* Initialize Table Design Customizer after calendar renders */
  setTimeout(() => TDC.init(), 100);
});
