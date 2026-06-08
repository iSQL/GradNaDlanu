import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  comments,
  locations,
  moduleContent,
  users,
  villageCurators,
} from '../db/schema.js';
import { requireRole } from '../lib/auth.js';
import {
  InvalidSlugError,
  mergeCuratorContent,
  slugify,
  validateContent,
} from '../lib/locations.js';
import { isVillage } from '../lib/villages.js';

// Skup sela koje korisnik kurira. Admin → 'ALL'.
async function curatedVillagesFor(userId: number, role: string): Promise<Set<string> | 'ALL'> {
  if (role === 'admin') return 'ALL';
  const rows = await db
    .select({ village: villageCurators.villageName })
    .from(villageCurators)
    .where(eq(villageCurators.userId, userId));
  return new Set(rows.map((r) => r.village));
}

// Vraća listu location.id koje korisnik može da edituje kao kustos.
// Admin: 'ALL'. Kustos: sve published+draft lokacije iz svojih sela.
async function curatedLocationIds(
  userId: number,
  role: string,
): Promise<number[] | 'ALL'> {
  const villageScope = await curatedVillagesFor(userId, role);
  if (villageScope === 'ALL') return 'ALL';
  if (villageScope.size === 0) return [];
  const rows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(inArray(locations.village, [...villageScope]));
  return rows.map((r) => r.id);
}

