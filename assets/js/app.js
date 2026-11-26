// ============================================================================
// PTT PANAMÁ 3D — Application Controller
// Connects:
//  - 3D Interactive Panama Isthmus Scene (8 beacons incl. Colón Cruise Port)
//  - Smart Search & Multi-Faceted Filter Engine (Layover PTY + Colón Cruises)
//  - Direct WhatsApp Quote Builder (Zero public hardcoded prices)
//  - Authentic 3:4 Real Photo Gallery with Interactive Lightbox
//  - Complete Bilingual Switcher (ES / EN)
// ============================================================================

import {
  EXPERIENCES,
  FAQS,
  FLEET,
  I18N,
  PAYMENT_METHODS,
  QUOTE_ADDONS,
  REAL_GALLERY,
  TESTIMONIALS,
  TRANSFER_ROUTES,
} from './data.js?v=20261126';
import { Panama3DScene } from './scene3d.js?v=20261126';
import {
  buildQuoteText,
  createInitialQuoteState,
  renderQuoteReceiptHTML,
  summarizeQuote,
} from './quote.js?v=20261126';

const appState = {
  lang: localStorage.getItem('ptt_lang') === 'en' ? 'en' : 'es',
  activeExpId: 'city-tour',
  filters: {
    query: '',
    category: 'all',
    duration: 'all',
    profile: 'all',
    layoverOnly: false,
    cruiseOnly: false,
    sort: 'popular',
  },
  quote: createInitialQuoteState(),
  modalExpId: null,
  galleryGroup: 'all',
  lightboxIndex: null,
};

let scene3D = null;
let beaconPinEls = new Map();
let geoLabelEls = {};
let toastTimer = null;
let quoteSectionInView = false;

// ----------------------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  init3DScene();
  bindGlobalNavigation();
  bindSearchControls();
  bindQuoteControls();
  bindModalControls();
  bindLightboxControls();
  renderAll();
});

function init3DScene() {
  const host = document.getElementById('panama-3d-canvas');
  if (!host) return;

  const labelLayer = document.getElementById('panama-3d-labels');
  if (labelLayer) {
    labelLayer.innerHTML = '';
    EXPERIENCES.forEach((exp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-pin-label';
      btn.dataset.expId = exp.id;
      btn.innerHTML = `<span class="pin-dot"></span><span class="pin-name"></span>`;
      btn.addEventListener('click', () => select3DExperience(exp.id, true));
      labelLayer.appendChild(btn);
      beaconPinEls.set(exp.id, btn);
    });

    ['caribbean', 'pacific', 'canal'].forEach((k) => {
      const span = document.createElement('span');
      span.className = `geo-water-label geo-${k}`;
      labelLayer.appendChild(span);
      geoLabelEls[k] = span;
    });
  }

  scene3D = new Panama3DScene(host, {
    onSelect: (id) => {
      appState.activeExpId = id;
      render3DSpotlight();
      render3DPills();
    },
    onFrameLabels: (screenCoords, geoCoords) => {
      const filteredSet = new Set(getFilteredExperiences().map((e) => e.id));
      const hostW = host.clientWidth || 1200;
      const hostH = host.clientHeight || 720;
      const isDesktopHud = hostW >= 1100;
      beaconPinEls.forEach((el, id) => {
        const pt = screenCoords[id];
        if (!pt || !pt.visible) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }
        const isActive = id === appState.activeExpId;
        const isMatch = filteredSet.has(id);
        const underLeftHud = isDesktopHud && pt.x < hostW * 0.35 && pt.y < hostH * 0.66;
        const underRightHud = isDesktopHud && pt.x > hostW * 0.7 && pt.y < hostH * 0.64;
        const occluded = !isActive && (underLeftHud || underRightHud);
        el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -100%)`;
        el.style.opacity = isActive ? '1' : occluded ? '0.16' : isMatch ? '0.9' : '0.28';
        el.style.pointerEvents = occluded ? 'none' : 'auto';
        el.classList.toggle('is-active', isActive);
        el.classList.toggle('is-dimmed', !isMatch && !isActive);
      });

      Object.entries(geoCoords).forEach(([k, pt]) => {
        const el = geoLabelEls[k];
        if (!el) return;
        if (!pt || !pt.visible) {
          el.style.opacity = '0';
          return;
        }
        el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%)`;
        el.style.opacity = k === 'canal' ? '0.85' : '0.45';
      });
    },
  });

  document.querySelectorAll('[data-atmosphere]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.atmosphere;
      document.querySelectorAll('[data-atmosphere]').forEach((b) => b.classList.toggle('is-active', b === btn));
      scene3D?.applyAtmosphere(mode);
    });
  });

  const btnOrbit = document.getElementById('btn-toggle-orbit');
  btnOrbit?.addEventListener('click', () => {
    if (!scene3D) return;
    const next = !scene3D.autoRotate;
    scene3D.setAutoRotate(next);
    btnOrbit.classList.toggle('is-active', next);
    render3DHudText();
  });

  document.getElementById('btn-zoom-in')?.addEventListener('click', () => scene3D?.zoom(-1.25));
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => scene3D?.zoom(1.25));
  document.getElementById('btn-reset-3d')?.addEventListener('click', () => scene3D?.resetView());
}

function select3DExperience(id, fly = true) {
  appState.activeExpId = id;
  scene3D?.focusExperience(id, fly);
  render3DSpotlight();
  render3DPills();
}

