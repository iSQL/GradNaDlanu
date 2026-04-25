# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

City directory web app for **Žabari** (Braničevo District, Serbia), 12374. Hero map with Leaflet satellite tiles + sticky nav, per-category module pages (kafići, javne službe, znamenitosti, smeštaj, obrazovanje), plus a hidden admin panel. Origin: a Claude Design HTML/JSX prototype (still in `/tmp/design/extracted/grad-na-dlanu/` during the build session) that was rebuilt as a real Vite + Fastify stack. UI copy is Serbian (Latin script).

## Commands

All commands run from the repo root (npm workspaces). The DB must be up before any `db:*` or server `dev` script.

```bash
# First-time setup
cp .env.example .env
npm install
npm run db:up          # docker compose up -d db
npm run db:migrate     # creates 4 tables (idempotent)
npm run db:seed        # 5 categories + 18 locations + module_content + admin user

# Daily dev (parallel: web :5173, server :3000)
npm run dev

# Single workspace
npm --workspace web    run dev
npm --workspace server run dev
npm --workspace web    run typecheck
npm --workspace web    run build

# DB lifecycle
npm run db:down        # stop container, keep volume
npm run db:reset       # wipe volume, re-migrate, re-seed
```

Default admin is `admin` / `admin` (controlled by `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`, baked into the password hash at seed time — change the env *before* seeding).

There is no test suite yet.

## Architecture

Two npm workspaces, one Postgres container.

### `server/` — Fastify + Drizzle + postgres-js

- Entry: [server/src/index.ts](server/src/index.ts) — registers `@fastify/cors`, `@fastify/jwt`, then the three route modules.
- Routes: [categories.ts](server/src/routes/categories.ts), [locations.ts](server/src/routes/locations.ts) (public list/get + admin-gated create/update), [auth.ts](server/src/routes/auth.ts) (bcrypt + JWT).
- Admin gate: `requireAdmin` in [server/src/lib/auth.ts](server/src/lib/auth.ts) — calls `req.jwtVerify()`, returns 401 on failure. JWT payload is `{ sub, username }`.
- DB: [schema.ts](server/src/db/schema.ts) holds the Drizzle schema. The shape per location varies a lot per category, so per-location content lives in `module_content.content` (`jsonb`) — there's no flat column for menu/rooms/facts/etc. The 5 web module components know how to read each shape.
- Migrations are hand-written DDL in [migrate.ts](server/src/db/migrate.ts) (no drizzle-kit at runtime). Seed reads from [seed-data.ts](server/src/db/seed-data.ts), which is the **source of truth** for the 18 starter locations + their content. If you change/expand the dataset, edit that file, then `npm run db:reset`.
- Env: [server/src/env.ts](server/src/env.ts) loads `.env` from the **repo root** (resolved via `import.meta.url`), not the workspace cwd — required because npm workspaces invoke scripts with the workspace as cwd.

### `web/` — Vite + React + TS, react-leaflet, react-router

- Entry: [main.tsx](web/src/main.tsx) → [router.tsx](web/src/router.tsx) → [App.tsx](web/src/App.tsx) shell.
- Routes: `/` (Hero), `/objekat/:slug` (ModulePage dispatcher), `/admin/login`, `/admin` (gated by [RequireAuth.tsx](web/src/admin/RequireAuth.tsx) — JWT in `localStorage` under `gnd.token`).
- **AppContext via Outlet:** [App.tsx](web/src/App.tsx) loads categories + locations once and exposes them through React Router's `Outlet context`. Children read with `useOutletContext<AppContext>()`. The Nav, Hero, and AdminPanel all share this single source. The context also exposes `setActiveFilter` and `reloadLocations` so children can both toggle map filters and trigger a refetch after admin writes.
- **Map:** [CityMap.tsx](web/src/components/CityMap.tsx) uses `react-leaflet` with two `<TileLayer>`s (Esri World Imagery satellite + Reference labels overlay). Pins are `L.divIcon`s whose HTML is built by `pinSvgString()` in [PinGlyph.tsx](web/src/components/PinGlyph.tsx). The same file exports `<PinGlyph>` as a React component for use in legend swatches and the admin category picker — keep both code paths in sync if you change pin shapes.
- **Hover card:** the Hero positions `<div class="pin-card">` using `e.containerPoint` from the Leaflet marker's `mouseover` event (passed up via `onPinHover`).
- **Module dispatch:** [ModulePage.tsx](web/src/modules/ModulePage.tsx) fetches `/api/locations/:slug` (returns location + content jsonb) then `switch`es on `loc.catId` to render one of `CafeModule | PublicModule | LandmarkModule | HotelModule | SchoolModule`. Each module casts `data.content` to its specific TS interface (`CafeContent`, etc., from [types.ts](web/src/types.ts)) — those interfaces must match the JSONB shape produced by `buildModuleContent()` in seed-data.
- **Styles:** all in [web/src/styles.css](web/src/styles.css), plain CSS with `:root` variables. **The prototype's tweaks-panel variants are stripped** — defaults baked in (Esri satellite, gold accent, full nav, rich hero, pulse pins). Don't add `.map-style-*`, `.highlight-*`, `.topnav.compact|floating`, or `.hero-info.minimal` rules — they were author-time switches.

### Vite proxy

[vite.config.ts](web/vite.config.ts) proxies `/api/*` → `http://localhost:3000`. Frontend code uses bare `/api/...` paths via [api.ts](web/src/lib/api.ts), which also auto-attaches `Authorization: Bearer <token>` when present.

## v2 plan

[fetch-this-design-file-whimsical-quilt.md](C:/Users/marem/.claude/plans/fetch-this-design-file-whimsical-quilt.md) (in the user's `~/.claude/plans/`) holds the approved v2 design: three roles (admin / business owner / visitor) with favorites, comments, check-ins, reservations, owner-managed object-internal maps. Read it before adding multi-user features so the v2 schema additions land in the additive shape that's planned, not a rewrite.

## Conventions worth respecting

- New locations are **slugified server-side** in [locations.ts](server/src/routes/locations.ts) — Serbian diacritics map to ASCII (`č→c`, `š→s`, `ž→z`, `đ→dj`). Don't generate slugs on the client.
- Admin-created locations land as `status = 'draft'`. Public list endpoint filters drafts unless `?includeDrafts=1`. The admin list endpoint always returns both.
- The `admin_users` table and JWT shape are deliberately minimal because v2 replaces them with a `users` table that has a `role` column. Keep changes here additive.
