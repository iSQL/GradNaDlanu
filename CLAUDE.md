# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

City directory web app for **Žabari** (Braničevo District, Serbia), 12374. Landing page with CTA cards on `/`, lazy-loaded Leaflet satellite map on `/mapa`, per-category module pages (kafići, javne službe, znamenitosti, smeštaj, obrazovanje), a hidden admin panel, a business-owner dashboard, and visitor accounts with favorites/comments/check-ins/reservations. A `/desavanja` feed merges news ("obaveštenja") and events ("događaji") posted by business owners across all villages of the municipality, with a per-village filter and a "Prikaži stara obaveštenja" toggle. UI copy is Serbian (Latin script). Origin: a Claude Design HTML/JSX prototype rebuilt as a real Vite + Fastify stack.

## Commands

All commands run from the repo root (npm workspaces). The DB must be up before any `db:*` or server `dev` script.

```bash
# First-time setup
cp .env.example .env
npm install
npm run db:up          # docker compose up -d db   (uses the `dev` profile)
npm run db:migrate     # creates ~13 tables (idempotent)
npm run db:seed        # 5 categories + 5 starter locations + admin user

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

Default admin is `admin@local` / `admin` — login is by **email**, and the seed derives the email from `ADMIN_USERNAME` (`<username>@local`). Both come from `.env` and are baked into the password hash at seed time, so change them *before* `db:seed` / `db:reset`.

There is no test suite yet.

## Architecture

Two npm workspaces, one Postgres container in dev, a single combined image in prod.

### `server/` — Fastify + Drizzle + postgres-js

- Entry: [server/src/index.ts](server/src/index.ts) — boots migrations (and optionally seed) when `RUN_MIGRATIONS_ON_BOOT` / `RUN_SEED_ON_BOOT` are set, registers JWT + CORS + all route modules, then in production serves the built SPA from `web/dist` with an SPA fallback for non-`/api/*` routes (so React Router deep-links survive a hard refresh).
- Routes (each is a Fastify plugin):
  - [categories.ts](server/src/routes/categories.ts), [locations.ts](server/src/routes/locations.ts) — public list/get + admin-only CRUD on locations (including `village`).
  - [auth.ts](server/src/routes/auth.ts) — bcrypt + JWT register/login + `/api/me` (returns `ownedLocationIds`).
  - [social.ts](server/src/routes/social.ts) — favorites, comments (tree shape, owner-only replies), check-ins.
  - [reservations.ts](server/src/routes/reservations.ts) — visitor-side create/cancel/own-list + public availability windows.
  - [owner.ts](server/src/routes/owner.ts) — `business`-role: list owned locations, edit a restricted field set, approve/decline reservations, list comments on owned objects.
  - [admin-users.ts](server/src/routes/admin-users.ts) — admin: search users, change role, grant/revoke object ownership.
  - [object-maps.ts](server/src/routes/object-maps.ts) — public floor-plan read + owner write/delete.
  - [events.ts](server/src/routes/events.ts) — public list/single + owner CRUD for timed happenings. Supports `?cat=` and `?village=` filters.
  - [news.ts](server/src/routes/news.ts) — public list/single + owner CRUD for per-object announcements ("obaveštenja"). Slugs auto-generated with anti-collision suffix. Owner POST defaults to `status='published'` with `publishedAt=now`.
  - [newsletter.ts](server/src/routes/newsletter.ts) — `POST /api/newsletter/subscribe` (rate-limited, ON CONFLICT DO NOTHING so success leaks nothing about prior signups).
- **Auth helpers** in [server/src/lib/auth.ts](server/src/lib/auth.ts):
  - `requireAuth` — any logged-in user.
  - `requireRole('admin' | 'business')` — admin **always passes** role checks regardless of which role you ask for. Use this for routes that operate on resources scoped per-user.
  - `requireOwner(locationParam)` — admin always passes; otherwise checks `object_owners` for the location id in the named route param.
  - JWT payload is `{ sub, email, role }` (declared via module augmentation on `@fastify/jwt`).
- DB: [schema.ts](server/src/db/schema.ts) holds the Drizzle schema. Per-location content varies a lot per category, so it lives in `module_content.content` (`jsonb`) — no flat columns for menu/rooms/facts. The 5 web module components know how to read each shape. `locations.village` is a nullable text column constrained at the application layer to values in the `SELA_ZABARI` enum (see [server/src/lib/villages.ts](server/src/lib/villages.ts)) — no DB CHECK constraint, the server validates on write. `news` and `newsletter_subscribers` join the schema; news status is `'draft' | 'pending' | 'published'` with a default of `'pending'` at the column level, but the business POST path sets `'published'` explicitly so direct publishing is the actual default in practice.
- **Migrations are hand-written DDL** in [migrate.ts](server/src/db/migrate.ts) — no drizzle-kit at runtime. Idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). The file also contains a one-shot `DO $$ … $$` block that mirrors any leftover `admin_users` rows into the `users` table with `role='admin'` then drops the legacy table — if you ever rip that block out, do it in a separate commit after confirming all deployed envs are past v1.
- Seed reads from [seed-data.ts](server/src/db/seed-data.ts), which is the **source of truth** for the starter locations (one per category — cafe/public/landmark/hotel/school) and their content. If you change/expand the dataset, edit that file, then `npm run db:reset`.
- Env: [server/src/env.ts](server/src/env.ts) loads `.env` from the **repo root** (resolved via `import.meta.url`), not the workspace cwd — required because npm workspaces invoke scripts with the workspace as cwd. In Docker the file usually doesn't exist and env comes from compose; `dotenv` silently falls through.

### Reservation conflict logic

[server/src/lib/reservations.ts](server/src/lib/reservations.ts) is where the booking semantics live:

- **Cafés** book a `tableId` for a half-open `tstzrange` `[slotStart, slotEnd)` — overlap check uses Postgres' `&&` operator on `tstzrange(... '[)')`.
- **Hotels** book a `roomKey` for a half-open `daterange` `[dateFrom, dateTo)` (checkout day exclusive) — same pattern with `daterange`.
- `findCafeConflicts` / `findHotelConflicts` accept an optional `excludeId` so the owner-approval path can re-check without flagging the row being approved as its own conflict. **Always re-run conflict checks at approve time** (see [owner.ts](server/src/routes/owner.ts)) — pending requests can race.
- Active statuses for overlap are `pending` and `approved`; `declined`/`cancelled` are ignored.
- `/api/locations/:slug/availability` returns minimal payloads (no `user_id`) so visitor pickers can grey out booked slots without leaking other visitors' identities.

### Background cleanup jobs

Two daily sweeps run from boot (`setInterval` with `unref` so they don't block shutdown), kicked off once immediately so a long-stopped instance doesn't sit on a backlog:

- [guest-cleanup.ts](server/src/lib/guest-cleanup.ts) — deletes `role='guest'` users inactive for >7 days. The 7-day window is the contract surfaced in the GuestBanner UI ("istice za 7 dana neaktivnosti") — change both at once. CASCADE clears favorites/comments/checkins along with the row.
- [desavanja-cleanup.ts](server/src/lib/desavanja-cleanup.ts) — deletes `news` and `events` whose effective end date is more than 30 days old (`COALESCE(published_at, created_at)` for news; `COALESCE(ends_at, starts_at)` for events). The 7-day "hide old" threshold on `/desavanja` is a UI concern only — DB retention is 30 days so admins still have a window to review or backfill.

Both batch deletes 500 rows at a time and loop until a partial batch signals the eligible set is drained.

### Logging

Pino multistream → **stdout + rolling daily files** at `${LOG_DIR}/zabariYYYY-MM-DD.log` (defaults: `/storage/logs` in prod, `./storage/logs` in dev). Retention is `LOG_RETENTION_DAYS` (default 7) — the oldest matching file is unlinked on rotation so the directory never exceeds the window. Rotation is *lazy*: triggered by the first write after a UTC date boundary, so an idle process can't pin an old file handle. Date is UTC-based to avoid the "midnight in Belgrade vs. container TZ" gotcha that could otherwise rotate twice on the same calendar day.

If the file stream can't be opened (missing volume / no perms), the boot warns once and continues with stdout-only — never refuses to start. The implementation lives in [rolling-log.ts](server/src/lib/rolling-log.ts) and the multistream is built in [index.ts](server/src/index.ts) `buildLogger()`. Coolify keeps capturing stdout (so its UI keeps working) and the files persist via the `logs:/storage/logs` volume on `app` in [docker-compose.yml](docker-compose.yml).

Fastify auto-logs every HTTP request. Explicit `req.log.info` lines exist for user-lifecycle events (register, email verification, guest upgrade) in [auth.ts](server/src/routes/auth.ts) — add similar lines if you introduce new domain events worth grep-ing for.

### Floor plans (`object_maps`)

- The layout is a single `jsonb` blob: `{ width, height, items: LayoutItem[] }` where items are `table | room | wall | door`. Tables expose `id` as the bookable key; rooms expose `roomKey`.
- [object-maps.ts](server/src/routes/object-maps.ts) `validateLayout()` is strict — every item needs id/x/y, tables/rooms also need w/h/label/capacity, rooms need a non-empty `roomKey`, and ids must be unique within a layout.
- Saving a new layout **refuses with 422** if any `pending`/`approved` reservation references a `tableId`/`roomKey` that the new layout doesn't contain. Owners must decline/cancel those reservations first.

### `web/` — Vite + React + TS, react-leaflet, react-router

- Entry: [main.tsx](web/src/main.tsx) → [router.tsx](web/src/router.tsx) → [App.tsx](web/src/App.tsx) shell.
- Routes (all under the `App` shell so nav + context are always present):
  - `/` landing with CTA cards (no map import — keeps the initial bundle Leaflet-free).
  - `/mapa` — Hero + CityMap, **lazy-loaded** via `React.lazy(() => import('../components/Hero'))` and wrapped in `<Suspense>` by [MapPage.tsx](web/src/pages/MapPage.tsx). Hero must keep its `export default` for the lazy import to resolve.
  - `/objekti` — listing with category / village / name filters (all client-side off the `AppContext.locations` array).
  - `/desavanja` — merged news + events feed. Tabs (Sva / Događaji / Obaveštenja), per-village select, and a "Prikaži stara obaveštenja" checkbox that toggles the 7-day cut-off (defined as `RECENT_THRESHOLD_MS` in [DesavanjaPage.tsx](web/src/pages/DesavanjaPage.tsx)).
  - `/dashboard` — placeholder for personal feed (currently a skeleton; gated CTA for guests).
  - `/objekat/:slug` — ModulePage dispatcher.
  - `/prijava` (login), `/registracija` (register), `/nalog` (visitor account — favorites, comments, reservations, check-ins).
  - `/poslovni`, `/poslovni/objekti/:slug`, `/poslovni/objekti/:slug/mapa` — business-owner dashboard, per-object editor (now editing village + news + events too), floor-plan editor.
  - `/admin/login` (legacy alias for `/prijava` — same flow, role-aware redirect after login), `/admin`, `/admin/objekat/:slug` — gated by `<RequireAuth role="admin">`.
- **Auth gate:** [RequireAuth.tsx](web/src/admin/RequireAuth.tsx) checks JWT presence + the decoded `role` against an optional `role` prop. JWT is in `localStorage` under `gnd.token`.
- **AppContext via Outlet:** [App.tsx](web/src/App.tsx) loads categories, locations, and the current user once and exposes them through React Router's `Outlet context`. Children read with `useOutletContext<AppContext>()`. The context exposes `setActiveFilter`, `reloadLocations`, and `reloadCurrentUser` so children can toggle map filters, refresh after admin/owner writes, and re-fetch `/api/me` after role/ownership changes. The legacy `homeView` (map/dashboard) toggle has been removed — those views are now full routes.
- **Nav:** [Nav.tsx](web/src/components/Nav.tsx) uses `NavLink`s and a hamburger drawer that activates at `≤ 720px`. The drawer is fully overlay-based (`position: fixed`, `slide-in` animation, body scroll lock); it auto-closes on every route change. ENTER in the nav search field navigates to `/objekti?q=…` if not already there.
- **Map:** [CityMap.tsx](web/src/components/CityMap.tsx) uses `react-leaflet` with two `<TileLayer>`s (Esri World Imagery satellite + Reference labels overlay). Pins are `L.divIcon`s whose HTML is built by `pinSvgString()` in [PinGlyph.tsx](web/src/components/PinGlyph.tsx). The same file exports `<PinGlyph>` as a React component for legend swatches and the admin category picker — **keep both code paths in sync** if you change pin shapes.
- **Hover card:** the Hero positions `<div class="pin-card">` using `e.containerPoint` from the Leaflet marker's `mouseover` event (passed up via `onPinHover`).
- **Module dispatch:** [ModulePage.tsx](web/src/modules/ModulePage.tsx) fetches `/api/locations/:slug` (returns location + content jsonb) then `switch`es on `loc.catId` to render one of `CafeModule | PublicModule | LandmarkModule | HotelModule | SchoolModule`. Each module casts `data.content` to its specific TS interface (`CafeContent`, etc., from [types.ts](web/src/types.ts)) — those interfaces must match the JSONB shape produced by `buildModuleContent()` in seed-data and by the admin/owner content editors.
- **Floor plan UI:** [components/floorplan/FloorPlanEditor.tsx](web/src/components/floorplan/FloorPlanEditor.tsx) is an SVG canvas with drag/resize/snap-to-grid used at `/poslovni/objekti/:slug/mapa`; `FloorPlanView.tsx` is the read-only renderer that visitor reservation pickers swap in for the illustrative SVG, greying out items booked in the chosen window.
- **Owner editors:** business and admin edit pages both embed [OwnerEventsEditor.tsx](web/src/components/OwnerEventsEditor.tsx) and [OwnerNewsEditor.tsx](web/src/components/OwnerNewsEditor.tsx) below the basic-fields section. Both follow the same draft-row + inline-edit pattern. News carries a `'published' | 'draft'` status toggle in the create/edit form; the API also accepts `'pending'` for future moderation flows.
- **Footer:** three-column grid in [App.tsx](web/src/App.tsx) — "O opštini" (legal links), "Kontakt" (hardcoded opština contact), and a newsletter sign-up form ([NewsletterForm.tsx](web/src/components/NewsletterForm.tsx)) that POSTs to `/api/newsletter/subscribe`.
- **Styles:** all in [web/src/styles.css](web/src/styles.css), plain CSS with `:root` variables. **The prototype's tweaks-panel variants are stripped** — defaults baked in (Esri satellite, gold accent, full nav, pulse pins). The Hero originally had a "rich" overlay (`.hero-info` with title + stats panels); that overlay was removed — only `.map-legend` and `.panel-toggle` remain on the map. Don't add `.map-style-*`, `.highlight-*`, `.topnav.compact|floating`, or `.hero-info*` rules — they were author-time switches.

### Vite proxy

[vite.config.ts](web/vite.config.ts) proxies `/api/*` → `http://localhost:3000`. Frontend code uses bare `/api/...` paths via [api.ts](web/src/lib/api.ts), which auto-attaches `Authorization: Bearer <token>` when present.

### Production / Coolify deployment

[Dockerfile](Dockerfile) builds a single image containing both the compiled server and `web/dist`. [docker-compose.yml](docker-compose.yml) has two services:

- `db` — bundled Postgres, **gated by `COMPOSE_PROFILES=dev`**, so it stays inert in production where Coolify supplies a managed Postgres via `DATABASE_URL`.
- `app` — the combined image. In prod `RUN_MIGRATIONS_ON_BOOT=true` (default whenever `NODE_ENV=production`), `RUN_SEED_ON_BOOT` defaults off (flip to `true` only for the very first deploy). Traefik labels expose the app on `${APP_DOMAIN}`. The compose file also attaches `app` to an **external `coolify` network** so it can resolve the managed Postgres's internal hostname — if you rename or remove that network, both Coolify deploys and `docker compose up` will break.

Migrations always run at boot in prod, so schema changes ship with the next image — no separate migrate step.

## Conventions worth respecting

- **Slugs are server-side.** [server/src/lib/locations.ts](server/src/lib/locations.ts) / [routes/locations.ts](server/src/routes/locations.ts) slugify Serbian diacritics to ASCII (`č→c`, `š→s`, `ž→z`, `đ→dj`). Don't generate slugs on the client.
- **Drafts.** Admin-created locations land as `status='draft'`. The public list endpoint filters drafts unless `?includeDrafts=1`; the admin list endpoint always returns both.
- **Admin is a superset.** Both `requireRole('business')` and `requireOwner(...)` short-circuit-pass when `req.user.role === 'admin'`. When adding a new owner-scoped route, follow the same pattern so admins can act on behalf of owners without separate plumbing.
- **Reservation race protection.** Any path that approves a reservation must re-run `findCafeConflicts` / `findHotelConflicts` with `excludeId=row.id`. The initial submit check is not enough — owners may sit on requests for hours.
- **Owner edit scope is intentionally narrow.** `PATCH /api/owner/locations/:id` accepts only `name | subtitle | address | village | content`. Don't widen it to `lat/lng/catId/slug/status` without explicit product approval — those affect the map, the slug URL, and admin draft workflow.
- **Villages are a hardcoded enum, mirrored.** [server/src/lib/villages.ts](server/src/lib/villages.ts) and [web/src/lib/villages.ts](web/src/lib/villages.ts) export `SELA_ZABARI` as the source of truth. Backend validates `village` writes against `isVillage()` and returns 400 on unknown values. If you add/remove a village, edit **both** files in the same commit — there's no shared package.
- **News/events use `published` as the practical default.** The `news.status` column defaults to `'pending'` at the DB level, but the business POST handler ([news.ts](server/src/routes/news.ts)) and events POST handler both set the row to `'published'` with `publishedAt=now`. Admin moderation is intentionally absent for now — if you reintroduce a moderation step, flip the default at the route layer, not the schema.
- **Comment replies are owner/admin only.** Visitors can only create top-level comments. Enforced in [social.ts](server/src/routes/social.ts) — don't relax this without product input.
- **`includeDrafts=1` is admin-only on the public endpoint.** When adding new list-style endpoints that should hide drafts from the public, mirror that pattern instead of inventing a new one.

## Reference

[fetch-this-design-file-whimsical-quilt.md](C:/Users/marem/.claude/plans/fetch-this-design-file-whimsical-quilt.md) (in the user's `~/.claude/plans/`) is the original v2 design doc — three roles, favorites, comments, check-ins, reservations, owner-managed floor plans. The features are now landed; treat the doc as historical context for *why* the schema has the shape it does, not as a list of TODOs.

[todo.md](todo.md) tracks open ideas not yet built (image uploads, reservation notifications, events calendar, owner analytics, comment moderation queue, cross-cutting tags).
