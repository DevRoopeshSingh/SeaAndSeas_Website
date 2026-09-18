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

    // Dual-Track Contact Tabs
    const tabOwner = document.getElementById('tabOwner');
    const tabCrew = document.getElementById('tabCrew');
    const panelOwner = document.getElementById('panelOwner');
    const panelCrew = document.getElementById('panelCrew');

    tabOwner.addEventListener('click', () => {
      tabOwner.classList.add('active');
      tabCrew.classList.remove('active');
      panelOwner.classList.add('active');
      panelCrew.classList.remove('active');
    });

    tabCrew.addEventListener('click', () => {
      tabCrew.classList.add('active');
      tabOwner.classList.remove('active');
      panelCrew.classList.add('active');
      panelOwner.classList.remove('active');
    });

    // CV File selector feedback
    const cvFile = document.getElementById('cvFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if(cvFile){
      cvFile.addEventListener('change', () => {
        if(cvFile.files && cvFile.files[0]){
          fileNameDisplay.textContent = "📄 Selected: " + cvFile.files[0].name;
        }
      });
    }

    // Shipowner Form Submit
    const ownerForm = document.getElementById('ownerForm');
    const ownerAlert = document.getElementById('ownerAlert');
    ownerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const refNum = "SS-REQ-" + Math.floor(100000 + Math.random() * 900000);
      ownerAlert.innerHTML = `<b>✓ Inquiry Received (Ref: ${refNum})</b>Thank you. Our crewing &amp; operations superintendent will review your vessel requirements and contact you within 24 hours.`;
      ownerAlert.style.display = "block";
      ownerForm.reset();
    });

    // Seafarer Form Submit
    const crewForm = document.getElementById('crewForm');
    const crewAlert = document.getElementById('crewAlert');
    crewForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const appNum = "SS-APP-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);
      crewAlert.innerHTML = `<b>✓ Application Registered (Ref: ${appNum})</b>Your profile has been submitted to the Sea &amp; Seas crewing roster. Our recruitment officers will verify your INDOS &amp; sea-time records.`;
      crewAlert.style.display = "block";
      crewForm.reset();
      fileNameDisplay.textContent = "📎 Click or drag & drop your CV (PDF/DOCX)";
    });

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
