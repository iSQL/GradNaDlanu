# Future ideas — Grad na dlanu

Roadmap of things worth building once v2 is settled. Ranked by user-perceived value.

## Deploy note: majstori + service requests

The tradesperson directory + repair-request feature uses local-disk photo uploads via `@fastify/multipart`. **Before deploying to Coolify**:

1. In Coolify's app config, add a **Persistent Storage** mount pointing the container path `/data/uploads` to a persistent volume. Without this, every container rebuild wipes uploaded photos.
2. The default `UPLOAD_DIR` env in [docker-compose.yml](docker-compose.yml) is `/data/uploads` — only change it if your persistent mount lives elsewhere.
3. `RUN_MIGRATIONS_ON_BOOT=true` (already the prod default) will add the new `media` and `service_requests` tables automatically.
4. For a fresh deploy you can flip `RUN_SEED_ON_BOOT=true` once to seed the three starter majstori (vodoinstalater Marko, elektro Stojan, auto-servis Žika), then turn it off.

## 1. Image uploads (recommended next)

Every module currently shows ASCII placeholders (`[ recepcija ]`, `[ soba ]`, etc.). One real photo per location + a module gallery is the single biggest perceived-quality jump.

- [ ] Storage: S3 (or local `web/public/uploads/` + nginx in prod)
- [ ] `images` table: `id`, `location_id`, `url`, `kind` (`hero`/`gallery`), `sort_order`, `uploaded_by`, `created_at`
- [ ] Server: `POST /api/owner/locations/:id/images` (multipart, sharp resize → 1600/800/400 widths), `DELETE /api/owner/images/:id`
- [ ] Web: upload widget in `OwnerEditLocation` and `EditLocation`; replace the `gallery-img` placeholders in [HotelModule.tsx](web/src/modules/HotelModule.tsx) with real `<img srcset>`
- [ ] Add a hero image slot for cafés/landmarks/schools too

## 2. Reservation notifications

Today, visitors only learn about approve/decline by refreshing `/nalog`. Owners only see new requests when they happen to open `/poslovni`.

- [ ] `notifications` table: `id`, `user_id`, `kind`, `payload jsonb`, `read_at`, `created_at`
- [ ] Server: emit on `POST /api/locations/:slug/reservations` (→ owner) and `PATCH /api/owner/reservations/:id` (→ visitor)
- [ ] Web: bell icon in [Nav.tsx](web/src/components/Nav.tsx) with unread count, dropdown list, "mark read" on click
- [ ] Optional: real email (Resend / SMTP) once SMTP creds are in place — the `users.email_verified_at` column is already there

## 3. City events calendar

Žabari has festivals, market days, school programs. Currently the Pregled tab aggregates upcoming events across all published locations and each location's module can render its own calendar — what's left below would extend the surface.

- [x] `events` table tied to `locations(id)` (no city-wide nullable variant yet)
- [x] Owner/admin CRUD via `/api/owner/events`; public list via `/api/events` (filterable by category, cap 100)
- [x] `EventsPanel` on home `Pregled`, calendar editor in `OwnerEditLocation`, `SchoolModule` reads events from API
- [ ] Hero date filter + date-bounded pins
- [ ] Dedicated `/dogadjaji` route with month grid (current Pregled panel is a 10-row list)
- [ ] City-wide events (nullable `location_id`) for festivals / market days that don't tie to one object
- [ ] Visitor "interested" / favorite-event action

## 4. Owner analytics

Owners have an inbox but no signal on how the object is performing.

- [ ] Cheap MVP: server-side counter on `GET /api/locations/:slug` (per-day rollup table to avoid hot-path writes)
- [ ] New tab in `/poslovni` showing: page views (7/30 day), reservation conversion (views → submitted), approval rate, comment count + average rating trend
- [ ] Aggregate at admin level too: top-viewed objects, busiest days

## 5. Comment moderation queue

[schema.ts](server/src/db/schema.ts) already has `comments.status: 'visible' | 'hidden' | 'flagged'` but no UI uses it.

- [ ] "Prijavi" button on each comment in [CommentsSection.tsx](web/src/components/CommentsSection.tsx) → marks as `flagged`
- [ ] Admin tab "Moderacija" listing `status='flagged'` comments with approve/hide/delete actions
- [ ] Owner can hide comments on their own objects (uses existing `requireOwner`)

## 6. Cross-cutting tags

"Pet-friendly", "wheelchair-accessible", "kids welcome", "outdoor seating" cut across categories. Schema-light, powerful for discovery.

- [ ] `tags` table (slug, label, icon) + `location_tags` join table
- [ ] Tag chips on hero and on module pages
- [ ] Filter pins by tag combinations
- [ ] Admin manages the tag vocabulary

## Smaller wins / nice-to-haves

- [ ] **Open Graph meta tags** on module pages so shared links render with name + image + tagline
- [ ] **PWA**: manifest + service worker + Leaflet tile cache; "Add to home screen" prompt
- [ ] **iCal export** of approved reservations (`/api/me/reservations.ics`)
- [ ] **Cyrillic toggle** for users who prefer it; **English copy** for tourists
- [ ] **Anonymous favorites** via `localStorage` (so visitors don't need an account just to bookmark)
- [ ] **Search across address + content jsonb**, not just `name` (current [routes/locations.ts](server/src/routes/locations.ts) only does `ilike(name, ...)`)
- [ ] **Availability heatmap** in date pickers — show which days/times are busy at a glance
- [ ] **Owner self-onboarding** flow (currently admin grants ownership manually — fine for now, but a self-serve path with admin verification will be needed once volume justifies it)

## Out of scope (per v2 spec)

- Payments for reservations
- Push notifications
- Native mobile apps
