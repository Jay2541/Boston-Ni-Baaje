import { renderHeader, renderFooter, initReveal, prefersReducedMotion } from './layout.js';

renderHeader('index.html');
renderFooter();

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
  const colors = ['#8f2d32', '#2a4a6b', '#3f2d54', '#a5383e'];
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

initStatCounters();
initParticles();
initReveal();