// ----------------------------------------------------------------------------
// Global Navigation & Language Switcher
// ----------------------------------------------------------------------------
function bindGlobalNavigation() {
  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextLang = btn.dataset.langBtn;
      if (nextLang === appState.lang) return;
      appState.lang = nextLang;
      localStorage.setItem('ptt_lang', nextLang);
      document.documentElement.lang = nextLang;
      renderAll();
    });
  });

  const menuBtn = document.getElementById('btn-mobile-menu');
  const mobileDrawer = document.getElementById('mobile-nav-drawer');
  menuBtn?.addEventListener('click', () => {
    const open = mobileDrawer.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  mobileDrawer?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileDrawer.classList.remove('is-open');
      menuBtn?.setAttribute('aria-expanded', 'false');
    });
  });

  const header = document.getElementById('site-header');
  const onScroll = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 28);
    updateFloatingQuoteVisibility();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const quoteSectionEl = document.getElementById('cotizador');
  if (quoteSectionEl && 'IntersectionObserver' in window) {
    const qObs = new IntersectionObserver(
      (entries) => {
        quoteSectionInView = entries[0]?.isIntersecting ?? false;
        updateFloatingQuoteVisibility();
      },
      { threshold: 0.04 }
    );
    qObs.observe(quoteSectionEl);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const input = document.getElementById('search-input');
      input?.focus();
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (e.key === 'Escape') {
      if (appState.lightboxIndex !== null) closeLightbox();
      else if (appState.modalExpId) closeModal();
    }
    if (appState.lightboxIndex !== null) {
      if (e.key === 'ArrowRight') stepLightbox(1);
      if (e.key === 'ArrowLeft') stepLightbox(-1);
    }
  });
}

// ----------------------------------------------------------------------------
// Smart Search & Multi-Faceted Filter Engine
// ----------------------------------------------------------------------------
function bindSearchControls() {
  const searchInput = document.getElementById('search-input');
  searchInput?.addEventListener('input', (e) => {
    appState.filters.query = e.target.value;
    syncCatalogAndMap();
  });

  document.getElementById('search-clear-btn')?.addEventListener('click', () => {
    appState.filters.query = '';
    if (searchInput) searchInput.value = '';
    syncCatalogAndMap();
  });

  document.querySelectorAll('[data-quick-query]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const q = chip.dataset.quickQuery;
      appState.filters.query = q;
      if (searchInput) searchInput.value = q;
      syncCatalogAndMap();
    });
  });

  document.getElementById('btn-layover-toggle')?.addEventListener('click', () => {
    appState.filters.layoverOnly = !appState.filters.layoverOnly;
    if (appState.filters.layoverOnly) appState.filters.cruiseOnly = false;
    syncCatalogAndMap();
  });

  document.getElementById('btn-cruise-toggle')?.addEventListener('click', () => {
    appState.filters.cruiseOnly = !appState.filters.cruiseOnly;
    if (appState.filters.cruiseOnly) appState.filters.layoverOnly = false;
    syncCatalogAndMap();
  });

  document.getElementById('category-pills')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-category]');
    if (!btn) return;
    appState.filters.category = btn.dataset.category;
    syncCatalogAndMap();
  });

  document.getElementById('filter-duration')?.addEventListener('change', (e) => {
    appState.filters.duration = e.target.value;
    syncCatalogAndMap();
  });

  document.getElementById('filter-profile')?.addEventListener('change', (e) => {
    appState.filters.profile = e.target.value;
    syncCatalogAndMap();
  });

  document.getElementById('filter-sort')?.addEventListener('change', (e) => {
    appState.filters.sort = e.target.value;
    syncCatalogAndMap();
  });

  document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
}

function resetFilters() {
  appState.filters = {
    query: '',
    category: 'all',
    duration: 'all',
    profile: 'all',
    layoverOnly: false,
    cruiseOnly: false,
    sort: 'popular',
  };
  const input = document.getElementById('search-input');
  if (input) input.value = '';
  const dur = document.getElementById('filter-duration');
  if (dur) dur.value = 'all';
  const prof = document.getElementById('filter-profile');
  if (prof) prof.value = 'all';
  const sort = document.getElementById('filter-sort');
  if (sort) sort.value = 'popular';
  syncCatalogAndMap();
}

function getFilteredExperiences() {
  const { query, category, duration, profile, layoverOnly, cruiseOnly, sort } = appState.filters;
  const qNorm = normalizeText(query);

  let list = EXPERIENCES.filter((exp) => {
    if (category !== 'all' && exp.category !== category) return false;
    if (layoverOnly && !exp.layoverFriendly) return false;
    if (cruiseOnly && !exp.cruiseFriendly) return false;

    if (duration === 'short' && exp.durationHours > 4) return false;
    if (duration === 'half' && (exp.durationHours <= 4 || exp.durationHours > 7)) return false;
    if (duration === 'full' && exp.durationHours < 8) return false;

    if (profile !== 'all' && !exp.profiles.includes(profile)) return false;

    if (qNorm) {
      const haystack = normalizeText(
        `${exp.title.es} ${exp.title.en} ${exp.summary.es} ${exp.summary.en} ${exp.region.es} ${exp.region.en} ${exp.keywords}`
      );
      const tokens = qNorm.split(/\s+/).filter(Boolean);
      if (!tokens.every((tk) => haystack.includes(tk))) return false;
    }

    return true;
  });

  if (sort === 'duration-asc') {
    list = [...list].sort((a, b) => a.durationHours - b.durationHours);
  } else if (sort === 'rating') {
    list = [...list].sort((a, b) => b.rating - a.rating);
  } else {
    list = [...list].sort((a, b) => Number(b.bestseller) - Number(a.bestseller) || b.reviewCount - a.reviewCount);
  }

  return list;
}

