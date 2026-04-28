# Future ideas — Grad na dlanu

Roadmap of things worth building once v2 is settled. Ranked by user-perceived value.

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

Žabari has festivals, market days, school programs. Currently nothing surfaces them on the map.

- [ ] `events` table: `id`, `location_id` (nullable — some events are city-wide), `title`, `description`, `starts_at`, `ends_at`, `cat_id` nullable, `created_by`
- [ ] Hero gains a date filter and renders date-bounded pins
- [ ] New `/dogadjaji` route with month grid
- [ ] Admin/owner can create events; visitors can favorite events the same way they favorite locations

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
