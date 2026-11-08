// Board roster, one entry per committee (in display order).
//
// Committee photos: drop image files into src/assets/board/ named `<slug>-1.jpg`,
// `<slug>-2.jpg`, ... (jpg, jpeg, png or webp) and they appear in that committee's
// card in the board strip automatically (the first photo is used), e.g. `tech-1.jpg`,
// `head-liaison-1.webp`. Until a committee has a photo, its card shows a brand-colored
// stand-in with the logo.
// Tip: resize photos to about 1600px wide first so the page stays fast.
export const BOARD = [
  { slug: 'directors', category: 'Directors', members: ['Maya Mehta', 'Diya Chatwani'] },
  { slug: 'logistics', category: 'Logistics', members: ['Jheel Patel', 'Aastha Patel', 'Shreya Patel'] },
  {
    slug: 'hospitality',
    category: 'Hospitality',
    members: ['Inesh Parikh', 'Moulika Sivalenka', 'Sahasra Karri', 'Sanketh Udupa'],
  },
  { slug: 'show', category: 'Show', members: ['Suhani Shah', 'Aarya Patel', 'Nidhi Tadepalli'] },
  { slug: 'tech', category: 'Tech', members: ['Jay Patel', 'Ved Naykude'] },
  { slug: 'finance', category: 'Finance', members: ['Hitesh Damineni', 'Parth Patel'] },
  { slug: 'sponsorship', category: 'Sponsorship', members: ['Risha Khanderia', 'Shreyas Lenkala'] },
  { slug: 'social', category: 'Social', members: ['Samarth Keerthivasan', 'Janvi Shah'] },
  { slug: 'registration', category: 'Registration', members: ['Himasri Cheerla', 'Anya Amin'] },
  { slug: 'marketing', category: 'Marketing', members: ['Aishani Raju', 'Sanjana Chennupati'] },
  { slug: 'creative', category: 'Creative', members: ['Maya Nair', 'Ariya Patel', 'Nithya Gangireddy'] },
  { slug: 'head-liaison', category: 'Head Liaison', members: ['Hetvi Khamar'] },
  { slug: 'judging', category: 'Judging', members: ['Varsha Sathish'] },
];
