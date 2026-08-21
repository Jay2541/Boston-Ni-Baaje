import { renderHeader, renderFooter, initReveal, prefersReducedMotion } from './layout.js';
import { EVENT, mapsUrl } from './data/event.js';
import discover from './data/discover.json';

renderHeader('discover.html');
renderFooter();

const { venue, groups, transit } = discover;

/* Flat list of every place + the venue, so the map and the cards share one source. */
const allPlaces = groups.flatMap((g) =>
  g.places.map((p) => ({ ...p, color: g.color, category: g.category }))
);

const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const stars = (n = 0) => '●'.repeat(n) + '○'.repeat(Math.max(0, 5 - n));

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
        src="${escapeHtml(place.photo)}"
        alt="${escapeHtml(place.name)}"
        loading="lazy"
        onerror="this.closest('.place-photo-wrap').classList.add('img-failed')"
      />
      ${emblem}
    </div>`;
}

/* One baseball card. Front = photo + name + position; back = scouting report + stats. */
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
            <p class="place-dist"><span>📍 ${escapeHtml(place.dist)}</span><span>🚶 ${escapeHtml(place.walk)}</span></p>
          </div>
          <span class="place-flip-hint">Scouting report ↻</span>
        </div>
        <div class="place-face place-back">
          <span class="place-back-label">Scouting Report</span>
          <h4>${escapeHtml(place.name)}</h4>
          <p class="place-desc">${escapeHtml(place.desc)}</p>
          <dl class="place-stats">
            <div><dt>Distance</dt><dd>${escapeHtml(place.dist)}</dd></div>
            <div><dt>On foot</dt><dd>${escapeHtml(place.walk)}</dd></div>
            <div><dt>By T</dt><dd>${escapeHtml(place.transit)}</dd></div>
            <div><dt>Scout grade</dt><dd class="place-rating">${stars(place.rating)}</dd></div>
          </dl>
          <div class="place-actions">
            <button type="button" class="place-btn place-locate" data-locate="${place.id}">📍 Map</button>
            <a class="place-btn place-visit" href="${escapeHtml(place.url)}" target="_blank" rel="noopener">Visit ↗</a>
          </div>
        </div>
      </div>
    </article>`;
}

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
  `<span class="legend-chip legend-venue"><i></i>${escapeHtml(venue.name)}</span>` +
  groups
    .map(
      (g) =>
        `<span class="legend-chip" style="--team:${g.color}"><i></i>${escapeHtml(g.category)}</span>`
    )
    .join('');

/* ---------- Interactive map (Leaflet + CARTO light tiles) ---------- */
const reduce = prefersReducedMotion();

function initMap() {
  const el = document.getElementById('discover-map');
  if (!el || typeof window.L === 'undefined') {
    // No Leaflet (offline / blocked CDN) — hide the map shell, cards still work.
    document.querySelector('.discover-map-wrap')?.style.setProperty('display', 'none');
    return;
  }
  const L = window.L;

  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView(venue.coords, 15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
  }).addTo(map);

  // Custom baseball marker: a stitched ball ringed in the category color.
  const ballIcon = (color, home = false) =>
    L.divIcon({
      className: 'bnb-pin-wrap',
      html: `<span class="bnb-pin${home ? ' bnb-pin-home' : ''}" style="--team:${color}">${
        home ? '🏠' : ''
      }</span>`,
      iconSize: home ? [40, 40] : [28, 28],
      iconAnchor: home ? [20, 20] : [14, 14],
      popupAnchor: [0, home ? -20 : -14],
    });

  const markers = {};

  // Venue = home plate.
  L.marker(venue.coords, { icon: ballIcon('#8f2d32', true), zIndexOffset: 1000 })
    .addTo(map)
    .bindPopup(
      `<div class="map-pop">
         <span class="map-pop-tag" style="--team:#8f2d32">${escapeHtml(venue.position)}</span>
         <strong>${escapeHtml(venue.name)}</strong>
         <span class="map-pop-desc">${escapeHtml(venue.desc)}</span>
         <a class="map-pop-link" href="${mapsUrl(EVENT.venue.mapsQuery)}" target="_blank" rel="noopener">Open in Maps ↗</a>
       </div>`,
      { className: 'bnb-popup' }
    );

  const bounds = [venue.coords];

  allPlaces.forEach((place) => {
    bounds.push(place.coords);
    const popup = `
      <div class="map-pop">
        <span class="map-pop-tag" style="--team:${place.color}">${escapeHtml(place.tag)}</span>
        <strong>${escapeHtml(place.name)}</strong>
        <span class="map-pop-meta">🚶 ${escapeHtml(place.walk)} · 🚇 ${escapeHtml(place.transit)}</span>
        <span class="map-pop-desc">${escapeHtml(place.desc)}</span>
        <span class="map-pop-actions">
          <a class="map-pop-link" href="${escapeHtml(place.url)}" target="_blank" rel="noopener">Visit ↗</a>
          <button type="button" class="map-pop-card" data-card="${place.id}">See the card ↓</button>
        </span>
      </div>`;
    const marker = L.marker(place.coords, { icon: ballIcon(place.color) })
      .addTo(map)
      .bindPopup(popup, { className: 'bnb-popup' });

    // Hovering a marker highlights its card; hovering the card is handled below.
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

  // "On the map" button on a card → fly there and open its popup.
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

  // Keep the map sized correctly once it becomes visible.
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
