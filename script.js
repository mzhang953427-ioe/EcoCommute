const SUPABASE_URL = 'https://mdsusjsgucxemzrmmnlr.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3VzanNndWN4ZW16cm1tbmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODkzNjcsImV4cCI6MjA5NzI2NTM2N30.6CaZN46zkvLJS1Xkdma1j5U76N9mRfu64AV5msGrsDc'; 

let supabaseClient = null;

try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn("Supabase library blocked or failed to load. Running in Offline Mode.");
  }
} catch(err) {
  console.error("Failed to initialize database connection:", err);
}

Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, sans-serif";
Chart.defaults.font.size = 17.6;
Chart.defaults.color = "#000000";

const SCHOOLS = [
  { id: 'school-a', name: "School A", code: "12345" },
  { id: 'school-b', name: "School B", code: "12345" },
  { id: 'school-c', name: "School C", code: "12345" },
  { id: 'school-d', name: "School D", code: "12345" }
];

const TRANSPORT_DATA = {
  car: { label: "Car", speedRush: 25, speedNorm: 37.5, co2: 0.058, aqBase: 8 },
  bus: { label: "Bus", speedRush: 15, speedNorm: 20, co2: 0.036, aqBase: 12 },
  dart: { label: "DART", speedRush: 36, speedNorm: 36, co2: 0.028, aqBase: 4 },
  luas: { label: "Luas", speedRush: 26, speedNorm: 26, co2: 0.0, aqBase: 4 },
  cycling: { label: "Cycling", speedRush: 15, speedNorm: 15, co2: 0.021, aqBase: 15 },
  walking: { label: "Walking", speedRush: 5.3, speedNorm: 5.3, co2: 0.0, aqBase: 15 }
};

const modeOptionsHTML = `<option value="" disabled selected>Select a mode of transport</option>` + 
  Object.entries(TRANSPORT_DATA)
  .map(([key, data]) => `<option value="${key}">${data.label}</option>`)
  .join('');

let sectionCount = 0;
let userJourneySections = [];
let returnSectionCount = 0;
let userReturnSections = [];
let calculationDone = false;
let journeyTotals = { timeDaily: 0, timeReturn: 0, emissionsAnnual: 0, emissionsDaily: 0, distDaily: 0 };
let confirmedSchoolId = null;
let lastSubmitTime = 0; 
let isAdminUnlocked = false; 

let schoolModeChartInstance = null;
let schoolEmissionsChartInstance = null;
let comparisonChartInstance = null;

