import { renderHeader, renderFooter, initReveal } from './layout.js';
import { EVENT, mapsUrl } from './data/event.js';
import schedule from './data/schedule.json';

renderHeader('schedule.html');
renderFooter();

/* ---------- Timeline grouped by day ---------- */
const byDay = schedule.reduce((acc, item) => {
  (acc[item.day] ??= []).push(item);
  return acc;
}, {});

const timeline = Object.entries(byDay)
  .map(
    ([day, items]) => `
      <div class="day-group reveal">
        <h3 class="day-heading"><span>${day}</span></h3>
        <ol class="timeline">
          ${items
            .map(
              (item) => `
            <li class="timeline-item">
              <span class="timeline-time">${item.time}</span>
              <div class="timeline-body">
                <h4>${item.event}</h4>
                ${item.note ? `<p class="timeline-note">${item.note}</p>` : ''}
                <p class="timeline-loc">📍 ${item.location}</p>
              </div>
            </li>`
            )
            .join('')}
        </ol>
      </div>`
  )
  .join('');

document.getElementById('schedule-timeline').innerHTML = timeline;

/* ---------- Venue details from config ---------- */
const venueEl = document.getElementById('venue-details');
if (venueEl) {
  venueEl.innerHTML = `
    <div class="card reveal">
      <h3>Venue</h3>
      <p>${EVENT.venue.name}<br />${EVENT.venue.org}</p>
    </div>
    <div class="card reveal">
      <h3>Address</h3>
      <p>${EVENT.venue.address}</p>
      <a class="btn-ghost" href="${mapsUrl(EVENT.venue.mapsQuery)}" target="_blank" rel="noopener">Open in Maps &rarr;</a>
    </div>
    <div class="card reveal">
      <h3>Date</h3>
      <p>${EVENT.dateLabel}</p>
    </div>
  `;
}

const aboutVenueEl = document.getElementById('venue-about');
if (aboutVenueEl) {
  aboutVenueEl.innerHTML = `
    <div class="venue-feature reveal">
      <span class="venue-eyebrow">⚾ This year's theme &mdash; ${EVENT.theme}</span>
      <h3>About the ${EVENT.venue.name}</h3>
      <p>${EVENT.venue.about}</p>
      <a class="btn btn-outline" href="${mapsUrl(EVENT.venue.mapsQuery)}" target="_blank" rel="noopener">Get Directions &rarr;</a>
    </div>
  `;
}

const contactEmail = document.getElementById('schedule-contact-email');
if (contactEmail) {
  contactEmail.href = `mailto:${EVENT.contact.info}`;
  contactEmail.textContent = EVENT.contact.info;
}

initReveal();
