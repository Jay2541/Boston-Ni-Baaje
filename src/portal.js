import { renderHeader, renderFooter } from './layout.js';
import { auth, db } from './firebase.js';
import { resolveMember, TEAM_ACCOUNTS } from './data/members.js';
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

const loginView = document.getElementById('portal-login');
const chatView = document.getElementById('portal-chat');
const loginForm = document.getElementById('portal-login-form');
const loginError = document.getElementById('portal-login-error');

let unsubMessages = null; // detach the active thread listener when switching

/* ---------- Auth state ---------- */
onAuthStateChanged(auth, (user) => {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }

  if (!user) {
    loginView.hidden = false;
    chatView.hidden = true;
    return;
  }

  const member = resolveMember(user);
  if (member.role === 'unknown') {
    // Signed in but not a recognized team/board account.
    signOut(auth);
    showLoginError('This account isn’t set up for the portal. Contact the directors.');
    return;
  }

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

/* ---------- Team view: single thread ---------- */
function renderTeam(team) {
  chatView.innerHTML = `
    <div class="chat-shell">
      <div class="chat-topbar">
        <div>
          <span class="chat-eyebrow">Team Portal</span>
          <h3>${team.name}</h3>
        </div>
        <button class="btn-ghost" id="signout-btn">Sign out</button>
      </div>
      <div class="chat-log" id="chat-log"><p class="chat-empty">Loading messages…</p></div>
      ${composer()}
    </div>
  `;
  wireSignOut();
  openThread(team.id, 'team');
}

/* ---------- Board view: pick a team, then its thread ---------- */
function renderBoard() {
  const tabs = TEAM_ACCOUNTS.map(
    (t, i) => `<button class="team-tab${i === 0 ? ' active' : ''}" data-team="${t.id}" data-name="${t.name}">${t.name}</button>`
  ).join('');

  chatView.innerHTML = `
    <div class="chat-shell chat-shell-board">
      <div class="chat-topbar">
        <div>
          <span class="chat-eyebrow">Director Inbox</span>
          <h3 id="board-active-team">${TEAM_ACCOUNTS[0].name}</h3>
        </div>
        <button class="btn-ghost" id="signout-btn">Sign out</button>
      </div>
      <div class="board-tabs">${tabs}</div>
      <div class="chat-log" id="chat-log"><p class="chat-empty">Loading messages…</p></div>
      ${composer()}
    </div>
  `;
  wireSignOut();

  const tabEls = chatView.querySelectorAll('.team-tab');
  tabEls.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabEls.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('board-active-team').textContent = tab.dataset.name;
      openThread(tab.dataset.team, 'board');
    });
  });

  openThread(TEAM_ACCOUNTS[0].id, 'board');
}

function composer() {
  return `
    <form class="chat-composer" id="chat-form">
      <input type="text" id="chat-input" placeholder="Type a message…" autocomplete="off" maxlength="1000" />
      <button type="submit" class="btn btn-primary" aria-label="Send">➤</button>
    </form>
  `;
}

/* ---------- Live thread ---------- */
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
      log.innerHTML = snap.docs
        .map((d) => renderBubble(d.data(), senderRole))
        .join('');
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
      await addDoc(msgs, {
        text,
        from: senderRole, // 'team' | 'board'
        createdAt: serverTimestamp(),
      });
      // Touch the thread doc so the board could sort by latest activity later.
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

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