window.switchPage = function(pageId) {
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('hidden'));
  const target = document.getElementById(pageId);
  if (target) target.classList.remove('hidden');
  
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-target="${pageId}"]`);
  if(activeBtn) activeBtn.classList.add('active');

  const mobileLinks = document.getElementById('mobile-nav-links');
  if (mobileLinks && mobileLinks.classList.contains('open')) {
    mobileLinks.classList.remove('open');
  }

  if (pageId === 'alternatives') renderAlternatives();
  if (pageId === 'our-school') window.renderSchoolDashboard();
};

window.toggleMobileMenu = function() {
  const links = document.getElementById('mobile-nav-links');
  if (links) {
    links.classList.toggle('open');
  }
};

function initSchoolDropdowns() {
  const optionsHTML = `<option value="" disabled selected>Select school</option>` + 
                      SCHOOLS.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                      
  const adminOptionsHTML = `<option value="" disabled selected>Select school</option>` + 
                           `<option value="all">Overall (All Schools)</option>` +
                           SCHOOLS.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  
  const modalSelect = document.getElementById('modal-school-select');
  if (modalSelect) modalSelect.innerHTML = optionsHTML;
  
  const adminSelect = document.getElementById('admin-school-select');
  if (adminSelect) adminSelect.innerHTML = adminOptionsHTML;
  
  const contactSelect = document.getElementById('contact-school');
  if (contactSelect) {
      contactSelect.innerHTML = optionsHTML + `<option value="na">N/A</option>`;
  }
}

window.toggleAdmin = function() {
  const cb = document.getElementById('cb-admin');
  const pg = document.getElementById('admin-passcode-group');
  const err = document.getElementById('admin-error');
  if (cb && cb.checked) {
    pg.classList.remove('hidden');
  } else {
    pg.classList.add('hidden');
    document.getElementById('admin-passcode').value = '';
    if (err) err.classList.add('hidden');
    document.getElementById('admin-select-group').classList.add('hidden');
    isAdminUnlocked = false;
    window.renderSchoolDashboard();
  }
};

window.checkAdmin = function() {
  const pass = document.getElementById('admin-passcode').value;
  const sg = document.getElementById('admin-select-group');
  const cbWrap = document.getElementById('admin-cb-wrapper');
  const passWrap = document.getElementById('admin-passcode-group');
  const err = document.getElementById('admin-error');
  
  if (pass === '123456') {
    sg.classList.remove('hidden');
    cbWrap.classList.add('hidden');
    passWrap.classList.add('hidden');
    if (err) err.classList.add('hidden');
    isAdminUnlocked = true;
    window.renderSchoolDashboard();
  } else {
    sg.classList.add('hidden');
    if (err) err.classList.remove('hidden');
    isAdminUnlocked = false;
  }
};

window.exitAdmin = function() {
  document.getElementById('cb-admin').checked = false;
  document.getElementById('admin-passcode').value = '';
  document.getElementById('admin-cb-wrapper').classList.remove('hidden');
  document.getElementById('admin-passcode-group').classList.add('hidden');
  document.getElementById('admin-select-group').classList.add('hidden');
  document.getElementById('admin-error').classList.add('hidden');
  isAdminUnlocked = false;
  window.renderSchoolDashboard();
};

window.adminSchoolChange = function() {
  if (isAdminUnlocked) {
    window.renderSchoolDashboard();
  }
};

window.openSubmitModal = function() {
  if (userJourneySections.length === 0) {
    alert("Please calculate a commute first.");
    return;
  }
  
  const now = Date.now();
  if (lastSubmitTime !== 0 && (now - lastSubmitTime < 60000)) {
    alert("You have already submitted a commute recently. Please wait one minute before submitting again.");
    return;
  }
  
  const modalSubmitBtn = document.getElementById('modal-confirm-btn');
  if (modalSubmitBtn) {
    modalSubmitBtn.innerText = "Submit Commute";
    modalSubmitBtn.disabled = false;
  }

  document.getElementById('school-modal').classList.add('active');
  document.getElementById('modal-code-group').classList.add('hidden');
  document.getElementById('modal-school-code').value = '';
  document.getElementById('modal-error').classList.add('hidden');
  document.getElementById('modal-school-select').value = '';
};

window.closeModal = function() {
  document.getElementById('school-modal').classList.remove('active');
};

window.handleOverlayClick = function(event) {
  if (event.target.id === 'school-modal') {
    window.closeModal();
  }
};

window.handleModalSchoolChange = function() {
  const val = document.getElementById('modal-school-select').value;
  const codeGroup = document.getElementById('modal-code-group');
  if(val) codeGroup.classList.remove('hidden');
  else codeGroup.classList.add('hidden');
};

window.toggleReturnCommute = function() {
  const cb = document.getElementById('cb-return-journey');
  const box = document.getElementById('return-commute-box');
  if (cb && cb.checked) {
    box.classList.add('hidden');
  } else {
    box.classList.remove('hidden');
    if (returnSectionCount === 0) {
      window.addSection('return');
    }
  }
};

window.addSection = function(type = 'forward') {
  const isReturn = type === 'return';
  if (isReturn) returnSectionCount++; else sectionCount++;
  const sCount = isReturn ? returnSectionCount : sectionCount;

  const id = `sec-${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const container = document.getElementById(isReturn ? 'return-sections-container' : 'sections-container');
  if(!container) return;

  const sectionLabel = isReturn ? `Return Section ${sCount}` : `Section ${sCount}`;
  
  const sectionHTML = `
    <div class="journey-section" id="${id}" data-type="${type}">
      <h3 class="section-title">${sectionLabel}</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Mode of Transport</label>
          <select class="mode-select" data-id="${id}" onchange="handleSectionChange('${id}')" required>
            ${modeOptionsHTML}
          </select>
        </div>
        <div class="form-group">
          <label>Input Type</label>
          <select class="input-type-select" data-id="${id}" onchange="handleSectionChange('${id}')" required>
            <option value="" disabled selected>Select an input type</option>
            <option value="distance">Distance (km)</option>
            <option value="time">Time (minutes)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="value-label">Distance / Time</label>
          <input type="number" class="value-input" data-id="${id}" min="0.1" step="0.1" placeholder="Enter a value">
        </div>
      </div>
      <div class="form-row-bottom">
        <div class="rush-group hidden" id="rush-group-${id}">
          <label class="checkbox-container">
            <input type="checkbox" class="rush-checkbox">
            <span class="cb-label" style="font-weight: normal;">Travelling during rush hour</span>
          </label>
        </div>
        ${sCount > 1 ? `<button type="button" class="btn delete-btn" onclick="removeSection('${id}', '${type}')">Delete Section</button>` : ''}
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', sectionHTML);
  handleSectionChange(id);
};

window.removeSection = function(id, type) {
  const el = document.getElementById(id);
  if (el) el.remove();
  updateSectionLabels(type);
};

function updateSectionLabels(type = 'forward') {
  const isReturn = type === 'return';
  const containerId = isReturn ? '#return-sections-container .journey-section' : '#sections-container .journey-section';
  const sections = document.querySelectorAll(containerId);
  
  if (isReturn) returnSectionCount = sections.length;
  else sectionCount = sections.length;
  
  sections.forEach((sec, index) => {
    const title = sec.querySelector('.section-title');
    if (title) title.innerText = isReturn ? `Return Section ${index + 1}` : `Section ${index + 1}`;
  });
}

window.handleSectionChange = function(id) {
  const row = document.getElementById(id);
  if (!row) return;
  
  const modeSelect = row.querySelector('.mode-select');
  const inputTypeSelect = row.querySelector('.input-type-select');
  const valueInput = row.querySelector('.value-input');
  
  if (!modeSelect || !inputTypeSelect) return;

  const mode = modeSelect.value;
  const inputType = inputTypeSelect.value;
  
  const label = row.querySelector('.value-label');
  if (label) {
    if (inputType === 'distance') {
        label.innerText = 'Distance (km)';
        if (valueInput) {
            valueInput.step = '0.1';
            valueInput.min = '0.1';
        }
    } else if (inputType === 'time') {
        label.innerText = 'Time (minutes)';
        if (valueInput) {
            valueInput.step = '1';
            valueInput.min = '1';
        }
    } else {
        label.innerText = 'Distance / Time';
    }
  }
  
  const rushGroup = row.querySelector(`#rush-group-${id}`);
  const rowBottom = row.querySelector('.form-row-bottom');
  const hasDeleteBtn = row.querySelector('.delete-btn') !== null;

  let isRushVisible = false;

  if (rushGroup) {
    if (mode && mode !== 'walking' && mode !== 'cycling') {
      rushGroup.classList.remove('hidden');
      isRushVisible = true;
    } else {
      rushGroup.classList.add('hidden');
    }
  }

  if (rowBottom) {
      if (!isRushVisible && !hasDeleteBtn) {
          rowBottom.classList.add('hidden');
      } else {
          rowBottom.classList.remove('hidden');
      }
  }
};

