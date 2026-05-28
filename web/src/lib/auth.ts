const KEY = 'gnd.token';

export type Role = 'admin' | 'business' | 'user' | 'guest';

export interface TokenPayload {
  sub: number;
  // Null for guest accounts (one-click signup, no email). Becomes a real
  // address once a guest upgrades and verifies.
  email: string | null;
  role: Role;
  iat?: number;
  exp?: number;
}

export function getToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(KEY);
}

export function isAuthed(): boolean {
  return !!getToken();
}

// Best-effort JWT payload decode for client-side UI gating.
// Server is the source of truth — never trust this for authorization.
export function decodeToken(token: string | null = getToken()): TokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
