// ============================================================================
// PTT PANAMÁ — Direct WhatsApp Quote & Live Flight Tracking Slip Engine
// Pricing policy: Zero hardcoded prices on-site; every quote request generates
// a complete booking & flight-tracking slip sent directly to PTT WhatsApp.
// ============================================================================

import {
  BRAND,
  EXPERIENCES,
  FLEET,
  I18N,
  PAYMENT_METHODS,
  QUOTE_ADDONS,
  TRANSFER_ROUTES,
} from './data.js';

const AIRLINE_CODES = {
  CM: 'Copa Airlines',
  AA: 'American Airlines',
  UA: 'United Airlines',
  DL: 'Delta Air Lines',
  AV: 'Avianca',
  IB: 'Iberia',
  KL: 'KLM',
  AF: 'Air France',
  UX: 'Air Europa',
  TK: 'Turkish Airlines',
  LA: 'LATAM Airlines',
  P5: 'Wingo',
  NK: 'Spirit Airlines',
  AM: 'Aeroméxico',
  AC: 'Air Canada',
  LH: 'Lufthansa',
  BA: 'British Airways',
  DM: 'Arajet',
  '9V': 'Avior Airlines',
  S6: 'Sunrise Airways',
};

export function parseFlightInfo(rawInput) {
  const clean = String(rawInput || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!clean) return null;

  const match = clean.match(/^([A-Z0-9]{2})\s*-?\s*(\d{1,4}[A-Z]?)$/);
  if (match) {
    const code = match[1];
    const num = match[2];
    const formatted = `${code} ${num}`;
    const airline = AIRLINE_CODES[code] || null;
    const trackUrl = `https://www.google.com/search?q=${encodeURIComponent(`${formatted} flight status`)}`;
    return {
      isFlightCode: true,
      formatted,
      airline,
      display: airline ? `${formatted} (${airline})` : formatted,
      trackUrl,
    };
  }

  return {
    isFlightCode: false,
    formatted: String(rawInput || '').trim(),
    airline: null,
    display: String(rawInput || '').trim(),
    trackUrl: null,
  };
}

export function createInitialQuoteState() {
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 3);
  const isoDate = defaultDate.toISOString().slice(0, 10);

  return {
    mode: 'tours', // 'tours' | 'transfers'
    refCode: `PTT-26-${Math.floor(1000 + Math.random() * 8999)}`,
    selectedTours: ['city-tour'],
    adults: 2,
    children: 0,
    date: isoDate,
    tier: 'private', // 'shared' | 'private'
    addons: [],
    // Transfer specific
    routeId: 'pty-city',
    tripType: 'one-way', // 'one-way' | 'round-trip'
    hours: 4,
    vehicleId: 'odyssey',
    pickupTime: '10:00',
    // Flight / Cruise tracking (shared across both Tours & Transfers)
    flightNumber: '',
    flightTerminal: '',
    flightArrivalTime: '',
    // Preferred payment method (card | yappy | ach | cash | paypal)
    paymentMethod: 'card',
    // Optional client info
    clientName: '',
    clientHotel: '',
    clientNotes: '',
  };
}

export function summarizeQuote(state) {
  const paxTotal = Math.max(1, Number(state.adults || 1) + Number(state.children || 0));
  const flightInfo = parseFlightInfo(state.flightNumber);

  if (state.mode === 'transfers') {
    const route = TRANSFER_ROUTES.find((r) => r.id === state.routeId) || TRANSFER_ROUTES[0];
    const vehicle = FLEET.find((v) => v.id === state.vehicleId) || FLEET[0];
    return {
      mode: 'transfers',
      isEmpty: false,
      route,
      vehicle,
      paxTotal,
      flightInfo,
      isRoundTrip: !route.hourly && state.tripType === 'round-trip',
      isBundle: false,
      hasSanBlas: false,
      items: [],
    };
  }

  const items = state.selectedTours
    .map((id) => EXPERIENCES.find((e) => e.id === id && !e.isTransfer))
    .filter(Boolean);

  return {
    mode: 'tours',
    isEmpty: items.length === 0,
    paxTotal,
    flightInfo,
    isRoundTrip: false,
    isBundle: items.length >= 2,
    hasSanBlas: items.some((i) => i.id === 'san-blas'),
    items,
  };
}

