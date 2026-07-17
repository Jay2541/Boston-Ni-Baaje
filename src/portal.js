import { renderHeader, renderFooter, initReveal } from './layout.js';
import { auth, db } from './firebase.js';
import { resolveMember, TEAM_ACCOUNTS } from './data/members.js';
import { broadcast } from './data/updates.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
} from 'firebase/firestore';

renderHeader('teams.html');
renderFooter();

/* ---------- Competing teams roster (shown when signed out) ---------- */
const rosterEl = document.getElementById('team-roster');
if (rosterEl) {
  rosterEl.innerHTML = TEAM_ACCOUNTS.map(
    (t) => `
      <div class="team-card">
        <span class="team-crest" style="--crest:${t.color || 'var(--gold)'}">${t.initials || ''}</span>
        <div class="team-meta">
          <h4>${t.name}</h4>
          <p>${t.school || ''}</p>
        </div>
      </div>`
  ).join('');
}
const countEl = document.getElementById('team-count');
if (countEl) countEl.textContent = TEAM_ACCOUNTS.length;

initReveal();

const rosterSection = document.getElementById('teams');
const portalSection = document.getElementById('team-portal');
const portalHead = document.getElementById('portal-head');
const loginView = document.getElementById('portal-login');
const chatView = document.getElementById('portal-chat');
const loginForm = document.getElementById('portal-login-form');
const loginError = document.getElementById('portal-login-error');

let unsubMessages = null; // detach the active thread listener when switching

/* ---------- Auth state ---------- */
onAuthStateChanged(auth, (user) => {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }

  if (!user) {
    // Signed out: show the marketing roster + login form.
    if (rosterSection) rosterSection.hidden = false;
    if (portalHead) portalHead.hidden = false;
    loginView.hidden = false;
    chatView.hidden = true;
    return;
  }

  const member = resolveMember(user);
  if (member.role === 'unknown') {
    signOut(auth);
    showLoginError('This account isn’t set up for the portal. Contact the directors.');
    return;
  }

  // Signed in: hide the marketing sections, show the app-like console.
  if (rosterSection) rosterSection.hidden = true;
  if (portalHead) portalHead.hidden = true;
  loginView.hidden = true;
  chatView.hidden = false;
  member.role === 'board' ? renderBoard() : renderTeam(member.team);
});

/* ---------- Login ---------- */
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearLoginError();
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;
    const btn = loginForm.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      showLoginError(friendlyAuthError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In →';
    }
  });
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.hidden = false;
}
function clearLoginError() {
  loginError.hidden = true;
}
function friendlyAuthError(err) {
  const code = err?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Wrong email or password. Check with the directors if unsure.';
  }
  if (code.includes('too-many-requests')) return 'Too many attempts — try again in a bit.';
  if (code.includes('network')) return 'Network issue — check your connection.';
  return 'Could not sign in. Please try again.';
}

/* ============================================================
   TEAM VIEW — one full chat with the directors
   ============================================================ */
function renderTeam(team) {
  chatView.innerHTML = `
    <div class="console console-team">
      <div class="console-topbar">
        <div>
          <span class="chat-eyebrow">Team Portal</span>
          <h3>${team.name}</h3>
        </div>
        <button class="btn-ghost" id="signout-btn">Sign out</button>
      </div>
      <p class="console-sub">Chat directly with the Boston Ni Baaje directors. They'll see your messages in real time.</p>
      <div class="chat-log" id="chat-log"><p class="chat-empty">Loading messages…</p></div>
      ${composer('Message the directors…')}
    </div>
  `;
  wireSignOut();
  openThread(team.id, 'team');
}

/* ============================================================
   DIRECTOR CONSOLE — sidebar + main panel
   ============================================================ */
function renderBoard() {
  const teamItems = TEAM_ACCOUNTS.map(
    (t) => `
      <button class="console-nav-item" data-view="team" data-team="${t.id}" data-name="${t.name}">
        <span class="console-crest" style="--crest:${t.color || 'var(--gold)'}">${t.initials || ''}</span>
        <span class="console-nav-label">${t.name}</span>
      </button>`
  ).join('');

  chatView.innerHTML = `
    <div class="console console-board">
      <aside class="console-side">
        <div class="console-side-head">
          <span class="chat-eyebrow">Director Console</span>
          <button class="btn-ghost" id="signout-btn">Sign out</button>
        </div>
        <button class="console-nav-item announce-item active" data-view="announce">
          <span class="console-crest announce-crest">📢</span>
          <span class="console-nav-label">Announce to All Teams</span>
        </button>
        <div class="console-side-label">Team Chats</div>
        <div class="console-nav-list">${teamItems}</div>
      </aside>
      <section class="console-main" id="console-main"></section>
    </div>
  `;
  wireSignOut();

  const items = chatView.querySelectorAll('.console-nav-item');
  items.forEach((item) => {
    item.addEventListener('click', () => {
      items.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      if (item.dataset.view === 'announce') {
        showAnnounceView();
      } else {
        showTeamChat(item.dataset.team, item.dataset.name);
      }
    });
  });

  // Default landing view = the broadcast panel (the thing directors do most).
  showAnnounceView();
}

