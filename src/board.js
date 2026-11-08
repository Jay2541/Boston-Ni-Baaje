import { renderHeader, renderFooter, initReveal, prefersReducedMotion } from './layout.js';
import { BOARD } from './data/board.js';
import coverUrl from './assets/board/cover.webp';

renderHeader('board.html');
renderFooter();

const BASE = import.meta.env.BASE_URL;
const SPEED = 40; // px per second the strip drifts
const HOLD_AFTER_PICK = 4000; // ms the strip waits after someone picks a committee

/* Committee photos are picked up automatically from src/assets/board/<slug>-<n>.<ext>. */
const photoFiles = import.meta.glob('./assets/board/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const photosBySlug = {};
Object.entries(photoFiles)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .forEach(([path, url]) => {
    const match = path.split('/').pop().match(/^(.+)-\d+\.\w+$/);
    if (match) (photosBySlug[match[1]] ??= []).push(url);
  });

// The full-board photo leads the lineup, then one card per committee.
const CARDS = [
  {
    slug: 'full-board',
    category: 'The Full Board',
    members: BOARD.flatMap((c) => c.members),
    photo: coverUrl,
  },
  ...BOARD.map((c) => ({ ...c, photo: photosBySlug[c.slug]?.[0] ?? null })),
];
const n = CARDS.length;

const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
const pad = (num) => String(num).padStart(2, '0');
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

/* Committees without a photo yet get a brand-colored card with the logo instead. */
function cardHtml(c, i, copy) {
  const media = c.photo
    ? `<img src="${c.photo}" alt="" draggable="false" />`
    : `<span class="board-card-fill tone-${i % 3}"><img src="${BASE}logo.png" alt="" draggable="false" /></span>
       <span class="board-card-soon">Photo soon</span>`;
  const hidden = copy === 1 ? '' : ' tabindex="-1" aria-hidden="true"';
  return `
    <button type="button" class="board-card" data-index="${i}"${hidden} aria-label="${c.category}">
      ${media}
      <span class="board-card-caption">
        <span class="board-card-count">${i === 0 ? 'Everyone' : pad(i)}</span>
        <span class="board-card-name">${c.category}</span>
      </span>
    </button>`;
}

const root = document.getElementById('board-root');
// three copies of the lineup: the strip always shows the middle one and wraps seamlessly
root.innerHTML = `
  <div class="board-strip" aria-roledescription="carousel" aria-label="Board committees">
    <div class="board-track">
      ${[0, 1, 2].map((copy) => CARDS.map((c, i) => cardHtml(c, i, copy)).join('')).join('')}
    </div>
  </div>
  <div class="board-strip-bar">
    <button type="button" class="board-ctrl board-pause" aria-label="Pause"></button>
    <span>Drag the strip or tap a committee</span>
  </div>

  <div class="board-below">
    <section class="board-roster">
      <span class="board-kicker">Now Batting</span>
      <h3 class="board-roster-title"></h3>
      <ul class="board-people"></ul>
    </section>
    <aside class="board-deck" aria-label="Coming up next">
      <button type="button" class="board-deck-card on-deck">
        <span class="board-kicker">On Deck</span>
        <span class="board-deck-body"></span>
      </button>
      <button type="button" class="board-deck-card in-hole">
        <span class="board-kicker">In the Hole</span>
        <span class="board-deck-body"></span>
      </button>
    </aside>
  </div>
`;

const strip = root.querySelector('.board-strip');
const track = root.querySelector('.board-track');
const cards = [...root.querySelectorAll('.board-card')];
const pauseBtn = root.querySelector('.board-pause');
const roster = root.querySelector('.board-roster');
const rosterTitle = root.querySelector('.board-roster-title');
const people = root.querySelector('.board-people');
const onDeck = root.querySelector('.on-deck');
const inHole = root.querySelector('.in-hole');

let paused = prefersReducedMotion(); // reduced-motion visitors drag or tap instead
let hovering = false;
let holdUntil = 0;
let current = -1;

/* ---------- Panel below the strip ---------- */
function deckCard(card, index) {
  const c = CARDS[index];
  card.dataset.index = index;
  card.setAttribute('aria-label', `Up next: ${c.category}. Jump to it`);
  const names = index === 0 ? `All ${c.members.length} board members` : c.members.join(' · ');
  const thumb = c.photo
    ? `<span class="board-deck-thumb" style="background-image:url('${c.photo}')"></span>`
    : `<span class="board-deck-thumb board-card-fill tone-${index % 3}"><img src="${BASE}logo.png" alt="" /></span>`;
  card.querySelector('.board-deck-body').innerHTML = `
    ${thumb}
    <span class="board-deck-text">
      <strong>${c.category}</strong>
      <small>${names}</small>
    </span>`;
}

function setCurrent(index) {
  if (index === current) return;
  current = index;
  const c = CARDS[index];
  cards.forEach((el) => el.classList.toggle('is-active', Number(el.dataset.index) === index));

  rosterTitle.textContent = c.category;
  people.classList.toggle('is-everyone', index === 0);
  people.innerHTML = c.members
    .map((name, i) => `<li style="--i:${i}"><span class="board-avatar" aria-hidden="true">${initials(name)}</span>${name}</li>`)
    .join('');
  deckCard(onDeck, (index + 1) % n);
  deckCard(inHole, (index + 2) % n);
}

/* ---------- Strip motion ---------- */
let pos = 0; // track translateX in px
let stride = 0; // card width + gap
let setWidth = 0; // width of one copy of the lineup
let cardWidth = 0;
let glide = null; // { from, to, start, dur }
let drag = null; // { x, startPos, moved, card }

function measure() {
  cardWidth = cards[0].offsetWidth;
  stride = cards[1].offsetLeft - cards[0].offsetLeft;
  setWidth = stride * n;
}

// position of the track that puts card k (counting across all copies) in the middle of the strip
const centeredPos = (k) => strip.clientWidth / 2 - cardWidth / 2 - k * stride;
const centerK = () => Math.round((strip.clientWidth / 2 - cardWidth / 2 - pos) / stride);

// keep the middle copy in view; shift any in-flight drag or glide by the same amount
function wrap() {
  let shift = 0;
  if (pos > -setWidth * 0.5) shift = -setWidth;
  else if (pos < -setWidth * 1.5) shift = setWidth;
  if (!shift) return;
  pos += shift;
  if (drag) drag.startPos += shift;
  if (glide) { glide.from += shift; glide.to += shift; }
}

function glideTo(index) {
  const k0 = centerK();
  let delta = (((index - k0) % n) + n) % n;
  if (delta > n / 2) delta -= n;
  const to = centeredPos(k0 + delta);
  glide = prefersReducedMotion() ? null : { from: pos, to, start: performance.now(), dur: 700 };
  if (!glide) pos = to;
  holdUntil = performance.now() + HOLD_AFTER_PICK;
  history.replaceState(null, '', `#${CARDS[index].slug}`);
}

let last = null;
function frame(now) {
  const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
  last = now;
  if (glide) {
    const t = Math.min((now - glide.start) / glide.dur, 1);
    pos = glide.from + (glide.to - glide.from) * (1 - Math.pow(1 - t, 3));
    if (t === 1) glide = null;
  } else if (!drag && !paused && !hovering && now > holdUntil) {
    pos -= SPEED * dt;
  }
  wrap();
  track.style.transform = `translate3d(${pos}px, 0, 0)`;
  setCurrent((((centerK() % n) + n) % n));
  requestAnimationFrame(frame);
}

/* ---------- Interaction ---------- */
function syncPaused() {
  pauseBtn.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
  pauseBtn.setAttribute('aria-label', paused ? 'Play the strip' : 'Pause the strip');
  // only announce changes when the visitor is driving; the drifting strip stays quiet
  roster.setAttribute('aria-live', paused ? 'polite' : 'off');
}
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  syncPaused();
});