export async function curatorRoutes(app: FastifyInstance) {
  // Sela koja korisnik kurira. Admin dobija sva sela iz `villages` tabele.
  app.get('/api/curator/villages', { preHandler: requireRole('curator') }, async (req) => {
    const scope = await curatedVillagesFor(req.user.sub, req.user.role);
    if (scope === 'ALL') {
      const rows = await db.select({ name: villageCurators.villageName }).from(villageCurators);
      // Admin: vrati distinct imena svih sela koja imaju kustose + obrnuto očekivani UI
      // pokazuje sva sela iz lib/villages.ts — ali backend ovde vraća efektivni
      // skup. Frontend će preseći sa SELA_ZABARI listom.
      return [...new Set(rows.map((r) => r.name))];
    }
    return [...scope];
  });

  // Svi objekti u kuratorovim selima.
  app.get('/api/curator/locations', { preHandler: requireRole('curator') }, async (req) => {
    const scope = await curatedVillagesFor(req.user.sub, req.user.role);
    if (scope === 'ALL') {
      return db.select().from(locations).orderBy(desc(locations.createdAt));
    }
    if (scope.size === 0) return [];
    return db
      .select()
      .from(locations)
      .where(inArray(locations.village, [...scope]))
      .orderBy(desc(locations.createdAt));
  });

  // Kreiraj novi objekat. Selo MORA biti u kuratorovim selima. Status je uvek
  // 'draft' (admin posle pregleda može da prebaci u 'published').
  app.post<{
    Body: {
      name: string;
      address: string;
      catId: string;
      village: string;
      subtitle?: string | null;
      lat?: number;
      lng?: number;
      content?: unknown;
    };
  }>(
    '/api/curator/locations',
    { preHandler: requireRole('curator') },
    async (req, reply) => {
      const { name, address, catId, village, subtitle, lat, lng, content } = req.body ?? {};
      if (!name || !address || !catId || !village) {
        return reply.code(400).send({ error: 'name, address, catId, village su obavezni' });
      }
      if (!isVillage(village)) {
        return reply.code(400).send({ error: 'village mora biti jedno od sela opštine Žabari' });
      }
      const scope = await curatedVillagesFor(req.user.sub, req.user.role);
      if (scope !== 'ALL' && !scope.has(village)) {
        return reply.code(403).send({ error: 'kustos može da dodaje objekte samo u svojim selima' });
      }
      // Sadržaj filtriran kroz kustos whitelist čak i pri kreiranju — sprečava
      // da kustos ubaci npr. menu jsonb na novi kafić.
      const merge = mergeCuratorContent(catId, {}, content ?? null);
      if (!merge.ok) return reply.code(400).send({ error: merge.error });

      const contentCheck = validateContent(merge.merged);
      if (!contentCheck.ok) return reply.code(400).send({ error: contentCheck.error });

      let slug: string;
      try {
        slug = slugify(name);
      } catch (err) {
        if (err instanceof InvalidSlugError) {
          return reply.code(400).send({ error: 'name ne sadrži slugifikabilan tekst' });
        }
        throw err;
      }
      try {
        const [row] = await db
          .insert(locations)
          .values({
            slug,
            name,
            address,
            catId,
            subtitle: subtitle ?? null,
            village,
            lat: typeof lat === 'number' && Number.isFinite(lat) ? lat : 44.3567,
            lng: typeof lng === 'number' && Number.isFinite(lng) ? lng : 21.2161,
            status: 'draft',
          })
          .returning();
        await db
          .insert(moduleContent)
          .values({ locationId: row.id, content: merge.merged })
          .onConflictDoNothing();
        return row;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('unique')) {
          return reply.code(409).send({ error: 'Slug već postoji', slug });
        }
        throw err;
      }
    },
  );

  // Edit objekta u kuratorovom selu. Polja: name/subtitle/address/content. Village
  // se NE menja iz ove rute (sprečava da kustos pomeri objekat van svoje vlasti).
  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      subtitle: string | null;
      address: string;
      content: unknown;
    }>;
  }>(
    '/api/curator/locations/:id',
    { preHandler: requireRole('curator') },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid id' });
      const owned = await curatedLocationIds(req.user.sub, req.user.role);
      if (owned !== 'ALL' && !owned.includes(id)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const body = req.body ?? {};
      const allowed: Record<string, unknown> = {};
      if (typeof body.name === 'string') allowed.name = body.name;
      if (typeof body.address === 'string') allowed.address = body.address;
      if (typeof body.subtitle === 'string' || body.subtitle === null) allowed.subtitle = body.subtitle;

      // Trenutni red i postojeći content — potrebni za whitelist-merge.
      const [existing] = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
      if (!existing) return reply.code(404).send({ error: 'Not found' });

      let nextContent: Record<string, unknown> | undefined;
      if (body.content !== undefined) {
        const [mc] = await db
          .select()
          .from(moduleContent)
          .where(eq(moduleContent.locationId, id))
          .limit(1);
        const merge = mergeCuratorContent(existing.catId, mc?.content ?? {}, body.content);
        if (!merge.ok) return reply.code(400).send({ error: merge.error });
        const sizeCheck = validateContent(merge.merged);
        if (!sizeCheck.ok) return reply.code(400).send({ error: sizeCheck.error });
        nextContent = merge.merged;
      }

      let row = existing;
      if (Object.keys(allowed).length > 0) {
        const [updated] = await db
          .update(locations)
          .set(allowed)
          .where(eq(locations.id, id))
          .returning();
        if (!updated) return reply.code(404).send({ error: 'Not found' });
        row = updated;
      }
      if (nextContent !== undefined) {
        await db
          .insert(moduleContent)
          .values({ locationId: id, content: nextContent })
          .onConflictDoUpdate({ target: moduleContent.locationId, set: { content: nextContent } });
      }
      return row;
    },
  );

  // Komentari na objektima u kuratorovim selima — uključuje i 'hidden' da kustos
  // može da ih vrati u 'visible' ako je sakrio greškom.
  app.get('/api/curator/comments', { preHandler: requireRole('curator') }, async (req) => {
    const owned = await curatedLocationIds(req.user.sub, req.user.role);
    if (owned !== 'ALL' && owned.length === 0) return [];
    const conds = owned === 'ALL' ? [] : [inArray(comments.locationId, owned)];
    const rows = await db
      .select({
        id: comments.id,
        body: comments.body,
        rating: comments.rating,
        status: comments.status,
        createdAt: comments.createdAt,
        parentId: comments.parentId,
        locationId: locations.id,
        locationSlug: locations.slug,
        locationName: locations.name,
        village: locations.village,
        authorId: users.id,
        authorName: users.displayName,
      })
      .from(comments)
      .innerJoin(locations, eq(comments.locationId, locations.id))
      .innerJoin(users, eq(comments.userId, users.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(comments.createdAt));
    return rows;
  });

  // Toggle status komentara — kustos može da sakrije neprikladne ili vrati u vidljivo.
  app.patch<{
    Params: { id: string };
    Body: { status: 'visible' | 'hidden' };
  }>(
    '/api/curator/comments/:id',
    { preHandler: requireRole('curator') },
    async (req, reply) => {
      const id = Number(req.params.id);
      const next = req.body?.status;
      if (next !== 'visible' && next !== 'hidden') {
        return reply.code(400).send({ error: 'status mora biti visible ili hidden' });
      }
      const [row] = await db
        .select({ id: comments.id, locationId: comments.locationId })
        .from(comments)
        .where(eq(comments.id, id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: 'Not found' });

      const owned = await curatedLocationIds(req.user.sub, req.user.role);
      if (owned !== 'ALL' && !owned.includes(row.locationId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const [updated] = await db
        .update(comments)
        .set({ status: next })
        .where(eq(comments.id, id))
        .returning();
      return updated;
    },
  );
}
