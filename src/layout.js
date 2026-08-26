import { EVENT, mapsUrl } from './data/event.js';

const BASE = import.meta.env.BASE_URL;

// Point the Fenway backdrop (hero + subtle site-wide wash) at the base-aware image path.
document.documentElement.style.setProperty('--fenway-bg', `url("${BASE}fenway-bg.jpg")`);

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
  { href: 'board.html', label: 'Board' },
  { href: 'resources.html', label: 'Resources' },
];

const SOCIAL_ICONS = {
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/></svg>`,
};

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
        <img src="${BASE}logo.png" alt="Boston Ni Baaje" class="brand-logo" />
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
    <div class="footer-contact">
      <h2>Contact Us</h2>
      <p>Please feel free to reach out if you have any questions, concerns, or feedback.</p>
      <a class="footer-email" href="mailto:${EVENT.contact.info}">${EVENT.contact.info}</a>
      <p class="footer-follow-label">Follow us on</p>
      <div class="social-row">
        <a class="social-btn" href="${EVENT.social.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${SOCIAL_ICONS.instagram}</a>
        <a class="social-btn" href="${EVENT.social.tiktok}" target="_blank" rel="noopener" aria-label="TikTok">${SOCIAL_ICONS.tiktok}</a>
        <a class="social-btn" href="${EVENT.social.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn">${SOCIAL_ICONS.linkedin}</a>
      </div>
    </div>
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
        <a href="${mapsUrl(EVENT.venue.mapsQuery)}" target="_blank" rel="noopener">${EVENT.venue.name}</a>
      </div>
    </div>
    <div class="footer-copy">${EVENT.name} &middot; Boston, MA &middot; ${year}</div>
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
