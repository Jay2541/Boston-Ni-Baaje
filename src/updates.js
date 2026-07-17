import { renderHeader, renderFooter } from './layout.js';
import { VAPID_PUBLIC_KEY, PUSH_WORKER_URL } from './firebase.js';
import { watchAnnouncements } from './data/updates.js';
import { enablePush, pushSupported, notifPermission } from './push.js';

renderHeader('updates.html');
renderFooter();

const feedEl = document.getElementById('updates-feed');

/* ---------- "Turn on notifications" prompt ---------- */
initNotifCta();

async function initNotifCta() {
  const cta = document.getElementById('notif-cta');
  if (!cta) return;

  // Nothing to offer until push is configured (VAPID key + Worker) and supported here.
  if (!VAPID_PUBLIC_KEY || !PUSH_WORKER_URL || !(await pushSupported())) {
    cta.hidden = true;
    return;
  }
  const perm = notifPermission();
  if (perm === 'granted') { cta.hidden = true; return; }
  if (perm === 'denied') {
    cta.hidden = false;
    cta.innerHTML = `<p>🔕 Notifications are blocked in your settings. Enable them for this app to get updates.</p>`;
    return;
  }

  cta.hidden = false;
  cta.innerHTML = `
    <div class="notif-cta-inner">
      <div><strong>🔔 Get updates on your phone</strong><span>Turn on notifications to hear from the directors instantly.</span></div>
      <button class="btn btn-primary" id="enable-notif">Turn On</button>
    </div>`;
  document.getElementById('enable-notif').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Enabling…';
    let res;
    try {
      res = await enablePush();
    } catch (err) {
      res = { ok: false, reason: 'error' };
    }
    if (res && res.ok) {
      btn.textContent = 'Done!';
      cta.innerHTML = `<p class="notif-ok">✅ Done! You'll get updates here and on your phone.</p>`;
    } else {
      btn.disabled = false;
      btn.textContent = 'Turn On';
      const msg = res && res.reason === 'denied'
        ? 'Permission denied. You can re-enable it in your browser/app settings.'
        : 'Could not enable notifications on this device.';
      showTransient(cta, msg);
    }
  });
}

function showTransient(container, msg) {
  const p = document.createElement('p');
  p.className = 'notif-err';
  p.textContent = msg;
  container.appendChild(p);
  setTimeout(() => p.remove(), 5000);
}

/* ---------- Live feed (everyone sees this) ---------- */
watchAnnouncements(
  (items) => {
    if (!items.length) {
      feedEl.innerHTML = `<p class="chat-empty">No announcements yet. Check back soon 📣</p>`;
      return;
    }
    feedEl.innerHTML = items.map(renderUpdate).join('');
  },
  () => {
    feedEl.innerHTML = `<p class="chat-empty">Couldn’t load updates. Refresh to retry.</p>`;
  }
);

function renderUpdate(u) {
  const when = u.createdAt?.toDate
    ? u.createdAt.toDate().toLocaleString([], {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'Just now';
  return `
    <article class="update-card">
      <div class="update-head">
        <h3>${escapeHtml(u.title || 'Update')}</h3>
        <time>${when}</time>
      </div>
      <p>${escapeHtml(u.body || '')}</p>
    </article>`;
}

// The board posts announcements from the Director Console (Teams page → sign in),
// so the Updates page is read-only: it just shows the feed + the notify opt-in.

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