export function buildQuoteText(state, summary, lang = 'es') {
  const isEs = lang === 'es';
  const lines = [];

  lines.push(isEs ? `SOLICITUD DE COTIZACIÓN — PTT PANAMÁ` : `DIRECT QUOTE REQUEST — PTT PANAMA`);
  lines.push(`${isEs ? 'Referencia' : 'Reference'}: ${state.refCode}`);
  lines.push(`${isEs ? 'Idioma' : 'Language'}: ${isEs ? 'Español (ES)' : 'English (EN)'}`);
  lines.push(`--------------------------------`);

  if (summary.mode === 'transfers') {
    lines.push(`${isEs ? 'Servicio' : 'Service'}: ${isEs ? 'Traslado Privado / Ejecutivo' : 'Private / Executive Transfer'}`);
    lines.push(`${isEs ? 'Ruta' : 'Route'}: ${summary.route.name[lang]}`);
    if (summary.route.hourly) {
      lines.push(`${isEs ? 'Duración' : 'Hours'}: ${state.hours}h`);
    } else {
      lines.push(
        `${isEs ? 'Modalidad' : 'Trip Type'}: ${
          state.tripType === 'round-trip'
            ? isEs
              ? 'Ida y Vuelta (solicitar tarifa especial)'
              : 'Round-Trip (request special rate)'
            : isEs
            ? 'Solo Ida'
            : 'One-Way'
        }`
      );
    }
    lines.push(`${isEs ? 'Vehículo' : 'Vehicle'}: ${summary.vehicle.name[lang]} (${summary.vehicle.models})`);
    lines.push(`${isEs ? 'Fecha y hora' : 'Date & time'}: ${state.date || (isEs ? 'Por definir' : 'Flexible')} · ${state.pickupTime || (isEs ? 'Por definir' : 'TBD')}`);
    lines.push(
      `${isEs ? 'Pasajeros' : 'Passengers'}: ${state.adults} ${isEs ? 'adulto(s)' : 'adult(s)'}${
        state.children > 0 ? ` + ${state.children} ${isEs ? 'niño(s)' : 'child(ren)'}` : ''
      }`
    );
  } else {
    lines.push(`${isEs ? 'Experiencias seleccionadas' : 'Selected experiences'}:`);
    summary.items.forEach((exp, i) => {
      lines.push(`  ${i + 1}. ${exp.title[lang]} (${exp.durationLabel[lang]})`);
    });
    if (summary.isBundle) {
      lines.push(
        isEs
          ? `Paquete Multi-Tour: Sí (${summary.items.length} experiencias — solicitar tarifa de paquete)`
          : `Multi-Tour Bundle: Yes (${summary.items.length} experiences — request bundle rate)`
      );
    }
    lines.push(`${isEs ? 'Fecha estimada' : 'Estimated date'}: ${state.date || (isEs ? 'Flexible' : 'Flexible')}`);
    lines.push(
      `${isEs ? 'Grupo' : 'Group'}: ${state.adults} ${isEs ? 'adulto(s)' : 'adult(s)'}${
        state.children > 0 ? ` + ${state.children} ${isEs ? 'niño(s)' : 'child(ren)'}` : ''
      }`
    );
    lines.push(
      `${isEs ? 'Modalidad' : 'Service tier'}: ${
        state.tier === 'private'
          ? isEs
            ? 'Privado Exclusivo VIP'
            : 'Private Exclusive VIP'
          : isEs
          ? 'Compartido Confort'
          : 'Comfort Shared'
      }`
    );
  }

  if (state.addons.length > 0) {
    const addonNames = state.addons
      .map((id) => QUOTE_ADDONS.find((a) => a.id === id)?.label[lang])
      .filter(Boolean);
    lines.push(`${isEs ? 'Adicionales' : 'Add-ons'}: ${addonNames.join(' · ')}`);
  }

  // Dedicated Flight / Cruise Tracking Block (both Tours & Transfers)
  if (summary.flightInfo || state.flightTerminal || state.flightArrivalTime) {
    lines.push(`--------------------------------`);
    lines.push(isEs ? `SEGUIMIENTO DE VUELO / LLEGADA:` : `FLIGHT / ARRIVAL TRACKING:`);
    if (summary.flightInfo) {
      lines.push(`${isEs ? 'Vuelo / Crucero' : 'Flight / Cruise'}: ${summary.flightInfo.display}`);
    }
    if (state.flightTerminal) {
      lines.push(`${isEs ? 'Terminal / Puerto' : 'Terminal / Port'}: ${state.flightTerminal}`);
    }
    if (state.flightArrivalTime) {
      lines.push(`${isEs ? 'Hora estimada de llegada' : 'Estimated arrival time'}: ${state.flightArrivalTime}`);
    }
    if (summary.flightInfo?.trackUrl) {
      lines.push(`${isEs ? 'Rastreo en vivo' : 'Live flight status'}: ${summary.flightInfo.trackUrl}`);
    }
  }

  if (state.clientName.trim() || state.clientHotel.trim() || state.clientNotes.trim()) {
    lines.push(`--------------------------------`);
    if (state.clientName.trim()) {
      lines.push(`${isEs ? 'Nombre' : 'Name'}: ${state.clientName.trim()}`);
    }
    if (state.clientHotel.trim()) {
      lines.push(`${isEs ? 'Hotel / Recogida' : 'Hotel / Pickup'}: ${state.clientHotel.trim()}`);
    }
    if (state.clientNotes.trim()) {
      lines.push(`${isEs ? 'Notas' : 'Notes'}: ${state.clientNotes.trim()}`);
    }
  }

  const payMethod = PAYMENT_METHODS.find((p) => p.id === state.paymentMethod && p.enabled) || PAYMENT_METHODS[0];
  if (payMethod) {
    lines.push(`--------------------------------`);
    lines.push(`${isEs ? 'Forma de pago preferida' : 'Preferred payment method'}: ${payMethod.whatsappLabel[lang]}`);
  }

  lines.push(`--------------------------------`);
  lines.push(
    isEs
      ? `¡Hola equipo PTT Panamá! Por favor indíquenme la tarifa personalizada y disponibilidad para esta cotización.`
      : `Hello PTT Panama team! Please share your personalized rate and availability for this quote request.`
  );

  return lines.join('\n');
}