window.calculateCommute = function() {
  
  const freqErr = document.getElementById('freq-error');
  if (freqErr) freqErr.classList.add('hidden');

  const daysInputNode = document.getElementById('days-per-week');
  const weeksInputNode = document.getElementById('weeks-per-year');
  if (!daysInputNode.value || !weeksInputNode.value) {
      if (freqErr) freqErr.classList.remove('hidden');
      return;
  }
    
  userJourneySections = [];
  userReturnSections = [];
  let totalDistOneWay = 0;
  let totalTimeOneWay = 0;
  let totalEmissionsOneWay = 0;
  let rushHourMotorSections = 0;
  
  let totalDistReturn = 0;
  let totalTimeReturn = 0;
  let totalEmissionsReturn = 0;

  let validSectionsExist = false;
  let incompleteSections = false;

  const parseSection = (secNode, index, isReturn) => {
    const modeKey = secNode.querySelector('.mode-select').value;
    const inputType = secNode.querySelector('.input-type-select').value;
    const rawVal = parseFloat(secNode.querySelector('.value-input').value) || 0;
    
    if (!modeKey || !inputType || rawVal <= 0) {
        incompleteSections = true;
        return;
    }
    
    validSectionsExist = true;
    const rushCheckbox = secNode.querySelector('.rush-checkbox');
    const isRush = rushCheckbox ? rushCheckbox.checked : false;

    const modeData = TRANSPORT_DATA[modeKey];
    let distance = 0, time = 0;
    let speed = isRush ? modeData.speedRush : modeData.speedNorm;
    
    if (inputType === 'distance') {
      distance = rawVal;
      time = (distance / speed) * 60;
    } else {
      time = rawVal;
      distance = (time / 60) * speed;
    }

    const emissions = distance * modeData.co2; 
    
    if (isReturn) {
        totalDistReturn += distance;
        totalTimeReturn += time;
        totalEmissionsReturn += emissions;
        if (isRush && (modeKey === 'car' || modeKey === 'bus')) rushHourMotorSections++;
        userReturnSections.push({
            label: `Return Section ${index + 1}`, modeKey, distance, time, emissions, isRush
        });
    } else {
        totalDistOneWay += distance;
        totalTimeOneWay += time;
        totalEmissionsOneWay += emissions;
        if (isRush && (modeKey === 'car' || modeKey === 'bus')) rushHourMotorSections++;
        userJourneySections.push({
            label: `Forward Section ${index + 1}`, modeKey, distance, time, emissions, isRush
        });
    }
  };

  document.querySelectorAll('#sections-container .journey-section').forEach((secNode, index) => {
    parseSection(secNode, index, false);
  });
  
  const isReturnSame = document.getElementById('cb-return-journey').checked;
  if (!isReturnSame) {
      document.querySelectorAll('#return-sections-container .journey-section').forEach((secNode, index) => {
        parseSection(secNode, index, true);
      });
  } else {
    rushHourMotorSections *= 2; 
  }

  if (!validSectionsExist || incompleteSections) {
    alert("Please completely fill out all of your commute sections before calculating your commute.");
    userJourneySections = []; 
    userReturnSections = [];
    return;
  }

  const daysPerWeek = parseInt(daysInputNode.value) || 5;
  const weeksPerYear = parseInt(weeksInputNode.value) || 36;
  const commutesPerYear = daysPerWeek * weeksPerYear;

  const totalDailyDist = isReturnSame ? (totalDistOneWay * 2) : (totalDistOneWay + totalDistReturn);
  const totalDailyTime = isReturnSame ? (totalTimeOneWay * 2) : (totalTimeOneWay + totalTimeReturn);
  const totalDailyEmissions = isReturnSame ? (totalEmissionsOneWay * 2) : (totalEmissionsOneWay + totalEmissionsReturn);

  const annualDist = totalDailyDist * commutesPerYear;
  const annualTimeHours = (totalDailyTime * commutesPerYear) / 60;
  const annualEmissions = totalDailyEmissions * commutesPerYear;

  journeyTotals = { 
    timeDaily: totalDailyTime, 
    timeReturn: isReturnSame ? totalTimeOneWay : totalTimeReturn, 
    emissionsAnnual: annualEmissions, 
    emissionsDaily: totalDailyEmissions,
    distDaily: totalDailyDist 
  };

  const getVal = (cbId, sliderId) => {
    const cb = document.getElementById(cbId);
    const slider = document.getElementById(sliderId);
    return (cb && cb.checked && slider) ? (parseInt(slider.value) || 0) : 0;
  };
  
  const valTraffic = getVal('cb-heavy-traffic', 'aq-heavy-traffic');
  const valWaiting = getVal('cb-waiting', 'aq-waiting');
  const valRoads = getVal('cb-busy-roads', 'aq-busy-roads');
  const valPerceived = getVal('cb-perceived', 'aq-perceived');

  let avgOneWayTime = totalDailyTime / 2;
  let totalAqBaseSum = 0;
  
  userJourneySections.forEach(sec => totalAqBaseSum += sec.time * TRANSPORT_DATA[sec.modeKey].aqBase);
  if (!isReturnSame) {
      userReturnSections.forEach(sec => totalAqBaseSum += sec.time * TRANSPORT_DATA[sec.modeKey].aqBase);
  } else {
      totalAqBaseSum *= 2;
  }
  
  let baseAq = totalDailyTime > 0 ? (totalAqBaseSum / totalDailyTime) : 0;

  let aqScore = baseAq + (avgOneWayTime / 60) * 8;
  aqScore += (valTraffic * 1.5) + (valWaiting * 1.2) + (valRoads * 1.5) + (valPerceived * 2.0);
  aqScore += (rushHourMotorSections / 2) * 6;
  aqScore = Math.min(Math.max(Math.round(aqScore), 0), 100);

  let aqLevel = "", aqDesc = "", badgeClass = "";
  if (aqScore <= 20) { 
    aqLevel = "Minimal"; 
    aqDesc = "Excellent route with minimal exposure to pollutants and traffic exhaust"; 
    badgeClass = "badge-green"; 
  } else if (aqScore <= 40) { 
    aqLevel = "Low"; 
    aqDesc = "Good route with low exposure to pollutants and traffic exhaust"; 
    badgeClass = "badge-green"; 
  } else if (aqScore <= 60) { 
    aqLevel = "Moderate"; 
    aqDesc = "Typical urban exposure level to pollutants and traffic exhaust"; 
    badgeClass = "badge-yellow"; 
  } else if (aqScore <= 80) { 
    aqLevel = "High"; 
    aqDesc = "High exposure to pollutants and traffic exhaust; consider alternative routes where available"; 
    badgeClass = "badge-red"; 
  } else { 
    aqLevel = "Critical"; 
    aqDesc = "Significant exposure to pollutants and traffic exhaust; change your route if possible"; 
    badgeClass = "badge-red"; 
  }

  const setTxt = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
  setTxt('res-dist-oneway', totalDailyDist.toFixed(1));
  setTxt('res-dist-annual', Math.round(annualDist).toLocaleString());
  
  setTxt('res-time-oneway', `${Math.round(totalDailyTime)} minute${Math.round(totalDailyTime) === 1 ? '' : 's'}`);
  
  setTxt('res-time-annual', Math.round(annualTimeHours).toLocaleString());
  setTxt('res-carbon-annual', Math.round(annualEmissions).toLocaleString());
  setTxt('res-aq-score', aqScore);
  setTxt('res-aq-level', aqLevel);
  setTxt('res-aq-desc', aqDesc);
  
  const badgeEl = document.getElementById('res-aq-level');
  if (badgeEl) {
    badgeEl.className = `aq-badge ${badgeClass}`;
  }

  document.getElementById('results-dashboard').classList.remove('hidden');
  
  const showAltBtn = document.getElementById('show-alt-btn');
  if(showAltBtn) showAltBtn.classList.remove('hidden');
  
  const submitBtn = document.getElementById('submit-btn');
  if(submitBtn) {
    submitBtn.classList.remove('hidden');
    if (confirmedSchoolId) {
      submitBtn.innerText = "Resubmit Commute";
    } else {
      submitBtn.innerText = "Submit Commute";
    }
  }
  
  calculationDone = true;

  const altView = document.getElementById('alternatives');
  if (altView && !altView.classList.contains('hidden')) {
    renderAlternatives();
  }
};

