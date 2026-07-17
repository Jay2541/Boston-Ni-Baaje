import { EVENT, mapsUrl } from './data/event.js';

const BASE = import.meta.env.BASE_URL;

// Register the service worker so the site is installable as an app (PWA).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {});
  });
}

const NAV_LINKS = [
  { href: 'index.html', label: 'Home' },
  { href: 'schedule.html', label: 'Schedule' },
  { href: 'updates.html', label: 'Updates' },
  { href: 'teams.html', label: 'Teams' },
  { href: 'discover.html', label: 'Discover' },
  { href: 'sponsors.html', label: 'Sponsors' },
];

export function renderHeader(activePage) {
  const header = document.getElementById('site-header');
  if (!header) return;

  const links = NAV_LINKS.map(
    (link) => `
      <a href="${BASE}${link.href}" class="nav-link${link.href === activePage ? ' active' : ''}">
        ${link.label}
      </a>`
  ).join('');

  header.innerHTML = `
    <div class="header-inner">
      <a href="${BASE}index.html" class="brand">
        <img src="${BASE}logo.png" alt="" class="brand-logo" />
        <span class="brand-text">Boston Ni Baaje</span>
      </a>
      <nav class="nav">${links}</nav>
      <a href="${BASE}teams.html#team-portal" class="login-pill${activePage === 'teams.html' ? ' active' : ''}">
        <span class="login-pill-icon" aria-hidden="true">⚿</span>
        <span class="login-pill-text">Team Login</span>
      </a>
      <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;

  // Mobile menu toggle
  const toggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('.nav');
  toggle.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('.nav-link')) header.classList.remove('nav-open');
  });

  // Only show the right-edge fade when the nav actually overflows horizontally
  // (desktop wide enough to fit everything → no fade; narrower → scroll + fade).
  const updateFade = () => {
    const desktop = window.matchMedia('(min-width: 721px)').matches;
    const overflowing = nav.scrollWidth > nav.clientWidth + 2;
    const atEnd = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2;
    nav.classList.toggle('no-fade', !desktop || !overflowing || atEnd);
  };
  updateFade();
  nav.addEventListener('scroll', updateFade, { passive: true });
  window.addEventListener('resize', updateFade, { passive: true });

  // Shadow / condensed header on scroll
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

export function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;

  const year = new Date().getFullYear();

  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        <img src="${BASE}logo.png" alt="" class="brand-logo" />
        <div>
          <strong>${EVENT.name} ${EVENT.edition}</strong>
          <p>Boston's collegiate Raas competition.</p>
        </div>
      </div>
      <div class="footer-links">
        <a href="${BASE}app.html">Get the App</a>
        <a href="mailto:${EVENT.contact.info}">${EVENT.contact.info}</a>
        <a href="${mapsUrl(EVENT.venue.mapsQuery)}" target="_blank" rel="noopener">${EVENT.venue.name}</a>
        <a href="${EVENT.social.instagram}" target="_blank" rel="noopener">Instagram</a>
      </div>
    </div>
    <div class="footer-copy">&copy; ${year} ${EVENT.name}. All rights reserved.</div>
  `;
}

/**
 * Reveal elements with the `.reveal` class as they scroll into view.
 * Call once per page after content is in the DOM.
 */
export function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  els.forEach((el) => io.observe(el));
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