strip.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
strip.addEventListener('pointerleave', () => { hovering = false; });

strip.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  glide = null;
  drag = { x: e.clientX, startPos: pos, moved: 0, card: e.target.closest('.board-card') };
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  drag.moved = Math.max(drag.moved, Math.abs(dx));
  if (drag.moved > 6) strip.classList.add('is-dragging');
  pos = drag.startPos + dx;
});
const endDrag = (e) => {
  if (!drag) return;
  const { moved, card } = drag;
  drag = null;
  strip.classList.remove('is-dragging');
  if (e.type === 'pointerup' && moved <= 6 && card) glideTo(Number(card.dataset.index));
  else holdUntil = performance.now() + 1500;
};
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

// keyboard: Enter/Space fires a click with no pointer (detail 0); tabbing to a card brings it to the middle
cards.forEach((card) => {
  card.addEventListener('click', (e) => e.detail === 0 && glideTo(Number(card.dataset.index)));
  card.addEventListener('focus', () => card.matches(':focus-visible') && glideTo(Number(card.dataset.index)));
});
[onDeck, inHole].forEach((card) => card.addEventListener('click', () => glideTo(Number(card.dataset.index))));

window.addEventListener('resize', () => {
  const k = centerK();
  measure();
  pos = centeredPos(k);
});

measure();
const fromHash = CARDS.findIndex((c) => c.slug === location.hash.slice(1));
pos = centeredPos(n + Math.max(fromHash, 0)); // start in the middle copy
if (fromHash >= 0) holdUntil = performance.now() + HOLD_AFTER_PICK;
syncPaused();
requestAnimationFrame(frame);

initReveal();
