import { renderHeader, renderFooter, initReveal } from './layout.js';
import teams from './data/teams.json';

renderHeader('teams.html');
renderFooter();

/* ---------- Competing teams roster ---------- */
const roster = teams
  .map(
    (t) => `
      <div class="team-card reveal">
        <span class="team-crest" style="--crest:${t.color}">${t.initials}</span>
        <div class="team-meta">
          <h4>${t.name}</h4>
          <p>${t.school}</p>
        </div>
      </div>`
  )
  .join('');

const rosterEl = document.getElementById('team-roster');
if (rosterEl) rosterEl.innerHTML = roster;

const countEl = document.getElementById('team-count');
if (countEl) countEl.textContent = teams.length;

/* ---------- Team sign-in (preview — no backend yet) ---------- */
const form = document.getElementById('team-login-form');
const status = document.getElementById('login-status');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.className = 'login-status show';
    status.innerHTML = `
      <strong>Team portals are coming soon. 🎉</strong>
      Once teams are confirmed, you'll sign in here to see your personalized
      check-in time, stage slot, and to submit your roster, music, and tech needs.
      Questions in the meantime? Email <a href="mailto:info@bostonnibaaje.com">info@bostonnibaaje.com</a>.
    `;
  });
}

initReveal();
