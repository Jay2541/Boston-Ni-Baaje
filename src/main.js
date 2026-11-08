import { renderHeader, renderFooter, initReveal, prefersReducedMotion } from './layout.js';
import { EVENT } from './data/event.js';

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

/* ---------- Countdown to showtime ---------- */
function initCountdown() {
  const root = document.getElementById('countdown');
  if (!root || !EVENT.startISO) return;

  const target = new Date(EVENT.startISO).getTime();
  const units = [
    { key: 'days', label: 'Days' },
    { key: 'hours', label: 'Hours' },
    { key: 'minutes', label: 'Min' },
    { key: 'seconds', label: 'Sec' },
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
  const cells = Object.fromEntries(units.map((u) => [u.key, root.querySelector(`[data-unit="${u.key}"]`)]));
  const pad = (n) => String(n).padStart(2, '0');

  const tick = () => {
    const diff = target - Date.now();
    if (diff <= 0) {
      root.closest('.countdown-wrap').innerHTML = '<div class="count-live">Play ball! The show is live 🎉</div>';
      clearInterval(timer);
      return;
    }
    cells.days.textContent = Math.floor(diff / 86400000);
    cells.hours.textContent = pad(Math.floor((diff % 86400000) / 3600000));
    cells.minutes.textContent = pad(Math.floor((diff % 3600000) / 60000));
    cells.seconds.textContent = pad(Math.floor((diff % 60000) / 1000));
  };
  const timer = setInterval(tick, 1000);
  tick();
}

const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ICONS = {
  play: svg('M8 5v14l11-7z'),
  pause: svg('M6 5h4v14H6zM14 5h4v14h-4z'),
  sound: svg('M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z'),
  muted: svg('M16.5 12a4.5 4.5 0 0 0-2.5-4v2.2l2.4 2.4.1-.6zM19 12c0 .9-.2 1.8-.5 2.6l1.5 1.5A8.9 8.9 0 0 0 21 12a9 9 0 0 0-7-8.8v2.1a7 7 0 0 1 5 6.7zM4.3 3 3 4.3 7.7 9H3v6h4l5 5v-6.7l4.3 4.2c-.7.5-1.4.9-2.3 1.2v2.1a9 9 0 0 0 3.7-1.8l2 2 1.3-1.3-9-9L4.3 3zM12 4 9.9 6.1 12 8.2V4z'),
};

/* ---------- Background hero video: muted autoplay loop, with pause + sound toggles ---------- */
function initHeroVideo() {
  const video = document.getElementById('hero-video');
  const playBtn = document.getElementById('hero-play');
  const soundBtn = document.getElementById('hero-sound');
  if (!video) return;

  const syncPlay = () => {
    playBtn.innerHTML = video.paused ? ICONS.play : ICONS.pause;
    playBtn.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
  };
  const syncSound = () => {
    soundBtn.innerHTML = video.muted ? ICONS.muted : ICONS.sound;
    soundBtn.setAttribute('aria-label', video.muted ? 'Turn sound on' : 'Turn sound off');
  };
  video.addEventListener('play', syncPlay);
  video.addEventListener('pause', syncPlay);
  video.addEventListener('volumechange', syncSound);

  playBtn.addEventListener('click', () => (video.paused ? video.play() : video.pause()));
  soundBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && video.paused) video.play();
  });

  // reduced-motion visitors get the poster frame; the play button is still there
  if (!prefersReducedMotion()) video.play().catch(() => {});
  syncPlay();
  syncSound();
}

initCountdown();
initHeroVideo();
initStatCounters();
initReveal();
