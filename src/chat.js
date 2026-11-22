// The BNB app (chat.html) — what opens from the home-screen icon.
// Phone + PIN sign-in, chat list, live chats, info, and the directors' Manage
// screen. Routes live in the URL hash so notification taps can deep-link:
//   (empty) chats · #chat=<id> one chat · #info · #manage
import { isStandalone } from './layout.js';
import { auth } from './firebase.js';
import { logIn, callWorker, formatPhone } from './api.js';
import { enablePush, pushSupported, notifPermission, onForegroundMessage } from './push.js';
import {
  TEAMS,
  ROLE_LABELS,
  chatsFor,
  canPost,
  teamById,
  isStaff,
  watchMember,
  watchMembers,
  watchChatPreviews,
  watchMessages,
  sendMessage,
} from './data/chat.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const BASE = import.meta.env.BASE_URL;
const root = document.getElementById('chat-app');

let member = null;         // members/{uid} + uid, live
let previews = {};         // chatId → { lastMessage, lastFrom, updatedAt }
let unsubMember = null;
let unsubPreviews = null;
let unsubView = null;      // whatever the current screen listens to
let currentChatId = null;
let pushRefreshed = false;
let loginNotice = '';       // shown on the login screen after a forced sign-out

/* ============================================================
   AUTH
   ============================================================ */
onAuthStateChanged(auth, (user) => {
  cleanup();
  if (!user) {
    member = null;
    renderLogin(loginNotice);
    loginNotice = '';
    return;
  }
  unsubMember = watchMember(
    user.uid,
    (m) => {
      if (!m) {
        // Removed by a director (or never finished signing up).
        loginNotice = 'Your account was removed. Ask your captain for your team’s join link to sign up again.';
        signOut(auth);
        return;
      }
      const changed = !member || member.role !== m.role || member.teamId !== m.teamId;
      member = m;
      if (!changed) return;
      startPreviews();
      route();
      refreshPush();
    },
    (err) => {
      // Once removed, the rules stop them reading their own member doc, so
      // removal usually arrives as permission-denied rather than a deleted doc.
      if (err?.code === 'permission-denied') {
        loginNotice = 'Your account was removed. Ask your captain for your team’s join link to sign up again.';
        signOut(auth);
        return;
      }
      renderLogin('Couldn’t load your account. Check your connection and reopen the app.');
    }
  );
});

function cleanup() {
  for (const u of [unsubMember, unsubPreviews, unsubView]) if (u) u();
  unsubMember = unsubPreviews = unsubView = null;
  previews = {};
}

function renderLogin(message = '') {
  currentChatId = null;
  root.innerHTML = `
    <div class="app-login">
      <img src="${BASE}logo.png" alt="Boston Ni Baaje" class="app-login-logo" />
      <h1>Sign in</h1>
      <p>Use the phone number and PIN you signed up with.</p>
      <form id="login-form" class="join-form" novalidate>
        <label>Phone number
          <input type="tel" name="phone" autocomplete="tel" inputmode="tel" placeholder="(617) 555-1234" required />
        </label>
        <label>PIN
          <input type="password" name="pin" inputmode="numeric" autocomplete="current-password" pattern="[0-9]*" maxlength="6" placeholder="4–6 digits" required />
        </label>
        <button type="submit" class="btn btn-primary">Sign in &rarr;</button>
        <div id="login-error" class="login-error" role="alert" ${message ? '' : 'hidden'}>${esc(message)}</div>
      </form>
      <p class="app-login-note">New? Ask your captain or liaison for your team’s <strong>join link</strong>.<br />
        Forgot your PIN? A director can reset it.</p>
      ${isStandalone ? '' : `<a class="btn-ghost" href="${BASE}app.html">How to get the app &rarr;</a>`}
    </div>`;

  const form = document.getElementById('login-form');
  const err = document.getElementById('login-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await logIn({ phone: form.phone.value, pin: form.pin.value });
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Sign in →';
    }
  });
}

/* ============================================================
   ROUTER
   ============================================================ */
window.addEventListener('hashchange', () => member && route());

