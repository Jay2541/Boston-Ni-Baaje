import { renderHeader, renderFooter, initReveal, prefersReducedMotion } from './layout.js';
import { mapsUrl } from './data/event.js';
import discover from './data/discover.json';

renderHeader('discover.html');
renderFooter();

const BASE = import.meta.env.BASE_URL;
// Local photos live in /public/img (relative path); landmark photos are full URLs.
const photoSrc = (p) => (p.startsWith('http') ? p : `${BASE}${p}`);

const { venues, groups, transit } = discover;

/* Flat list of every place + the venue, so the map and the cards share one source. */
const allPlaces = groups.flatMap((g) =>
  g.places.map((p) => ({ ...p, color: g.color, category: g.category }))
);

const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Proximity meter: a baseball diamond, runner advanced `bases` (1–4).
   1 = Single (steps away) … 4 = Home Run (a trip). Drives home how close things are. ---------- */
const DIAMOND_PTS = { H: [22, 40], B1: [40, 22], B2: [22, 4], B3: [4, 22] };
function basesDiamond(bases = 2) {
  const seq = ['H', 'B1', 'B2', 'B3', 'H']; // running the bases
  const lit = (i) => i <= bases;
  const edge = (a, b, i) =>
    `<line x1="${DIAMOND_PTS[a][0]}" y1="${DIAMOND_PTS[a][1]}" x2="${DIAMOND_PTS[b][0]}" y2="${DIAMOND_PTS[b][1]}" class="dm-edge${lit(i + 1) ? ' on' : ''}" />`;
  const edges = seq.slice(0, -1).map((a, i) => edge(a, seq[i + 1], i)).join('');
  const base = (key, i, home = false) => {
    const [x, y] = DIAMOND_PTS[key];
    const on = home ? bases >= 4 : i <= bases;
    return `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" transform="rotate(45 ${x} ${y})" class="dm-base${on ? ' on' : ''}${home ? ' dm-home' : ''}" />`;
  };
  return `
    <svg class="bases-diamond" viewBox="0 0 44 44" aria-hidden="true">
      ${edges}
      ${base('B1', 1)}${base('B2', 2)}${base('B3', 3)}${base('H', 4, true)}
    </svg>`;
}

/* Baseball-card "photo" area — a real photo when we have one, otherwise a themed
   emblem panel that reads as an illustrated rookie card (never a broken image). */
function cardMedia(place) {
  const emblem = `
    <div class="place-emblem" style="--team:${place.color}">
      <span class="place-emblem-icon">${place.emoji || '⚾'}</span>
    </div>`;
  if (!place.photo) return emblem;
  return `
    <div class="place-photo-wrap">
      <img
        class="place-photo"
        src="${escapeHtml(photoSrc(place.photo))}"
        alt="${escapeHtml(place.name)}"
        loading="lazy"
        onerror="this.closest('.place-photo-wrap').classList.add('img-failed')"
      />
      ${emblem}
    </div>`;
}

/* One baseball card. Front = photo + name + proximity; back = scouting report + stats. */
function renderCard(place) {
  return `
    <article class="place-card reveal" id="card-${place.id}" data-id="${place.id}" style="--team:${place.color}" tabindex="0">
      <div class="place-card-inner">
        <div class="place-face place-front">
          <div class="place-team-bar"><span>${escapeHtml(place.tag)}</span><span class="place-mini-ball">⚾</span></div>
          ${cardMedia(place)}
          <div class="place-front-body">
            <h4>${escapeHtml(place.name)}</h4>
            <p class="place-position">${escapeHtml(place.position)}</p>
            <div class="place-prox">
              ${basesDiamond(place.bases)}
              <span class="place-prox-text">
                <strong>${escapeHtml(place.hit)}</strong>
                <span>${escapeHtml(place.walk)} from home plate</span>
              </span>
            </div>
          </div>
          <span class="place-flip-hint">Scouting report ↻</span>
        </div>
        <div class="place-face place-back">
          <span class="place-back-label">Scouting Report</span>
          <h4>${escapeHtml(place.name)}</h4>
          <p class="place-desc">${escapeHtml(place.desc)}</p>
          <dl class="place-stats">
            <div><dt>From home plate</dt><dd>${escapeHtml(place.dist)}</dd></div>
            <div><dt>On foot</dt><dd>${escapeHtml(place.walk)}</dd></div>
            <div><dt>By T</dt><dd>${escapeHtml(place.transit)}</dd></div>
            <div><dt>The hit</dt><dd class="place-hit">${escapeHtml(place.hit)}</dd></div>
          </dl>
          <div class="place-actions">
            <button type="button" class="place-btn place-locate" data-locate="${place.id}">📍 Map</button>
            <a class="place-btn place-visit" href="${escapeHtml(place.url)}" target="_blank" rel="noopener">Visit ↗</a>
          </div>
        </div>
      </div>
    </article>`;
}