export function buildWhatsAppHref(text) {
  return `https://wa.me/${BRAND.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export function buildMailtoHref(state, text, lang = 'es') {
  const subject =
    lang === 'es'
      ? `Solicitud de Cotización ${state.refCode} — Panamá Transports and Tours`
      : `Quote Request ${state.refCode} — Panamá Transports and Tours`;
  return `mailto:${BRAND.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

export function renderQuoteReceiptHTML(state, summary, lang) {
  const t = I18N[lang];
  const quoteText = buildQuoteText(state, summary, lang);
  const waHref = buildWhatsAppHref(quoteText);
  const mailHref = buildMailtoHref(state, quoteText, lang);

  if (summary.isEmpty) {
    return `
      <div class="receipt-empty">
        <div class="receipt-empty-icon" aria-hidden="true">✦</div>
        <p>${t.emptyQuoteMsg}</p>
      </div>
    `;
  }

  const linesHTML =
    summary.mode === 'transfers'
      ? `
        <div class="receipt-item">
          <div>
            <strong>${summary.route.name[lang]}</strong>
            <span class="receipt-sub">${summary.vehicle.name[lang]} · ${
          summary.route.hourly
            ? `${state.hours}h`
            : state.tripType === 'round-trip'
            ? t.roundTrip
            : t.oneWay
        }</span>
          </div>
          <span class="receipt-pill-tag">${lang === 'es' ? 'Cotizar' : 'Quote'}</span>
        </div>
      `
      : summary.items
          .map(
            (exp) => `
              <div class="receipt-item">
                <div>
                  <strong>${exp.shortTitle[lang]}</strong>
                  <span class="receipt-sub">${exp.durationLabel[lang]} · ${state.adults}A${
              state.children > 0 ? ` + ${state.children}${lang === 'es' ? 'N' : 'C'}` : ''
            } · ${state.tier === 'private' ? t.tierPrivate : t.tierShared}</span>
                </div>
                <span class="receipt-pill-tag">${lang === 'es' ? 'Incluido' : 'Selected'}</span>
              </div>
            `
          )
          .join('');

  const addonsHTML =
    state.addons.length > 0
      ? `<div class="receipt-row"><span>${lang === 'es' ? 'Servicios adicionales' : 'Optional add-ons'}</span><strong>${state.addons.length}</strong></div>`
      : '';

  const flightTrackingBanner = summary.flightInfo
    ? `
      <div class="flight-tracking-pill" id="flight-tracking-badge">
        <div class="flight-tracking-left">
          <strong>✈️ ${escapeHtml(summary.flightInfo.display)}</strong>
          <span>${
            [state.flightTerminal, state.flightArrivalTime].filter(Boolean).join(' · ') || t.flightTrackingActive
          }</span>
        </div>
        ${
          summary.flightInfo.trackUrl
            ? `<a href="${summary.flightInfo.trackUrl}" target="_blank" rel="noopener noreferrer" class="flight-live-link">${t.flightCheckLive}</a>`
            : ''
        }
      </div>
    `
    : '';

  const benefitBadge = summary.isBundle
    ? `<div class="receipt-note-pill">✦ ${lang === 'es' ? `Paquete de ${summary.items.length} tours — elegible para tarifa especial` : `${summary.items.length}-tour bundle — eligible for special package rate`}</div>`
    : summary.isRoundTrip
    ? `<div class="receipt-note-pill">✦ ${lang === 'es' ? 'Traslado Ida y Vuelta — tarifa preferencial directa' : 'Round-Trip transfer — preferential direct rate'}</div>`
    : '';

  const activePay = PAYMENT_METHODS.find((p) => p.id === state.paymentMethod && p.enabled) || PAYMENT_METHODS[0];

  const metaChips = [
    state.date ? `📅 ${state.date}` : '',
    `👥 ${state.adults} ${lang === 'es' ? 'Ad.' : 'Ad.'}${state.children > 0 ? ` · ${state.children} ${lang === 'es' ? 'Niñ.' : 'Ch.'}` : ''}`,
    summary.flightInfo ? `✈️ ${escapeHtml(summary.flightInfo.formatted)}` : '',
    state.flightTerminal ? `🛫 ${escapeHtml(state.flightTerminal)}` : '',
    activePay ? `${activePay.icon} ${activePay.shortLabel[lang]}` : '',
    state.clientHotel.trim() ? `🏨 ${escapeHtml(state.clientHotel.trim())}` : '',
    `🌐 ${lang.toUpperCase()}`,
  ]
    .filter(Boolean)
    .map((c) => `<span class="receipt-chip">${c}</span>`)
    .join('');

  return `
    <div class="receipt-meta-chips">${metaChips}</div>

    ${flightTrackingBanner}

    <div class="receipt-lines">
      ${linesHTML}
      ${addonsHTML}
    </div>

    ${benefitBadge}
    ${summary.hasSanBlas ? `<div class="receipt-note-pill">✓ ${t.sanBlasTaxNote}</div>` : ''}

    <div class="receipt-total-box receipt-direct-box">
      <div>
        <strong class="receipt-direct-title">${t.quoteDirectBannerTitle}</strong>
        <span class="receipt-per-pax">${t.quoteDirectBannerSub}</span>
      </div>
      <span class="receipt-wa-badge" aria-hidden="true">24/7</span>
    </div>

    <details class="slip-preview">
      <summary>${lang === 'es' ? 'Ver ticket exacto para WhatsApp' : 'Preview exact WhatsApp quote ticket'}</summary>
      <pre id="quote-slip-preview">${escapeHtml(quoteText)}</pre>
    </details>

    <div class="receipt-actions">
      <a id="quote-wa-link" class="btn btn-whatsapp btn-lg btn-block" href="${waHref}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.33-1.66a11.86 11.86 0 0 0 5.73 1.46h.01c6.55 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.42zM12.07 21.8h-.01a9.87 9.87 0 0 1-5.04-1.38l-.36-.21-3.76.99 1-3.66-.24-.38a9.86 9.86 0 0 1-1.52-5.26c0-5.46 4.44-9.9 9.92-9.9 2.65 0 5.14 1.03 7.01 2.91a9.84 9.84 0 0 1 2.9 7.01c0 5.46-4.44 9.88-9.9 9.88zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/></svg>
        <span>${t.btnSendWhatsapp}</span>
      </a>
      ${
        activePay?.paypalUrl
          ? `<a id="quote-paypal-link" class="btn btn-paypal btn-sm btn-block" href="${activePay.paypalUrl}" target="_blank" rel="noopener noreferrer">${t.payConfirmedPaypal}</a>`
          : ''
      }
      <div class="receipt-secondary-actions">
        <a id="quote-mail-link" class="btn btn-outline btn-sm" href="${mailHref}">${t.btnSendEmail}</a>
        <button type="button" class="btn btn-outline btn-sm" id="btn-copy-quote">${t.btnCopySummary}</button>
        <button type="button" class="btn btn-outline btn-sm" id="btn-print-quote">${t.btnPrintPdf}</button>
      </div>
    </div>

    <p class="receipt-disclaimer">${t.estimateDisclaimer}</p>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
