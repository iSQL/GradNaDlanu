import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { emailVerificationTokens } from '../db/schema.js';

const TOKEN_TTL_HOURS = 24;
const TOKEN_BYTES = 32;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// Generates a fresh verification token for the given user. The raw token (to
// be embedded in the email link) is returned; only its SHA-256 hash is stored
// in the database, so a DB leak doesn't immediately expose live tokens. Any
// existing tokens for the user are deleted so resends rotate cleanly.
export async function createVerificationToken(userId: number): Promise<string> {
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  const raw = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt,
  });
  return raw;
}

// Consumes a token: hashes it, looks up the matching unexpired row, returns
// the userId, and deletes the row. Returns null when the token is unknown or
// expired (we don't distinguish those — both look like "invalid link" to the
// user).
export async function consumeVerificationToken(rawToken: string): Promise<number | null> {
  if (typeof rawToken !== 'string' || rawToken.length === 0) return null;
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const [row] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        gt(emailVerificationTokens.expiresAt, now),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, row.id));
  return row.userId;
}
