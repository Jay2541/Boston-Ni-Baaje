import { renderHeader, renderFooter, initReveal } from './layout.js';
import { EVENT } from './data/event.js';
import { BOARD } from './data/board.js';

renderHeader('board.html');
renderFooter();

const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const groups = BOARD.map((group) => {
  const cards = group.members
    .map(
      (m) => `
      <div class="board-card reveal">
        <div class="board-photo">${initials(m.name)}</div>
        <h4>${m.name}</h4>
        <p>${m.role}</p>
      </div>`
    )
    .join('');

  const email = group.contactKey && EVENT.contact[group.contactKey];
  const contact = email ? `<a class="board-contact" href="mailto:${email}">${email}</a>` : '';

  return `
    <div class="board-group reveal">
      <h3>${group.category}</h3>
      <div class="board-cards">${cards}</div>
      ${contact}
    </div>`;
}).join('');

document.getElementById('board-groups').innerHTML = groups;

initReveal();