function route() {
  if (unsubView) { unsubView(); unsubView = null; }
  currentChatId = null;
  const params = new URLSearchParams(location.hash.slice(1));
  const chatId = params.get('chat');
  const chat = chatId && chatsFor(member).find((c) => c.id === chatId);
  if (chat) return renderChat(chat);
  if (location.hash === '#info') return renderShell('info', renderInfo);
  if (location.hash === '#manage' && member.role === 'director') return renderShell('manage', renderManage);
  renderShell('chats', renderChatList);
}

/** Top bar + content + bottom tabs. `fill(el)` renders into the content area. */
function renderShell(tab, fill) {
  const tabs = [
    { id: 'chats', href: '#', icon: '💬', label: 'Chats' },
    { id: 'info', href: '#info', icon: 'ℹ️', label: 'Info' },
  ];
  if (member.role === 'director') tabs.push({ id: 'manage', href: '#manage', icon: '🛠️', label: 'Manage' });
  const titles = { chats: 'Chats', info: 'Info', manage: 'Manage' };

  root.innerHTML = `
    <header class="app-top">
      <img src="${BASE}logo.png" alt="" class="app-top-logo" />
      <h1>${titles[tab]}</h1>
    </header>
    <main class="app-main" id="app-main"></main>
    <nav class="app-tabs">
      ${tabs.map((t) => `
        <a href="${t.href}" class="app-tab${t.id === tab ? ' active' : ''}">
          <span aria-hidden="true">${t.icon}</span>${t.label}
        </a>`).join('')}
    </nav>`;
  fill(document.getElementById('app-main'));
}

/* ============================================================
   CHAT LIST
   ============================================================ */
function startPreviews() {
  if (unsubPreviews) unsubPreviews();
  unsubPreviews = watchChatPreviews(chatsFor(member).map((c) => c.id), (p) => {
    previews = p;
    const list = document.getElementById('chat-list');
    if (list) list.innerHTML = chatListItems();
  });
}

function renderChatList(main) {
  main.innerHTML = `
    <div id="notif-banner"></div>
    <ul class="chat-list" id="chat-list">${chatListItems()}</ul>`;
  renderNotifBanner();
}

function chatListItems() {
  const [announce, ...rest] = chatsFor(member);
  // Announcements stay pinned on top; the rest sort by latest activity.
  rest.sort((a, b) => millis(previews[b.id]?.updatedAt) - millis(previews[a.id]?.updatedAt));
  return [announce, ...rest].map((c) => {
    const p = previews[c.id];
    const unread = p && millis(p.updatedAt) > lastSeen(c.id);
    const preview = p ? `${p.lastFrom ? `${esc(p.lastFrom)}: ` : ''}${esc(p.lastMessage)}` : 'No messages yet';
    return `
      <li>
        <a class="chat-row${unread ? ' unread' : ''}" href="#chat=${encodeURIComponent(c.id)}">
          ${avatar(c)}
          <span class="chat-row-text">
            <span class="chat-row-top">
              <strong>${esc(c.name)}</strong>
              <time>${p ? shortTime(p.updatedAt) : ''}</time>
            </span>
            <span class="chat-row-preview">${preview}</span>
          </span>
        </a>
      </li>`;
  }).join('');
}

function avatar(c) {
  if (c.team) return `<span class="chat-avatar" style="--crest:${c.team.color}">${esc(c.team.initials)}</span>`;
  return `<span class="chat-avatar chat-avatar-icon">${c.icon}</span>`;
}

/* ---------- Notifications opt-in (iPhone needs a tap first) ---------- */
async function renderNotifBanner() {
  const el = document.getElementById('notif-banner');
  if (!el || !(await pushSupported())) return;
  const perm = notifPermission();
  if (perm === 'granted') return;
  el.innerHTML = perm === 'denied'
    ? `<div class="app-banner">🔕 Notifications are off. Turn them on in Settings → Notifications → BNB.</div>`
    : `<div class="app-banner">
        <span><strong>🔔 Turn on notifications</strong> so you don’t miss messages.</span>
        <button class="btn btn-primary" id="notif-btn">Turn on</button>
      </div>`;
  const btn = document.getElementById('notif-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Turning on…';
    const res = await enablePush();
    el.innerHTML = res.ok
      ? `<div class="app-banner ok">✅ Notifications on.</div>`
      : `<div class="app-banner">Couldn’t turn on notifications${res.reason === 'denied' ? ' (blocked in Settings)' : ''}.</div>`;
  });
}

