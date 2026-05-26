import { sql } from '../db/client.js';

export type CafePayload = {
  tableId: string;
  slotStart: string; // ISO timestamp (UTC)
  slotEnd: string;   // ISO timestamp (UTC)
  guests: number;
};

export type HotelPayload = {
  roomKey: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD (exclusive — checkout day)
  guests: number;
};

export type ReservationPayload = CafePayload | HotelPayload;

export function isCafePayload(p: unknown): p is CafePayload {
  return !!p && typeof p === 'object'
    && typeof (p as CafePayload).tableId === 'string'
    && typeof (p as CafePayload).slotStart === 'string'
    && typeof (p as CafePayload).slotEnd === 'string'
    && typeof (p as CafePayload).guests === 'number';
}

export function isHotelPayload(p: unknown): p is HotelPayload {
  return !!p && typeof p === 'object'
    && typeof (p as HotelPayload).roomKey === 'string'
    && typeof (p as HotelPayload).dateFrom === 'string'
    && typeof (p as HotelPayload).dateTo === 'string'
    && typeof (p as HotelPayload).guests === 'number';
}

const ACTIVE_STATUSES = ['pending', 'approved'];

// Returns the IDs of conflicting reservations (excluding `excludeId` if given —
// used when re-checking on approve so the row being approved isn't its own conflict).
export async function findCafeConflicts(
  locationId: number,
  payload: CafePayload,
  excludeId?: number,
): Promise<number[]> {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM reservations
    WHERE location_id = ${locationId}
      AND status = ANY(${ACTIVE_STATUSES})
      AND payload->>'tableId' = ${payload.tableId}
      AND tstzrange(
            (payload->>'slotStart')::timestamptz,
            (payload->>'slotEnd')::timestamptz,
            '[)'
          ) &&
          tstzrange(${payload.slotStart}::timestamptz, ${payload.slotEnd}::timestamptz, '[)')
      AND (${excludeId ?? null}::int IS NULL OR id <> ${excludeId ?? null}::int)
  `;
  return rows.map((r) => r.id);
}

export async function findHotelConflicts(
  locationId: number,
  payload: HotelPayload,
  excludeId?: number,
): Promise<number[]> {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM reservations
    WHERE location_id = ${locationId}
      AND status = ANY(${ACTIVE_STATUSES})
      AND payload->>'roomKey' = ${payload.roomKey}
      AND daterange(
            (payload->>'dateFrom')::date,
            (payload->>'dateTo')::date,
            '[)'
          ) &&
          daterange(${payload.dateFrom}::date, ${payload.dateTo}::date, '[)')
      AND (${excludeId ?? null}::int IS NULL OR id <> ${excludeId ?? null}::int)
  `;
  return rows.map((r) => r.id);
}

const PAST_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_CAFE_DURATION_MS = 8 * 60 * 60 * 1000;
const MAX_HOTEL_DURATION_DAYS = 90;
const MAX_LEAD_TIME_MS = 365 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(s: string): boolean {
  return DATE_ONLY_RE.test(s);
}

export function validateCafePayload(p: unknown): { ok: true; payload: CafePayload } | { ok: false; error: string } {
  if (!isCafePayload(p)) return { ok: false, error: 'invalid cafe payload (need tableId, slotStart, slotEnd, guests)' };
  const start = Date.parse(p.slotStart);
  const end = Date.parse(p.slotEnd);
  if (Number.isNaN(start) || Number.isNaN(end)) return { ok: false, error: 'slotStart/slotEnd must be ISO timestamps' };
  if (end <= start) return { ok: false, error: 'slotEnd must be after slotStart' };
  const now = Date.now();
  if (start < now - PAST_TOLERANCE_MS) return { ok: false, error: 'slotStart is in the past' };
  if (start > now + MAX_LEAD_TIME_MS) return { ok: false, error: 'slotStart is more than a year out' };
  if (end - start > MAX_CAFE_DURATION_MS) return { ok: false, error: 'reservation longer than 8 hours' };
  if (p.tableId.length === 0 || p.tableId.length > 64) return { ok: false, error: 'tableId length out of range' };
  if (p.guests < 1 || p.guests > 20) return { ok: false, error: 'guests must be 1..20' };
  return { ok: true, payload: p };
}

export function validateHotelPayload(p: unknown): { ok: true; payload: HotelPayload } | { ok: false; error: string } {
  if (!isHotelPayload(p)) return { ok: false, error: 'invalid hotel payload (need roomKey, dateFrom, dateTo, guests)' };
  if (!isDateOnly(p.dateFrom) || !isDateOnly(p.dateTo)) return { ok: false, error: 'dateFrom/dateTo must be YYYY-MM-DD' };
  const from = Date.parse(p.dateFrom + 'T00:00:00Z');
  const to = Date.parse(p.dateTo + 'T00:00:00Z');
  if (Number.isNaN(from) || Number.isNaN(to)) return { ok: false, error: 'dateFrom/dateTo must be YYYY-MM-DD' };
  if (to <= from) return { ok: false, error: 'dateTo must be after dateFrom' };
  const now = Date.now();
  const todayStart = Math.floor(now / MS_PER_DAY) * MS_PER_DAY;
  if (from < todayStart) return { ok: false, error: 'dateFrom is in the past' };
  if (from > now + MAX_LEAD_TIME_MS) return { ok: false, error: 'dateFrom is more than a year out' };
  if ((to - from) / MS_PER_DAY > MAX_HOTEL_DURATION_DAYS) return { ok: false, error: `stay longer than ${MAX_HOTEL_DURATION_DAYS} days` };
  if (p.roomKey.length === 0 || p.roomKey.length > 64) return { ok: false, error: 'roomKey length out of range' };
  if (p.guests < 1 || p.guests > 20) return { ok: false, error: 'guests must be 1..20' };
  return { ok: true, payload: p };
}