window.confirmSubmission = async function() {
  const schoolId = document.getElementById('modal-school-select').value;
  const code = document.getElementById('modal-school-code').value;
  const errEl = document.getElementById('modal-error');
  const submitBtn = document.getElementById('modal-confirm-btn');
  
  if(!schoolId) {
    errEl.innerText = "Please select a school.";
    errEl.classList.remove('hidden');
    submitBtn.disabled = false;
    return;
  }

  const selectedSchool = SCHOOLS.find(s => s.id === schoolId);

  if(!selectedSchool || code !== selectedSchool.code) {
    errEl.innerText = "Incorrect school code.";
    errEl.classList.remove('hidden');
    submitBtn.disabled = false;
    return;
  }

  errEl.classList.add('hidden');
  submitBtn.innerText = "Submitting...";
  submitBtn.disabled = true;

  let modeArray = [];
  userJourneySections.forEach(s => modeArray.push(s.modeKey));
  const isReturnSame = document.getElementById('cb-return-journey').checked;
  if (!isReturnSame) {
      userReturnSections.forEach(s => modeArray.push(s.modeKey));
  } else {
      userJourneySections.forEach(s => modeArray.push(s.modeKey));
  }
  let modeString = modeArray.join(','); 

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('school_data').insert([{ 
        mode: modeString, 
        annual_emissions: journeyTotals.emissionsAnnual, 
        distance: journeyTotals.distDaily,
        school_id: schoolId
      }]);
      if (error) throw error;
    }
    
    confirmedSchoolId = schoolId;
    lastSubmitTime = Date.now();
    
    window.closeModal();
    
    const mainSubmitBtn = document.getElementById('submit-btn');
    if (mainSubmitBtn) {
      mainSubmitBtn.innerText = "Commute Submitted!";
    }
    
    submitBtn.innerText = "Submit Commute";
    submitBtn.disabled = false;
    
    window.renderSchoolDashboard();
    
  } catch (err) {
    console.error('Database connection error:', err);
    errEl.innerText = "Database connection error.";
    errEl.classList.remove('hidden');
    submitBtn.innerText = "Submit Commute";
    submitBtn.disabled = false;
  }
};

