import { renderHeader, renderFooter, initReveal, prefersReducedMotion } from './layout.js';
import { EVENT } from './data/event.js';

renderHeader('index.html');
renderFooter();

/* ---------- Countdown timer ---------- */
function initCountdown() {
  const root = document.getElementById('countdown');
  if (!root) return;

  const target = new Date(EVENT.startISO).getTime();
  const units = [
    { key: 'days', label: 'Days' },
    { key: 'hours', label: 'Hours' },
    { key: 'minutes', label: 'Minutes' },
    { key: 'seconds', label: 'Seconds' },
  ];

  root.innerHTML = units
    .map(
      (u) => `
      <div class="count-unit">
        <span class="count-value" data-unit="${u.key}">--</span>
        <span class="count-label">${u.label}</span>
      </div>`
    )
    .join('');

  const cells = {};
  units.forEach((u) => {
    cells[u.key] = root.querySelector(`[data-unit="${u.key}"]`);
  });

  const pad = (n) => String(n).padStart(2, '0');

  const tick = () => {
    const diff = target - Date.now();
    if (diff <= 0) {
      root.innerHTML = '<div class="count-live">The competition is live! 🎉</div>';
      clearInterval(timer);
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    cells.days.textContent = days;
    cells.hours.textContent = pad(hours);
    cells.minutes.textContent = pad(minutes);
    cells.seconds.textContent = pad(seconds);
  };

  tick();
  const timer = setInterval(tick, 1000);
}

/* ---------- Animated count-up stats ---------- */
function initStatCounters() {
  const stats = document.querySelectorAll('.stat-value[data-target]');
  if (!stats.length) return;

  const animate = (el) => {
    const target = Number(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    if (prefersReducedMotion()) {
      el.textContent = target + suffix;
      return;
    }
    const duration = 1400;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  stats.forEach((s) => io.observe(s));
}

/* ---------- Floating dandiya particles in hero ---------- */
function initParticles() {
  const layer = document.querySelector('.hero-particles');
  if (!layer || prefersReducedMotion()) return;

  const COUNT = 14;
  const colors = ['#f0c14b', '#bd3039', '#0c8a5f', '#e63946'];
  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    const size = 4 + ((i * 7) % 8);
    p.style.setProperty('--size', `${size}px`);
    p.style.setProperty('--x', `${(i * 137) % 100}%`);
    p.style.setProperty('--delay', `${(i * 0.9) % 12}s`);
    p.style.setProperty('--duration', `${9 + ((i * 3) % 8)}s`);
    p.style.setProperty('--color', colors[i % colors.length]);
    layer.appendChild(p);
  }
}

initCountdown();
initStatCounters();
initParticles();
initReveal();
