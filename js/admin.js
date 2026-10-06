/**
 * Sea & Seas Shipping Private Limited
 * Crewing Desk Admin Portal Controller
 */

(function () {
  'use strict';

  try { localStorage.removeItem('seaandseas_admin_token'); } catch { /* Staff authentication uses server sessions. */ }
  let csrf = '';
  let pageOffset = 0;

  // Call PHP directly so staff access also works without /api rewrite rules.
  function apiUrl(route, params = new URLSearchParams()) {
    const url = new URL('/api.php', window.location.href);
    url.search = params.toString();
    url.searchParams.set('route', route);
    return url.href;
  }

  async function responseData(response) {
    if (!response.headers.get('Content-Type')?.includes('application/json')) {
      throw new Error('The sign-in service is unavailable. Open this page through the PHP website server and check its configuration.');
    }
    return response.json();
  }

  function showLoginError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
  }

  // DOM Elements
  const loginScreen = document.getElementById('loginScreen');
  const adminApp = document.getElementById('adminApp');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  const searchInput = document.getElementById('searchInput');
  const rankFilter = document.getElementById('rankFilter');
  const statusFilter = document.getElementById('statusFilter');
  const refreshBtn = document.getElementById('refreshBtn');
  const tableBody = document.getElementById('applicationsTableBody');

  const statTotal = document.getElementById('statTotal');
  const statNew = document.getElementById('statNew');
  const statReview = document.getElementById('statReview');
  const statShortlisted = document.getElementById('statShortlisted');

  const dossierModal = document.getElementById('dossierModal');
  const dossierTitle = document.getElementById('dossierTitle');
  const dossierRef = document.getElementById('dossierRef');
  const dossierBody = document.getElementById('dossierBody');
  const closeDossierBtn = document.getElementById('closeDossierBtn');

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    verifyAndLoad();

    initListeners();
  });

  function initListeners() {
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.style.display = 'none';

      const username = document.getElementById('usernameInput')?.value;
      const password = document.getElementById('passwordInput')?.value;
      const button = loginForm.querySelector('button[type="submit"]');
      if (button.disabled) return;
      const label = button.textContent;
      button.disabled = true;
      button.textContent = 'Signing in…';

      try {
        const res = await fetch(apiUrl('admin/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await responseData(res);

        if (res.ok && data.success && data.csrf) {
          const session = await fetch(apiUrl('admin/me'));
          if (session.status === 401) throw new Error('Your sign-in session could not be saved. Enable cookies and use HTTPS on the hosted website; localhost HTTP needs local server configuration.');
          if (!session.ok) throw new Error((await responseData(session)).error || 'The sign-in session could not be verified.');
          csrf = data.csrf;
          document.getElementById('passwordInput').value = '';
          showApp();
          loadApplications();
        } else {
          showLoginError(data.error || 'Authentication failed.');
        }
      } catch (err) {
        showLoginError(err instanceof TypeError ? 'Cannot connect to the sign-in service. Open this page through the PHP website server.' : err.message);
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });

    logoutBtn?.addEventListener('click', async () => {
      await fetch(apiUrl('admin/logout'), {method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{}'});
      csrf = '';
      dossierModal.style.display = 'none'; dossierBody.textContent = ''; tableBody.textContent = '';
      showLogin();
    });

    refreshBtn?.addEventListener('click', loadApplications);

    let searchTimeout = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { pageOffset = 0; loadApplications(); }, 300);
    });

    rankFilter?.addEventListener('change', () => { pageOffset = 0; loadApplications(); });
    statusFilter?.addEventListener('change', () => { pageOffset = 0; loadApplications(); });

    closeDossierBtn?.addEventListener('click', () => {
      dossierModal.style.display = 'none';
    });

    dossierModal?.addEventListener('click', (e) => {
      if (e.target === dossierModal) {
        dossierModal.style.display = 'none';
      }
    });
  }

  async function verifyAndLoad() {
    try {
      const res = await fetch(apiUrl('admin/me'));
      if (res.ok) {
        const data = await res.json(); csrf = data.csrf;
        showApp();
        loadApplications();
      } else {
        csrf = '';
        showLogin();
        if (res.status !== 401) showLoginError((await responseData(res)).error || 'The sign-in service is unavailable.');
      }
    } catch (e) {
      showLogin();
      showLoginError(e instanceof TypeError ? 'Cannot connect to the sign-in service. Open this page through the PHP website server.' : e.message);
    }
  }

  function showLogin() {
    loginScreen.style.display = 'block';
    adminApp.style.display = 'none';
  }

  function showApp() {
    loginScreen.style.display = 'none';
    adminApp.style.display = 'block';
  }

  async function loadApplications() {
    const search = searchInput?.value.trim() || '';
    const rank = rankFilter?.value || '';
    const status = statusFilter?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (rank) params.append('rank', rank);
    if (status) params.append('status', status);
    params.set('limit', '50'); params.set('offset', String(pageOffset));

    try {
      const res = await fetch(apiUrl('admin/applications', params));

      if (!res.ok) {
        if (res.status === 401) {
          showLogin();
          return;
        }
        throw new Error('Failed to load records.');
      }

      const data = await res.json();
      renderTable(data.items || []);
      updateStats(data.items || []);
      let pager = document.getElementById('applicationPager');
      if (!pager) { pager = document.createElement('div'); pager.id = 'applicationPager'; tableBody.closest('.table-container, .table-responsive')?.after(pager); if (!pager.isConnected) tableBody.closest('table').after(pager); }
      pager.textContent = `${data.total} applications • Showing ${Math.min(pageOffset+1,data.total)}–${Math.min(pageOffset+50,data.total)} `;
      for (const [label, offset] of [['Previous', pageOffset-50], ['Next', pageOffset+50]]) {
        const button = document.createElement('button'); button.className = 'btn-action'; button.textContent = label;
        button.disabled = offset < 0 || offset >= data.total;
        button.addEventListener('click', () => { pageOffset = offset; loadApplications(); }); pager.appendChild(button);
      }
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  }

  function updateStats(items) {
    if (statTotal) statTotal.textContent = items.length;
    let newCount = 0;
    let reviewCount = 0;
    let shortCount = 0;

    items.forEach(it => {
      if (it.status === 'submitted') newCount++;
      if (it.status === 'under_review') reviewCount++;
      if (it.status === 'shortlisted') shortCount++;
    });

    if (statNew) statNew.textContent = newCount;
    if (statReview) statReview.textContent = reviewCount;
    if (statShortlisted) statShortlisted.textContent = shortCount;
  }

  function renderTable(items) {
    if (!items.length) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:36px;color:var(--admin-sub);">No seafarer applications found matching criteria.</td></tr>`;
      return;
    }

    tableBody.innerHTML = items.map(item => {
      const dateFormatted = new Date(item.submittedAt).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      const lowerAcceptable = item.rankLowerAcceptable === 'YES'
        ? '<span style="font-size:10px;color:#fbbf24;display:block;">(Accepts lower rank)</span>'
        : '';

      const docxDownloadUrl = escapeHtml(apiUrl(`admin/applications/${item.id}/download/docx`));
      const cvDownloadUrl = escapeHtml(apiUrl(`admin/applications/${item.id}/download/cv`));

      return `
        <tr data-id="${item.id}">
          <td><span class="ref-badge">${item.refNumber}</span></td>
          <td>
            <strong style="color:#fff;display:block;">${escapeHtml(item.fullName)}</strong>
            <span style="font-size:11px;color:var(--admin-sub);">${escapeHtml(item.email)}</span>
          </td>
          <td>
            <strong>${escapeHtml(item.positionApplied)}</strong>
            ${lowerAcceptable}
          </td>
          <td>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:11.5px;">${escapeHtml(item.indosNumber || item.cdcNumber || '-')}</span>
          </td>
          <td>${escapeHtml(item.phone)}</td>
          <td>${dateFormatted}</td>
          <td>
            <select class="admin-select" style="padding:4px 8px;font-size:11px;" ${!item.hasDocx?'disabled':''} onchange="updateApplicationStatus('${item.id}', this.value)">
              ${!item.hasDocx?`<option>${escapeHtml(item.status)}</option>`:''}
              <option value="submitted" ${item.status === 'submitted' ? 'selected' : ''}>Submitted</option>
              <option value="under_review" ${item.status === 'under_review' ? 'selected' : ''}>Under Review</option>
              <option value="shortlisted" ${item.status === 'shortlisted' ? 'selected' : ''}>Shortlisted</option>
              <option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>Rejected</option>
            </select>
          </td>
          <td style="text-align:right;white-space:nowrap;">
            <button type="button" class="btn-action" onclick="viewDossier('${item.id}')">
              👁️ View Bio-Data
            </button>
            ${item.hasDocx?`<a href="${docxDownloadUrl}" class="btn-action btn-docx" title="Download Form RPS 01-A (Word Document)" download>
              📑 Form RPS 01-A (.docx)
            </a>`:''}
            <a href="${cvDownloadUrl}" class="btn-action" title="Download Candidate Uploaded CV" download>
              📄 CV (${item.cvSizeKb} KB)
            </a>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.updateApplicationStatus = async function (id, newStatus) {
    try {
      const res = await fetch(apiUrl(`admin/applications/${id}/status`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) alert('Failed to update status.');
    } catch (e) {
      alert('Error communicating with server.');
    }
  };

  window.viewDossier = async function (id) {
    try {
      const res = await fetch(apiUrl(`admin/applications/${id}`));
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to load details.');
        return;
      }

      const app = data.application;
      const raw = app.rawData || {};
      Object.assign(app, {rankLowerAcceptable:raw.accept_lower_rank,dateAvailability:raw.date_availability,dob:raw.dob,nationality:raw.nationality,cdcNumber:raw.cdc_indian_no,passportNumber:raw.passport_no});

      dossierTitle.textContent = `${app.fullName} - ${app.positionApplied}`;
      dossierRef.textContent = `Ref: ${app.refNumber} • Applied: ${new Date(app.submittedAt).toLocaleString()}`;

      // Build rich dossier view
      dossierBody.innerHTML = `
        <div class="dossier-sec">
          <div class="dossier-title">1. Position &amp; Personal Identification</div>
          <div class="dossier-grid">
            <div class="dossier-item"><span>Position Applied</span><strong>${escapeHtml(app.positionApplied)}</strong></div>
            <div class="dossier-item"><span>Accept Lower Rank</span><strong>${escapeHtml(app.rankLowerAcceptable)}</strong></div>
            <div class="dossier-item"><span>Availability Date</span><strong>${escapeHtml(app.dateAvailability || 'Immediate')}</strong></div>
            <div class="dossier-item"><span>Date of Birth</span><strong>${escapeHtml(app.dob || '-')}</strong></div>
            <div class="dossier-item"><span>Place of Birth</span><strong>${escapeHtml(raw.pob || '-')}</strong></div>
            <div class="dossier-item"><span>Nationality</span><strong>${escapeHtml(app.nationality || 'Indian')}</strong></div>
            <div class="dossier-item"><span>Marital Status</span><strong>${escapeHtml(raw.marital_status || '-')}</strong></div>
            <div class="dossier-item"><span>Nearest Airport</span><strong>${escapeHtml(raw.nearest_airport || '-')}</strong></div>
            <div class="dossier-item"><span>Height / Weight</span><strong>${escapeHtml(raw.height_cm || '-')} cm / ${escapeHtml(raw.weight_kg || '-')} kg</strong></div>
            <div class="dossier-item"><span>Boiler Suit &bull; Shoes</span><strong>Size ${escapeHtml(raw.boiler_suit_size || '-')} &bull; Shoe ${escapeHtml(raw.shoe_size || '-')}</strong></div>
          </div>
          <div style="margin-top:12px;font-size:12px;">
            <div style="color:var(--admin-sub);">Permanent Address:</div>
            <div style="color:#fff;margin-top:2px;">${escapeHtml(raw.permanent_address || '-')} (PIN: ${escapeHtml(raw.permanent_postcode || '-')})</div>
          </div>
        </div>

        <div class="dossier-sec">
          <div class="dossier-title">2. Next of Kin &amp; Family Dependents</div>
          <div class="dossier-grid">
            <div class="dossier-item"><span>Next of Kin Name</span><strong>${escapeHtml(raw.kin_name || '-')}</strong></div>
            <div class="dossier-item"><span>Relationship</span><strong>${escapeHtml(raw.kin_relationship || '-')}</strong></div>
            <div class="dossier-item"><span>Kin Telephone</span><strong>${escapeHtml(raw.kin_phone_primary || '-')}</strong></div>
            <div class="dossier-item"><span>Kin Address</span><strong>${escapeHtml(raw.kin_address || '-')}</strong></div>
          </div>
        </div>

        <div class="dossier-sec">
          <div class="dossier-title">3. Maritime Registry (INDOS, CDC &amp; CoC)</div>
          <div class="dossier-grid">
            <div class="dossier-item"><span>INDOS Number</span><strong style="color:var(--admin-lime);font-family:'IBM Plex Mono';">${escapeHtml(app.indosNumber || '-')}</strong></div>
            <div class="dossier-item"><span>Indian CDC No</span><strong>${escapeHtml(app.cdcNumber || '-')}</strong></div>
            <div class="dossier-item"><span>Passport Number</span><strong>${escapeHtml(app.passportNumber || '-')}</strong></div>
            <div class="dossier-item"><span>Passport Expiry</span><strong>${escapeHtml(raw.passport_doe || '-')}</strong></div>
            <div class="dossier-item"><span>Indian CoC</span><strong>${escapeHtml(raw.coc_indian_no || '-')} (${escapeHtml(raw.coc_indian_rank || '-')})</strong></div>
            <div class="dossier-item"><span>Panama / Foreign CoC</span><strong>${escapeHtml(raw.coc_panama_no || raw.coc_other_no || '-')}</strong></div>
          </div>
        </div>

        <div class="dossier-sec">
          <div class="dossier-title">4. Wages &amp; Banking Details</div>
          <div class="dossier-grid">
            <div class="dossier-item"><span>Last Drawn Wages</span><strong>${escapeHtml(raw.last_drawn_wages || '-')}</strong></div>
            <div class="dossier-item"><span>Expected Wages</span><strong>${escapeHtml(raw.expected_wages || '-')}</strong></div>
            <div class="dossier-item"><span>Savings Bank &amp; Account</span><strong>${escapeHtml(raw.bank_name || '-')} • A/C ${escapeHtml(raw.bank_account_no || '-')}</strong></div>
            <div class="dossier-item"><span>Bank IFSC Code</span><strong>${escapeHtml(raw.bank_ifsc || '-')}</strong></div>
            <div class="dossier-item"><span>NRI Account</span><strong>${escapeHtml(raw.nri_bank_name || 'None')} (${escapeHtml(raw.nri_account_no || '-')})</strong></div>
          </div>
        </div>

        <div class="dossier-sec">
          <div class="dossier-title">5. Technical Experience &amp; Vetting</div>
          <div class="dossier-grid">
            <div class="dossier-item"><span>Trading Areas</span><strong>${escapeHtml(raw.trading_areas || 'Worldwide')}</strong></div>
            <div class="dossier-item"><span>CDI Inspection</span><strong>${escapeHtml(raw.cdi_inspection || 'No')} (${escapeHtml(raw.cdi_details || '-')})</strong></div>
            <div class="dossier-item"><span>Oil Major Inspections</span><strong>${escapeHtml(raw.oil_major_inspections || '-')}</strong></div>
            <div class="dossier-item"><span>Drydocking Experience</span><strong>${escapeHtml(raw.drydock_experience || '-')}</strong></div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:16px;">
          <a href="${escapeHtml(apiUrl(`admin/applications/${app.id}/download/docx`))}" class="btn-action btn-docx" style="padding:10px 18px;font-size:13px;" download>
            📥 Download Form RPS 01-A (DOCX)
          </a>
          <a href="${escapeHtml(apiUrl(`admin/applications/${app.id}/download/cv`))}" class="btn-action" style="padding:10px 18px;font-size:13px;" download>
            📄 Download Uploaded CV
          </a>
        </div>
      `;

      const complete = document.createElement('details');
      const heading = document.createElement('summary'); heading.textContent = 'All submitted fields and repeatable records'; complete.appendChild(heading);
      for (const [name, value] of Object.entries(raw)) {
        if (value === '' || Array.isArray(value) && !value.length) continue;
        const block = document.createElement('div'); block.className = 'dossier-sec';
        const label = document.createElement('strong'); label.textContent = name.replaceAll('_', ' ');
        const content = document.createElement('pre'); content.style.whiteSpace = 'pre-wrap'; content.style.overflowWrap = 'anywhere';
        content.textContent = Array.isArray(value) ? value.map((row,i) => (i+1)+'. '+Object.entries(row).filter(([,v]) => v).map(([k,v]) => k.replaceAll('_',' ')+': '+v).join('\n')).join('\n\n') : String(value);
        block.append(label,content); complete.appendChild(block);
      }
      dossierBody.appendChild(complete);

      dossierModal.style.display = 'flex';
    } catch (e) {
      alert('Error fetching dossier.');
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