/** Already allowed → quietly re-subscribe so topics match the member's current chats. */
function refreshPush() {
  if (pushRefreshed || notifPermission() !== 'granted') return;
  pushRefreshed = true;
  enablePush();
}

// Don't toast a message for the chat that's already on screen.
onForegroundMessage((payload) => payload?.data?.chatId && payload.data.chatId === currentChatId);

/* ============================================================
   ONE CHAT
   ============================================================ */
function renderChat(chat) {
  currentChatId = chat.id;
  const isAnnounce = chat.id === 'announcements';
  const mayPost = canPost(member, chat.id);

  root.innerHTML = `
    <header class="app-top app-top-chat">
      <a href="#" class="app-back" aria-label="Back to chats">‹</a>
      ${avatar(chat)}
      <h1>${esc(chat.name)}</h1>
    </header>
    <main class="app-main chat-log" id="chat-log"><p class="chat-empty">Loading messages…</p></main>
    ${mayPost ? `
      <form class="chat-composer app-composer" id="chat-form">
        ${isAnnounce ? `<input type="text" id="chat-title" placeholder="Title (optional)" maxlength="80" autocomplete="off" />` : ''}
        <div class="app-composer-row">
          <textarea id="chat-input" rows="1" placeholder="${isAnnounce ? 'Announce to everyone…' : 'Message'}" maxlength="1000"></textarea>
          <button type="submit" class="btn btn-primary" aria-label="Send">➤</button>
        </div>
      </form>` : `<p class="app-readonly">Only directors can post announcements.</p>`}`;

  const log = document.getElementById('chat-log');
  unsubView = watchMessages(
    chat.id,
    (msgs) => {
      markSeen(chat.id);
      if (!msgs.length) {
        log.innerHTML = `<p class="chat-empty">No messages yet. Say hello 👋</p>`;
        return;
      }
      const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
      log.innerHTML = renderMessages(msgs, isAnnounce);
      if (nearBottom || !log.dataset.loaded) log.scrollTop = log.scrollHeight;
      log.dataset.loaded = '1';
    },
    () => { log.innerHTML = `<p class="chat-empty">Couldn’t load messages. Reopen the app to retry.</p>`; }
  );

  if (!mayPost) return;
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const titleInput = document.getElementById('chat-title');

  // Grow the box with the text; Enter sends on desktop, Shift+Enter for a new line.
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const title = titleInput ? titleInput.value : '';
    input.value = '';
    if (titleInput) titleInput.value = '';
    input.style.height = 'auto';
    try {
      await sendMessage(chat.id, member, text, title);
      log.scrollTop = log.scrollHeight;
    } catch {
      input.value = text; // restore so nothing is lost
      if (titleInput) titleInput.value = title;
    }
  });
}

function renderMessages(msgs, isAnnounce) {
  let lastDay = '';
  return msgs.map((m) => {
    const date = toDate(m.createdAt);
    const day = date ? date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    const sep = day && day !== lastDay ? `<div class="chat-day">${day}</div>` : '';
    if (day) lastDay = day;
    const time = date ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

    if (isAnnounce) {
      return `${sep}
        <article class="announce-card">
          ${m.title ? `<h3>${esc(m.title)}</h3>` : ''}
          <p>${esc(m.text)}</p>
          <span class="bubble-time">${esc(m.name || 'Directors')} · ${time}</span>
        </article>`;
    }
    const mine = m.uid === member.uid;
    return `${sep}
      <div class="bubble-row ${mine ? 'mine' : 'theirs'}">
        <div class="bubble">
          ${mine ? '' : `<span class="bubble-who">${esc(m.name || '')}</span>`}
          <p>${esc(m.text)}</p>
          <span class="bubble-time">${time}</span>
        </div>
      </div>`;
  }).join('');
}

/* ============================================================
   INFO
   ============================================================ */
