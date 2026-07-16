import { renderHeader, renderFooter } from './layout.js';
import schedule from './data/schedule.json';

renderHeader('schedule.html');
renderFooter();

const rows = schedule
  .map(
    (item) => `
      <tr>
        <td>${item.time}</td>
        <td>${item.event}</td>
        <td>${item.location}</td>
      </tr>`
  )
  .join('');

document.getElementById('schedule-table').innerHTML = `
  <table class="schedule">
    <thead>
      <tr>
        <th>Time</th>
        <th>Event</th>
        <th>Location</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
`;