/* Closeness strip — hammers home that it's all a short hop from the venue. */
const placeCount = allPlaces.length;
document.getElementById('discover-stats').innerHTML = `
  <div class="close-stat"><span class="close-num">${placeCount}</span><span class="close-lbl">spots near the venue</span></div>
  <div class="close-stat"><span class="close-num">~1 mi</span><span class="close-lbl">covers almost all of it</span></div>
  <div class="close-stat"><span class="close-num">🟢</span><span class="close-lbl">Green Line at the door</span></div>`;

/* Render the grouped card grid. */
document.getElementById('discover-content').innerHTML = groups
  .map(
    (group) => `
      <div class="discover-group" style="--team:${group.color}">
        <div class="discover-head reveal">
          <span class="eyebrow">${group.eyebrow}</span>
          <h3>${escapeHtml(group.category)}</h3>
          <p>${escapeHtml(group.blurb)}</p>
        </div>
        <div class="discover-grid">
          ${group.places.map((pl) => renderCard({ ...pl, color: group.color })).join('')}
        </div>
      </div>`
  )
  .join('');

/* Transit strip. */
document.getElementById('discover-transit-grid').innerHTML = transit
  .map(
    (t) => `
      <a class="transit-card reveal" href="${escapeHtml(t.url)}" target="_blank" rel="noopener">
        <span class="transit-tag">${escapeHtml(t.tag)}</span>
        <strong>${escapeHtml(t.name)}</strong>
        <span class="transit-desc">${escapeHtml(t.desc)}</span>
      </a>`
  )
  .join('');

/* Legend — one chip per category, colored to match the map bases. */
document.getElementById('discover-legend').innerHTML =
  venues
    .map((v) => `<span class="legend-chip legend-venue"><i></i>${escapeHtml(v.name)} (home plate)</span>`)
    .join('') +
  groups
    .map(
      (g) =>
        `<span class="legend-chip" style="--team:${g.color}"><i></i>${escapeHtml(g.category)}</span>`
    )
    .join('');

/* ---------- Interactive map (Leaflet + CARTO light tiles) ---------- */
const reduce = prefersReducedMotion();

