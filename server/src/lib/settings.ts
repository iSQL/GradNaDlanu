import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { appSettings } from '../db/schema.js';

const REGISTRATION_ENABLED_KEY = 'registration_enabled';
const GUESTS_CAN_BOOK_KEY = 'guests_can_book';

export async function isRegistrationEnabled(): Promise<boolean> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, REGISTRATION_ENABLED_KEY))
    .limit(1);
  if (!row) return false;
  return row.value === true;
}

export async function setRegistrationEnabled(enabled: boolean): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: REGISTRATION_ENABLED_KEY, value: enabled })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: enabled, updatedAt: new Date() },
    });
}

// Guests can reserve / request services by default — operators can flip this
// off without disabling guest signup entirely.
export async function guestsCanBook(): Promise<boolean> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, GUESTS_CAN_BOOK_KEY))
    .limit(1);
  if (!row) return true;
  return row.value === true;
}

export async function setGuestsCanBook(enabled: boolean): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: GUESTS_CAN_BOOK_KEY, value: enabled })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: enabled, updatedAt: new Date() },
    });
}
