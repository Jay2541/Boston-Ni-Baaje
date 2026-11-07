import { renderHeader, renderFooter, initReveal } from './layout.js';
import { BOARD } from './data/board.js';
import coverUrl from './assets/board/cover.webp';

renderHeader('board.html');
renderFooter();

const BASE = import.meta.env.BASE_URL;

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

const root = document.getElementById('board-root');

root.innerHTML = `
  <div class="board-layout">
    <figure class="board-cover">
      <img src="${coverUrl}" alt="The Boston Ni Baaje board posing together on a staircase" />
    </figure>
    <div class="board-viewer">
      <div class="board-tabs" role="tablist" aria-label="Committees">
        ${BOARD.map(
          (c, i) =>
            `<button type="button" class="board-tab" role="tab" id="tab-${c.slug}" data-index="${i}" aria-controls="board-panel">${c.category}</button>`
        ).join('')}
      </div>
      <div class="board-panel" id="board-panel" role="tabpanel" tabindex="-1"></div>
    </div>
  </div>
`;

const tabs = [...root.querySelectorAll('.board-tab')];
const panel = document.getElementById('board-panel');
let current = -1;

function renderGallery(committee) {
  const photos = photosBySlug[committee.slug] || [];
  if (!photos.length) {
    return `
      <div class="board-photo-empty">
        <img src="${BASE}logo.png" alt="" />
        <span>${committee.category} committee photo coming soon</span>
      </div>`;
  }
  const slides = photos
    .map((url, i) => `<img src="${url}" alt="${committee.category} committee, photo ${i + 1} of ${photos.length}" loading="lazy" />`)
    .join('');
  const controls =
    photos.length > 1
      ? `<button type="button" class="board-photo-btn prev" aria-label="Previous photo">&#8249;</button>
         <button type="button" class="board-photo-btn next" aria-label="Next photo">&#8250;</button>`
      : '';
  return `<div class="board-photos"><div class="board-photo-track">${slides}</div>${controls}</div>`;
}

function show(index, { focusTab = false, updateHash = true } = {}) {
  const n = BOARD.length;
  index = (index + n) % n;
  if (index === current) return;
  current = index;
  const committee = BOARD[index];

  tabs.forEach((tab, i) => {
    const active = i === index;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', `tab-${committee.slug}`);

  panel.innerHTML = `
    <div class="board-panel-head">
      <button type="button" class="board-step prev" aria-label="Previous committee">&#8249;</button>
      <div class="board-panel-title">
        <span class="eyebrow">Committee</span>
        <h3>${committee.category}</h3>
      </div>
      <button type="button" class="board-step next" aria-label="Next committee">&#8250;</button>
    </div>
    ${renderGallery(committee)}
    <ul class="board-names" aria-label="${committee.category} members">
      ${committee.members.map((name) => `<li>${name}</li>`).join('')}
    </ul>
  `;

  // keep the active tab visible in the scrolling strip (mobile) without moving the page
  const strip = tabs[index].parentElement;
  const target = tabs[index].offsetLeft - (strip.clientWidth - tabs[index].offsetWidth) / 2;
  strip.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  if (focusTab) tabs[index].focus();
  if (updateHash) history.replaceState(null, '', `#${committee.slug}`);
}

tabs.forEach((tab) => tab.addEventListener('click', () => show(Number(tab.dataset.index))));

root.querySelector('.board-tabs').addEventListener('keydown', (e) => {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (step) {
    e.preventDefault();
    show(current + step, { focusTab: true });
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    show(e.key === 'Home' ? 0 : BOARD.length - 1, { focusTab: true });
  }
});

panel.addEventListener('click', (e) => {
  if (e.target.closest('.board-step')) {
    show(current + (e.target.closest('.board-step').classList.contains('next') ? 1 : -1));
    return;
  }
  const photoBtn = e.target.closest('.board-photo-btn');
  if (photoBtn) {
    const track = panel.querySelector('.board-photo-track');
    const dir = photoBtn.classList.contains('next') ? 1 : -1;
    track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' });
  }
});

const fromHash = BOARD.findIndex((c) => c.slug === location.hash.slice(1));
show(fromHash >= 0 ? fromHash : 0, { updateHash: fromHash >= 0 });

initReveal();
