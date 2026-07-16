const BASE = import.meta.env.BASE_URL;

const NAV_LINKS = [
  { href: 'index.html', label: 'Home' },
  { href: 'schedule.html', label: 'Schedule' },
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
        <img src="${BASE}logo-placeholder.svg" alt="Boston Ni Baaje logo" class="brand-logo" />
        <span class="brand-text">Boston Ni Baaje</span>
      </a>
      <nav class="nav">${links}</nav>
    </div>
  `;
}

export function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="footer-inner">
      <p>Boston Ni Baaje &mdash; Boston's collegiate Raas competition.</p>
      <p>Questions? Reach out to our Directors at
        <a href="mailto:info@bostonnibaaje.com">info@bostonnibaaje.com</a>
      </p>
    </div>
  `;
}
