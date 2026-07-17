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
  { id: 'northeastern', email: 'northeastern@bnb.team', name: 'Northeastern Nakhraas' },
  { id: 'uconn', email: 'uconn@bnb.team', name: 'UConn ThundeRaas' },
  { id: 'gatech', email: 'gatech@bnb.team', name: "GT Ramblin' Raas" },
  { id: 'cmu', email: 'cmu@bnb.team', name: 'CMU Raasta' },
  { id: 'utd', email: 'utd@bnb.team', name: 'UTD TaRaas' },
  { id: 'texas', email: 'texas@bnb.team', name: 'Texas Raas' },
  { id: 'uf', email: 'uf@bnb.team', name: 'UF GatoRaas' },
  { id: 'ucf', email: 'ucf@bnb.team', name: 'UCF KnightRaas' },
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