function renderInfo(main) {
  const team = teamById(member.teamId);
  const links = [
    ['🗓️', 'Schedule', 'schedule.html'],
    ['📣', 'Updates', 'updates.html'],
    ['🧭', 'Discover Boston', 'discover.html'],
    ['💃', 'Teams', 'teams.html'],
    ['📚', 'Resources', 'resources.html'],
  ];
  main.innerHTML = `
    <section class="app-card">
      <h2>${esc(member.name)}</h2>
      <p>${esc(formatPhone(member.uid))}</p>
      <p>${ROLE_LABELS[member.role] || ''}${team ? ` · ${esc(team.name)}` : ''}</p>
    </section>
    <ul class="app-links">
      ${links.map(([icon, label, href]) => `<li><a href="${BASE}${href}"><span>${icon}</span>${label}<span class="app-chev">›</span></a></li>`).join('')}
    </ul>
    <button class="btn btn-outline app-signout" id="signout-btn">Sign out</button>`;
  document.getElementById('signout-btn').addEventListener('click', () => {
    pushRefreshed = false;
    signOut(auth);
  });
}

/* ============================================================
   MANAGE (directors) — join links + members
   ============================================================ */
function renderManage(main) {
  const groups = [{ id: 'board', name: 'Board', initials: '🔒', color: 'var(--navy)' }, ...TEAMS];
  main.innerHTML = `
    <section class="app-section">
      <h2>Join links</h2>
      <p class="app-hint">Send each team’s link to its captain once. Anyone with a link can sign up for that team. Tap <strong>New link</strong> to stop an old one from working.</p>
      <ul class="join-links" id="join-links">
        ${groups.map((g) => `
          <li class="join-link" data-target="${g.id}">
            <div class="join-link-head">
              <span class="chat-avatar" style="--crest:${g.color}">${esc(g.initials)}</span>
              <strong>${esc(g.name)}</strong>
            </div>
            <code class="join-link-url">Loading…</code>
            <div class="join-link-actions"></div>
            <div class="join-link-qr" hidden></div>
          </li>`).join('')}
      </ul>
    </section>
    <section class="app-section">
      <h2>Members <span class="app-count" id="member-count"></span></h2>
      <input type="search" id="member-search" class="app-search" placeholder="Search name or number" />
      <div id="member-list"><p class="chat-empty">Loading…</p></div>
    </section>`;

  loadJoinLinks();

  let all = [];
  const search = document.getElementById('member-search');
  const draw = () => drawMembers(all, search.value.trim().toLowerCase());
  search.addEventListener('input', draw);
  unsubView = watchMembers((list) => { all = list; draw(); }, () => {});
}

const joinUrl = (code) => `${location.origin}${BASE}app.html#join=${code}`;

async function loadJoinLinks() {
  let codes = {};
  try {
    ({ codes } = await callWorker('/admin/codes', {}, { withAuth: true }));
  } catch (err) {
    document.querySelectorAll('.join-link-url').forEach((el) => { el.textContent = err.message; });
    return;
  }
  document.querySelectorAll('.join-link').forEach((li) => drawJoinLink(li, codes[li.dataset.target]));
}

function drawJoinLink(li, code) {
  const urlEl = li.querySelector('.join-link-url');
  const actions = li.querySelector('.join-link-actions');
  const qr = li.querySelector('.join-link-qr');
  qr.hidden = true;
  urlEl.textContent = code ? joinUrl(code) : 'No link yet';
  actions.innerHTML = code
    ? `<button class="btn btn-outline" data-act="copy">Copy</button>
       ${navigator.share ? `<button class="btn btn-outline" data-act="share">Share</button>` : ''}
       <button class="btn btn-outline" data-act="qr">QR</button>
       <button class="btn-ghost" data-act="rotate">New link</button>`
    : `<button class="btn btn-primary" data-act="rotate">Create link</button>`;

  actions.onclick = async (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (!act) return;
    const url = code && joinUrl(code);
    const name = li.querySelector('strong').textContent;
    if (act === 'copy') {
      await navigator.clipboard.writeText(url).catch(() => {});
      e.target.textContent = 'Copied!';
    } else if (act === 'share') {
      navigator.share({ title: `Join ${name} on BNB`, text: `Join ${name} on the Boston Ni Baaje app:`, url }).catch(() => {});
    } else if (act === 'qr') {
      if (qr.hidden) {
        const QRCode = (await import('qrcode')).default;
        qr.innerHTML = await QRCode.toString(url, { type: 'svg', margin: 1 });
      }
      qr.hidden = !qr.hidden;
    } else if (act === 'rotate') {
      if (code && !confirm(`Make a new link for ${name}? The old link will stop working (people who already joined stay in).`)) return;
      try {
        const { code: next } = await callWorker('/admin/rotate-code', { target: li.dataset.target }, { withAuth: true });
        drawJoinLink(li, next);
      } catch (err) {
        alert(err.message);
      }
    }
  };
}

