import { renderHeader, renderFooter, initReveal } from './layout.js';
import TEAMS from './data/teams.json';

renderHeader('teams.html');
renderFooter();

/* ---------- Competing teams roster ---------- */
const rosterEl = document.getElementById('team-roster');
if (rosterEl) {
  rosterEl.innerHTML = TEAMS.map(
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
if (countEl) countEl.textContent = TEAMS.length;

initReveal();
