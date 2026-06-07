import type { Role } from '../lib/auth';

// Small pill rendered next to a displayName when the role is meaningful to
// surface in the UI. Currently only 'guest' renders a badge — other roles
// (user/business/admin) get no badge to avoid visual noise. Returns null
// rather than empty so callers can drop it inline without conditionals.
interface Props {
  role: Role | undefined | null;
}

export function RoleBadge({ role }: Props) {
  if (role === 'guest') {
    return (
      <span
        className="role-badge role-badge-guest"
        title="Privremeni nalog — istice za 7 dana neaktivnosti"
      >
        gost
      </span>
    );
  }
  if (role === 'curator') {
    return (
      <span
        className="role-badge role-badge-curator"
        title="Kustos sela — održava objekte i komentare u svom selu"
      >
        kustos
      </span>
    );
  }
  return null;
}
