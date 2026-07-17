// Maps Firebase Auth accounts to who they are in the app.
//
// One shared login per team + one board account. You'll create these accounts
// in the Firebase console (Authentication → Users → Add user) using these exact
// emails, and hand each team their email + password.
//
// Emails are NOT secrets (only passwords are), so it's fine to list them here.

// The board/admin account — sees every team's thread and can reply + broadcast.
export const BOARD_EMAIL = 'board@bostonnibaaje.com';

// Team accounts. `id` must be stable (used as the Firestore thread id).
export const TEAM_ACCOUNTS = [
  { id: 'northeastern', email: 'northeastern@bnb.team', name: 'Northeastern Nakhraas', school: 'Northeastern University', initials: 'NU', color: '#c8102e' },
  { id: 'uconn', email: 'uconn@bnb.team', name: 'UConn ThundeRaas', school: 'University of Connecticut', initials: 'UC', color: '#0e1a3c' },
  { id: 'gatech', email: 'gatech@bnb.team', name: "GT Ramblin' Raas", school: 'Georgia Tech', initials: 'GT', color: '#b3a369' },
  { id: 'cmu', email: 'cmu@bnb.team', name: 'CMU Raasta', school: 'Carnegie Mellon University', initials: 'CMU', color: '#c41230' },
  { id: 'utd', email: 'utd@bnb.team', name: 'UTD TaRaas', school: 'UT Dallas', initials: 'UTD', color: '#e87500' },
  { id: 'texas', email: 'texas@bnb.team', name: 'Texas Raas', school: 'UT Austin', initials: 'UT', color: '#bf5700' },
  { id: 'uf', email: 'uf@bnb.team', name: 'UF GatoRaas', school: 'University of Florida', initials: 'UF', color: '#0021a5' },
  { id: 'ucf', email: 'ucf@bnb.team', name: 'UCF KnightRaas', school: 'University of Central Florida', initials: 'UCF', color: '#ba9b37' },
];

const BY_EMAIL = new Map(TEAM_ACCOUNTS.map((t) => [t.email.toLowerCase(), t]));

/** Resolve a signed-in user to { role, team } where role is 'board' | 'team' | 'unknown'. */
export function resolveMember(user) {
  if (!user || !user.email) return { role: 'unknown', team: null };
  const email = user.email.toLowerCase();
  if (email === BOARD_EMAIL.toLowerCase()) return { role: 'board', team: null };
  const team = BY_EMAIL.get(email);
  if (team) return { role: 'team', team };
  return { role: 'unknown', team: null };
}
