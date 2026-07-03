# Grad na dlanu

City directory web app for **Žabari** (Braničevo District, Serbia, ZIP 12374). Landing page with CTA cards as the front door; the Leaflet satellite map is lazy-loaded on `/mapa` so the initial bundle stays light. Sticky top nav with a hamburger drawer on mobile, dedicated module pages per object type (kafići, javne službe, znamenitosti, smeštaj, obrazovanje), a `/desavanja` feed merging news items and announced events across all villages of the municipality, and a `/naselja` page with a Voronoi map showing population, area, distance and curators for each of the 15 villages.

Four user roles — admin, business owner, village curator ("kustos"), visitor — with reservations, favorites, comments, check-ins, news/announcements per object, an owner-managed floor-plan editor for cafés and hotels, and a newsletter sign-up in the footer. UI copy is Serbian (Latin script).

## Stack

- **Web** — Vite + React + TypeScript, react-leaflet, React Router
- **Server** — Fastify + Drizzle ORM, JWT auth, postgres-js, serves the built SPA in production
- **Database** — Postgres 16

Two npm workspaces (`web/`, `server/`) at the repo root.

## Prerequisites

- Node.js 20+
- Docker + Docker Compose

## First-time setup

```bash
cp .env.example .env
npm install
npm run db:up          # start the bundled Postgres (dev profile)
npm run db:migrate     # create tables (idempotent)
npm run db:seed        # 8 categories + 8 starter locations + 15 villages + admin user
```

## Run (dev)

```bash
npm run dev            # web on :5173, server on :3000 (API proxied via Vite)
```

Open http://localhost:5173.