function syncCatalogAndMap() {
  const filtered = getFilteredExperiences();
  scene3D?.setHighlightedExperiences(filtered.map((e) => e.id));
  renderSearchUI(filtered);
  renderCatalog(filtered);
}

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ----------------------------------------------------------------------------
// Direct WhatsApp Quote Builder Controls
// ----------------------------------------------------------------------------
function bindQuoteControls() {
  document.querySelectorAll('[data-quote-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.quote.mode = btn.dataset.quoteMode;
      renderQuoteSection();
      renderFloatingQuoteBar();
    });
  });

  const builderEl = document.getElementById('quote-builder-body');
  builderEl?.addEventListener('click', (e) => {
    const tourCard = e.target.closest('[data-toggle-tour]');
    if (tourCard) {
      toggleTourInQuote(tourCard.dataset.toggleTour, false);
      return;
    }

    const tierBtn = e.target.closest('[data-set-tier]');
    if (tierBtn) {
      appState.quote.tier = tierBtn.dataset.setTier;
      renderQuoteSection();
      renderFloatingQuoteBar();
      return;
    }

    const tripBtn = e.target.closest('[data-set-triptype]');
    if (tripBtn) {
      appState.quote.tripType = tripBtn.dataset.setTriptype;
      renderQuoteSection();
      renderFloatingQuoteBar();
      return;
    }

    const vehBtn = e.target.closest('[data-set-vehicle]');
    if (vehBtn) {
      appState.quote.vehicleId = vehBtn.dataset.setVehicle;
      renderQuoteSection();
      renderFloatingQuoteBar();
      return;
    }

    const stepBtn = e.target.closest('[data-stepper]');
    if (stepBtn) {
      const [field, deltaStr] = stepBtn.dataset.stepper.split(':');
      const delta = Number(deltaStr);
      if (field === 'adults') {
        appState.quote.adults = Math.max(1, Math.min(22, appState.quote.adults + delta));
      } else if (field === 'children') {
        appState.quote.children = Math.max(0, Math.min(16, appState.quote.children + delta));
      } else if (field === 'hours') {
        appState.quote.hours = Math.max(3, Math.min(12, appState.quote.hours + delta));
      }
      renderQuoteSection();
      renderFloatingQuoteBar();
      return;
    }
  });

  builderEl?.addEventListener('change', (e) => {
    const target = e.target;
    if (target.id === 'quote-date') {
      appState.quote.date = target.value;
    } else if (target.id === 'quote-route') {
      appState.quote.routeId = target.value;
    } else if (target.id === 'quote-pickup-time') {
      appState.quote.pickupTime = target.value;
    } else if (target.dataset.addonId) {
      const id = target.dataset.addonId;
      if (target.checked) {
        if (!appState.quote.addons.includes(id)) appState.quote.addons.push(id);
      } else {
        appState.quote.addons = appState.quote.addons.filter((x) => x !== id);
      }
    }
    renderQuoteSection();
    renderFloatingQuoteBar();
  });

  builderEl?.addEventListener('input', (e) => {
    if (e.target.id === 'quote-flight') {
      appState.quote.flightNumber = e.target.value;
      renderQuoteReceiptOnly();
    }
  });

  // Unified Flight / Cruise tracking fields (available for BOTH Tours & Transfers)
  document.getElementById('flight-number')?.addEventListener('input', (e) => {
    appState.quote.flightNumber = e.target.value;
    renderQuoteReceiptOnly();
  });
  document.getElementById('flight-terminal')?.addEventListener('change', (e) => {
    appState.quote.flightTerminal = e.target.value;
    renderQuoteReceiptOnly();
  });
  document.getElementById('flight-arrival')?.addEventListener('change', (e) => {
    appState.quote.flightArrivalTime = e.target.value;
    renderQuoteReceiptOnly();
  });

  ['client-name', 'client-hotel', 'client-notes'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      if (id === 'client-name') appState.quote.clientName = e.target.value;
      if (id === 'client-hotel') appState.quote.clientHotel = e.target.value;
      if (id === 'client-notes') appState.quote.clientNotes = e.target.value;
      renderQuoteReceiptOnly();
    });
  });

  document.getElementById('quote-receipt-dynamic')?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-copy-quote')) {
      const summary = summarizeQuote(appState.quote);
      const txt = buildQuoteText(appState.quote, summary, appState.lang);
      navigator.clipboard?.writeText(txt).catch(() => {});
      showToast(I18N[appState.lang].copiedToast);
    }
    if (e.target.closest('#btn-print-quote')) {
      window.print();
    }
  });
}

function toggleTourInQuote(expId, notify = true) {
  const exp = EXPERIENCES.find((e) => e.id === expId);
  if (!exp) return;

  if (exp.isTransfer) {
    appState.quote.mode = 'transfers';
    renderQuoteSection();
    renderFloatingQuoteBar();
    document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  appState.quote.mode = 'tours';
  const idx = appState.quote.selectedTours.indexOf(expId);
  if (idx >= 0) {
    appState.quote.selectedTours.splice(idx, 1);
    if (notify) showToast(`${I18N[appState.lang].removedToast}: ${exp.shortTitle[appState.lang]}`);
  } else {
    appState.quote.selectedTours.push(expId);
    if (notify) showToast(`${I18N[appState.lang].addedToast}: ${exp.shortTitle[appState.lang]}`);
  }

  renderCatalog();
  render3DSpotlight();
  renderQuoteSection();
  renderFloatingQuoteBar();
  if (appState.modalExpId === expId) renderModal(expId);
}

// ----------------------------------------------------------------------------
// Detail Modal & Real Photo Lightbox Controls
// ----------------------------------------------------------------------------
function bindModalControls() {
  const overlay = document.getElementById('tour-modal');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('#modal-close-btn')) {
      closeModal();
    }
  });
}