window.resetCommute = function() {
  const container = document.getElementById('sections-container');
  if (container) container.innerHTML = '';
  sectionCount = 0;
  
  const returnContainer = document.getElementById('return-sections-container');
  if (returnContainer) returnContainer.innerHTML = '';
  returnSectionCount = 0;

  window.addSection('forward');
  
  const freqErr = document.getElementById('freq-error');
  if (freqErr) freqErr.classList.add('hidden');

  const daysInput = document.getElementById('days-per-week');
  if(daysInput) daysInput.value = 5;
  const weeksInput = document.getElementById('weeks-per-year');
  if(weeksInput) weeksInput.value = 36;
  
  const returnCb = document.getElementById('cb-return-journey');
  if(returnCb) {
      returnCb.checked = true;
      window.toggleReturnCommute();
  }

  document.querySelectorAll('.aq-factor input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
  });

  document.querySelectorAll('.custom-slider').forEach(slider => {
    slider.value = 1;
  });

  document.getElementById('results-dashboard').classList.add('hidden');
  
  const showAltBtn = document.getElementById('show-alt-btn');
  if(showAltBtn) showAltBtn.classList.add('hidden');
  
  const submitBtn = document.getElementById('submit-btn');
  if(submitBtn) {
    submitBtn.classList.add('hidden');
    submitBtn.innerText = "Submit Commute";
    submitBtn.disabled = false;
  }

  const altContent = document.getElementById('alternatives-content');
  if (altContent) altContent.classList.add('hidden');
  
  const altWarning = document.getElementById('alternatives-warning');
  if (altWarning) altWarning.classList.remove('hidden');
  
  calculationDone = false;
  confirmedSchoolId = null;
};


window.renderAlternatives = function() {
  const warning = document.getElementById('alternatives-warning');
  const content = document.getElementById('alternatives-content');
  
  if (!calculationDone || userJourneySections.length === 0) {
    if (warning) warning.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    return;
  }
  
  if (warning) warning.classList.add('hidden');
  if (content) content.classList.remove('hidden');
  
  const container = document.getElementById('alt-sections-container');
  if (!container) return;
  
  container.innerHTML = '';

  const renderSectionOptions = (sec, i, isReturn) => {
    const curMode = TRANSPORT_DATA[sec.modeKey];
    const sectionLabel = isReturn ? `Return Section ${i + 1}` : `Section ${i + 1}`;
    const radioName = isReturn ? `alt-return-radio-${i}` : `alt-forward-radio-${i}`;
    
    let html = `<div class="alt-section">
      <h3 class="section-title">${sectionLabel}</h3>
      <div class="alt-options-grid">`;

    html += `
      <label class="alt-label active-alt">
        <input type="radio" name="${radioName}" value="${sec.modeKey}" data-time="${sec.time}" data-co2="${sec.emissions}" checked onchange="calculateAlternatives()">
        <div class="alt-info">
          <strong style="display: block; margin-bottom: 0.2rem;">${curMode.label} (Original)</strong>
          <span class="diff-neutral">+0 kg CO₂</span>
        </div>
      </label>`;

    Object.keys(TRANSPORT_DATA).forEach(altKey => {
      if (altKey === sec.modeKey) return; 
      if (altKey === 'walking' && sec.time > 30 && sec.modeKey !== 'walking') return;

      const altData = TRANSPORT_DATA[altKey];
      const speed = sec.isRush ? altData.speedRush : altData.speedNorm;
      const altTime = (sec.distance / speed) * 60;
      const altCo2 = sec.distance * altData.co2;
      const co2Diff = altCo2 - sec.emissions;
      
      let co2Str = "";
      if (co2Diff > 0.01) co2Str = `<span class="diff-bad">+${co2Diff.toFixed(2)} kg CO₂</span>`;
      else if (co2Diff < -0.01) co2Str = `<span class="diff-good">-${Math.abs(co2Diff).toFixed(2)} kg CO₂</span>`;
      else co2Str = `<span class="diff-neutral">+0 kg CO₂</span>`;

      html += `
        <label class="alt-label">
          <input type="radio" name="${radioName}" value="${altKey}" data-time="${altTime}" data-co2="${altCo2}" onchange="calculateAlternatives()">
          <div class="alt-info">
            <strong style="display: block; margin-bottom: 0.2rem;">${altData.label}</strong>
            ${co2Str}
          </div>
        </label>`;
    });

    html += `</div></div>`;
    container.insertAdjacentHTML('beforeend', html);
  };

  userJourneySections.forEach((sec, i) => renderSectionOptions(sec, i, false));
  
  const isReturnSame = document.getElementById('cb-return-journey').checked;
  if (!isReturnSame) {
      userReturnSections.forEach((sec, i) => renderSectionOptions(sec, i, true));
  }

  calculateAlternatives();
};

