/**
 * Sea & Seas Shipping Private Limited
 * Form RPS 01-A - Seafarer Comprehensive Bio-Data & Application Logic
 * Pure ES6+ Vanilla JavaScript - Zero External Dependencies
 */

(function () {
  'use strict';

  // Constants & Storage Keys
  const STORAGE_KEY = 'seaandseas_rps01a_draft';
  const TOTAL_STEPS = 7;
  let currentStep = 1;
  let schema = null;
  let isSubmitting = false;
  const KEY_STORAGE = 'seaandseas_application_retry_key';
  function newSubmissionKey() {
    return crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2,'0')).join('');
  }
  let submissionKey = newSubmissionKey();
  try { submissionKey = sessionStorage.getItem(KEY_STORAGE) || submissionKey; sessionStorage.setItem(KEY_STORAGE, submissionKey); } catch { /* In-memory retry still works when tab storage is disabled. */ }

  // DOM Elements
  const form = document.getElementById('rpsApplicationForm');
  const wizardNav = document.getElementById('wizardStepsNav');
  const draftStatusEl = document.getElementById('draftStatusText');
  const draftIndicator = document.getElementById('draftIndicator');
  const clearDraftBtn = document.getElementById('clearDraftBtn');
  const prevBtn = document.getElementById('prevStepBtn');
  const nextBtn = document.getElementById('nextStepBtn');
  const submitBtn = document.getElementById('submitAppBtn');
  const printBioBtn = document.getElementById('printBioBtn');
  const appAlertBox = document.getElementById('appAlertBox');

  // Dynamic Table Bodies
  const familyTableBody = document.getElementById('familyTableBody');
  const seaServiceTableBody = document.getElementById('seaServiceTableBody');
  const eduTableBody = document.getElementById('eduTableBody');

  const STEP_TITLES = [
    'Position & Personal',
    'Family & Medical',
    'Travel & Academics',
    'CDC & STCW',
    'Sea Service (10 Yrs)',
    'Technical Experience',
    'Bank & Declaration'
  ];

  /* ==========================================================================
     1. INITIALIZATION & DRAFT RESTORATION
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch('/js/application-schema.json?v=20261007');
      if (!response.ok) throw new Error('Schema unavailable');
      schema = await response.json();
      Object.entries(schema.fields).forEach(([name, spec]) => {
        form.querySelectorAll(`[name="${name}"]`).forEach(input => {
          if (spec.type !== 'consent') input.maxLength = spec.max;
          input.required = Boolean(spec.required);
        });
      });
      document.querySelectorAll('[data-add-repeat]').forEach(button => button.addEventListener('click', () => {
        addExtraRow(button.dataset.addRepeat); scheduleAutosave();
      }));
      Object.keys(schema.repeats).filter(k => ['visas', 'certificates', 'licences'].includes(k)).forEach(addExtraRow);
    } catch {
      showAlert('The form configuration could not load. Refresh before submitting.', 'error');
      if (nextBtn) nextBtn.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
      return;
    }
    initStepNavigation();
    initDynamicTables();
    initFieldListeners();
    restoreDraft();
    initCalculationListeners();
    showStep(1);
  });

  /* ==========================================================================
     2. STEP NAVIGATION & VALIDATION
     ========================================================================== */
  function showStep(stepIndex) {
    if (stepIndex < 1 || stepIndex > TOTAL_STEPS) return;
    currentStep = stepIndex;

    // Toggle Step Visibility
    document.querySelectorAll('.step-content').forEach((el) => {
      const stepNum = parseInt(el.getAttribute('data-step'), 10);
      el.style.display = stepNum === currentStep ? 'block' : 'none';
    });

    // Update Wizard Navigation Buttons (Active, Completed Checkmark, and Inactive Dimmed)
    document.querySelectorAll('.wizard-step-btn').forEach((btn) => {
      const stepNum = parseInt(btn.getAttribute('data-step-target'), 10);
      const numSpan = btn.querySelector('.step-num');
      btn.classList.remove('active', 'completed');

      if (stepNum === currentStep) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'step');
        if (numSpan) numSpan.textContent = stepNum;
      } else if (stepNum < currentStep) {
        btn.classList.add('completed');
        btn.removeAttribute('aria-current');
        if (numSpan) numSpan.textContent = '✓';
      } else {
        btn.removeAttribute('aria-current');
        if (numSpan) numSpan.textContent = stepNum;
      }
    });

    // Update Mobile Stepper Card
    const mobCur = document.getElementById('mobileStepCurrent');
    const mobTitle = document.getElementById('mobileStepTitle');
    const mobFill = document.getElementById('mobileProgressFill');

    if (mobCur) mobCur.textContent = currentStep;
    if (mobTitle) mobTitle.textContent = STEP_TITLES[currentStep - 1] || '';
    if (mobFill) mobFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;

    // Control Footer Buttons
    if (prevBtn) {
      prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';
    }
    if (nextBtn) {
      nextBtn.style.display = currentStep === TOTAL_STEPS ? 'none' : 'inline-flex';
      if (currentStep < TOTAL_STEPS) {
        nextBtn.innerHTML = `Save &amp; Continue to Step ${currentStep + 1} →`;
      }
    }
    if (submitBtn) {
      submitBtn.style.display = currentStep === TOTAL_STEPS ? 'inline-flex' : 'none';
    }

    // Scroll to top of card smoothly
    const card = document.querySelector('.apply-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function validateStep(stepIndex) {
    if (schema) {
      const errors = ApplicationValidation.validate(collectData(), schema, stepIndex);
      if (Object.keys(errors).length) { displayErrors(errors); return false; }
    }
    const currentContainer = document.querySelector(`.step-content[data-step="${stepIndex}"]`);
    if (!currentContainer) return true;

    // Check all required inputs in this step
    const requiredInputs = currentContainer.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    let firstInvalid = null;

    requiredInputs.forEach((input) => {
      // Check radios
      if (input.type === 'radio') {
        const name = input.name;
        const checked = currentContainer.querySelector(`input[name="${name}"]:checked`);
        if (!checked) {
          isValid = false;
          if (!firstInvalid) firstInvalid = input;
          input.closest('.toggle-card, .radio-group')?.classList.add('field-invalid');
        } else {
          input.closest('.toggle-card, .radio-group')?.classList.remove('field-invalid');
        }
      } else if (input.type === 'checkbox') {
        if (!input.checked) {
          isValid = false;
          if (!firstInvalid) firstInvalid = input;
          input.classList.add('field-invalid');
        } else {
          input.classList.remove('field-invalid');
        }
      } else {
        // Text, Select, Date, Tel, Email
        if (!input.value.trim() || !input.checkValidity()) {
          isValid = false;
          input.classList.add('field-invalid');
          if (!firstInvalid) firstInvalid = input;
        } else {
          // Specific format validations
          if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
            isValid = false;
            input.classList.add('field-invalid');
            if (!firstInvalid) firstInvalid = input;
          } else {
            input.classList.remove('field-invalid');
          }
        }
      }
    });

    if (!isValid && firstInvalid) {
      firstInvalid.focus();
      showAlert('⚠️ Please fill out all required fields before proceeding to the next step.', 'error');
    } else {
      hideAlert();
    }

    return isValid;
  }

  function initStepNavigation() {
    // Next Step Button
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
          showStep(currentStep + 1);
          saveDraft();
        }
      });
    }

    // Previous Step Button
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        showStep(currentStep - 1);
        saveDraft();
      });
    }

    // Wizard Step Nav Buttons
    if (wizardNav) {
      wizardNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.wizard-step-btn');
        if (!btn) return;
        const targetStep = parseInt(btn.getAttribute('data-step-target'), 10);
        // Allow going backwards anytime, or jumping forward if valid
        if (targetStep < currentStep || validateStep(currentStep)) {
          showStep(targetStep);
          saveDraft();
        }
      });
    }

    // Print Bio-Data Button
    if (printBioBtn) {
      printBioBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }

  /* ==========================================================================
     3. DRAFT PERSISTENCE (AUTOSAVE & RESTORE)
     ========================================================================== */
  let autosaveTimer = null;

  function scheduleAutosave() {
    if (draftIndicator) draftIndicator.classList.add('saving');
    const footerInd = document.getElementById('footerDraftIndicator');
    if (footerInd) footerInd.classList.add('saving');

    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      saveDraft();
    }, 1500);
  }

  function saveDraft() {
    if (!form) return;
    try {
      const data = {};
      const elements = form.querySelectorAll('input, select, textarea');

      elements.forEach((el) => {
        if (!el.name || el.type === 'file' || el.name === '_hp_trap') return;

        if (el.type === 'checkbox') {
          data[el.name] = el.checked;
        } else if (el.type === 'radio') {
          if (el.checked) {
            data[el.name] = el.value;
          }
        } else {
          data[el.name] = el.value;
        }
      });

      // Save dynamic table counts
      data._familyRowCount = familyTableBody ? familyTableBody.children.length : 0;
      data._seaServiceRowCount = seaServiceTableBody ? seaServiceTableBody.children.length : 0;
      data._eduRowCount = eduTableBody ? eduTableBody.children.length : 0;
      data._savedAt = new Date().toISOString();

      for (const group of ['visas', 'certificates', 'licences']) data['_'+group+'RowCount'] = document.getElementById(group+'TableBody')?.children.length || 0;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      if (draftIndicator) draftIndicator.classList.remove('saving');
      const footerInd = document.getElementById('footerDraftIndicator');
      if (footerInd) footerInd.classList.remove('saving');

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (draftStatusEl) draftStatusEl.textContent = `Draft saved in this tab (${timeStr})`;
      const footerStatus = document.getElementById('footerDraftStatus');
      if (footerStatus) footerStatus.textContent = `Draft auto-saved (${timeStr})`;
    } catch (e) {
      console.warn('[RPS 01-A] Could not save tab draft', e);
    }
  }

  function restoreDraft() {
    if (!form) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;

      // Restore dynamic rows first
      if (data._seaServiceRowCount && seaServiceTableBody) {
        while (seaServiceTableBody.children.length < Math.min(10, data._seaServiceRowCount)) {
          addSeaServiceRow();
        }
      }
      if (data._familyRowCount && familyTableBody) {
        while (familyTableBody.children.length < Math.min(12, data._familyRowCount)) {
          addFamilyRow();
        }
      }
      if (data._eduRowCount && eduTableBody) {
        while (eduTableBody.children.length < Math.min(12, data._eduRowCount)) {
          addEduRow();
        }
      }

      for (const group of ['visas', 'certificates', 'licences']) {
        const body = document.getElementById(group+'TableBody');
        while (body.children.length < Math.min(schema.repeats[group].max, data['_'+group+'RowCount'] || 1)) addExtraRow(group);
      }

      // Populate elements
      const elements = form.querySelectorAll('input, select, textarea');
      elements.forEach((el) => {
        if (!el.name || el.type === 'file' || el.name === '_hp_trap') return;

        if (data[el.name] !== undefined) {
          if (el.type === 'checkbox') {
            el.checked = Boolean(data[el.name]);
          } else if (el.type === 'radio') {
            if (el.value === data[el.name]) {
              el.checked = true;
            }
          } else {
            el.value = data[el.name];
          }
        }
      });

      // Calculate total sea-time durations
      recalculateAllSeaTimes();

      // Trigger condition reveals
      checkConditionalReveals();

      if (draftStatusEl && data._savedAt) {
        const savedDate = new Date(data._savedAt);
        const timeStr = savedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        draftStatusEl.textContent = `Draft restored (${timeStr})`;
      }
    } catch (e) {
      console.warn('[RPS 01-A] Error restoring tab draft', e);
    }
  }

  if (clearDraftBtn) {
    clearDraftBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your saved draft and reset the form?')) {
        submissionKey = newSubmissionKey();
        try { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.setItem(KEY_STORAGE, submissionKey); } catch { /* Storage may be disabled. */ }
        form.reset();
        showStep(1);
        if (draftStatusEl) draftStatusEl.textContent = 'Draft cleared';
        showAlert('Draft has been reset.', 'info');
      }
    });
  }

  function initFieldListeners() {
    if (!form) return;
    form.addEventListener('input', scheduleAutosave);
    form.addEventListener('change', (e) => {
      scheduleAutosave();
      checkConditionalReveals(e.target);
    });

    // CV File drag and drop
    const cvFileInput = document.getElementById('cvFile');
    const fileDropBox = document.getElementById('fileDropBox');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    if (cvFileInput && fileDropBox) {
      ['dragenter', 'dragover'].forEach((eventName) => {
        fileDropBox.addEventListener(eventName, (e) => {
          e.preventDefault();
          fileDropBox.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach((eventName) => {
        fileDropBox.addEventListener(eventName, (e) => {
          e.preventDefault();
          fileDropBox.classList.remove('dragover');
        });
      });

      fileDropBox.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length) {
          cvFileInput.files = e.dataTransfer.files;
          updateFileNameDisplay();
        }
      });

      cvFileInput.addEventListener('change', updateFileNameDisplay);

      function updateFileNameDisplay() {
        if (cvFileInput.files && cvFileInput.files[0]) {
          const file = cvFileInput.files[0];
          const sizeKb = Math.round(file.size / 1024);
          fileNameDisplay.textContent = `✅ ${file.name} (${sizeKb} KB)`;
          cvFileInput.setCustomValidity(file.size > 10 * 1024 * 1024 || !/\.(pdf|doc|docx)$/i.test(file.name) ? 'Choose a PDF, DOC or DOCX up to 10 MB.' : '');
          fileDropBox.classList.add('has-file');
        } else {
          fileNameDisplay.textContent = '📎 Click or drag & drop your CV (PDF/DOCX)';
          fileDropBox.classList.remove('has-file');
        }
      }
    }
  }

  /* ==========================================================================
     4. CONDITIONAL FIELDS (MEDICAL / RANK SPECIFIC)
     ========================================================================== */
  function checkConditionalReveals() {
    if (schema) Object.entries(schema.fields).forEach(([name, spec]) => {
      if (!spec.when) return;
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      const active = form.querySelector(`[name="${spec.when[0]}"]:checked`)?.value === spec.when[1];
      input.required = active;
      const wrapper = input.closest('[data-condition]');
      if (wrapper) wrapper.style.display = active ? 'block' : 'none';
    });
    // Medical signoff reveal
    const medSignoffYes = document.querySelector('input[name="medical_signoff"][value="Yes"]');
    const medDetailsBox = document.getElementById('medSignoffDetails');
    if (medSignoffYes && medDetailsBox) {
      medDetailsBox.style.display = medSignoffYes.checked ? 'block' : 'none';
    }

    // Rank role highlighting
    const rankSelect = document.getElementById('posRank');
    if (rankSelect) {
      const val = rankSelect.value.toLowerCase();
      const deckBlock = document.getElementById('miscDeckBlock');
      const engBlock = document.getElementById('miscEngBlock');
      const elecBlock = document.getElementById('miscElecBlock');

      if (deckBlock && engBlock && elecBlock) {
        if (val.includes('master') || val.includes('officer') || val.includes('bosun') || val.includes('seaman') || val.includes('deck')) {
          deckBlock.style.borderLeft = '4px solid var(--brand-blue)';
        } else {
          deckBlock.style.borderLeft = 'none';
        }

        if (val.includes('engineer') || val.includes('oiler') || val.includes('motor') || val.includes('fitter') || val.includes('welder')) {
          engBlock.style.borderLeft = '4px solid var(--brand-blue)';
        } else {
          engBlock.style.borderLeft = 'none';
        }

        if (val.includes('eto') || val.includes('electrical')) {
          elecBlock.style.borderLeft = '4px solid var(--brand-blue)';
        } else {
          elecBlock.style.borderLeft = 'none';
        }
      }
    }
  }

  /* ==========================================================================
     5. DYNAMIC TABLES (SEA SERVICE, DEPENDENTS, EDUCATION)
     ========================================================================== */
  function initDynamicTables() {
    // Add Sea Service Row Button
    const addSeaBtn = document.getElementById('addSeaServiceBtn');
    if (addSeaBtn) {
      addSeaBtn.addEventListener('click', () => {
        addSeaServiceRow();
        scheduleAutosave();
      });
    }

    // Add Family Row Button
    const addFamBtn = document.getElementById('addFamilyRowBtn');
    if (addFamBtn) {
      addFamBtn.addEventListener('click', () => {
        addFamilyRow();
        scheduleAutosave();
      });
    }

    // Add Education Row Button
    const addEduBtn = document.getElementById('addEduRowBtn');
    if (addEduBtn) {
      addEduBtn.addEventListener('click', () => {
        addEduRow();
        scheduleAutosave();
      });
    }

    // Event delegation for Remove Row buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-row')) {
        const row = e.target.closest('tr');
        const tbody = row?.parentElement;
        if (row && tbody) {
          if (tbody.children.length > 1) {
            row.remove();
            reindexTable(tbody);
            reindexSeaServiceRows();
            scheduleAutosave();
          } else {
            showAlert('At least one row must remain in this table.', 'info');
          }
        }
      }
    });
  }

  function addSeaServiceRow() {
    if (!seaServiceTableBody) return;
    const count = seaServiceTableBody.children.length + 1;
    if (count > 10) {
      showAlert('Maximum of 10 sea service vessels reached.', 'info');
      return;
    }

    const tr = document.createElement('tr');
    tr.className = 'sea-row';
    tr.innerHTML = `
      <td style="text-align:center;font-weight:700;">${count}</td>
      <td><input type="text" name="sea_owner_${count}" placeholder="Owner / Manager"></td>
      <td><input type="text" name="sea_vessel_${count}" placeholder="Vessel Name"></td>
      <td><input type="text" name="sea_built_${count}" placeholder="Year" style="width:65px;"></td>
      <td>
        <select name="sea_type_${count}" style="min-width:110px;">
          <option value="">Type</option>
          <option value="Bulk Carrier">Bulk</option>
          <option value="Oil Tanker">Oil Tanker</option>
          <option value="Chemical Tanker">Chemical</option>
          <option value="LPG/LNG">Gas Tanker</option>
          <option value="Container">Container</option>
          <option value="General Cargo">Gen Cargo</option>
          <option value="Offshore AHTS/PSV">Offshore</option>
          <option value="Tug/Barge">Tug</option>
        </select>
      </td>
      <td><input type="text" name="sea_grt_${count}" placeholder="GRT" style="width:75px;"></td>
      <td><input type="text" name="sea_dwt_${count}" placeholder="DWT" style="width:75px;"></td>
      <td><input type="text" name="sea_engine_${count}" placeholder="e.g. MAN B&W" style="min-width:90px;"></td>
      <td><input type="text" name="sea_bhp_${count}" placeholder="BHP" style="width:70px;"></td>
      <td><input type="text" name="sea_rank_${count}" placeholder="Rank" style="min-width:80px;"></td>
      <td><input type="date" name="sea_from_${count}" class="sea-date-from"></td>
      <td><input type="date" name="sea_to_${count}" class="sea-date-to"></td>
      <td><input type="text" name="sea_total_${count}" class="sea-duration-calc" placeholder="MM/DD" readonly style="width:70px;background:#f8fafc;font-weight:600;"></td>
      <td><input type="text" name="sea_reason_${count}" placeholder="Sign-off reason" style="min-width:110px;"></td>
      <td style="text-align:center;"><button type="button" class="btn-remove-row" title="Delete row">×</button></td>
    `;
    seaServiceTableBody.appendChild(tr);
    initCalculationListeners();
  }

  function reindexSeaServiceRows() {
    if (!seaServiceTableBody) return;
    Array.from(seaServiceTableBody.children).forEach((row, idx) => {
      const numCell = row.children[0];
      if (numCell) numCell.textContent = idx + 1;
    });
  }

  function addFamilyRow() {
    if (!familyTableBody) return;
    const count = familyTableBody.children.length + 1;
    if (count > 12) return showAlert('Maximum of 12 family records reached.', 'info');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <select name="fam_rel_${count}" style="min-width:100px;">
          <option value="Child (M)">Child (M)</option>
          <option value="Child (F)">Child (F)</option>
          <option value="Wife">Wife</option>
          <option value="Father">Father</option>
          <option value="Mother">Mother</option>
        </select>
      </td>
      <td><input type="text" name="fam_name_${count}" placeholder="Full Name"></td>
      <td><input type="date" name="fam_anniv_${count}"></td>
      <td><input type="date" name="fam_dob_${count}"></td>
      <td><input type="text" name="fam_ppt_${count}" placeholder="Passport No"></td>
      <td><input type="date" name="fam_doi_${count}"></td>
      <td><input type="text" name="fam_poi_${count}" placeholder="Place of Issue"></td>
      <td><input type="date" name="fam_doe_${count}"></td>
      <td>
        <select name="fam_ecnr_${count}" style="width:70px;">
          <option value="YES">YES</option>
          <option value="NO">NO</option>
        </select>
      </td>
      <td style="text-align:center;"><button type="button" class="btn-remove-row" title="Delete row">×</button></td>
    `;
    familyTableBody.appendChild(tr);
  }

  function addEduRow() {
    if (!eduTableBody) return;
    const count = eduTableBody.children.length + 1;
    if (count > 12) return showAlert('Maximum of 12 education records reached.', 'info');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" name="edu_school_${count}" placeholder="School / College / University"></td>
      <td><input type="date" name="edu_from_${count}" style="width:130px;"></td>
      <td><input type="date" name="edu_to_${count}" style="width:130px;"></td>
      <td><input type="text" name="edu_degree_${count}" placeholder="Qualification / Degree"></td>
      <td style="text-align:center;"><button type="button" class="btn-remove-row" title="Delete row">×</button></td>
    `;
    eduTableBody.appendChild(tr);
  }

  /* ==========================================================================
     6. SEA-TIME AUTOMATIC DURATION CALCULATOR
     ========================================================================== */
  function initCalculationListeners() {
    const fromInputs = document.querySelectorAll('.sea-date-from');
    const toInputs = document.querySelectorAll('.sea-date-to');

    fromInputs.forEach((input) => {
      input.removeEventListener('change', calculateSeaTimeForRow);
      input.addEventListener('change', calculateSeaTimeForRow);
    });

    toInputs.forEach((input) => {
      input.removeEventListener('change', calculateSeaTimeForRow);
      input.addEventListener('change', calculateSeaTimeForRow);
    });
  }

  function calculateSeaTimeForRow(e) {
    const row = e.target.closest('tr');
    if (!row) return;

    const fromDateVal = row.querySelector('.sea-date-from')?.value;
    const toDateVal = row.querySelector('.sea-date-to')?.value;
    const calcInput = row.querySelector('.sea-duration-calc');

    if (!calcInput) return;

    if (fromDateVal && toDateVal) {
      const d1 = new Date(fromDateVal);
      const d2 = new Date(toDateVal);

      if (d2 >= d1) {
        // Difference in months & days
        let months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        let days = d2.getDate() - d1.getDate();

        if (days < 0) {
          months -= 1;
          const prevMonthLastDay = new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
          days += prevMonthLastDay;
        }

        calcInput.value = `${months}M ${days}D`;
      } else {
        calcInput.value = 'Invalid';
      }
    } else {
      calcInput.value = '';
    }
  }

  function recalculateAllSeaTimes() {
    document.querySelectorAll('.sea-row').forEach((row) => {
      const from = row.querySelector('.sea-date-from');
      if (from) {
        calculateSeaTimeForRow({ target: from });
      }
    });
  }

  /* ==========================================================================
     7. ALERT / NOTIFICATION BANNER HELPER
     ========================================================================== */
  function showAlert(msg, type = 'error') {
    if (!appAlertBox) return;
    appAlertBox.className = `form-alert ${type}-alert`;
    appAlertBox.textContent = msg;
    appAlertBox.style.display = 'block';
    appAlertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    if (appAlertBox) {
      appAlertBox.style.display = 'none';
    }
  }

  function addExtraRow(group) {
    const spec = schema.repeats[group];
    const body = document.getElementById(group+'TableBody');
    if (!body || body.children.length >= spec.max) return;
    const row = document.createElement('tr');
    const n = body.children.length + 1;
    spec.fields.forEach(name => {
      const cell = row.insertCell();
      const input = document.createElement('input');
      input.name = name+'_'+n;
      input.type = /_(doi|doe)$/.test(name) ? 'date' : 'text';
      input.maxLength = 120;
      input.setAttribute('aria-label', name.replaceAll('_', ' '));
      cell.appendChild(input);
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'btn-remove-row'; remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remove record'); row.insertCell().appendChild(remove);
    body.appendChild(row);
  }

  function reindexTable(body) {
    Array.from(body.children).forEach((row, index) => {
      row.querySelectorAll('input, select').forEach(input => {
        input.name = input.name.replace(/_\d+$/, '_'+(index+1));
      });
    });
  }

  function collectData() {
    const data = Object.fromEntries(new FormData(form));
    for (const [group, spec] of Object.entries(schema.repeats)) {
      const id = {family:'familyTableBody', education:'eduTableBody', sea_service:'seaServiceTableBody'}[group] || group+'TableBody';
      data[spec.key] = [];
      document.querySelectorAll('#'+id+' tr').forEach(row => {
        const entry = {};
        row.querySelectorAll('input, select').forEach(input => { entry[input.name.replace(/_\d+$/, '')] = input.value.trim(); });
        if (spec.fields.some(key => !['fam_rel', 'fam_ecnr', 'sea_total'].includes(key) && entry[key])) data[spec.key].push(entry);
      });
    }
    return data;
  }

  function displayErrors(errors) {
    form.querySelectorAll('.field-invalid').forEach(input => { input.classList.remove('field-invalid'); input.removeAttribute('aria-invalid'); });
    let first;
    for (const [key, message] of Object.entries(errors)) {
      let input = form.querySelector(`[name="${key}"]`);
      const parts = key.split('.');
      if (!input && parts.length === 3) {
        const group = Object.entries(schema.repeats).find(([, s]) => s.key === parts[0])?.[0];
        const id = {family:'familyTableBody',education:'eduTableBody',sea_service:'seaServiceTableBody'}[group] || group+'TableBody';
        const rows = Array.from(document.querySelectorAll('#'+id+' tr')).filter(row => Array.from(row.querySelectorAll('input')).some(el => el.value.trim()));
        input = rows[Number(parts[1])]?.querySelector(`[name^="${parts[2]}_"]`);
      }
      if (input) { input.classList.add('field-invalid'); input.setAttribute('aria-invalid', 'true'); if (!first) first = input; }
    }
    if (first) { showStep(Number(first.closest('[data-step]')?.dataset.step || currentStep)); first.focus(); }
    showAlert(Object.values(errors)[0], 'error');
  }

  /* ==========================================================================
     8. FINAL FORM SUBMISSION PIPELINE (AJAX / FETCH)
     ========================================================================== */
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmitting || !schema) return;
      for (let step = 1; step <= TOTAL_STEPS; step++) {
        const errors = ApplicationValidation.validate(collectData(), schema, step);
        if (Object.keys(errors).length) { showStep(step); displayErrors(errors); return; }
      }

      // Final Step Validation
      if (!validateStep(currentStep)) {
        return;
      }

      // Check required declarations
      const decl1 = document.getElementById('declTruth');
      const decl2 = document.getElementById('declSocial');
      const decl3 = document.getElementById('declZeroFee');

      if (!decl1?.checked || !decl2?.checked || !decl3?.checked) {
        showAlert('⚠️ You must accept all declarations and affirm the zero-recruitment fee policy before submitting.', 'error');
        return;
      }

      // Check CV Attachment
      const cvFileInput = document.getElementById('cvFile');
      if (!cvFileInput || !cvFileInput.files || cvFileInput.files.length === 0) {
        showAlert('⚠️ Please attach your Curriculum Vitae (CV) in Step 7 before submitting.', 'error');
        showStep(7);
        return;
      }

      // Disable Submit Button & Show Spinner
      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>⏳ Transmitting Application Dossier...</span>`;
      }
      hideAlert();

      try {
        const formData = new FormData(form);
        formData.append('application_type', 'full_rps_01_a');

        // Submit the same complete repeat records used by validation.
        const allData = collectData();
        for (const spec of Object.values(schema.repeats)) formData.set(spec.key, JSON.stringify(allData[spec.key]));

        // Submit via Fetch
        const response = await fetch('/submit_application.php', {
          method: 'POST',
          body: formData,
          headers: {
            Accept: 'application/json',
            'Idempotency-Key': submissionKey
          }
        });

        const result = await response.json().catch(() => null);

        if (response.ok && result && result.success) {
          if (!/^SS-APP-\d{4}-[A-F0-9]{12}$/.test(result.refNumber || '') || !/^\/download_application\.php\?token=[a-f0-9]{64}$/.test(result.downloadUrl || '')) throw new Error('Incomplete server acknowledgement');
          // Transmission Succeeded!
          clearTimeout(autosaveTimer);
          try { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(KEY_STORAGE); } catch { /* Completion does not depend on browser storage. */ }
          renderSuccessView(result.refNumber, result.downloadUrl);
        } else {
          // Server returned an error message
          const err = result?.error || 'A server communication error occurred during transmission.';
          if (result?.errors) displayErrors(result.errors);
          else showAlert('Submission error: '+err, 'error');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Submit Bio-Data Application</span>`;
          }
        }
      } catch (networkError) {
        console.error('[RPS 01-A] Network Error:', networkError);
        showAlert('Unable to confirm submission. Your form is retained. Retry with the same data and CV; this will not create a duplicate.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Submit Bio-Data Application</span>`;
        }
      } finally { isSubmitting = false; }
    });
  }

  function renderSuccessView(refNumber, downloadUrl) {
    const card = document.querySelector('.apply-card');
    if (!card) return;

    const downloadButtonHtml = downloadUrl ? `
      <a href="${downloadUrl}" class="btn-print-bio" style="text-decoration:none;background:var(--brand-royal,#183358);color:#fff;display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:4px;font-weight:700;box-shadow:0 4px 12px rgba(24,51,88,0.25);" download>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Completed Form RPS 01-A (.docx)
      </a>
    ` : '';

    card.innerHTML = `
      <div class="submission-success-card">
        <div class="success-icon-badge">✓</div>
        <h2>Application Successfully Enrolled</h2>
        <p style="color:var(--fog);font-size:14px;max-width:620px;margin:0 auto 16px auto;">
          Your official seafarer bio-data (Form RPS 01-A) has been securely validated, stored in our maritime recruitment database, and mapped to the official <b>Form RPS 01-A</b> format.
        </p>

        <div class="submission-ref-box">
          Official Reference No: <span>${refNumber}</span>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:4px;max-width:640px;margin:0 auto 28px auto;text-align:left;font-size:13px;line-height:1.7;">
          <b style="color:#0f172a;">Application Status &amp; Next Steps:</b>
          <ul style="margin:8px 0 0 18px;list-style:disc;color:#334155;">
            <li>Your completed application document has been automatically generated and connected to your record in private storage.</li>
            <li>Our crewing staff will review your application.</li>
            <li>Your private Word download link expires in one hour. Keep your application number for future enquiries.</li>
          </ul>
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;">
          ${downloadButtonHtml}
          <button type="button" class="btn-print-bio" onclick="window.print()" style="background:#f1f5f9;color:#1e293b;border:1px solid #cbd5e1;">
            🖨️ Print Form RPS 01-A (A4)
          </button>
          <a href="index.html" class="btn-prev" style="text-decoration:none;">
            ← Return to Fleet Homepage
          </a>
        </div>
      </div>
    `;

    // Hide draft bar & wizard nav
    const draftBar = document.querySelector('.draft-bar');
    const navWrap = document.querySelector('.wizard-nav-wrap');
    if (draftBar) draftBar.style.display = 'none';
    if (navWrap) navWrap.style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

})();