/* ---------- Board: Announce-to-all panel ---------- */
function showAnnounceView() {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  const main = document.getElementById('console-main');
  main.innerHTML = `
    <div class="announce-panel">
      <div class="announce-header">
        <span class="announce-badge">📢 Broadcast</span>
        <h3>Announce to All Teams</h3>
        <p>Posts to the in-app Updates feed <strong>and</strong> pushes a notification to every phone that turned notifications on. All ${TEAM_ACCOUNTS.length} teams see it.</p>
      </div>
      <form class="announce-form" id="announce-form">
        <label>Title
          <input type="text" id="an-title" placeholder="e.g. Doors open at noon" maxlength="80" required />
        </label>
        <label>Message
          <textarea id="an-body" placeholder="Head to the Huntington Theatre lobby to check in." rows="4" maxlength="500" required></textarea>
        </label>
        <button type="submit" class="btn btn-primary">📣 Send to All Teams</button>
        <div id="an-status" class="post-status" role="status" hidden></div>
      </form>
    </div>
  `;

  const form = document.getElementById('announce-form');
  const status = document.getElementById('an-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('an-title').value;
    const body = document.getElementById('an-body').value;
    if (!title.trim() || !body.trim()) return;
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const { pushed } = await broadcast({ title, body });
      form.reset();
      showStatus(status, pushed
        ? '✅ Sent to all teams — feed updated and phones notified!'
        : '✅ Posted to the feed for all teams. (Push not sent — check Worker setup.)', true);
    } catch {
      showStatus(status, 'Could not send. Make sure you’re signed in as the board.', false);
    } finally {
      btn.disabled = false;
      btn.textContent = '📣 Send to All Teams';
    }
  });
}

/* ---------- Board: one team's chat ---------- */
function showTeamChat(teamId, teamName) {
  const main = document.getElementById('console-main');
  main.innerHTML = `
    <div class="console-chat">
      <div class="console-chat-head">
        <span class="chat-eyebrow">Direct chat</span>
        <h3>${teamName}</h3>
      </div>
      <div class="chat-log" id="chat-log"><p class="chat-empty">Loading messages…</p></div>
      ${composer('Reply to ' + teamName + '…')}
    </div>
  `;
  openThread(teamId, 'board');
}

function composer(placeholder) {
  return `
    <form class="chat-composer" id="chat-form">
      <input type="text" id="chat-input" placeholder="${placeholder}" autocomplete="off" maxlength="1000" />
      <button type="submit" class="btn btn-primary" aria-label="Send">➤</button>
    </form>
  `;
}

/* ---------- Live thread (shared by team + board chat) ---------- */
function openThread(teamId, senderRole) {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }

  const log = document.getElementById('chat-log');
  const msgs = collection(db, 'threads', teamId, 'messages');
  const q = query(msgs, orderBy('createdAt', 'asc'));

  unsubMessages = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        log.innerHTML = `<p class="chat-empty">No messages yet. Say hello 👋</p>`;
        return;
      }
      log.innerHTML = snap.docs.map((d) => renderBubble(d.data(), senderRole)).join('');
      log.scrollTop = log.scrollHeight;
    },
    () => {
      log.innerHTML = `<p class="chat-empty">Couldn’t load messages. Refresh to retry.</p>`;
    }
  );

  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await addDoc(msgs, { text, from: senderRole, createdAt: serverTimestamp() });
      await setDoc(
        doc(db, 'threads', teamId),
        { lastMessage: text, lastFrom: senderRole, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch {
      input.value = text; // restore so nothing is lost
    }
  };
}

function renderBubble(m, viewerRole) {
  const mine = m.from === viewerRole;
  const who = m.from === 'board' ? 'Directors' : 'Team';
  const time = m.createdAt?.toDate
    ? m.createdAt.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  return `
    <div class="bubble-row ${mine ? 'mine' : 'theirs'}">
      <div class="bubble">
        <span class="bubble-who">${who}</span>
        <p>${escapeHtml(m.text)}</p>
        <span class="bubble-time">${time}</span>
      </div>
    </div>`;
}

function wireSignOut() {
  const btn = document.getElementById('signout-btn');
  if (btn) btn.addEventListener('click', () => signOut(auth));
}

function showStatus(el, msg, ok) {
  el.textContent = msg;
  el.hidden = false;
  el.className = `post-status ${ok ? 'ok' : 'err'}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