function openModal(expId) {
  appState.modalExpId = expId;
  renderModal(expId);
  const overlay = document.getElementById('tour-modal');
  overlay?.classList.add('is-open');
  overlay?.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  appState.modalExpId = null;
  const overlay = document.getElementById('tour-modal');
  overlay?.classList.remove('is-open');
  overlay?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function bindLightboxControls() {
  const lb = document.getElementById('photo-lightbox');
  lb?.addEventListener('click', (e) => {
    if (e.target === lb || e.target.closest('#lightbox-close')) {
      closeLightbox();
    } else if (e.target.closest('#lightbox-prev')) {
      stepLightbox(-1);
    } else if (e.target.closest('#lightbox-next')) {
      stepLightbox(1);
    }
  });
}

function openLightbox(idx) {
  appState.lightboxIndex = idx;
  renderLightbox();
  const lb = document.getElementById('photo-lightbox');
  lb?.classList.add('is-open');
  lb?.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  appState.lightboxIndex = null;
  const lb = document.getElementById('photo-lightbox');
  lb?.classList.remove('is-open');
  lb?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function stepLightbox(delta) {
  if (appState.lightboxIndex === null) return;
  appState.lightboxIndex = (appState.lightboxIndex + delta + REAL_GALLERY.length) % REAL_GALLERY.length;
  renderLightbox();
}

function renderLightbox() {
  if (appState.lightboxIndex === null) return;
  const item = REAL_GALLERY[appState.lightboxIndex];
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  const tag = document.getElementById('lightbox-tag');
  if (img) {
    img.src = item.src;
    img.alt = item.caption[appState.lang];
  }
  if (tag) tag.textContent = item.tag[appState.lang];
  if (cap) cap.textContent = item.caption[appState.lang];
}

function renderModal(expId) {
  const exp = EXPERIENCES.find((e) => e.id === expId);
  const body = document.getElementById('tour-modal-body');
  if (!exp || !body) return;

  const lang = appState.lang;
  const t = I18N[lang];
  const inQuote = !exp.isTransfer && appState.quote.selectedTours.includes(exp.id);

  body.innerHTML = `
    <div class="modal-hero">
      <img src="${exp.image}" alt="${exp.title[lang]}" />
      <div class="modal-hero-overlay">
        <span class="badge-glass">${exp.region[lang]}</span>
        <h3>${exp.title[lang]}</h3>
        <div class="modal-meta-row">
          <span>⏱ ${exp.durationLabel[lang]}</span>
          <span>★ ${exp.rating.toFixed(1)} (${exp.reviewCount})</span>
          <span>💬 <strong>${t.directQuoteTag} · WhatsApp</strong></span>
        </div>
      </div>
    </div>
    <div class="modal-content-grid">
      <div class="modal-main-col">
        <p class="modal-summary">${exp.summary[lang]}</p>

        <h4>${t.modalHighlights}</h4>
        <ul class="clean-check-list">
          ${exp.highlights[lang].map((h) => `<li>${h}</li>`).join('')}
        </ul>

        <h4>${t.modalItinerary}</h4>
        <ol class="timeline-list">
          ${exp.itinerary[lang]
            .map(
              (item) => `
            <li>
              <span class="timeline-time">${item.time}</span>
              <span class="timeline-step">${item.step}</span>
            </li>
          `
            )
            .join('')}
        </ol>
      </div>

      <aside class="modal-side-col">
        <div class="modal-box">
          <h5>✓ ${t.modalIncludes}</h5>
          <ul class="mini-list">
            ${exp.includes[lang].map((i) => `<li>${i}</li>`).join('')}
          </ul>
        </div>
        <div class="modal-box modal-box-muted">
          <h5>ⓘ ${t.modalExcludes}</h5>
          <ul class="mini-list">
            ${exp.excludes[lang].map((i) => `<li>${i}</li>`).join('')}
          </ul>
        </div>
        <div class="modal-cta-stack">
          <button type="button" class="btn btn-whatsapp btn-block" id="modal-quote-action">
            ${inQuote ? t.modalInQuote : t.modalAddQuote}
          </button>
          <button type="button" class="btn btn-outline btn-block" id="modal-focus-3d">
            ✦ ${t.btnFocus3D}
          </button>
        </div>
      </aside>
    </div>
  `;

  body.querySelector('#modal-quote-action')?.addEventListener('click', () => {
    if (!inQuote) toggleTourInQuote(exp.id, true);
    closeModal();
    document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  body.querySelector('#modal-focus-3d')?.addEventListener('click', () => {
    closeModal();
    select3DExperience(exp.id, true);
    document.getElementById('inicio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ----------------------------------------------------------------------------
// Render Functions (100% Safe Bilingual Rendering)
// ----------------------------------------------------------------------------
function renderAll() {
  renderStaticTranslations();
  render3DHudText();
  render3DPills();
  render3DSpotlight();
  syncCatalogAndMap();
  renderQuoteSection();
  renderPaymentsSection();
  renderRealGallerySection();
  renderFleetSection();
  renderTestimonialsSection();
  renderAboutSection();
  renderFaqSection();
  renderFloatingQuoteBar();
  if (appState.modalExpId) renderModal(appState.modalExpId);
  if (appState.lightboxIndex !== null) renderLightbox();
}

function renderStaticTranslations() {
  const t = I18N[appState.lang];

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (typeof t[key] === 'string') {
      el.textContent = t[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (typeof t[key] === 'string') {
      el.placeholder = t[key];
    }
  });

  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.langBtn === appState.lang);
  });

  // Populate translated airport/port terminal options cleanly
  const termSel = document.getElementById('flight-terminal');
  if (termSel && Array.isArray(t.terminalOptions)) {
    const prev = appState.quote.flightTerminal || '';
    termSel.innerHTML = t.terminalOptions
      .map((opt) => `<option value="${opt.id}" ${opt.id === prev ? 'selected' : ''}>${opt.label}</option>`)
      .join('');
  }

  if (geoLabelEls.caribbean) geoLabelEls.caribbean.textContent = t.oceanCaribbean;
  if (geoLabelEls.pacific) geoLabelEls.pacific.textContent = t.oceanPacific;
  if (geoLabelEls.canal) geoLabelEls.canal.textContent = t.canalLabel;

  EXPERIENCES.forEach((exp) => {
    const pin = beaconPinEls.get(exp.id);
    if (pin) {
      const nameEl = pin.querySelector('.pin-name');
      if (nameEl) nameEl.textContent = exp.shortTitle[appState.lang];
    }
  });
}

function render3DHudText() {
  const t = I18N[appState.lang];
  const btnOrbit = document.getElementById('btn-toggle-orbit');
  if (btnOrbit) {
    const isOn = scene3D ? scene3D.autoRotate : true;
    btnOrbit.textContent = isOn ? t.autoRotateOn : t.autoRotateOff;
    btnOrbit.classList.toggle('is-active', isOn);
  }
}

function render3DPills() {
  const host = document.getElementById('hud-destination-pills');
  if (!host) return;
  const lang = appState.lang;

  host.innerHTML = EXPERIENCES.map(
    (exp) => `
    <button type="button" class="hud-pill ${exp.id === appState.activeExpId ? 'is-active' : ''}" data-hud-exp="${exp.id}">
      <span class="hud-pill-dot"></span>
      <span>${exp.shortTitle[lang]}</span>
    </button>
  `
  ).join('');

  host.querySelectorAll('[data-hud-exp]').forEach((btn) => {
    btn.addEventListener('click', () => select3DExperience(btn.dataset.hudExp, true));
  });
}

function render3DSpotlight() {
  const host = document.getElementById('hud-spotlight-card');
  if (!host) return;

  const exp = EXPERIENCES.find((e) => e.id === appState.activeExpId) || EXPERIENCES[0];
  const lang = appState.lang;
  const t = I18N[lang];
  const inQuote = !exp.isTransfer && appState.quote.selectedTours.includes(exp.id);

  host.innerHTML = `
    <div class="spotlight-thumb">
      <img src="${exp.image}" alt="${exp.shortTitle[lang]}" />
      <span class="spotlight-badge">${exp.badge[lang]}</span>
    </div>
    <div class="spotlight-body">
      <div class="spotlight-region">${exp.region[lang]} · ⏱ ${exp.durationLabel[lang]}</div>
      <h3>${exp.shortTitle[lang]}</h3>
      <p>${exp.summary[lang]}</p>
      <div class="spotlight-footer">
        <div class="spotlight-price">
          <strong class="spotlight-direct">${t.directQuoteTag}</strong>
          <small>${t.directQuoteSub}</small>
        </div>
        <div class="spotlight-btns">
          <button type="button" class="btn btn-glass btn-xs" id="spot-details">${t.tooltipExplore}</button>
          <button type="button" class="btn btn-gold btn-xs" id="spot-quote">${inQuote ? t.btnAddedQuote : t.tooltipQuote}</button>
        </div>
      </div>
    </div>
  `;

  host.querySelector('#spot-details')?.addEventListener('click', () => openModal(exp.id));
  host.querySelector('#spot-quote')?.addEventListener('click', () => {
    if (exp.isTransfer) {
      toggleTourInQuote(exp.id, false);
    } else if (!inQuote) {
      toggleTourInQuote(exp.id, true);
    } else {
      document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

function renderSearchUI(filtered) {
  const t = I18N[appState.lang];

  const cats = [
    ['all', t.catAll],
    ['culture', t.catCulture],
    ['cruise', t.catCruise],
    ['islands', t.catIslands],
    ['nature', t.catNature],
    ['shopping', t.catShopping],
    ['transfers', t.catTransfers],
  ];
  const catHost = document.getElementById('category-pills');
  if (catHost) {
    catHost.innerHTML = cats
      .map(
        ([id, label]) => `
        <button type="button" class="cat-pill ${appState.filters.category === id ? 'is-active' : ''}" data-category="${id}">
          ${label}
        </button>
      `
      )
      .join('');
  }

  document.getElementById('btn-layover-toggle')?.classList.toggle('is-active', appState.filters.layoverOnly);
  document.getElementById('btn-cruise-toggle')?.classList.toggle('is-active', appState.filters.cruiseOnly);

  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.hidden = !appState.filters.query;

  const countEl = document.getElementById('search-results-count');
  if (countEl) countEl.textContent = t.resultsCount(filtered.length);
}

function renderCatalog(filteredList = getFilteredExperiences()) {
  const grid = document.getElementById('experience-grid');
  if (!grid) return;

  const lang = appState.lang;
  const t = I18N[lang];

  if (filteredList.length === 0) {
    grid.innerHTML = `
      <div class="empty-results-card">
        <h3>${t.noResultsTitle}</h3>
        <p>${t.noResultsDesc}</p>
        <button type="button" class="btn btn-primary" id="btn-empty-reset">${t.chipClear}</button>
      </div>
    `;
    grid.querySelector('#btn-empty-reset')?.addEventListener('click', resetFilters);
    return;
  }

  grid.innerHTML = filteredList
    .map((exp) => {
      const inQuote = !exp.isTransfer && appState.quote.selectedTours.includes(exp.id);
      return `
        <article class="exp-card ${inQuote ? 'is-selected' : ''}" data-card-id="${exp.id}">
          <div class="exp-media">
            <img src="${exp.image}" alt="${exp.title[lang]}" loading="lazy" decoding="async" />
            <div class="exp-badges-top">
              <span class="exp-badge-primary">${exp.badge[lang]}</span>
              ${exp.layoverFriendly ? `<span class="exp-badge-layover">✈️ ${t.layoverBadge}</span>` : ''}
              ${exp.id === 'colon-cruise' ? `<span class="exp-badge-layover">🚢 ${t.cruiseBadge}</span>` : ''}
            </div>
            <button type="button" class="exp-3d-chip" data-focus-3d="${exp.id}" title="${t.btnFocus3D}">
              ✦ 3D
            </button>
          </div>

          <div class="exp-body">
            <div class="exp-meta-top">
              <span class="exp-region">${exp.region[lang]}</span>
              <span class="exp-rating tabular">★ ${exp.rating.toFixed(1)} <small>(${exp.reviewCount})</small></span>
            </div>

            <h3 class="exp-title">${exp.title[lang]}</h3>
            <p class="exp-summary">${exp.summary[lang]}</p>

            <div class="exp-specs">
              <span>⏱ ${exp.durationLabel[lang]}</span>
              <span>✓ ${t.freeCancel}</span>
            </div>

            <div class="exp-footer">
              <div class="exp-quote-label">
                <strong>${t.directQuoteTag}</strong>
                <span>${t.directQuoteSub}</span>
              </div>

              <div class="exp-actions">
                <button type="button" class="btn btn-outline btn-sm" data-open-detail="${exp.id}">${t.btnDetails}</button>
                <button type="button" class="btn ${inQuote ? 'btn-emerald' : 'btn-whatsapp'} btn-sm" data-card-quote="${exp.id}">
                  ${inQuote ? t.btnAddedQuote : t.btnAddQuote}
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-open-detail]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.openDetail));
  });

  grid.querySelectorAll('[data-card-quote]').forEach((btn) => {
    btn.addEventListener('click', () => toggleTourInQuote(btn.dataset.cardQuote, true));
  });

  grid.querySelectorAll('[data-focus-3d]').forEach((btn) => {
    btn.addEventListener('click', () => {
      select3DExperience(btn.dataset.focus3d, true);
      document.getElementById('inicio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    grid.querySelectorAll('.exp-card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${(-py * 4.5).toFixed(2)}deg) rotateY(${(px * 4.5).toFixed(
          2
        )}deg) translateY(-4px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }
}

function renderQuoteSection() {
  const lang = appState.lang;
  const t = I18N[lang];
  const q = appState.quote;

  document.querySelectorAll('[data-quote-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.quoteMode === q.mode);
  });

  const refEl = document.getElementById('quote-ref-badge');
  if (refEl) refEl.textContent = `${t.receiptRef} ${q.refCode}`;

  const body = document.getElementById('quote-builder-body');
  if (!body) return;

  if (q.mode === 'tours') {
    const toursOnly = EXPERIENCES.filter((e) => !e.isTransfer);
    const count = q.selectedTours.length;
    const promoMsg =
      count >= 3 ? t.comboPromo3 : count === 2 ? t.comboPromo2 : count === 1 ? t.comboPromo1 : t.comboPromo0;

    body.innerHTML = `
      <div class="combo-banner ${count >= 2 ? 'is-unlocked' : ''}">
        <span class="combo-dot">✦</span>
        <span>${promoMsg}</span>
      </div>

      <div class="quote-step">
        <h3 class="quote-step-title">${t.stepSelectTours}</h3>
        <div class="quote-tour-grid">
          ${toursOnly
            .map((exp) => {
              const selected = q.selectedTours.includes(exp.id);
              return `
                <button type="button" class="q-tour-pill ${selected ? 'is-selected' : ''}" data-toggle-tour="${exp.id}">
                  <img src="${exp.image}" alt="${exp.shortTitle[lang]}" />
                  <div class="q-tour-info">
                    <strong>${exp.shortTitle[lang]}</strong>
                    <span>${exp.durationLabel[lang]} · ${exp.region[lang]}</span>
                  </div>
                  <span class="q-check" aria-hidden="true">${selected ? '✓' : '+'}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>

      <div class="quote-step">
        <h3 class="quote-step-title">${t.stepTravelers}</h3>
        <div class="quote-controls-grid">
          <div class="stepper-card">
            <span class="field-label">${t.adultsLabel}</span>
            <div class="stepper">
              <button type="button" data-stepper="adults:-1" aria-label="Decrease adults">−</button>
              <strong class="tabular">${q.adults}</strong>
              <button type="button" data-stepper="adults:1" aria-label="Increase adults">+</button>
            </div>
          </div>

          <div class="stepper-card">
            <span class="field-label">${t.childrenLabel}</span>
            <div class="stepper">
              <button type="button" data-stepper="children:-1" aria-label="Decrease children">−</button>
              <strong class="tabular">${q.children}</strong>
              <button type="button" data-stepper="children:1" aria-label="Increase children">+</button>
            </div>
          </div>

          <div class="input-card">
            <label class="field-label" for="quote-date">${t.dateLabel}</label>
            <input type="date" id="quote-date" value="${q.date}" />
          </div>

          <div class="input-card">
            <span class="field-label">${t.tierLabel}</span>
            <div class="segmented-control">
              <button type="button" class="${q.tier === 'shared' ? 'is-active' : ''}" data-set-tier="shared">${t.tierShared}</button>
              <button type="button" class="${q.tier === 'private' ? 'is-active' : ''}" data-set-tier="private">${t.tierPrivate}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="quote-step">
        <h3 class="quote-step-title">${t.stepExtras}</h3>
        <div class="addons-grid">
          ${QUOTE_ADDONS.map((a) => {
            const checked = q.addons.includes(a.id);
            return `
              <label class="addon-card ${checked ? 'is-checked' : ''}">
                <input type="checkbox" data-addon-id="${a.id}" ${checked ? 'checked' : ''} />
                <div>
                  <strong>${a.label[lang]}</strong>
                  <span>${a.desc[lang]}</span>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    const activeRoute = TRANSFER_ROUTES.find((r) => r.id === q.routeId) || TRANSFER_ROUTES[0];
    body.innerHTML = `
      <div class="quote-step">
        <h3 class="quote-step-title">${t.routeLabel}</h3>
        <div class="quote-controls-grid">
          <div class="input-card input-card-wide">
            <label class="field-label" for="quote-route">${t.routeLabel}</label>
            <select id="quote-route">
              ${TRANSFER_ROUTES.map(
                (r) => `<option value="${r.id}" ${r.id === q.routeId ? 'selected' : ''}>${r.name[lang]} (${r.duration})</option>`
              ).join('')}
            </select>
          </div>

          ${
            activeRoute.hourly
              ? `
            <div class="stepper-card">
              <span class="field-label">${t.hoursLabel}</span>
              <div class="stepper">
                <button type="button" data-stepper="hours:-1">−</button>
                <strong class="tabular">${q.hours}h</strong>
                <button type="button" data-stepper="hours:1">+</button>
              </div>
            </div>
          `
              : `
            <div class="input-card">
              <span class="field-label">${t.tripTypeLabel}</span>
              <div class="segmented-control">
                <button type="button" class="${q.tripType === 'one-way' ? 'is-active' : ''}" data-set-triptype="one-way">${t.oneWay}</button>
                <button type="button" class="${q.tripType === 'round-trip' ? 'is-active' : ''}" data-set-triptype="round-trip">${t.roundTrip}</button>
              </div>
            </div>
          `
          }

          <div class="input-card">
            <label class="field-label" for="quote-date">${t.dateLabel}</label>
            <input type="date" id="quote-date" value="${q.date}" />
          </div>

          <div class="input-card">
            <label class="field-label" for="quote-pickup-time">${t.pickupTimeLabel}</label>
            <input type="time" id="quote-pickup-time" value="${q.pickupTime}" />
          </div>

          <div class="stepper-card">
            <span class="field-label">${t.adultsLabel}</span>
            <div class="stepper">
              <button type="button" data-stepper="adults:-1">−</button>
              <strong class="tabular">${q.adults}</strong>
              <button type="button" data-stepper="adults:1">+</button>
            </div>
          </div>
        </div>
      </div>

      <div class="quote-step">
        <h3 class="quote-step-title">${t.vehicleLabel}</h3>
        <div class="vehicle-selector-grid">
          ${FLEET.map((v) => {
            const active = v.id === q.vehicleId;
            return `
              <button type="button" class="vehicle-pill ${active ? 'is-selected' : ''}" data-set-vehicle="${v.id}">
                <div class="vehicle-pill-top">
                  <strong>${v.name[lang]}</strong>
                  <span class="veh-status">${active ? '✓' : '+'}</span>
                </div>
                <small>${v.models}</small>
                <span class="vehicle-cap">👤 1–${v.paxMax} · 🧳 ${v.bagsMax}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderQuoteReceiptOnly();
}

function renderQuoteReceiptOnly() {
  renderQuotePaymentSelector();
  const host = document.getElementById('quote-receipt-dynamic');
  if (!host) return;
  const summary = summarizeQuote(appState.quote);
  host.innerHTML = renderQuoteReceiptHTML(appState.quote, summary, appState.lang);
}

function renderQuotePaymentSelector() {
  const host = document.getElementById('quote-payment-pills');
  const noteEl = document.getElementById('quote-payment-note');
  if (!host) return;

  const lang = appState.lang;
  const activeMethods = PAYMENT_METHODS.filter((m) => m.enabled);
  const selected = activeMethods.find((m) => m.id === appState.quote.paymentMethod) || activeMethods[0];
  if (selected && selected.id !== appState.quote.paymentMethod) {
    appState.quote.paymentMethod = selected.id;
  }

  host.innerHTML = activeMethods
    .map(
      (m) => `
      <button type="button" class="pay-pill ${m.id === appState.quote.paymentMethod ? 'is-active' : ''}" data-pick-pay="${m.id}">
        <span>${m.icon}</span>
        <span>${m.shortLabel[lang]}</span>
      </button>
    `
    )
    .join('');

  if (noteEl && selected) {
    noteEl.textContent = selected.note[lang];
  }

  host.querySelectorAll('[data-pick-pay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.quote.paymentMethod = btn.dataset.pickPay;
      renderQuoteReceiptOnly();
      renderPaymentsSection();
    });
  });
}

function renderPaymentsSection() {
  const host = document.getElementById('payments-grid');
  if (!host) return;
  const lang = appState.lang;
  const activeMethods = PAYMENT_METHODS.filter((m) => m.enabled);

  const brandChips = {
    card: ['VISA', 'Mastercard', 'Amex'],
    yappy: ['Yappy', 'Banco General'],
    ach: ['Banco General', 'ACH', 'ACH Xpress'],
    cash: ['USD $', 'Panamá'],
    paypal: ['PayPal', 'Visa / MC', 'USD'],
  };

  const t = I18N[lang];

  host.innerHTML = activeMethods
    .map((m) => {
      const isSelected = appState.quote.paymentMethod === m.id;
      return `
        <article class="payment-card ${isSelected ? 'is-selected' : ''} ${m.paypalUrl ? 'payment-card-featured' : ''}">
          <div class="payment-card-top">
            <span class="payment-card-icon" aria-hidden="true">${m.icon}</span>
            <span class="payment-card-badge">${m.badge[lang]}</span>
          </div>
          <h3>${m.name[lang]}</h3>
          <p>${m.note[lang]}</p>
          <div class="payment-brand-chips">
            ${(brandChips[m.id] || []).map((c) => `<span>${c}</span>`).join('')}
          </div>
          <div class="payment-card-actions">
            ${
              m.paypalUrl
                ? `<a href="${m.paypalUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-paypal btn-sm btn-block" id="card-paypal-direct">${t.payNowPaypal}</a>`
                : ''
            }
            <button type="button" class="btn btn-outline btn-sm btn-block" data-select-payment-card="${m.id}">
              ${lang === 'es' ? `Cotizar pagando con ${m.shortLabel.es}` : `Quote with ${m.shortLabel.en}`}
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  host.querySelectorAll('[data-select-payment-card]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.quote.paymentMethod = btn.dataset.selectPaymentCard;
      renderQuoteReceiptOnly();
      renderPaymentsSection();
      document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function updateFloatingQuoteVisibility() {
  const bar = document.getElementById('floating-quote-bar');
  if (!bar) return;
  const summary = summarizeQuote(appState.quote);
  const shouldShow = !summary.isEmpty && window.scrollY > 420 && !quoteSectionInView;
  bar.classList.toggle('is-visible', shouldShow);
}

function renderFloatingQuoteBar() {
  const bar = document.getElementById('floating-quote-bar');
  if (!bar) return;

  const summary = summarizeQuote(appState.quote);
  const t = I18N[appState.lang];

  if (summary.isEmpty) {
    bar.classList.remove('is-visible');
    return;
  }

  const countLabel =
    summary.mode === 'transfers'
      ? summary.vehicle.name[appState.lang]
      : `${summary.items.length} ${summary.items.length === 1 ? 'Tour' : 'Tours'}`;

  const subtitle =
    summary.mode === 'transfers'
      ? summary.route.name[appState.lang]
      : `${appState.quote.adults}A${appState.quote.children > 0 ? ` + ${appState.quote.children}${appState.lang === 'es' ? 'N' : 'C'}` : ''} · WhatsApp`;

  bar.innerHTML = `
    <div class="fqb-info">
      <span class="fqb-badge">${countLabel}</span>
      <div class="fqb-text">
        <small>${t.floatingQuoteLabel}</small>
        <strong>${subtitle}</strong>
      </div>
    </div>
    <a href="#cotizador" class="btn btn-whatsapp btn-sm">${t.floatingQuoteBtn} →</a>
  `;
  updateFloatingQuoteVisibility();
}

// ----------------------------------------------------------------------------
// Authentic 3:4 Real Photo Gallery, Fleet, About, Testimonials & FAQ
// ----------------------------------------------------------------------------
function renderRealGallerySection() {
  const host = document.getElementById('real-gallery-grid');
  const filterHost = document.getElementById('gallery-filter-pills');
  if (!host) return;
  const lang = appState.lang;
  const t = I18N[lang];

  if (filterHost) {
    const groups = [
      ['all', t.galAll],
      ['casco', t.galCasco],
      ['canal', t.galCanal],
      ['cruise', t.galCruise],
      ['flavors', t.galFlavors],
    ];
    filterHost.innerHTML = groups
      .map(
        ([id, label]) => `
        <button type="button" class="cat-pill ${appState.galleryGroup === id ? 'is-active' : ''}" data-gal-group="${id}">
          ${label}
        </button>
      `
      )
      .join('');
    filterHost.querySelectorAll('[data-gal-group]').forEach((btn) => {
      btn.addEventListener('click', () => {
        appState.galleryGroup = btn.dataset.galGroup;
        renderRealGallerySection();
      });
    });
  }

  const itemsWithIdx = REAL_GALLERY.map((item, idx) => ({ item, idx })).filter(
    ({ item }) => appState.galleryGroup === 'all' || item.group === appState.galleryGroup
  );

  host.innerHTML = itemsWithIdx
    .map(
      ({ item, idx }) => `
    <button type="button" class="real-photo-card" data-open-lightbox="${idx}">
      <img src="${item.src}" alt="${item.caption[lang]}" loading="lazy" decoding="async" />
      <span class="real-photo-tag">${item.tag[lang]}</span>
      <span class="real-photo-caption">${item.caption[lang]}</span>
    </button>
  `
    )
    .join('');

  host.querySelectorAll('[data-open-lightbox]').forEach((btn) => {
    btn.addEventListener('click', () => openLightbox(Number(btn.dataset.openLightbox)));
  });
}

function renderFleetSection() {
  const host = document.getElementById('fleet-grid');
  if (!host) return;
  const lang = appState.lang;
  const icons = ['🚘', '🚙', '🚐', '🚌'];

  host.innerHTML = FLEET.map(
    (v, i) => `
    <article class="fleet-card">
      <div class="fleet-icon" aria-hidden="true">${icons[i]}</div>
      <h3>${v.name[lang]}</h3>
      <p class="fleet-models">${v.models}</p>
      <ul class="fleet-features">
        ${v.features[lang].map((f) => `<li>✓ ${f}</li>`).join('')}
      </ul>
      <button type="button" class="btn btn-whatsapp btn-sm btn-block" data-pick-fleet="${v.id}">
        ${lang === 'es' ? 'Cotizar este vehículo' : 'Quote this vehicle'}
      </button>
    </article>
  `
  ).join('');

  host.querySelectorAll('[data-pick-fleet]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.quote.mode = 'transfers';
      appState.quote.vehicleId = btn.dataset.pickFleet;
      renderQuoteSection();
      renderFloatingQuoteBar();
      document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function renderAboutSection() {
  const host = document.getElementById('about-bullets');
  if (!host) return;
  const t = I18N[appState.lang];
  host.innerHTML = t.aboutBullets.map((b) => `<li><span class="check-dot">✓</span><span>${b}</span></li>`).join('');
}

function renderTestimonialsSection() {
  const host = document.getElementById('reviews-grid');
  if (!host) return;
  const lang = appState.lang;

  host.innerHTML = TESTIMONIALS.map(
    (r) => `
    <article class="review-card">
      <div class="review-stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}</div>
      <p class="review-quote">“${r.quote[lang]}”</p>
      <div class="review-footer">
        <div class="review-avatar">${r.name.charAt(0)}</div>
        <div>
          <strong>${r.name}</strong>
          <span>${r.origin[lang]} · ${r.tour[lang]}</span>
        </div>
        <time>${r.date}</time>
      </div>
    </article>
  `
  ).join('');
}

function renderFaqSection() {
  const host = document.getElementById('faq-list');
  if (!host) return;
  const lang = appState.lang;

  host.innerHTML = FAQS.map(
    (item, idx) => `
    <details class="faq-item" ${idx === 0 ? 'open' : ''}>
      <summary>
        <span>${item.q[lang]}</span>
        <span class="faq-plus" aria-hidden="true">+</span>
      </summary>
      <p>${item.a[lang]}</p>
    </details>
  `
  ).join('');
}

function showToast(message) {
  const el = document.getElementById('toast-notification');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800);
}
