// "Get the App" page — also where team join links land (app.html#join=<code>).
// Step 1 creates the account (phone + PIN), step 2 shows install steps for this
// phone, step 3 says how to sign in inside the installed app.
//
// Why sign in twice on iPhone: Safari and the home-screen app don't share
// storage, so the account is created here and the app asks for phone + PIN once.
import { renderHeader, renderFooter, initReveal, isStandalone } from './layout.js';
import { signUp, formatPhone } from './api.js';
import { teamById } from './data/chat.js';

const BASE = import.meta.env.BASE_URL;

renderHeader('app.html');
renderFooter();
initReveal();

const joinCode = new URLSearchParams(location.hash.slice(1)).get('join') || '';

// Already in the installed app with nothing to join → go to the chats.
if (isStandalone && !joinCode) location.replace(`${BASE}chat.html`);

const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const inAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|GroupMe|LinkedInApp|TikTok|musical_ly|Twitter|Line\//i.test(ua);

/* ---------- Step 0: escape in-app browsers ---------- */
if (inAppBrowser && (isIOS || isAndroid)) {
  document.getElementById('inapp-banner').hidden = false;
  document.getElementById('inapp-text').innerHTML = isIOS
    ? 'This app’s browser can’t add BNB to your home screen. Tap <strong>•••</strong> (or the compass icon) → <strong>Open in Safari</strong>.'
    : 'This app’s browser can’t install BNB. Tap <strong>⋮</strong> → <strong>Open in Chrome</strong>.';
  document.getElementById('copy-link').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(location.href);
      e.currentTarget.textContent = 'Copied! Paste it in Safari/Chrome';
    } catch {
      e.currentTarget.textContent = location.href;
    }
  });
}

/* ---------- Step 2: only show this phone's install steps ---------- */
if (isIOS) document.getElementById('install-android').hidden = true;
if (isAndroid) document.getElementById('install-ios').hidden = true;
if (isStandalone) document.getElementById('step-install').hidden = true;

// Chrome on Android offers a one-tap install prompt.
const installBtn = document.getElementById('install-btn');
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  installBtn.hidden = false;
  document.getElementById('android-manual').hidden = true;
});
installBtn.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  installBtn.hidden = true;
  if (outcome === 'accepted') {
    installBtn.insertAdjacentHTML('afterend', '<p class="join-hint">✅ Installed! Find BNB on your home screen.</p>');
  } else {
    document.getElementById('android-manual').hidden = false;
  }
});

/* ---------- Step 1: create account from the join link ---------- */
if (joinCode) {
  const target = joinCode.split('-')[0].toLowerCase();
  const team = teamById(target);
  const groupName = target === 'board' ? 'the BNB board' : team ? team.name : null;

  document.getElementById('step-account').hidden = false;
  document.getElementById('no-code-note').hidden = true;
  if (groupName) {
    document.getElementById('app-title').textContent = `Join ${groupName} 🎉`;
    document.getElementById('join-heading').textContent = `Create your account for ${groupName}`;
  }
  document.getElementById('app-intro').textContent =
    'Three quick steps: create your account, add BNB to your home screen, then sign in.';
} else {
  // No join code: just the install steps. Renumber so they read 1, 2.
  document.querySelector('#step-install .join-num').textContent = '1';
  document.querySelector('#step-open .join-num').textContent = '2';
}

const form = document.getElementById('join-form');
const errorEl = document.getElementById('join-error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const pin = form.pin.value.trim();

  if (!name) return showError('Please enter your name.');
  if (phone.replace(/\D/g, '').length < 10) return showError('Enter your full phone number.');
  if (!/^\d{4,6}$/.test(pin)) return showError('Your PIN must be 4–6 digits.');
  if (pin !== form.pin2.value.trim()) return showError('The two PINs don’t match.');

  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    await signUp({ code: joinCode, name, phone, pin });
    accountReady(phone, `✅ You’re in, ${escapeHtml(name.split(' ')[0])}! Account created for <strong>${escapeHtml(formatPhone(phone))}</strong>.`);
  } catch (err) {
    if (err.status === 409) {
      accountReady(phone, `👋 <strong>${escapeHtml(formatPhone(phone))}</strong> already has an account. Skip to step 2.`);
    } else {
      showError(err.message);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create account →';
  }
});

function accountReady(phone, html) {
  // Inside the installed app (Android) the sign-in carries over — go straight in.
  if (isStandalone) {
    location.replace(`${BASE}chat.html`);
    return;
  }
  form.hidden = true;
  const done = document.getElementById('join-done');
  done.innerHTML = html;
  done.hidden = false;
  document.getElementById('step-account').classList.add('is-done');
  document.getElementById('open-text').innerHTML =
    `Tap the BNB icon on your home screen and sign in with <strong>${escapeHtml(formatPhone(phone))}</strong> and your PIN.`;
  document.getElementById('step-install').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
