import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { objectMaps, reservations } from '../db/schema.js';
import { requireOwner } from '../lib/auth.js';
import { getLocationBySlug } from '../lib/locations.js';

const MAX_ITEMS = 200;
const MAX_DIMENSION = 5000;
const MAX_LABEL = 200;
const MAX_ID = 64;

interface BaseItem { id: string; type: 'table' | 'room' | 'wall' | 'door'; x: number; y: number }
interface BoxItem extends BaseItem { w: number; h: number }
interface TableItem extends BoxItem { type: 'table'; label: string; capacity: number }
interface RoomItem  extends BoxItem { type: 'room';  label: string; roomKey: string; capacity: number }
interface WallItem  extends BoxItem { type: 'wall' }
interface DoorItem  extends BaseItem { type: 'door' }
type LayoutItem = TableItem | RoomItem | WallItem | DoorItem;

interface Layout {
  width: number;
  height: number;
  items: LayoutItem[];
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function nonNegFinite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function validateLayout(input: unknown): { ok: true; layout: Layout } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'layout must be an object' };
  const l = input as Partial<Layout>;
  if (!isFiniteNum(l.width)  || l.width  <= 0 || l.width  > MAX_DIMENSION) return { ok: false, error: `width must be in (0, ${MAX_DIMENSION}]` };
  if (!isFiniteNum(l.height) || l.height <= 0 || l.height > MAX_DIMENSION) return { ok: false, error: `height must be in (0, ${MAX_DIMENSION}]` };
  if (!Array.isArray(l.items)) return { ok: false, error: 'items must be an array' };
  if (l.items.length > MAX_ITEMS) return { ok: false, error: `too many items (max ${MAX_ITEMS})` };

  const seenIds = new Set<string>();
  for (const raw of l.items) {
    const it = raw as Partial<LayoutItem>;
    if (!it || typeof it.id !== 'string' || it.id.length === 0 || it.id.length > MAX_ID) {
      return { ok: false, error: `item.id required (1..${MAX_ID} chars)` };
    }
    if (seenIds.has(it.id)) return { ok: false, error: `duplicate item id: ${it.id}` };
    seenIds.add(it.id);
    if (!nonNegFinite(it.x) || !nonNegFinite(it.y)) return { ok: false, error: `${it.id}: x/y must be finite >= 0` };
    switch (it.type) {
      case 'table': {
        const t = it as Partial<TableItem>;
        if (!nonNegFinite(t.w) || !nonNegFinite(t.h)) return { ok: false, error: `${it.id}: w/h must be finite >= 0` };
        if (typeof t.label !== 'string' || t.label.length > MAX_LABEL) return { ok: false, error: `${it.id}: label required (<=${MAX_LABEL} chars)` };
        if (!isFiniteNum(t.capacity) || t.capacity < 1 || t.capacity > 1000) return { ok: false, error: `${it.id}: capacity must be 1..1000` };
        break;
      }
      case 'room': {
        const r = it as Partial<RoomItem>;
        if (!nonNegFinite(r.w) || !nonNegFinite(r.h)) return { ok: false, error: `${it.id}: w/h must be finite >= 0` };
        if (typeof r.label !== 'string' || r.label.length > MAX_LABEL) return { ok: false, error: `${it.id}: label required (<=${MAX_LABEL} chars)` };
        if (typeof r.roomKey !== 'string' || r.roomKey.length === 0 || r.roomKey.length > MAX_ID) {
          return { ok: false, error: `${it.id}: roomKey required (1..${MAX_ID} chars)` };
        }
        if (!isFiniteNum(r.capacity) || r.capacity < 1 || r.capacity > 1000) return { ok: false, error: `${it.id}: capacity must be 1..1000` };
        break;
      }
      case 'wall': {
        const w = it as Partial<WallItem>;
        if (!nonNegFinite(w.w) || !nonNegFinite(w.h)) return { ok: false, error: `${it.id}: w/h must be finite >= 0` };
        break;
      }
      case 'door':
        break;
      default:
        return { ok: false, error: `${(it as { id: string }).id}: unknown type` };
    }
  }
  return { ok: true, layout: l as Layout };
}

// Returns the set of item-keys (tableId for tables, roomKey for rooms) present in layout.
function bookableKeys(layout: Layout): { tables: Set<string>; rooms: Set<string> } {
  const tables = new Set<string>();
  const rooms = new Set<string>();
  for (const item of layout.items) {
    if (item.type === 'table') tables.add(item.id);
    else if (item.type === 'room') rooms.add(item.roomKey);
  }
  return { tables, rooms };
}

export async function objectMapsRoutes(app: FastifyInstance) {
  // Public — visitor reservation pickers fetch this.
  app.get<{ Params: { slug: string } }>(
    '/api/locations/:slug/map',
    async (req, reply) => {
      const loc = await getLocationBySlug(req.params.slug);
      if (!loc) return reply.code(404).send({ error: 'Not found' });
      const [row] = await db
        .select()
        .from(objectMaps)
        .where(eq(objectMaps.locationId, loc.id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: 'No layout' });
      return { layout: row.layout, updatedAt: row.updatedAt };
    },
  );

  // Owner — replaces the layout. Refuses to remove items still referenced by active reservations.
  app.put<{ Params: { id: string }; Body: { layout?: unknown } }>(
    '/api/owner/locations/:id/map',
    { preHandler: requireOwner('id') },
    async (req, reply) => {
      const id = Number(req.params.id);

      const v = validateLayout(req.body?.layout);
      if (!v.ok) return reply.code(400).send({ error: v.error });

      const { tables, rooms } = bookableKeys(v.layout);
      const active = await db
        .select({ id: reservations.id, payload: reservations.payload })
        .from(reservations)
        .where(
          and(
            eq(reservations.locationId, id),
            inArray(reservations.status, ['pending', 'approved'] as const),
          ),
        );

      const conflicts: Array<{ reservationId: number; missing: string }> = [];
      for (const r of active) {
        const p = r.payload as { tableId?: string; roomKey?: string } | null;
        if (!p) continue;
        if (typeof p.tableId === 'string' && !tables.has(p.tableId)) {
          conflicts.push({ reservationId: r.id, missing: `tableId:${p.tableId}` });
        }
        if (typeof p.roomKey === 'string' && !rooms.has(p.roomKey)) {
          conflicts.push({ reservationId: r.id, missing: `roomKey:${p.roomKey}` });
        }
      }
      if (conflicts.length > 0) {
        return reply.code(422).send({
          error: 'Aktivne rezervacije referenciraju stavke koje pokušavate da uklonite',
          conflicts,
        });
      }

      const [row] = await db
        .insert(objectMaps)
        .values({ locationId: id, layout: v.layout, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: objectMaps.locationId,
          set: { layout: v.layout, updatedAt: new Date() },
        })
        .returning();
      return { layout: row.layout, updatedAt: row.updatedAt };
    },
  );

  // Owner — convenience: delete the layout entirely.
  app.delete<{ Params: { id: string } }>(
    '/api/owner/locations/:id/map',
    { preHandler: requireOwner('id') },
    async (req) => {
      const id = Number(req.params.id);
      await db.delete(objectMaps).where(eq(objectMaps.locationId, id));
      return { ok: true };
    },
  );
}
