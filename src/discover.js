import { renderHeader, renderFooter, initReveal } from './layout.js';
import discover from './data/discover.json';

renderHeader('discover.html');
renderFooter();

const groups = discover
  .map(
    (group) => `
      <div class="discover-group">
        <div class="discover-head reveal">
          <span class="eyebrow">${group.eyebrow}</span>
          <h3>${group.category}</h3>
          <p>${group.blurb}</p>
        </div>
        <div class="discover-grid">
          ${group.places
            .map(
              (place) => `
            <a class="place-card reveal" href="${place.url}" target="_blank" rel="noopener">
              <span class="place-tag">${place.tag}</span>
              <h4>${place.name}</h4>
              <p>${place.desc}</p>
              <span class="place-link">Visit &rarr;</span>
            </a>`
            )
            .join('')}
        </div>
      </div>`
  )
  .join('');

document.getElementById('discover-content').innerHTML = groups;

initReveal();
