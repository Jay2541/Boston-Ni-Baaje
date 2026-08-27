// Central event config — edit these values, everything else updates automatically.
export const EVENT = {
  name: 'Boston Ni Baaje',
  edition: '1.0',
  theme: 'Fenway',
  tagline: "Boston's newest collegiate Raas competition.",
  venue: {
    name: 'Huntington Theatre',
    org: 'Boston, MA',
    neighborhood: 'the Fenway',
    address: '264 Huntington Ave, Boston, MA 02115',
    photo: 'huntington-theatre.jpg',
    about:
      "One of Boston's landmark performing-arts venues, the Huntington Theatre sits right in the city's Fenway neighborhood, the same iconic corner of Boston that inspires this year's theme. Its grand mainstage is the perfect place to bring collegiate Raas to the big leagues.",
    mapsQuery: 'Huntington Theatre, 264 Huntington Ave, Boston, MA 02115',
  },
  contact: {
    info: 'bostonnibaaje@gmail.com',
    sponsorship: 'bostonnibaaje.sponsorships@gmail.com',
    director: 'director@bostonnibaaje.com',
    registration: 'registration@bostonnibaaje.com',
    hospitality: 'hospitality@bostonnibaaje.com',
  },
  social: {
    instagram: 'https://instagram.com/bostonnibaaje',
    linkedin: 'https://www.linkedin.com/in/boston-ni-baaje-780126422/',
    tiktok: 'https://www.tiktok.com/@bostonnibaaje',
  },
};

export const mapsUrl = (q) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
