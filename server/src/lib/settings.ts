import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { appSettings } from '../db/schema.js';

const REGISTRATION_ENABLED_KEY = 'registration_enabled';

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
