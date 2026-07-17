import { renderHeader, renderFooter } from './layout.js';
import { auth, VAPID_PUBLIC_KEY, PUSH_WORKER_URL } from './firebase.js';
import { resolveMember } from './data/members.js';
import { watchAnnouncements, postAnnouncement } from './data/updates.js';
import { enablePush, pushSupported, notifPermission } from './push.js';
import { onAuthStateChanged, getIdToken } from 'firebase/auth';

renderHeader('updates.html');
renderFooter();

const feedEl = document.getElementById('updates-feed');
const composerSlot = document.getElementById('updates-composer');

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

/* ---------- Board-only composer ---------- */
onAuthStateChanged(auth, (user) => {
  const member = resolveMember(user);
  if (member.role !== 'board') {
    composerSlot.hidden = true;
    composerSlot.innerHTML = '';
    return;
  }
  composerSlot.hidden = false;
  composerSlot.innerHTML = `
    <form class="update-composer" id="post-update">
      <span class="chat-eyebrow">Post an announcement (visible to everyone)</span>
      <input type="text" id="up-title" placeholder="Title — e.g. Doors open at noon" maxlength="80" required />
      <textarea id="up-body" placeholder="Details…" rows="3" maxlength="500" required></textarea>
      <button type="submit" class="btn btn-primary">Post Update →</button>
      <div id="up-status" class="post-status" role="status" hidden></div>
    </form>
  `;

  const form = document.getElementById('post-update');
  const status = document.getElementById('up-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('up-title').value;
    const body = document.getElementById('up-body').value;
    if (!title.trim() || !body.trim()) return;
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Posting…';
    try {
      // 1) Always save to the feed (everyone sees it in-app).
      await postAnnouncement({ title, body });

      // 2) If the push Worker is configured, also buzz subscribed phones.
      let pushed = false;
      if (PUSH_WORKER_URL) {
        try {
          const idToken = await getIdToken(auth.currentUser);
          const res = await fetch(`${PUSH_WORKER_URL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, title: title.trim(), body: body.trim() }),
          });
          pushed = res.ok;
        } catch { /* feed post already succeeded; push is best-effort */ }
      }

      form.reset();
      showStatus(
        status,
        pushed
          ? 'Posted & notifications sent! 🎉'
          : 'Posted to the feed! (Push not sent — check Worker setup.)',
        true
      );
    } catch {
      showStatus(status, 'Could not post — are you signed in as the board?', false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Post Update →';
    }
  });
});

function showStatus(el, msg, ok) {
  el.textContent = msg;
  el.hidden = false;
  el.className = `post-status ${ok ? 'ok' : 'err'}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
