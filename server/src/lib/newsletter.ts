import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { newsletterSubscribers } from '../db/schema.js';

export type NewsletterCategory = 'desavanja' | 'poruke' | 'marketing';

export interface NewsletterPrefs {
  desavanja: boolean;
  poruke: boolean;
  marketing: boolean;
}

export interface SubscriberView {
  email: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  prefs: NewsletterPrefs;
  token: string;
}

const DEFAULT_PREFS: NewsletterPrefs = { desavanja: true, poruke: false, marketing: false };

// Raw capability token. Not hashed (unlike verification.ts) — it only authorizes
// subscribing/unsubscribing an already-known address and must stay stable so
// every future email can carry the same unsubscribe link.
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function toView(row: typeof newsletterSubscribers.$inferSelect): SubscriberView {
  return {
    email: row.email,
    status: row.status,
    prefs: {
      desavanja: row.prefDesavanja,
      poruke: row.prefPoruke,
      marketing: row.prefMarketing,
    },
    // token is nullable in the schema (legacy rows), but every row we hand out is
    // guaranteed to have one — callers only reach this after an upsert/backfill.
    token: row.token!,
  };
}

// Ensures a row has a token; backfills legacy rows lazily. Returns the token.
async function ensureToken(id: number, existing: string | null): Promise<string> {
  if (existing) return existing;
  const token = generateToken();
  await db.update(newsletterSubscribers).set({ token }).where(eq(newsletterSubscribers.id, id));
  return token;
}

interface UpsertOpts {
  autoConfirm?: boolean;
  userId?: number | null;
}

// Insert-or-update the subscriber keyed by email. Returns the resulting view.
// `autoConfirm` (a logged-in user with an already-verified email) skips double
// opt-in and lands the row straight in 'confirmed'.
export async function upsertSubscriber(
  email: string,
  prefs: NewsletterPrefs,
  opts: UpsertOpts = {},
): Promise<SubscriberView> {
  const lowered = email.trim().toLowerCase();
  const token = generateToken();
  const now = new Date();
  const status = opts.autoConfirm ? 'confirmed' : 'pending';

  const [row] = await db
    .insert(newsletterSubscribers)
    .values({
      email: lowered,
      status,
      prefDesavanja: prefs.desavanja,
      prefPoruke: prefs.poruke,
      prefMarketing: prefs.marketing,
      token,
      confirmedAt: opts.autoConfirm ? now : null,
      userId: opts.userId ?? null,
    })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: {
        prefDesavanja: prefs.desavanja,
        prefPoruke: prefs.poruke,
        prefMarketing: prefs.marketing,
        // Preserve an existing token; only fill it if the legacy row lacked one.
        token: sql`COALESCE(${newsletterSubscribers.token}, ${token})`,
        // autoConfirm always confirms; otherwise, re-subscribing an unsubscribed
        // row must reset it to 'pending' so a fresh opt-in email is required.
        status: opts.autoConfirm
          ? 'confirmed'
          : sql`CASE WHEN ${newsletterSubscribers.status} = 'confirmed' THEN 'confirmed' ELSE 'pending' END`,
        confirmedAt: opts.autoConfirm
          ? now
          : sql`CASE WHEN ${newsletterSubscribers.status} = 'confirmed' THEN ${newsletterSubscribers.confirmedAt} ELSE NULL END`,
        unsubscribedAt: null,
        ...(opts.userId !== undefined ? { userId: opts.userId } : {}),
      },
    })
    .returning();

  const finalToken = await ensureToken(row.id, row.token);
  return toView({ ...row, token: finalToken });
}

export async function getByEmail(email: string): Promise<SubscriberView | null> {
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email.trim().toLowerCase()))
    .limit(1);
  if (!row) return null;
  const token = await ensureToken(row.id, row.token);
  return toView({ ...row, token });
}

export async function getByToken(token: string): Promise<SubscriberView | null> {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.token, token))
    .limit(1);
  return row ? toView(row) : null;
}

// Idempotent: confirming an already-confirmed row is a no-op success.
export async function confirmByToken(token: string): Promise<SubscriberView | null> {
  const current = await getByToken(token);
  if (!current) return null;
  const [row] = await db
    .update(newsletterSubscribers)
    .set({
      status: 'confirmed',
      confirmedAt: sql`COALESCE(${newsletterSubscribers.confirmedAt}, NOW())`,
      unsubscribedAt: null,
    })
    .where(eq(newsletterSubscribers.token, token))
    .returning();
  return row ? toView(row) : null;
}

export async function unsubscribeByToken(token: string): Promise<SubscriberView | null> {
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribers.token, token))
    .returning();
  return row ? toView(row) : null;
}

export async function setPrefsByToken(
  token: string,
  prefs: NewsletterPrefs,
): Promise<SubscriberView | null> {
  const [row] = await db
    .update(newsletterSubscribers)
    .set({
      prefDesavanja: prefs.desavanja,
      prefPoruke: prefs.poruke,
      prefMarketing: prefs.marketing,
    })
    .where(eq(newsletterSubscribers.token, token))
    .returning();
  return row ? toView(row) : null;
}

const CATEGORY_COLUMN = {
  desavanja: newsletterSubscribers.prefDesavanja,
  poruke: newsletterSubscribers.prefPoruke,
  marketing: newsletterSubscribers.prefMarketing,
} as const;

// The confirmed segment that opted into a given category — the audience for a send.
export async function listConfirmedForCategory(
  cat: NewsletterCategory,
): Promise<{ email: string; token: string }[]> {
  const rows = await db
    .select({ email: newsletterSubscribers.email, token: newsletterSubscribers.token })
    .from(newsletterSubscribers)
    .where(and(eq(newsletterSubscribers.status, 'confirmed'), eq(CATEGORY_COLUMN[cat], true)));
  // Confirmed rows always have a token (set at subscribe/confirm time).
  return rows.filter((r): r is { email: string; token: string } => r.token !== null);
}

export interface SubscriberCounts {
  pending: number;
  confirmed: number;
  unsubscribed: number;
  desavanja: number;
  poruke: number;
  marketing: number;
}

export async function subscriberCounts(): Promise<SubscriberCounts> {
  const [row] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${newsletterSubscribers.status} = 'pending')::int`,
      confirmed: sql<number>`count(*) filter (where ${newsletterSubscribers.status} = 'confirmed')::int`,
      unsubscribed: sql<number>`count(*) filter (where ${newsletterSubscribers.status} = 'unsubscribed')::int`,
      desavanja: sql<number>`count(*) filter (where ${newsletterSubscribers.status} = 'confirmed' and ${newsletterSubscribers.prefDesavanja})::int`,
      poruke: sql<number>`count(*) filter (where ${newsletterSubscribers.status} = 'confirmed' and ${newsletterSubscribers.prefPoruke})::int`,
      marketing: sql<number>`count(*) filter (where ${newsletterSubscribers.status} = 'confirmed' and ${newsletterSubscribers.prefMarketing})::int`,
    })
    .from(newsletterSubscribers);
  return row ?? { pending: 0, confirmed: 0, unsubscribed: 0, desavanja: 0, poruke: 0, marketing: 0 };
}

export function defaultPrefs(): NewsletterPrefs {
  return { ...DEFAULT_PREFS };
}