window.calculateAlternatives = function() {
  let altTimeDaily = 0, altCo2Daily = 0;

  const getSelection = (sections, isReturn) => {
      sections.forEach((sec, i) => {
        const radioName = isReturn ? `alt-return-radio-${i}` : `alt-forward-radio-${i}`;
        const radios = document.getElementsByName(radioName);
        for (let r of radios) {
          if (r.checked) {
            altTimeDaily += parseFloat(r.getAttribute('data-time'));
            altCo2Daily += parseFloat(r.getAttribute('data-co2'));
            r.closest('.alt-label').classList.add('active-alt');
          } else {
            r.closest('.alt-label').classList.remove('active-alt');
          }
        }
      });
  };

  getSelection(userJourneySections, false);
  
  const isReturnSame = document.getElementById('cb-return-journey').checked;
  if (!isReturnSame) {
      getSelection(userReturnSections, true);
  } else {
      altTimeDaily *= 2;
      altCo2Daily *= 2;
  }

  const daysInput = document.getElementById('days-per-week');
  const weeksInput = document.getElementById('weeks-per-year');
  const commutesPerYear = (daysInput ? parseInt(daysInput.value) || 5 : 5) * (weeksInput ? parseInt(weeksInput.value) || 36 : 36);
  
  const altAnnualCo2 = altCo2Daily * commutesPerYear;

  const setTxt = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
  

  setTxt('alt-time-oneway', `${Math.round(altTimeDaily)} minute${Math.round(altTimeDaily) === 1 ? '' : 's'}`);
  setTxt('alt-carbon-annual', Math.round(altAnnualCo2).toLocaleString());

  const origDailyTime = journeyTotals.timeDaily;
  const tDiff = Math.round(altTimeDaily - origDailyTime);
  const tEl = document.getElementById('alt-time-diff');
  if(tEl) {
    if(tDiff > 0) {
        tEl.innerText = `+${tDiff} minute${tDiff === 1 ? '' : 's'}`;
        tEl.style.color = 'var(--danger-color)'; 
    } else if(tDiff < 0) {
        tEl.innerText = `-${Math.abs(tDiff)} minute${Math.abs(tDiff) === 1 ? '' : 's'}`;
        tEl.style.color = 'var(--heading-color)'; 
    } else {
        tEl.innerText = 'No change in travel time';
        tEl.style.color = 'var(--text-main)'; 
    }
  }
  
  const cDiff = altAnnualCo2 - journeyTotals.emissionsAnnual;
  const cEl = document.getElementById('alt-carbon-diff');
  
  if (cEl) {
    if (cDiff > 0.5) { 
      cEl.innerText = `+${Math.round(cDiff).toLocaleString()} kg CO₂`; 
      cEl.style.color = 'var(--danger-color)'; 
    }
    else if (cDiff < -0.5) { 
      cEl.innerText = `-${Math.round(Math.abs(cDiff)).toLocaleString()} kg CO₂`; 
      cEl.style.color = 'var(--heading-color)'; 
    }
    else { 
      cEl.innerText = 'No change in carbon footprint'; 
      cEl.style.color = 'var(--text-main)'; 
    }
  }
};

