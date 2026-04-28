# Grad na dlanu

City directory web app for **Žabari** (Braničevo District, Serbia, ZIP 12374). Full-bleed Leaflet satellite map of the village as the hero, sticky top nav with category filters and search, and dedicated module pages per object type (kafići, javne službe, znamenitosti, smeštaj, obrazovanje).

Three user roles — admin, business owner, visitor — with reservations, favorites, comments, check-ins, and an owner-managed floor-plan editor for cafés and hotels. UI copy is Serbian (Latin script).

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
npm run db:seed        # 5 categories + 5 starter locations (one per category) + admin user
```

## Run (dev)

```bash
npm run dev            # web on :5173, server on :3000 (API proxied via Vite)
```

Open http://localhost:5173.

**Default admin:** `admin@local` / `admin` (set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` **before** seeding — the password is hashed at seed time).

Visitors register at `/registracija`. Business owners are visitors who've been granted ownership of an object by an admin (admin panel → **Korisnici** → **+ Dodeli objekat**).

## Roles & flows

| Role | Surface | Can do |
| --- | --- | --- |
| Visitor (`/nalog`) | hero map, module pages | favorite objects, comment + rate, check in, request reservations, cancel own reservations |
| Business owner (`/poslovni`) | dashboard | edit owned objects (name/subtitle/address/content), approve/decline reservations, draw floor plans, reply to comments on own objects |
| Admin (`/admin`) | full panel | everything; tabs: **Objekti** (CRUD all locations), **Rezervacije** (cross-location inbox), **Korisnici** (search, change role, grant/revoke ownership) |

Reservations enforce real availability — café tables use a half-open `tstzrange` overlap check per `(location_id, tableId)`; hotels use a `daterange '[)'` per `(location_id, roomKey)`. Pending reservations block new ones until declined or cancelled.

The floor-plan editor (`/poslovni/objekti/<slug>/mapa`) is an SVG canvas with drag/resize, snap-to-grid, and a side panel for label/capacity/roomKey. Visitor reservation pickers automatically render the saved layout in place of the illustrative SVG, greying out items that are booked in the chosen window.

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

The starter dataset (one location per category — Stara Vodenica, Opština, Crkva Sv. Arhanđela, Hotel Morava, OŠ "Dositej Obradović") lives in [server/src/db/seed-data.ts](server/src/db/seed-data.ts). Real objects are added through the admin panel; to extend the seed itself, edit that file and run `npm run db:reset`.

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
5. Deploy. Traefik labels in `docker-compose.yml` expose the `app` service on `${APP_DOMAIN}` with a Let's Encrypt cert.
6. **After the first successful deploy**, flip `RUN_SEED_ON_BOOT=false` so subsequent restarts don't re-run the (idempotent) seed.

Boot-time migrations are always on in production — schema changes ship with the next image.

### Without Coolify

The same `docker-compose.yml` works on any Docker host. To run the bundled Postgres alongside the app, set `COMPOSE_PROFILES=dev`. Otherwise provide a `DATABASE_URL` pointing at any Postgres instance.

## Roadmap

Open ideas live in [todo.md](todo.md) — image uploads, reservation notifications, an events calendar, owner analytics, comment moderation queue, cross-cutting tags. Implemented features (v1 + v2) match the design doc at [`~/.claude/plans/fetch-this-design-file-whimsical-quilt.md`](.).

## License

AGPL-3.0 — see [LICENSE.md](LICENSE.md).
