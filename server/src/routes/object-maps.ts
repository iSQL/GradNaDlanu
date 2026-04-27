import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { db, sql } from '../db/client.js';
import { objectMaps, reservations } from '../db/schema.js';
import { requireRole } from '../lib/auth.js';
import { getLocationBySlug } from '../lib/locations.js';

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

function validateLayout(input: unknown): { ok: true; layout: Layout } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'layout must be an object' };
  const l = input as Partial<Layout>;
  if (!isFiniteNum(l.width) || l.width <= 0) return { ok: false, error: 'width must be > 0' };
  if (!isFiniteNum(l.height) || l.height <= 0) return { ok: false, error: 'height must be > 0' };
  if (!Array.isArray(l.items)) return { ok: false, error: 'items must be an array' };

  const seenIds = new Set<string>();
  for (const raw of l.items) {
    const it = raw as Partial<LayoutItem>;
    if (!it || typeof it.id !== 'string' || it.id.length === 0) return { ok: false, error: 'item.id required' };
    if (seenIds.has(it.id)) return { ok: false, error: `duplicate item id: ${it.id}` };
    seenIds.add(it.id);
    if (!isFiniteNum(it.x) || !isFiniteNum(it.y)) return { ok: false, error: `${it.id}: x/y required` };
    switch (it.type) {
      case 'table': {
        const t = it as Partial<TableItem>;
        if (!isFiniteNum(t.w) || !isFiniteNum(t.h)) return { ok: false, error: `${it.id}: w/h required` };
        if (typeof t.label !== 'string') return { ok: false, error: `${it.id}: label required` };
        if (!isFiniteNum(t.capacity) || t.capacity < 1) return { ok: false, error: `${it.id}: capacity must be >= 1` };
        break;
      }
      case 'room': {
        const r = it as Partial<RoomItem>;
        if (!isFiniteNum(r.w) || !isFiniteNum(r.h)) return { ok: false, error: `${it.id}: w/h required` };
        if (typeof r.label !== 'string') return { ok: false, error: `${it.id}: label required` };
        if (typeof r.roomKey !== 'string' || r.roomKey.length === 0) return { ok: false, error: `${it.id}: roomKey required` };
        if (!isFiniteNum(r.capacity) || r.capacity < 1) return { ok: false, error: `${it.id}: capacity must be >= 1` };
        break;
      }
      case 'wall': {
        const w = it as Partial<WallItem>;
        if (!isFiniteNum(w.w) || !isFiniteNum(w.h)) return { ok: false, error: `${it.id}: w/h required` };
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
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      // Scope check: admins always pass; otherwise must own this location.
      if (req.user.role !== 'admin') {
        const ok = await sql<{ x: number }[]>`
          SELECT 1 AS x FROM object_owners
          WHERE user_id = ${req.user.sub} AND location_id = ${id}
          LIMIT 1
        `;
        if (ok.length === 0) return reply.code(403).send({ error: 'Forbidden' });
      }

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
    { preHandler: requireRole('business') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (req.user.role !== 'admin') {
        const ok = await sql<{ x: number }[]>`
          SELECT 1 AS x FROM object_owners
          WHERE user_id = ${req.user.sub} AND location_id = ${id}
          LIMIT 1
        `;
        if (ok.length === 0) return reply.code(403).send({ error: 'Forbidden' });
      }
      await db.delete(objectMaps).where(eq(objectMaps.locationId, id));
      return { ok: true };
    },
  );
}