window.renderSchoolDashboard = async function() {
  const emptyState = document.getElementById('school-empty-state');
  const analyticsContent = document.getElementById('school-analytics-content');
  const titleText = document.getElementById('dashboard-title-text');
  const reductionCard = document.getElementById('reduction-potential-card');

  let viewingSchoolId = confirmedSchoolId;
  if (isAdminUnlocked) {
    const adminSelected = document.getElementById('admin-school-select').value;
    if (adminSelected) {
        viewingSchoolId = adminSelected;
    }
  }

  if (!viewingSchoolId) {
    if (analyticsContent) analyticsContent.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (titleText) titleText.innerText = "Your School";
    
    if(isAdminUnlocked) {
       emptyState.innerHTML = '<p class="text-black">Please select a school from the dropdown menu to view its dashboard.</p>';
    } else {
       emptyState.innerHTML = '<p class="text-black">Please submit your commute on the <i>\My Commute\</i> page first with your School Code to see your school\'s dashboard.</p>';
    }
    return;
  }

  if (viewingSchoolId === 'all') {
      if (titleText) titleText.innerText = "Overall";
  } else {
      const schoolObj = SCHOOLS.find(s => s.id === viewingSchoolId);
      if (schoolObj && titleText) {
        schoolObj.name;
        titleText.innerText = schoolObj.name;
      }
  }

  if (!supabaseClient) {
    if (analyticsContent) analyticsContent.classList.add('hidden');
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = '<p class="text-black">Offline Mode: Cannot connect to cloud database.</p>';
    }
    return;
  }

  try {
    const { data: allData, error } = await supabaseClient.from('school_data').select('*');
    if (error) throw error;
    
    let mySchoolData = [];
    if (viewingSchoolId === 'all') {
        mySchoolData = allData;
    } else {
        mySchoolData = allData.filter(d => d.school_id === viewingSchoolId);
    }
    
    const totalStudents = mySchoolData.length;

    if (totalStudents === 0) {
      if (analyticsContent) analyticsContent.classList.add('hidden');
      if (emptyState) {
        emptyState.classList.remove('hidden');
        if (isAdminUnlocked) {
            emptyState.innerHTML = '<p class="text-black">No submissions have been received yet for this school.</p>';
        } else {
            emptyState.innerHTML = '<p class="text-black">No submissions have been received yet for your school. Be the first to calculate and submit your commute!</p>';
        }
      }
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (analyticsContent) analyticsContent.classList.remove('hidden');

    if (reductionCard) {
      if (viewingSchoolId === 'all') {
        reductionCard.classList.add('hidden');
      } else {
        reductionCard.classList.remove('hidden');
      }
    }

    document.getElementById('school-total-students').innerText = totalStudents;

    let currentTotalCo2 = 0;
    let carUsers = 0;
    let carCo2 = 0;
    
    const modeCounts = { car: 0, bus: 0, dart: 0, luas: 0, cycling: 0, walking: 0 };
    const emissionsCounts = { car: 0, bus: 0, dart: 0, luas: 0, cycling: 0, walking: 0 };

    mySchoolData.forEach(trip => {
      currentTotalCo2 += trip.annual_emissions;
      
      let modes = trip.mode ? trip.mode.split(',') : ['car']; 
      let fraction = 1 / modes.length;

      modes.forEach(m => {
          if (modeCounts[m] !== undefined) {
            modeCounts[m] += fraction;
            emissionsCounts[m] += trip.annual_emissions * fraction;
          }
      });
      
      let carFraction = modes.filter(m => m === 'car').length / modes.length;
      if (carFraction > 0) {
        carUsers += carFraction;
        carCo2 += trip.annual_emissions * carFraction;
      }
    });

    document.getElementById('school-current-co2').innerText = Math.round(currentTotalCo2).toLocaleString();

    let scenariosHTML = "";

    if (carUsers > 0) {
      const busRatio = TRANSPORT_DATA.bus.co2 / TRANSPORT_DATA.car.co2;
      const realisticShift = Math.ceil(carUsers * 0.5);
      const emissionsSavedByShift = (realisticShift / carUsers) * carCo2 * (1 - busRatio);
      
      const shortCarShift = Math.ceil(carUsers * 0.2);
      const emissionsSavedByWalk = (shortCarShift / carUsers) * carCo2;

      scenariosHTML += `<li>If just <strong>half (${realisticShift})</strong> of your school's car commuters switched to commuting by bus, your school would save <strong>${Math.round(emissionsSavedByShift).toLocaleString()} kg CO₂</strong> every year. Consider commuting by bus if convenient to reduce your school's emissions.</li>`;
      scenariosHTML += `<li>If <strong>${shortCarShift}</strong> car commuter${shortCarShift === 1 ? '' : 's'} living close to the school commuted by walking or cycling, your school would immediately eliminate <strong>${Math.round(emissionsSavedByWalk).toLocaleString()} kg CO₂</strong> of localised emissions.</li>`;
    } else {
      scenariosHTML = `<li>Outstanding achievement! With ${totalStudents} student${totalStudents === 1 ? '' : 's'} submitting their commute, <strong>0%</strong> are commuting by car. Your school's transport emissions are highly optimised!</li>`;
    }

    document.getElementById('school-scenarios').innerHTML = scenariosHTML;

    const labels = [];
    const dataVals = [];
    const emissionsVals = [];
    const bgColors = [];
    
    const colorMap = {
      car: '#1a3828', bus: '#234a36', dart: '#2c5e43', 
      luas: '#408761', cycling: '#6ba887', walking: '#c9decb'    
    };

    for (const [mode, count] of Object.entries(modeCounts)) {
      if(count > 0 || emissionsCounts[mode] > 0) {
        labels.push(TRANSPORT_DATA[mode].label);
        dataVals.push(count);
        emissionsVals.push(Math.round(emissionsCounts[mode]));
        bgColors.push(colorMap[mode]);
      }
    }

    if (typeof Chart === 'undefined') return;

    if (schoolModeChartInstance) schoolModeChartInstance.destroy();
    if (schoolEmissionsChartInstance) schoolEmissionsChartInstance.destroy();
    if (comparisonChartInstance) comparisonChartInstance.destroy();

    const ctxMode = document.getElementById('schoolModeChart');
    if (ctxMode) {
      schoolModeChartInstance = new Chart(ctxMode.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{ 
            data: dataVals, backgroundColor: bgColors, 
            borderWidth: 2, borderColor: '#f2f9f4',
            hoverBorderWidth: 0, hoverBorderColor: 'transparent'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%', layout: { padding: 10 },
          plugins: { legend: { position: 'right', labels: { boxWidth: 15 } }, tooltip: { bodyFont: { size: 16 }, boxPadding: 8 } }
        }
      });
    }

    const ctxEmissions = document.getElementById('schoolEmissionsChart');
    if (ctxEmissions) {
      schoolEmissionsChartInstance = new Chart(ctxEmissions.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ 
            data: emissionsVals, backgroundColor: bgColors, borderRadius: 6,
            hoverBorderWidth: 0, hoverBorderColor: 'transparent'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, layout: { padding: { top: 10, bottom: 0, left: 10, right: 10 } },
          plugins: { legend: { display: false }, tooltip: { bodyFont: { size: 16 }, titleFont: { size: 16 }, boxPadding: 8 } },
          scales: {
            y: { 
              beginAtZero: true, 
              grid: { color: 'rgba(201, 222, 203, 0.4)' }, 
              title: { display: true, text: 'Total kg CO₂', font: { size: 17.6, weight: 'bold' } },
              ticks: { font: { size: 17.6, weight: 'normal' } } 
            },
            x: { 
              grid: { display: false }, 
              ticks: { font: { size: 17.6, weight: 'normal' } } 
            }
          }
        }
      });
    }

    const ctxCompare = document.getElementById('schoolComparisonChart');
    if (ctxCompare) {
      
      const comparisonMap = {};
      SCHOOLS.forEach(s => comparisonMap[s.id] = { name: s.name, totalCo2: 0 });
      
      allData.forEach(trip => {
        if(comparisonMap[trip.school_id]) {
          comparisonMap[trip.school_id].totalCo2 += trip.annual_emissions;
        }
      });

      const compLabels = SCHOOLS.map(s => s.name);
      const compDataVals = SCHOOLS.map(s => Math.round(comparisonMap[s.id].totalCo2));
      
      const palette = ['#1a3828', '#2c5e43', '#408761', '#c9decb'];
      const compColors = SCHOOLS.map((s, idx) => palette[idx % 4]);

      comparisonChartInstance = new Chart(ctxCompare.getContext('2d'), {
        type: 'bar',
        data: {
          labels: compLabels,
          datasets: [{ 
            data: compDataVals, backgroundColor: compColors, borderRadius: 6,
            hoverBorderWidth: 0, hoverBorderColor: 'transparent'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, layout: { padding: { top: 10, bottom: 0, left: 10, right: 10 } },
          plugins: { legend: { display: false }, tooltip: { bodyFont: { size: 16 }, titleFont: { size: 16 }, boxPadding: 8 } },
          scales: {
            y: { 
              beginAtZero: true, 
              grid: { color: 'rgba(201, 222, 203, 0.4)' }, 
              title: { display: true, text: 'Total kg CO₂', font: { size: 17.6, weight: 'bold' } },
              ticks: { font: { size: 17.6, weight: 'normal' } }
            },
            x: { 
              grid: { display: false }, 
              ticks: { font: { size: 17.6, weight: 'normal' } } 
            }
          }
        }
      });
    }

  } catch(err) {
    console.error('Error contacting Supabase database:', err);
    if (analyticsContent) analyticsContent.classList.add('hidden');
    if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = '<p class="text-black">Database Error: Could not retrieve submissions.</p>';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  
  initSchoolDropdowns();

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.switchPage(e.currentTarget.getAttribute('data-target'));
    });
  });

  document.querySelectorAll('.aq-factor input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const factor = e.currentTarget.closest('.aq-factor');
      if (factor) {
        const wrapper = factor.querySelector('.slider-wrapper');
        if (wrapper) {
          if (e.currentTarget.checked) wrapper.classList.remove('hidden');
          else wrapper.classList.add('hidden');
        }
      }
    });
  });

  /* AJAX Form Handling for Netlify Contact Form */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(contactForm);
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString(),
      }).then(() => {
        contactForm.classList.add('hidden');
        const successMsg = document.getElementById('contact-success-msg');
        if(successMsg) successMsg.classList.remove('hidden');
      }).catch((error) => alert(error));
    });
  }

  const bindClick = (id, func) => { const el = document.getElementById(id); if (el) el.addEventListener('click', func); };
  
  bindClick('add-section-btn', () => window.addSection('forward'));
  bindClick('add-return-section-btn', () => window.addSection('return'));
  bindClick('calculate-btn', window.calculateCommute);
  
  bindClick('submit-btn', window.openSubmitModal);
  
  bindClick('show-alt-btn', () => window.switchPage('alternatives'));
  bindClick('reset-btn', window.resetCommute);

  window.addSection('forward');
  window.renderSchoolDashboard(); 
});

window.resetContactForm = function() {
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.reset();
    contactForm.classList.remove('hidden');
  }
  const successMsg = document.getElementById('contact-success-msg');
  if (successMsg) successMsg.classList.add('hidden');
};