function drawMembers(all, q) {
  const listEl = document.getElementById('member-list');
  if (!listEl) return;
  document.getElementById('member-count').textContent = `(${all.length})`;
  const match = (m) => !q || m.name?.toLowerCase().includes(q) || m.uid.includes(q.replace(/\D/g, '') || '§');
  const groups = [
    { label: 'Board & directors', items: all.filter((m) => isStaff(m)) },
    ...TEAMS.map((t) => ({ label: t.name, items: all.filter((m) => !isStaff(m) && m.teamId === t.id) })),
  ];
  const html = groups.map((g) => {
    const items = g.items.filter(match).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!items.length) return '';
    return `<h3 class="member-group">${esc(g.label)} <span>${items.length}</span></h3>
      <ul class="member-list">${items.map(memberRow).join('')}</ul>`;
  }).join('');
  listEl.innerHTML = html || `<p class="chat-empty">No members${q ? ' match' : ' yet'}.</p>`;

  listEl.onchange = async (e) => {
    const li = e.target.closest('[data-uid]');
    if (!li) return;
    const role = li.querySelector('[name=role]').value;
    const teamSel = li.querySelector('[name=team]');
    teamSel.hidden = isStaff({ role });
    try {
      await callWorker('/admin/set-role', { phone: li.dataset.uid, role, teamId: teamSel.value }, { withAuth: true });
    } catch (err) {
      alert(err.message);
    }
  };
  listEl.onclick = async (e) => {
    const act = e.target.closest('button')?.dataset.act;
    const li = e.target.closest('[data-uid]');
    if (!act || !li) return;
    const name = li.querySelector('strong').textContent;
    const msg = act === 'reset'
      ? `Reset ${name}'s PIN? They'll set a new one by opening their team's join link again.`
      : `Remove ${name}? They'll lose access to all chats.`;
    if (!confirm(msg)) return;
    try {
      await callWorker(act === 'reset' ? '/admin/reset-pin' : '/admin/remove', { phone: li.dataset.uid }, { withAuth: true });
      if (act === 'reset') e.target.textContent = 'PIN reset ✓';
    } catch (err) {
      alert(err.message);
    }
  };
}

function memberRow(m) {
  const self = m.uid === member.uid;
  return `
    <li class="member-row" data-uid="${esc(m.uid)}">
      <div class="member-who">
        <strong>${esc(m.name || '—')}</strong>
        <span>${esc(formatPhone(m.uid))}</span>
      </div>
      <div class="member-controls">
        <select name="role" ${self ? 'disabled' : ''} aria-label="Role">
          ${Object.entries(ROLE_LABELS).map(([v, l]) => `<option value="${v}"${v === m.role ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
        <select name="team" ${self ? 'disabled' : ''} aria-label="Team" ${isStaff(m) ? 'hidden' : ''}>
          ${TEAMS.map((t) => `<option value="${t.id}"${t.id === m.teamId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select>
        ${self ? '' : `<button class="btn-ghost" data-act="reset">Reset PIN</button>
        <button class="btn-ghost danger" data-act="remove">Remove</button>`}
      </div>
    </li>`;
}

/* ============================================================
   HELPERS
   ============================================================ */
function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}
function millis(ts) {
  return toDate(ts)?.getTime() || 0;
}
function shortTime(ts) {
  const d = toDate(ts);
  if (!d) return '';
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// "Last seen" per chat for unread dots — a per-device convenience, so localStorage.
function lastSeen(chatId) {
  try {
    return Number(JSON.parse(localStorage.getItem('bnb-seen') || '{}')[chatId]) || 0;
  } catch {
    return 0;
  }
}
function markSeen(chatId) {
  try {
    const seen = JSON.parse(localStorage.getItem('bnb-seen') || '{}');
    seen[chatId] = Date.now();
    localStorage.setItem('bnb-seen', JSON.stringify(seen));
  } catch { /* private mode — no unread dots */ }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
