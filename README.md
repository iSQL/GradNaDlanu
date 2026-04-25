# Grad na dlanu

City directory web app for **Žabari** (Braničevo District, Serbia, ZIP 12374). Full-bleed Leaflet satellite map of the village as the hero, sticky top nav with category filters and search, and dedicated module pages per object type (kafići, javne službe, znamenitosti, smeštaj, obrazovanje). Hidden admin panel for adding new objects.

UI copy is Serbian (Latin script).

## Stack

- **Web** — Vite + React + TypeScript, react-leaflet, React Router
- **Server** — Fastify + Drizzle ORM, JWT auth
- **Database** — Postgres 16 in Docker

Two npm workspaces (`web/`, `server/`) at the repo root, one Postgres container via `docker-compose.yml`.

## Prerequisites

- Node.js 20+
- Docker + Docker Compose

## First-time setup

```bash
cp .env.example .env
npm install
npm run db:up          # start postgres
npm run db:migrate     # create 4 tables (idempotent)
npm run db:seed        # 5 categories + 18 locations + module content + admin user
```

## Run

```bash
npm run dev            # web on :5173, server on :3000 (API proxied via Vite)
```

Open http://localhost:5173.

Default admin: `admin` / `admin` (set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` **before** seeding to change — the password is hashed at seed time).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Web + server in parallel |
| `npm run build` | Production build of web + server |
| `npm run db:up` | Start Postgres container |
| `npm run db:down` | Stop container (volume preserved) |
| `npm run db:reset` | Wipe DB volume, re-migrate, re-seed |
| `npm --workspace web run typecheck` | TS check the web app |
| `npm --workspace web run dev` | Web only |
| `npm --workspace server run dev` | Server only |

## Project layout

```
.
├── docker-compose.yml      # postgres:16 + named volume
├── .env.example
├── package.json            # workspaces root + db:* helpers
├── CLAUDE.md               # guide for Claude Code agents
├── web/                    # Vite + React + TS
└── server/                 # Fastify + Drizzle + postgres-js
    └── src/db/seed-data.ts # source of truth for the 18 starter locations
```

The starter dataset (locations, lat/lng, module content) lives in [server/src/db/seed-data.ts](server/src/db/seed-data.ts). To extend it, edit that file and run `npm run db:reset`.

## Roadmap

A v2 plan exists with three user roles (admin / business owner / visitor), favorites, comments, check-ins, reservations, and owner-managed object-internal maps (e.g. café floor plans for table reservations). v1 was scoped narrower so the v2 schema lands additively.

## License

AGPL-3.0 — see [LICENSE.md](LICENSE.md).
