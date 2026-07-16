import { renderHeader, renderFooter, initReveal } from './layout.js';
import { EVENT } from './data/event.js';

renderHeader('sponsors.html');
renderFooter();

const contactEmail = document.getElementById('sponsor-contact-email');
if (contactEmail) {
  contactEmail.href = `mailto:${EVENT.contact.sponsorship}`;
  contactEmail.textContent = EVENT.contact.sponsorship;
}

const cta = document.getElementById('sponsor-cta');
if (cta) cta.href = `mailto:${EVENT.contact.sponsorship}?subject=Sponsorship%20Inquiry%20—%20Boston%20Ni%20Baaje%201.0`;

initReveal();
