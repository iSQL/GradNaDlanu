# Grad na dlanu

City directory web app for **Žabari** (Braničevo District, Serbia). Hero map with Leaflet satellite tiles, sticky nav, and per-category module pages (kafići, javne službe, znamenitosti, smeštaj, obrazovanje), plus a hidden admin panel.

## Stack

- **Web** — Vite + React + TypeScript, react-leaflet, React Router
- **Server** — Fastify + Drizzle ORM
- **Database** — Postgres 16 (in Docker)

## Prerequisites

- Node.js 20+
- Docker + Docker Compose

## First-time setup

```bash
cp .env.example .env
npm install
npm run db:up          # start postgres
npm run db:migrate     # create tables
npm run db:seed        # load 5 categories, 18 locations, admin user
```

## Run

```bash
npm run dev            # web on :5173, server on :3000
```

Open http://localhost:5173.

Default admin: `admin` / `admin` (change in `.env` before seeding for anything beyond local dev).

## Useful scripts

- `npm run db:up` — start postgres container
- `npm run db:down` — stop postgres container
- `npm run db:reset` — wipe DB volume, re-migrate, re-seed
- `npm run build` — production build of web + server