**Default admin:** `admin@local` / `admin` (set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` **before** seeding — the password is hashed at seed time).

Visitors register at `/registracija`. Business owners are visitors who've been granted ownership of an object by an admin (admin panel → **Korisnici** → **+ Dodeli objekat**). Village curators ("kustosi") are visitors granted oversight of one or more villages (**Korisnici** → **+ Dodeli selo**).

## Roles & flows

| Role | Surface | Can do |
| --- | --- | --- |
| Visitor (`/nalog`) | landing, map, module pages, `/desavanja`, `/objekti`, `/naselja` | favorite objects, comment + rate, check in, request reservations, cancel own reservations |
| Business owner (`/poslovni`) | dashboard | edit owned objects (name/subtitle/address/village/content), approve/decline reservations, draw floor plans, publish events and news ("obaveštenja") per object, reply to comments on own objects |
| Village curator (`/kustos`) | per-village dashboard | add new objects in their village(s) as draft (via dashboard form OR long-press on `/mapa`), edit general fields (name/subtitle/address) and a whitelisted slice of `content` per category (no `menu`/`services`/`rooms`/`programs`), full edit of landmark content, hide/restore comments on objects in their villages — **cannot** publish events/news, view reservations, edit `village` itself |
| Admin (`/admin`) | full panel | everything; tabs: **Objekti** (CRUD all locations including `village`), **Rezervacije** (cross-location inbox), **Korisnici** (search, change role, grant/revoke object ownership *and* village curatorship) |

Reservations enforce real availability — café tables use a half-open `tstzrange` overlap check per `(location_id, tableId)`; hotels use a `daterange '[)'` per `(location_id, roomKey)`. Pending reservations block new ones until declined or cancelled.

The floor-plan editor (`/poslovni/objekti/<slug>/mapa`) is an SVG canvas with drag/resize, snap-to-grid, and a side panel for label/capacity/roomKey. Visitor reservation pickers automatically render the saved layout in place of the illustrative SVG, greying out items that are booked in the chosen window.

The `/desavanja` feed merges `news` (per-object announcements) and `events` (timed happenings — concerts, performances) in a single timeline, with tabs **Sva dešavanja / Događaji / Obaveštenja** and a per-village dropdown. News older than 7 days and events whose `endsAt` (or `startsAt` if `endsAt` is null) is more than 7 days in the past are hidden by default; a **"Prikaži stara obaveštenja"** checkbox reveals them. A daily background job in [server/src/lib/desavanja-cleanup.ts](server/src/lib/desavanja-cleanup.ts) permanently deletes both news and events older than 30 days.

The `/naselja` page renders the 15 villages of Opština Žabari as a Voronoi SVG (preboji u site paletu paper/navy/gold), with hover for a transient preview and click to pin a selection. A side panel shows population (popis 2002), area estimate, distance and direction from Žabari, coordinates, and the list of curators assigned to the village. Object info cards expose **"Prikaži na mapi →"** which deep-links to `/mapa?focus=<slug>` and flies the map to that pin on load.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Web + server in parallel |
| `npm run build` | Production build of web + server |
| `npm run db:up` | Start the bundled Postgres |
| `npm run db:down` | Stop it (volume preserved) |
| `npm run db:reset` | Wipe DB volume, re-migrate, re-seed |
| `npm --workspace web run typecheck` | TS check the web app |
| `npm --workspace web run dev` | Web only |
| `npm --workspace server run dev` | Server only |

## Project layout

```
.
├── Dockerfile                 # multi-stage prod build
├── docker-compose.yml         # bundled postgres (dev profile) + app
├── .env.example
├── CLAUDE.md                  # guide for Claude Code agents
├── todo.md                    # ideas not yet built
├── web/                       # Vite + React + TS
└── server/                    # Fastify + Drizzle + postgres-js
    └── src/db/seed-data.ts    # source of truth for the starter locations
```

The starter dataset (one location per category, plus three "majstor" entries) lives in [server/src/db/seed-data.ts](server/src/db/seed-data.ts) alongside the `VILLAGES` seed (15 RZS-canonical villages with population, area, distance, direction, coordinates). Real objects are added through the admin or curator panels; to extend the seed itself, edit that file and run `npm run db:reset`.

Villages of opština Žabari are a hardcoded enum mirrored in two places — [server/src/lib/villages.ts](server/src/lib/villages.ts) and [web/src/lib/villages.ts](web/src/lib/villages.ts). Both files must change together. The canonical 15 are: Žabari, Aleksandrovac, Brzohode, Vitežovo, Vlaški Do, Kočetin, Mirijevo, Oreovica, Polatna, Porodin, Svinjarevo, Sibnica, Simićevo, Tićevac, Četereže. Backend validates `village` writes against the enum; the seed dataset leaves locations' `village = NULL` and admins/owners/curators assign it through the edit forms. The `villages` DB table carries the per-village facts surfaced on `/naselja` and is the join target for `village_curators(user_id, village_name)`.

Production data flow on a single image: Fastify boots → runs migrations on boot (`RUN_MIGRATIONS_ON_BOOT=true` is the default in `NODE_ENV=production`) → registers `@fastify/static` against `web/dist` → falls back to `index.html` for non-`/api/*` requests so React Router's client-side routes work on hard refresh.

## Production deployment (Docker / Coolify)

Build and run the whole stack locally to verify:

```bash
APP_HOST_PORT=3001 RUN_SEED_ON_BOOT=true JWT_SECRET=$(openssl rand -hex 32) \
  COMPOSE_PROFILES=dev docker compose up --build
```

Visit http://localhost:3001 — the SPA is served by Fastify on the same origin as the API.

### On Coolify (recommended: managed Postgres)

1. Provision a Postgres in Coolify (or reuse an existing one). Inside it, create a database for this app, e.g. `gradnadlanu`, and a user with full rights on it.
2. Create a new **Application** in Coolify pointing at this repo, source type **Docker Compose**.
3. **Connect** the app to the same project as the Postgres so they share Coolify's internal network.
4. Set environment variables in Coolify's panel:
   ```
   DATABASE_URL=postgres://<user>:<pass>@<pg-coolify-dns>:5432/gradnadlanu
   JWT_SECRET=<long random string>
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<your choice — bakes into the first seed>
   APP_DOMAIN=gradnadlanu.example.com
   RUN_SEED_ON_BOOT=true
   ```
   Leave `COMPOSE_PROFILES` unset so the bundled `db` service stays inert.
5. **Uploaded photos** are bind-mounted onto a **Hetzner Volume** (block storage, separate from the root disk). The host path is **hardcoded** in `docker-compose.yml` (`- /mnt/HC_Volume_<ID>/zabari-uploads:/data/uploads`) rather than driven by an env var — Coolify does not interpolate `${VAR}` into compose volume sources, so an env-driven source silently falls back to a named volume on the root disk. Attach + mount the Volume on the host (Hetzner's "Automatic" mount lands it at `/mnt/HC_Volume_<ID>` and adds an `fstab` entry so it survives reboots), then pre-create the target dir and `chown` it to the container's `node` user (uid 1000) before the first deploy:
   ```bash
   sudo mkdir -p /mnt/HC_Volume_<ID>/zabari-uploads
   sudo chown 1000:1000 /mnt/HC_Volume_<ID>/zabari-uploads
   ```
   Coolify surfaces this bind mount under **Persistent Storage → Directories** (same as the logs mount). The container path (`UPLOAD_DIR`) stays `/data/uploads`. To use a different Volume, edit the path in `docker-compose.yml`.
6. Deploy. Traefik labels in `docker-compose.yml` expose the `app` service on `${APP_DOMAIN}` with a Let's Encrypt cert.
7. **After the first successful deploy**, flip `RUN_SEED_ON_BOOT=false` so subsequent restarts don't re-run the (idempotent) seed.

Boot-time migrations are always on in production — schema changes ship with the next image.

> **Adding a new seed dataset later** (e.g., extending the `VILLAGES` array in `seed-data.ts` with new entries, or seeding a brand-new lookup table): do NOT flip `RUN_SEED_ON_BOOT=true` for one boot — that path also tries to insert the demo visitor accounts (`marko@example.com` etc.) and demo comments which you don't want polluting prod. Instead run a targeted `INSERT ... ON CONFLICT (...) DO NOTHING` SQL against just the affected table, or a small one-off Node script that imports only the desired const from `seed-data.ts`. Boot-time migrations create the table; the data backfill is a separate, deliberate step.

### Without Coolify

The same `docker-compose.yml` works on any Docker host. To run the bundled Postgres alongside the app, set `COMPOSE_PROFILES=dev`. Otherwise provide a `DATABASE_URL` pointing at any Postgres instance.

## Roadmap

Open ideas live in [todo.md](todo.md) — image uploads, reservation notifications, an events calendar, owner analytics, comment moderation queue, cross-cutting tags. Implemented features (v1 + v2) match the design doc at [`~/.claude/plans/fetch-this-design-file-whimsical-quilt.md`](.).

## License

AGPL-3.0 — see [LICENSE.md](LICENSE.md).