/* An SVG baseball, ringed in the category color, with two red seams. */
function ballSVG(color) {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#fff" stroke="${color}" stroke-width="2.4"/>
      <path d="M6 3.2 Q1.8 12 6 20.8" fill="none" stroke="#8f2d32" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M18 3.2 Q22.2 12 18 20.8" fill="none" stroke="#8f2d32" stroke-width="1.1" stroke-linecap="round"/>
      <g stroke="#8f2d32" stroke-width="0.8" stroke-linecap="round">
        <path d="M4.2 7 L6.4 6.2"/><path d="M3.4 10 L5.6 9.6"/><path d="M3.4 14 L5.6 14.4"/><path d="M4.2 17 L6.4 17.8"/>
        <path d="M19.8 7 L17.6 6.2"/><path d="M20.6 10 L18.4 9.6"/><path d="M20.6 14 L18.4 14.4"/><path d="M19.8 17 L17.6 17.8"/>
      </g>
    </svg>`;
}

/* A home-plate pentagon for the venue marker. */
function homePlateSVG() {
  return `
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <polygon points="5,4 27,4 27,17 16,28 5,17" fill="#8f2d32" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
      <polygon points="9,8 23,8 23,16 16,23 9,16" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1"/>
    </svg>`;
}

function initMap() {
  const el = document.getElementById('discover-map');
  if (!el || typeof window.L === 'undefined') {
    // No Leaflet (offline / blocked CDN) — hide the map shell, cards still work.
    document.querySelector('.discover-map-wrap')?.style.setProperty('display', 'none');
    return;
  }
  const L = window.L;

  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView(venues[0].coords, 15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
  }).addTo(map);

  const ballIcon = (color) =>
    L.divIcon({
      className: 'bnb-pin-wrap',
      html: `<span class="bnb-pin">${ballSVG(color)}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
  const homeIcon = () =>
    L.divIcon({
      className: 'bnb-pin-wrap',
      html: `<span class="bnb-pin bnb-pin-home">${homePlateSVG()}</span>`,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -21],
    });

  const markers = {};

  // Venues = home plate (the theatre and the event hotel).
  venues.forEach((v) => {
    L.marker(v.coords, { icon: homeIcon(), zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(
        `<div class="map-pop">
           <span class="map-pop-tag" style="--team:#8f2d32">🏟️ ${escapeHtml(v.position)}</span>
           <strong>${escapeHtml(v.name)}</strong>
           <span class="map-pop-desc">${escapeHtml(v.desc)}</span>
           <a class="map-pop-link" href="${mapsUrl(v.mapsQuery)}" target="_blank" rel="noopener">Open in Maps ↗</a>
         </div>`,
        { className: 'bnb-popup' }
      );
  });

  const bounds = venues.map((v) => v.coords);

  allPlaces.forEach((place) => {
    bounds.push(place.coords);
    const popup = `
      <div class="map-pop">
        <span class="map-pop-tag" style="--team:${place.color}">${escapeHtml(place.tag)}</span>
        <strong>${escapeHtml(place.name)}</strong>
        <span class="map-pop-meta">⚾ ${escapeHtml(place.hit)} · ${escapeHtml(place.walk)} from home plate</span>
        <span class="map-pop-desc">${escapeHtml(place.desc)}</span>
        <span class="map-pop-actions">
          <a class="map-pop-link" href="${escapeHtml(place.url)}" target="_blank" rel="noopener">Visit ↗</a>
          <button type="button" class="map-pop-card" data-card="${place.id}">See the card ↓</button>
        </span>
      </div>`;
    const marker = L.marker(place.coords, { icon: ballIcon(place.color) })
      .addTo(map)
      .bindPopup(popup, { className: 'bnb-popup' });

    marker.on('mouseover', () => document.getElementById(`card-${place.id}`)?.classList.add('is-cued'));
    marker.on('mouseout', () => document.getElementById(`card-${place.id}`)?.classList.remove('is-cued'));
    markers[place.id] = marker;
  });

  map.fitBounds(bounds, { padding: [40, 40] });

  // "See the card ↓" inside a popup → scroll to and flash that card.
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.map-pop-card');
    if (!btn) return;
    flashCard(btn.dataset.card);
  });

  // "Map" button on a card → fly there and open its popup.
  document.getElementById('discover-content').addEventListener('click', (e) => {
    const btn = e.target.closest('.place-locate');
    if (!btn) return;
    e.stopPropagation();
    const id = btn.dataset.locate;
    const marker = markers[id];
    if (!marker) return;
    document.querySelector('.discover-map-wrap')?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'center',
    });
    map.flyTo(marker.getLatLng(), 16, { duration: reduce ? 0 : 0.8 });
    marker.openPopup();
  });

  setTimeout(() => map.invalidateSize(), 200);
}

function flashCard(id) {
  const card = document.getElementById(`card-${id}`);
  if (!card) return;
  card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  card.classList.add('is-flashed');
  setTimeout(() => card.classList.remove('is-flashed'), 1600);
}

/* Touch / keyboard: tap or Enter flips the card (hover handles the mouse case in CSS).
   Buttons and links inside the card must not trigger a flip. */
document.getElementById('discover-content').addEventListener('click', (e) => {
  if (e.target.closest('a, button')) return;
  const card = e.target.closest('.place-card');
  if (card) card.classList.toggle('is-flipped');
});
document.getElementById('discover-content').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.place-card');
  if (card && e.target === card) {
    e.preventDefault();
    card.classList.toggle('is-flipped');
  }
});

initMap();
initReveal();
