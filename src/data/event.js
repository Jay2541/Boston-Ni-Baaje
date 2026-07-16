// Central event config — edit these values, everything else updates automatically.
export const EVENT = {
  name: 'Boston Ni Baaje',
  edition: '1.0',
  theme: 'Fenway',
  tagline: "Boston's newest collegiate Raas competition.",
  // Event start (used for the countdown). Update to the real date/time.
  // Format: ISO 8601 with timezone offset. Boston is UTC-05:00 in winter (Feb), -04:00 in summer.
  startISO: '2027-02-19T18:00:00-05:00',
  dateLabel: 'February 19–20, 2027',
  dateShort: 'Feb 19–20, 2027',
  venue: {
    name: 'Huntington Theatre',
    org: 'Boston, MA',
    neighborhood: 'the Fenway',
    address: '264 Huntington Ave, Boston, MA 02115',
    about:
      "One of Boston's landmark performing-arts venues, the Huntington Theatre sits right in the city's Fenway neighborhood — the same iconic corner of Boston that inspires this year's theme. Its grand mainstage is the perfect place to bring collegiate Raas to the big leagues.",
    mapsQuery: 'Huntington Theatre, 264 Huntington Ave, Boston, MA 02115',
  },
  contact: {
    info: 'info@bostonnibaaje.com',
    sponsorship: 'sponsorship@bostonnibaaje.com',
  },
  social: {
    instagram: 'https://instagram.com/bostonnibaaje',
  },
};

export const mapsUrl = (q) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
