/**
 * Sea & Seas Shipping Private Limited
 * Official Portal Logic & Interactivity
 */

document.addEventListener('DOMContentLoaded', () => {
  // Current Year & Dynamic Years of Excellence (Founding Year: 2008)
    const currentYear = new Date().getFullYear();
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = currentYear;

    const yearsExcellenceEl = document.getElementById('yearsExcellence');
    if (yearsExcellenceEl) {
      const foundingYear = 2008;
      const yearsInBusiness = Math.max(1, currentYear - foundingYear);
      yearsExcellenceEl.setAttribute('data-count', yearsInBusiness);
    }

    // Nav scroll state
    const nav = document.getElementById('siteNav');
    window.addEventListener('scroll', () => {
      nav.classList.toggle('solid', window.scrollY > 40);
    }, {passive:true});

    // Mobile nav toggle & drawer
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const navScrim = document.getElementById('navScrim');

    const closeNav = () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
      if (navScrim) navScrim.classList.remove('open');
      document.body.style.overflow = '';
    };

    const openNav = () => {
      navLinks.classList.add('open');
      navToggle.classList.add('active');
      navToggle.setAttribute('aria-expanded', 'true');
      if (navScrim) navScrim.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.contains('open');
      if (isOpen) {
        closeNav();
      } else {
        openNav();
      }
    });

    if (navScrim) {
      navScrim.addEventListener('click', closeNav);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        closeNav();
      }
    });

    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));

    // Service accordion with keyboard accessibility
    document.querySelectorAll('.service-row').forEach(row => {
      const toggle = () => {
        const isOpen = row.classList.contains('open');
        document.querySelectorAll('.service-row').forEach(r => {
          r.classList.remove('open');
          r.setAttribute('aria-expanded', 'false');
        });
        if(!isOpen){
          row.classList.add('open');
          row.setAttribute('aria-expanded', 'true');
        }
      };
      row.addEventListener('click', toggle);
      row.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          toggle();
        }
      });
    });

    // FAQ Accordion
    document.querySelectorAll('.faq-q').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.parentElement;
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if(!isOpen) item.classList.add('open');
      });
    });

    // Reveal on scroll
    const revealEls = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {threshold:0.12});
    revealEls.forEach(el => revealObserver.observe(el));

    // Counter animation
    const counters = document.querySelectorAll('[data-count]');
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          let cur = 0;
          const step = Math.max(1, Math.round(target/45));
          const tick = () => {
            cur += step;
            if(cur >= target){
              el.textContent = target.toLocaleString();
              return;
            }
            el.textContent = cur.toLocaleString();
            requestAnimationFrame(tick);
          };
          tick();
          counterObserver.unobserve(el);
        }
      });
    }, {threshold:0.5});
    counters.forEach(el => counterObserver.observe(el));

    // Bar chart animation
    const barChart = document.getElementById('barChart');
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.querySelectorAll('.bar-col').forEach((col, i) => {
            const val = parseFloat(col.dataset.val);
            const max = parseFloat(col.dataset.max);
            const pct = (val/max) * 100;
            setTimeout(() => {
              col.querySelector('.bar-fill').style.height = pct + '%';
              col.classList.add('animate');
            }, i * 110);
          });
          barObserver.unobserve(entry.target);
        }
      });
    }, {threshold:0.3});
    if(barChart) barObserver.observe(barChart);

    // Route diagram animation
    const routeSvg = document.getElementById('routeSvg');
    const routeObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('animate');
          routeObserver.unobserve(entry.target);
        }
      });
    }, {threshold:0.3});
    if(routeSvg) routeObserver.observe(routeSvg);

    // Contact Tabs (Guarded for single or dual tab setup)
    const tabOwner = document.getElementById('tabOwner');
    const tabCrew = document.getElementById('tabCrew');
    const panelOwner = document.getElementById('panelOwner');
    const panelCrew = document.getElementById('panelCrew');

    if(tabOwner && panelOwner){
      tabOwner.addEventListener('click', () => {
        tabOwner.classList.add('active');
        if(tabCrew) tabCrew.classList.remove('active');
        panelOwner.classList.add('active');
        if(panelCrew) panelCrew.classList.remove('active');
      });
    }

    if(tabCrew && panelCrew){
      tabCrew.addEventListener('click', () => {
        tabCrew.classList.add('active');
        if(tabOwner) tabOwner.classList.remove('active');
        panelCrew.classList.add('active');
        if(panelOwner) panelOwner.classList.remove('active');
      });
    }

    // --- CV FILE SELECTION, DRAG & DROP, AND VALIDATION ---
    const cvFile = document.getElementById('cvFile');
    const fileDropBox = document.getElementById('fileDropBox');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const fileError = document.getElementById('fileError');
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Megabytes
    const ALLOWED_EXTS = ['.pdf', '.doc', '.docx'];

    function validateSelectedFile(file) {
      if (fileError) {
        fileError.style.display = 'none';
        fileError.textContent = '';
      }
      if (fileDropBox) fileDropBox.classList.remove('has-file');

      if (!file) return false;

      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        if (fileError) {
          fileError.textContent = `❌ Invalid file type (${ext}). Only PDF and Word documents (.pdf, .doc, .docx) are accepted.`;
          fileError.style.display = 'block';
        }
        if (cvFile) cvFile.value = '';
        if (fileNameDisplay) fileNameDisplay.textContent = "📎 Click or drag & drop your CV (PDF/DOCX)";
        return false;
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        if (fileError) {
          fileError.textContent = `❌ File size exceeds 10MB limit (Selected file: ${sizeMb}MB). Please attach a compressed CV.`;
          fileError.style.display = 'block';
        }
        if (cvFile) cvFile.value = '';
        if (fileNameDisplay) fileNameDisplay.textContent = "📎 Click or drag & drop your CV (PDF/DOCX)";
        return false;
      }

      const sizeStr = file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        : (file.size / 1024).toFixed(0) + ' KB';

      if (fileNameDisplay) {
        fileNameDisplay.textContent = `📄 Selected: ${file.name} (${sizeStr})`;
      }
      if (fileDropBox) fileDropBox.classList.add('has-file');
      return true;
    }

    if (cvFile) {
      cvFile.addEventListener('change', () => {
        if (cvFile.files && cvFile.files[0]) {
          validateSelectedFile(cvFile.files[0]);
        }
      });
    }

    // Drag and Drop & Keyboard handlers on Dropzone
    if (fileDropBox && cvFile) {
      fileDropBox.addEventListener('click', () => {
        cvFile.click();
      });

      fileDropBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          cvFile.click();
        }
      });

      ['dragenter', 'dragover'].forEach(name => {
        fileDropBox.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fileDropBox.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        fileDropBox.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fileDropBox.classList.remove('dragover');
        });
      });

      fileDropBox.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          try {
            cvFile.files = dt.files;
          } catch(err) {
            // Fallback for browsers that disallow direct assignment to input.files
          }
          validateSelectedFile(dt.files[0]);
        }
      });
    }

    // Shipowner Form Submit (guarded if hidden/commented)
    const ownerForm = document.getElementById('ownerForm');
    const ownerAlert = document.getElementById('ownerAlert');
    if(ownerForm && ownerAlert){
      ownerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const refNum = "SS-REQ-" + Math.floor(100000 + Math.random() * 900000);
        ownerAlert.innerHTML = `<b>✓ Inquiry Received (Ref: ${refNum})</b>Thank you. Our crewing &amp; operations superintendent will review your vessel requirements and contact you within 24 hours.`;
        ownerAlert.style.display = "block";
        ownerForm.reset();
      });
    }

    // Seafarer Form Submit with Validation & Transmission
    const crewForm = document.getElementById('crewForm');
    const crewAlert = document.getElementById('crewAlert');
    const crewErrorAlert = document.getElementById('crewErrorAlert');
    const crewSubmitBtn = document.getElementById('crewSubmitBtn');

    if(crewForm){
      crewForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Reset alerts
        if (crewAlert) crewAlert.style.display = 'none';
        if (crewErrorAlert) crewErrorAlert.style.display = 'none';

        // 2. Anti-spam Honeypot Check
        const hpTrap = document.getElementById('hpTrap');
        if (hpTrap && hpTrap.value.trim() !== '') {
          console.warn('Submission halted: spam detected.');
          return;
        }

        // 3. HTML5 Constraint Validation
        if (!crewForm.checkValidity()) {
          crewForm.reportValidity();
          return;
        }

        // 4. Phone Number Format Validation (E.164 / maritime format)
        const phoneEl = document.getElementById('crewPhone');
        const phoneRegex = /^\+?[0-9\s\-]{8,18}$/;
        if (phoneEl && !phoneRegex.test(phoneEl.value.trim())) {
          phoneEl.setCustomValidity('Please enter a valid telephone / WhatsApp number (8 to 18 digits, e.g. +91 98201 55400).');
          phoneEl.reportValidity();
          return;
        } else if (phoneEl) {
          phoneEl.setCustomValidity('');
        }

        // 5. CV File Validation
        if (!cvFile || !cvFile.files || !cvFile.files[0]) {
          if (fileError) {
            fileError.textContent = '❌ Please upload your Curriculum Vitae / Resume before submitting.';
            fileError.style.display = 'block';
          }
          if (fileDropBox) fileDropBox.focus();
          return;
        }

        const validFile = validateSelectedFile(cvFile.files[0]);
        if (!validFile) return;

        // 6. Set Loading State & Prevent Duplicate Clicks
        const btnText = crewSubmitBtn ? crewSubmitBtn.querySelector('.btn-text') : null;
        const btnSpinner = crewSubmitBtn ? crewSubmitBtn.querySelector('.btn-spinner') : null;
        if (crewSubmitBtn) crewSubmitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnSpinner) btnSpinner.style.display = 'inline';

        const nameVal = document.getElementById('crewName')?.value.trim() || '';
        const rankVal = document.getElementById('crewRank')?.value || '';
        const emailVal = document.getElementById('crewEmail')?.value.trim() || '';
        const phoneVal = phoneEl ? phoneEl.value.trim() : '';
        const indosVal = document.getElementById('crewIndos')?.value.trim() || '';
        const expVal = document.getElementById('crewExp')?.value.trim() || 'None specified';
        const fileObj = cvFile.files[0];

        const appNum = "SS-APP-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);

        // 7. Store in Local Storage Roster
        try {
          const applicationRecord = {
            ref: appNum,
            timestamp: new Date().toISOString(),
            name: nameVal,
            rank: rankVal,
            email: emailVal,
            phone: phoneVal,
            indos: indosVal,
            seaTime: expVal,
            fileName: fileObj.name,
            fileSize: fileObj.size
          };
          const existing = JSON.parse(localStorage.getItem('seaandseas_applications') || '[]');
          existing.unshift(applicationRecord);
          localStorage.setItem('seaandseas_applications', JSON.stringify(existing.slice(0, 50)));
        } catch(e) {
          // localStorage error handling
        }

        // 8. Attempt Network Dispatch (Plesk PHP backend with graceful fallback)
        let transmittedViaApi = false;
        let finalRef = appNum;
        let serverErrorMsg = null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s network timeout

        try {
          const formData = new FormData(crewForm);
          const res = await fetch('submit_application.php', {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          const data = await res.json().catch(() => null);

          if (res.ok && data && data.success) {
            transmittedViaApi = true;
            if (data.refNumber) finalRef = data.refNumber;
          } else if (data && data.error) {
            serverErrorMsg = data.error;
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          // If offline, timeout, or static file server without PHP
          transmittedViaApi = false;
        }

        // 9. Display Feedback Based on Transmission Outcome
        if (serverErrorMsg) {
          if (crewErrorAlert) {
            crewErrorAlert.innerHTML = `
              <b>⚠️ Submission Issue</b>
              ${serverErrorMsg}<br>
              <div style="margin-top:8px;">
                You can also email your CV directly to <a href="mailto:crewing@seasshipping.com" style="color:var(--white);text-decoration:underline;">crewing@seasshipping.com</a>.
              </div>
            `;
            crewErrorAlert.style.display = "block";
            crewErrorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } else if (crewAlert) {
          if (transmittedViaApi) {
            // AUTOMATIC TRANSMISSION SUCCEEDED
            crewAlert.innerHTML = `
              <b>✓ Application &amp; CV Dispatched to Crewing Desk (Ref: ${finalRef})</b>
              Thank you, <b>${nameVal}</b>. Your application and CV (<b>${fileObj.name}</b>) have been successfully uploaded and delivered to <b>crewing@seasshipping.com</b>.<br>
              <div style="margin-top:8px;font-size:12.5px;color:rgba(255,255,255,0.9);">
                Our technical recruitment officers will review your INDOS/CDC &amp; sea-time records within 24–48 hours.
              </div>
              <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
                <a href="https://wa.me/919820155400?text=${encodeURIComponent('Hello Sea & Seas Crewing Desk, I submitted an application for ' + rankVal + ' (Ref: ' + finalRef + ').')}" target="_blank" rel="noopener" class="btn btn-primary" style="padding:8px 14px;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
                  💬 WhatsApp Crewing Desk (Instant Confirmation)
                </a>
              </div>
            `;
          } else {
            // FALLBACK ONLY WHEN AUTOMATIC SUBMISSION IS UNAVAILABLE
            const mailSubject = encodeURIComponent(`[Seafarer Application] ${rankVal} - ${nameVal} (Ref: ${finalRef})`);
            const mailBody = encodeURIComponent(
              `Dear Crewing Desk,\n\nPlease find attached my CV for the rank of ${rankVal}.\n\n` +
              `Candidate: ${nameVal}\n` +
              `Rank Applied For: ${rankVal}\n` +
              `INDOS / CDC No: ${indosVal}\n` +
              `Mobile / WhatsApp: ${phoneVal}\n` +
              `Email: ${emailVal}\n` +
              `Sea-Time Experience: ${expVal}\n` +
              `Application Ref: ${finalRef}\n\n` +
              `Regards,\n${nameVal}`
            );
            const emailHref = `mailto:crewing@seasshipping.com?subject=${mailSubject}&body=${mailBody}`;

            crewAlert.innerHTML = `
              <b>✓ Application Recorded (Ref: ${finalRef})</b>
              Your candidate profile for <b>${rankVal}</b> has been recorded in our intake roster.<br>
              <div style="margin-top:8px;font-size:12.5px;color:rgba(255,255,255,0.9);">
                📎 Attached Document: <b>${fileObj.name}</b> (${(fileObj.size / 1024).toFixed(0)} KB)<br>
                Automatic email delivery is currently offline. Please click below to send your CV directly to our crewing officers:
              </div>
              <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
                <a href="${emailHref}" class="btn btn-blue" style="padding:8px 14px;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
                  ✉️ Email CV Directly to Crewing Desk
                </a>
                <a href="https://wa.me/919820155400?text=${encodeURIComponent('Hello Sea & Seas Crewing Desk, I submitted an application for ' + rankVal + ' (Ref: ' + finalRef + ').')}" target="_blank" rel="noopener" class="btn btn-primary" style="padding:8px 14px;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
                  💬 WhatsApp Crewing Desk
                </a>
              </div>
            `;
          }

          crewAlert.style.display = "block";
          crewAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // 10. Reset Form & UI state
        crewForm.reset();
        if (fileNameDisplay) fileNameDisplay.textContent = "📎 Click or drag & drop your CV (PDF/DOCX)";
        if (fileDropBox) fileDropBox.classList.remove('has-file');

        // 11. Re-enable button
        if (crewSubmitBtn) crewSubmitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
      });
    }

    // WhatsApp Widget Toggle
    const waToggle = document.getElementById('waToggle');
    const waCard = document.getElementById('waCard');
    const waClose = document.getElementById('waClose');
    waToggle.addEventListener('click', () => {
      waCard.classList.toggle('open');
    });
    waClose.addEventListener('click', (e) => {
      e.stopPropagation();
      waCard.classList.remove('open');
    });

    // Automatic Hero Background Slider
    const heroSlides = document.querySelectorAll('.hero-slide');
    if (heroSlides.length > 1) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Asynchronously preload upcoming slide images
      heroSlides.forEach((slide, idx) => {
        if (idx > 0 && slide.dataset.bg) {
          const img = new Image();
          img.src = slide.dataset.bg;
          img.onload = () => {
            slide.style.backgroundImage = `url('${slide.dataset.bg}')`;
          };
        }
      });

      if (!prefersReducedMotion) {
        let currentSlide = 0;
        const totalSlides = heroSlides.length;
        const SLIDE_DURATION = 7000; // 7 seconds per slide

        setInterval(() => {
          if (document.hidden) return;
          heroSlides[currentSlide].classList.remove('active');
          currentSlide = (currentSlide + 1) % totalSlides;
          const nextSlide = heroSlides[currentSlide];
          if (nextSlide.dataset.bg && !nextSlide.style.backgroundImage) {
            nextSlide.style.backgroundImage = `url('${nextSlide.dataset.bg}')`;
          }
          nextSlide.classList.add('active');
        }, SLIDE_DURATION);
      }
    }
});
