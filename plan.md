# Implementation Plan

**Project:** KCRunning — GPS Art Route Map
**Stack:** Next.js · Tailwind CSS · MapLibre GL · Supabase + PostGIS · Vercel
**Date:** 2026-03-06

---

## Overview

The build is split into two stages.

**Stage A — Demo (no accounts required):** A fully working local demo using mock data and free no-registration tile sources. Build this first, show it, approve the UX, then proceed.

**Stage B — Production wiring:** Swap every mock for the real service (Supabase, MapTiler, Turnstile, Vercel). No code is thrown away — Stage A is the same codebase with environment flags switching between mock and real.

```
Stage A (Demo — no accounts needed)
  Phase 1 → Project setup + mock data layer
  Phase 2 → Map foundation (OpenFreeMap tiles, no key)
  Phase 3 → Route display (pins, polylines, popups)
  Phase 4 → Upload form + client-side GPX pipeline
  Phase 5 → Admin dashboard (hardcoded password, mock store)
  ── DEMO REVIEW ──
Stage B (Production — accounts required)
  Phase 6 → Supabase integration (replace mock data layer)
  Phase 7 → MapTiler + Cloudflare Turnstile + Resend
  Phase 8 → Security hardening
  Phase 9 → Polish & deploy to Vercel
```

---

## Project Structure

```
/app
  layout.tsx                  global layout, fonts, metadata
  page.tsx                    map home (full-screen, client component)
  /upload
    page.tsx                  upload form page
  /routes
    /[id]
      page.tsx                individual route page (SSR — for share links)
  /admin
    page.tsx                  admin dashboard (protected)
  /api
    /routes
      route.ts                GET  — fetch routes by viewport bbox
    /upload
      route.ts                POST — receive GPX, validate, process, store
    /report
      route.ts                POST — flag a route
    /admin
      /login
        route.ts              POST — set admin session cookie
      /approve
        route.ts              POST — approve route by id
      /reject
        route.ts              POST — reject route by id

/components
  /map
    MapView.tsx               MapLibre GL map, manages all map state
    RouteLayer.tsx            renders approved route polylines as a GL layer
    PinLayer.tsx              renders centroid pins as a GL symbol layer
    RoutePopup.tsx            popup shown on pin click
    SearchControl.tsx         geocoder / address lookup control
    LocationControl.tsx       "go to my location" button
  /upload
    UploadForm.tsx            the full upload form component
    GPXPreview.tsx            mini-map preview of parsed GPX before submit
  /admin
    RouteQueue.tsx            list of pending/flagged routes
    RouteCard.tsx             single route row with approve/reject buttons

/lib
  supabase-client.ts          Supabase browser client (anon key)
  supabase-server.ts          Supabase server client (service key, server-only)
  gpx.ts                      GPX → GeoJSON parsing helpers
  simplify.ts                 Douglas-Peucker simplification wrapper
  distance.ts                 calculate route distance in km
  rate-limit.ts               IP-based rate limiting logic
  admin-auth.ts               middleware helper for admin cookie check

/middleware.ts                 Next.js middleware — protects /admin routes

/types
  route.ts                    Route, RouteStatus, GeoJSONFeature types
```

---

## Data Model

### Supabase Schema

```sql
-- Enable PostGIS (run once in Supabase SQL editor)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Core routes table
CREATE TABLE routes (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT        NOT NULL,
  description     TEXT,
  tags            TEXT[]      DEFAULT '{}',
  gpx_file_path   TEXT        NOT NULL,         -- path in Supabase Storage
  geojson         JSONB       NOT NULL,          -- simplified, for map display
  geometry        GEOMETRY(LineString, 4326) NOT NULL,  -- PostGIS, for spatial queries
  centroid        GEOMETRY(Point, 4326),          -- pre-computed for pin placement
  bbox            BOX2D,                          -- pre-computed bounding box
  distance_km     FLOAT,
  status          TEXT        DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  ip_hash         TEXT,                           -- SHA-256 of submitter IP, for rate limiting
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table
CREATE TABLE reports (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id    UUID    REFERENCES routes(id) ON DELETE CASCADE,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX routes_geometry_gist   ON routes USING GIST (geometry);
CREATE INDEX routes_centroid_gist   ON routes USING GIST (centroid);
CREATE INDEX routes_status_idx      ON routes (status);

-- Row-level security
ALTER TABLE routes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Public: read approved routes only
CREATE POLICY "public_read_approved" ON routes
  FOR SELECT USING (status = 'approved');

-- Service role key bypasses RLS — used in API routes only
```

### Supabase Storage

One bucket: `gpx-files`
- Access: private (files served via signed URL on download)
- Path pattern: `{route-id}/original.gpx`

### TypeScript Types (`/types/route.ts`)

```ts
export type RouteStatus = 'pending' | 'approved' | 'rejected' | 'flagged'

export interface Route {
  id: string
  title: string
  description: string | null
  tags: string[]
  gpx_file_path: string
  geojson: GeoJSON.Feature<GeoJSON.LineString>
  distance_km: number
  status: RouteStatus
  created_at: string
}

// Lightweight type for map layer (centroid only, no full geojson)
export interface RoutePin {
  id: string
  title: string
  distance_km: number
  lng: number
  lat: number
}
```

---

## API Design

### `GET /api/routes`

Fetches approved routes within a viewport bounding box.

```
Query params: west, south, east, north (floats)
Returns: RoutePin[] — centroid + metadata only (not full geojson)
```

Two-step pattern: load pins everywhere in viewport, load full geojson only when a pin is selected.

```ts
// Supabase query (server-side, service key)
const { data } = await supabase.rpc('routes_in_bbox', {
  west, south, east, north
})
```

```sql
-- Supabase RPC function
CREATE OR REPLACE FUNCTION routes_in_bbox(
  west float, south float, east float, north float
)
RETURNS TABLE (id uuid, title text, distance_km float, lng float, lat float)
LANGUAGE sql STABLE AS $$
  SELECT
    id, title, distance_km,
    ST_X(centroid::geometry) AS lng,
    ST_Y(centroid::geometry) AS lat
  FROM routes
  WHERE
    status = 'approved'
    AND centroid && ST_MakeEnvelope(west, south, east, north, 4326)
$$;
```

### `GET /api/routes/[id]`

Returns full route including geojson (called when a pin is clicked).

```
Returns: Route (full object including geojson)
```

### `POST /api/upload`

Receives multipart form. Full processing happens here.

```
Body: multipart/form-data
  - file: GPX file (max 10MB)
  - title: string
  - description: string (optional)
  - tags: comma-separated string
  - cf-turnstile-response: Cloudflare Turnstile token
```

Processing steps (in order):
1. Verify Turnstile token with Cloudflare API
2. Check IP rate limit (max 3 uploads per IP per 24h — stored in `ip_hash` lookups)
3. Validate file size (reject > 10MB)
4. Validate file is valid XML with GPX root element
5. Parse GPX → GeoJSON using `@tmcw/togeojson`
6. Validate coordinate ranges (lat: -90 to 90, lng: -180 to 180)
7. Validate minimum route length (> 100m — reject obviously bad uploads)
8. Strip timestamps from coordinates (privacy)
9. Simplify with `@turf/simplify` (tolerance: 0.0001 degrees, ~11m)
10. Calculate distance with `@turf/length`
11. Compute centroid and bbox
12. Upload original GPX to Supabase Storage
13. Insert route record with `status = 'pending'`
14. Return `{ success: true, id }`

```
Returns: { success: boolean, id?: string, error?: string }
```

### `POST /api/report`

```
Body: { routeId: string, reason: string }
Returns: { success: boolean }
```

Inserts a report row and updates the route status to `'flagged'` if it receives 3+ reports.

### `POST /api/admin/login`

```
Body: { password: string }
```

Compares against `ADMIN_PASSWORD` env var. On success, sets an `admin_session` HttpOnly cookie (signed JWT, 7-day expiry). Middleware checks this cookie on all `/admin` routes.

### `POST /api/admin/approve` / `POST /api/admin/reject`

```
Body: { id: string }
```

Updates route status. Admin session cookie required (middleware enforced).

---

## Phase 1 — Project Setup & Mock Data Layer

**Goal:** Working Next.js app with a mock data store that behaves identically to Supabase — same function signatures, same return shapes. Swapping in Supabase later is a one-file change.

### Steps

1. **Re-initialise project as Next.js**
   ```bash
   npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
   ```

2. **Install dependencies**
   ```bash
   npm install maplibre-gl react-map-gl
   npm install @tmcw/togeojson @turf/simplify @turf/length @turf/centroid @turf/bbox
   npm install -D @types/geojson
   ```
   Note: `@supabase/supabase-js` is not installed yet — added in Stage B.

3. **Environment variables** — create `.env.local`
   ```
   NEXT_PUBLIC_DEMO_MODE=true      # switches between mock and real data layer
   ADMIN_PASSWORD=demo             # plaintext fine for local demo
   ```

4. **Mock data** — `/lib/mock/routes.ts`
   - A hardcoded array of 5–8 realistic GPS art routes as GeoJSON LineStrings
   - Each has: `id`, `title`, `description`, `tags`, `geojson`, `distance_km`, `status: 'approved'`, `centroid`, `created_at`
   - Routes should be visually interesting shapes spread across a real city (e.g. a star, a face, a word) to demonstrate the concept clearly
   - Source real GPS art coordinates from public examples or construct simple shapes manually

5. **Mock store** — `/lib/mock/store.ts`
   - In-memory array (module-level, persists for the server process lifetime)
   - Exports the same interface that the real data layer will export:
     ```ts
     getRoutesInBbox(west, south, east, north): RoutePin[]
     getRouteById(id): Route | null
     createRoute(data): Route
     approveRoute(id): void
     rejectRoute(id): void
     flagRoute(id): void
     getPendingRoutes(): Route[]
     getFlaggedRoutes(): Route[]
     ```
   - Pending/flagged routes start empty; upload form populates them at runtime

6. **Data layer abstraction** — `/lib/db.ts`
   - Single file that exports the same functions as the mock store
   - In demo mode (`NEXT_PUBLIC_DEMO_MODE=true`): re-exports from mock store
   - In production mode: re-exports from Supabase client (wired in Phase 6)
   - All API routes import from `/lib/db.ts` only — never directly from mock or Supabase

7. **Types** — `/types/route.ts`
   - Define `Route`, `RoutePin`, `RouteStatus` (same as in Data Model section above)

8. **Next.js middleware** (`/middleware.ts`)
   - Protect `/admin` routes — check for `admin_session` cookie
   - Redirect to `/admin/login` if missing

**Done when:** `npm run dev` loads a blank Next.js page, mock data layer returns routes from test import.

---

## Phase 2 — Map Foundation

**Goal:** Full-screen MapLibre GL map with address search and current location. No API key needed.

### Steps

1. **MapView component** (`/components/map/MapView.tsx`)
   - `'use client'` — map is entirely client-side
   - Use `react-map-gl` with MapLibre GL backend
   - Full-screen via Tailwind: `w-screen h-screen`
   - Initial view: sensible default (city and zoom level where the mock routes are placed)

2. **Map tile setup (demo — no account needed)**
   - Use **OpenFreeMap**: `https://tiles.openfreemap.org/styles/liberty`
   - Completely free, no API key, no registration, vector tiles, looks polished
   - In Phase 7 this URL is replaced with the MapTiler URL once the key is available

3. **SearchControl** (`/components/map/SearchControl.tsx`)
   - Use the **Nominatim API** (OpenStreetMap's free geocoder — no key, no account):
     `https://nominatim.openstreetmap.org/search?q={query}&format=json`
   - Simple input → fetch directly from the browser (Nominatim allows this for low-volume use)
   - On result: fly map to coordinates using `mapRef.current.flyTo()`
   - In Phase 7, swap to MapTiler Geocoding API for better results and rate limits

4. **LocationControl** (`/components/map/LocationControl.tsx`)
   - Browser `navigator.geolocation.getCurrentPosition()`
   - On success: `mapRef.current.flyTo({ center: [lng, lat], zoom: 14 })`
   - No external dependency — works identically in demo and production

5. **Home page** (`/app/page.tsx`)
   - Import MapView via `dynamic({ ssr: false })` — MapLibre GL cannot run server-side

**Done when:** Map loads full-screen, address search flies to location, location button works.

---

## Phase 3 — Route Display

**Goal:** Pins for all approved routes, click a pin to see its polyline and popup.

### Map State Design

All map interaction state lives in `MapView.tsx`:

```ts
const [pins, setPins]               = useState<RoutePin[]>([])
const [selectedRoute, setSelected]  = useState<Route | null>(null)
const [loading, setLoading]         = useState(false)
```

### Steps

1. **Viewport-based pin loading**
   - On map `moveend` and `zoomend` events, get current bounds:
     ```ts
     const bounds = mapRef.current.getBounds()
     ```
   - Fetch `/api/routes?west=...&south=...&east=...&north=...`
   - Merge new pins into state (deduplicate by id — don't re-add pins already loaded)
   - Debounce the fetch call by 300ms to avoid hammering on fast panning

2. **PinLayer** (`/components/map/PinLayer.tsx`)
   - Add a GeoJSON source to the map from the `pins` array
   - Add a `symbol` layer using a custom pin icon or MapLibre's built-in circle layer
   - Each feature has `id`, `title`, `distance_km` in its properties

3. **Click handler on pins**
   - Listen to MapLibre click event on the pin layer
   - On click: fetch `/api/routes/{id}` for the full route object
   - Set `selectedRoute` in state

4. **RouteLayer** (`/components/map/RouteLayer.tsx`)
   - When `selectedRoute` is set, add a GeoJSON source with that route's `geojson`
   - Add a `line` layer — bright colour (e.g. `#FF4136`), width 3px
   - When `selectedRoute` is cleared, remove the source and layer

5. **RoutePopup** (`/components/map/RoutePopup.tsx`)
   - Renders at the route's centroid coordinates using react-map-gl's `<Popup>`
   - Displays:
     - Title
     - Distance in km
     - Download GPX button → generates a signed Supabase Storage URL → triggers download
     - Share button → copies `window.location.origin/routes/{id}` to clipboard
     - Report button → opens a small inline form (reason text) → POST /api/report
   - Close button clears `selectedRoute`

6. **Individual route page** (`/app/routes/[id]/page.tsx`)
   - Server component — fetches route from Supabase using service key
   - Renders with proper `<meta>` Open Graph tags (title, description)
   - Displays the map centred on the route with its polyline pre-drawn
   - This is what the share URL points to

**Done when:** Pins load on map pan, clicking a pin shows polyline + popup, GPX download works, share URL copies to clipboard.

---

## Phase 4 — Upload Form & GPX Pipeline

**Goal:** Anonymous users can submit a GPX file with title/description/tags, see a preview, and submit for moderation. In demo mode, submissions go into the in-memory mock store (no Supabase, no file storage).

### Steps

1. **Upload page** (`/app/upload/page.tsx`)
   - Simple centred layout, not full-screen map
   - Links back to the map

2. **UploadForm component** (`/components/upload/UploadForm.tsx`)
   - Fields: GPX file input, title (required), description (optional), tags (comma-separated)
   - Honeypot field: hidden input `name="website"` — silently reject if filled
   - No Turnstile widget in demo mode (added in Phase 7)
   - On file select → parse client-side for preview
   - On submit → POST to `/api/upload`
   - On success → show "Submitted! Your route is under review." message, clear form

3. **Client-side GPX preview**
   - When user selects a file, read it with `FileReader`
   - Parse with `@tmcw/togeojson`
   - If valid, pass the GeoJSON to `<GPXPreview>` component
   - If invalid XML/not GPX, show an inline error immediately

4. **GPXPreview component** (`/components/upload/GPXPreview.tsx`)
   - Small (300×200px) MapLibre map, same OpenFreeMap tiles
   - Renders the parsed GeoJSON as a line layer
   - Fits bounds to the route with `mapRef.current.fitBounds(bbox)`

5. **`POST /api/upload` server route (demo mode)**
   - Validate file is present, title is non-empty
   - Check honeypot field
   - Parse GPX → GeoJSON using `/lib/gpx.ts`
   - Simplify, calculate distance, centroid, bbox
   - Strip timestamps
   - Call `db.createRoute(data)` → writes to mock store with `status = 'pending'`
   - GPX file itself is not stored in demo mode (no Storage bucket) — the geojson is enough
   - Return `{ success: true, id }`

6. **`/lib/gpx.ts`**, **`/lib/simplify.ts`**, **`/lib/distance.ts`**
   - Written once, used identically in demo and production

**Done when:** Upload form submits a GPX, the processed route appears in the mock store's pending queue, visible in the admin dashboard.

---

## Phase 5 — Admin Dashboard

**Goal:** Password-protected page to approve, reject, and review flagged routes. In demo mode, operates entirely on the mock store. Password is `demo` (from `.env.local`).

### Steps

1. **Admin login page** (`/app/admin/login/page.tsx`)
   - Simple form: password input → POST `/api/admin/login`
   - Compares against `ADMIN_PASSWORD` env var (plaintext comparison is fine for demo)
   - On success: set `admin_session` HttpOnly cookie, redirect to `/admin`

2. **Admin dashboard** (`/app/admin/page.tsx`)
   - Two tabs: **Pending** and **Flagged**
   - Calls `db.getPendingRoutes()` / `db.getFlaggedRoutes()` — works with mock store
   - Each row shows: title, tags, distance, submitted date

3. **RouteCard component** (`/components/admin/RouteCard.tsx`)
   - Shows route metadata
   - Small inline map preview (reuse `GPXPreview` component with the route's geojson)
   - **Approve** button → POST `/api/admin/approve` → calls `db.approveRoute(id)` → route appears on public map
   - **Reject** button → POST `/api/admin/reject` → calls `db.rejectRoute(id)`
   - For flagged routes: shows the report reason

4. **`/lib/admin-auth.ts`**
   - Cookie verification helper used by middleware and API routes

   Note: Email notifications are a Stage B feature (requires Resend account). Skipped for demo.

**Done when:** Log in with password `demo`, see uploaded routes in Pending tab, approve one, verify it appears as a pin on the map.

---

---
---

## — DEMO REVIEW POINT —

*Run `npm run dev`, open the browser, show the demo. Approve the UX before proceeding to Stage B.*

---
---

## Phase 6 — Supabase Integration *(requires Supabase account)*

**Goal:** Replace the mock store with real Supabase + PostGIS. All API routes already call `/lib/db.ts` — this phase only rewrites that file and adds the Supabase client.

### Steps

1. **You provide:** Supabase project URL, anon key, service key
2. **You do in Supabase dashboard:**
   - Enable PostGIS extension
   - Run schema SQL (routes + reports tables, indexes, RLS policies, `routes_in_bbox` RPC)
   - Create `gpx-files` storage bucket (private)
   - Set connection pooling to "Transaction" mode

3. **Install Supabase client**
   ```bash
   npm install @supabase/supabase-js
   ```

4. **Update `.env.local`**
   ```
   NEXT_PUBLIC_DEMO_MODE=false
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_KEY=...
   ```

5. **Write `/lib/supabase-client.ts`** and **`/lib/supabase-server.ts`**

6. **Rewrite `/lib/db.ts`** to call Supabase instead of the mock store — same function signatures, real queries

7. **Update `/api/upload`** to also upload the original GPX file to Supabase Storage and store the path

8. **Update GPX download** in `RoutePopup` to generate a Supabase signed Storage URL

**Done when:** Routes load from real database, uploads persist across server restarts, GPX download works from Storage.

---

## Phase 7 — MapTiler + Turnstile + Resend *(requires 3 accounts)*

**Goal:** Replace demo-grade services with production-grade ones.

### MapTiler *(you register, provide key)*
- Swap OpenFreeMap tile URL → MapTiler Streets style URL in `MapView.tsx`
- Swap Nominatim geocoder → MapTiler Geocoding API via `/api/geocode` proxy route

### Cloudflare Turnstile *(you register, provide site key + secret)*
- Add Turnstile widget to `UploadForm.tsx`
- Add server-side token verification to `/api/upload`

### Resend *(you register, provide API key)*
- Set up Supabase Database Webhook for new submissions → call Resend API
- Set up Supabase Database Webhook for new reports → call Resend API

---

## Phase 8 — Security Hardening

**Goal:** Harden everything that was left permissive during demo.

- [ ] File size limit enforced (reject > 10MB before reading body)
- [ ] File type validated (XML parse + GPX root element check)
- [ ] Coordinate range validation (lat ±90, lng ±180)
- [ ] Minimum route distance enforced (> 100m)
- [ ] IP rate limiting (max 3 uploads / IP / 24h via `ip_hash` in routes table)
- [ ] Timestamp stripping confirmed active
- [ ] Honeypot checked server-side
- [ ] `SUPABASE_SERVICE_KEY` absent from client bundle (verify with `next build`)
- [ ] Admin cookie upgraded: HttpOnly, Secure, SameSite=Strict, signed JWT, 7-day expiry
- [ ] Report throttle (max 1 report per IP per route)
- [ ] GPX downloads use signed Storage URLs (60s expiry, not public URLs)
- [ ] RLS tested: anon key cannot read pending/rejected routes

---

## Phase 9 — Polish & Deploy to Vercel *(requires Vercel account)*

### UI Polish
- Loading skeleton while pins fetch, spinner on route select
- Mobile-responsive upload form (single column, touch targets)
- Empty-viewport message when no routes in view
- User-friendly upload error messages (file too large, invalid GPX, rate limited)
- MapTiler/OSM attribution visible at all times (license requirement)

### Performance
- Cache `/api/routes` with `Cache-Control: s-maxage=30`
- Confirm MapLibre GL is dynamic-imported (`ssr: false`) — already done in Phase 2

### Deployment *(you do)*
1. Push repo to GitHub
2. Import project in Vercel dashboard
3. Set all env vars in Vercel
4. Deploy
5. Confirm custom domain (if applicable)
6. Enable Vercel Analytics (free)

---

## Deferred (Post-MVP)

| Feature | Reason deferred |
|---|---|
| Star ratings / reviews | Requires auth design decision first |
| Share thumbnail / OG image | URL sharing sufficient for MVP |
| Route deduplication | Low risk at launch volume |
| Start/end point fuzzing | Decide on privacy policy first |
| Realtime updates (new routes appearing live) | Supabase Realtime can be added in one afternoon when needed |
| Tag filtering / search on map | Not in original spec |

---

## Dependency Summary

```json
"dependencies": {
  "next": "^15",
  "react": "^19",
  "react-dom": "^19",
  "@supabase/supabase-js": "^2",
  "maplibre-gl": "^4",
  "react-map-gl": "^8",
  "@tmcw/togeojson": "^6",
  "@turf/simplify": "^7",
  "@turf/length": "^7",
  "@turf/centroid": "^7",
  "@turf/bbox": "^7"
},
"devDependencies": {
  "typescript": "^5",
  "@types/geojson": "^7946",
  "tailwindcss": "^4",
  "@types/node": "^22",
  "@types/react": "^19"
}
```

---

## Implementation Checklist

### Stage A — Demo (no accounts needed)

#### Phase 1 — Project Setup & Mock Data Layer
- [ ] Re-initialise project as Next.js (App Router, TypeScript, Tailwind)
- [ ] Install dependencies (`maplibre-gl`, `react-map-gl`, turf packages, `@tmcw/togeojson`, `@types/geojson`)
- [ ] Create `.env.local` (`NEXT_PUBLIC_DEMO_MODE=true`, `ADMIN_PASSWORD=demo`)
- [ ] Write `/types/route.ts` (`Route`, `RoutePin`, `RouteStatus`)
- [ ] Write `/lib/mock/routes.ts` — 5–8 hardcoded GPS art routes as GeoJSON
- [ ] Write `/lib/mock/store.ts` — in-memory store with full CRUD interface
- [ ] Write `/lib/db.ts` — abstraction layer, routes to mock store when `DEMO_MODE=true`
- [ ] Write `/middleware.ts` — protect `/admin` routes via cookie check
- [ ] Write `/lib/admin-auth.ts` — cookie verification helper

#### Phase 2 — Map Foundation
- [ ] Write `MapView.tsx` — full-screen MapLibre GL map via `react-map-gl`
- [ ] Configure OpenFreeMap tile URL (`https://tiles.openfreemap.org/styles/liberty`)
- [ ] Add MapView to home page (`/app/page.tsx`) via `dynamic({ ssr: false })`
- [ ] Write `SearchControl.tsx` — address lookup using Nominatim (no key)
- [ ] Wire search results to `mapRef.current.flyTo()`
- [ ] Write `LocationControl.tsx` — "locate me" button using `navigator.geolocation`

#### Phase 3 — Route Display
- [ ] Write `/app/api/routes/route.ts` — `GET` with bbox params, calls `db.getRoutesInBbox()`
- [ ] Write `/app/api/routes/[id]/route.ts` — `GET` single route, calls `db.getRouteById()`
- [ ] Add viewport `moveend`/`zoomend` listeners in `MapView.tsx`, fetch pins with 300ms debounce
- [ ] Implement client-side pin deduplication (merge by id)
- [ ] Write `PinLayer.tsx` — GeoJSON source + circle layer for route centroids
- [ ] Wire pin click → fetch full route → set `selectedRoute` state
- [ ] Write `RouteLayer.tsx` — line layer for selected route, clears on deselect
- [ ] Write `RoutePopup.tsx` — title, distance, Download button, Share button, Report button
- [ ] Implement Download button — serves geojson as `.gpx` file (demo: reconstruct from geojson; production: signed Storage URL)
- [ ] Implement Share button — copy `/routes/{id}` URL to clipboard
- [ ] Implement Report button — inline reason input → `POST /api/report`
- [ ] Write `/app/api/report/route.ts` — calls `db.flagRoute()`, increments report count
- [ ] Write `/app/routes/[id]/page.tsx` — SSR page with Open Graph meta tags, map centred on route

#### Phase 4 — Upload Form & GPX Pipeline
- [ ] Write `/app/upload/page.tsx` — centred layout with link back to map
- [ ] Write `UploadForm.tsx` — file input, title, description, tags, honeypot field
- [ ] Implement client-side GPX parse on file select (`@tmcw/togeojson` via `FileReader`)
- [ ] Show inline error if file is invalid GPX
- [ ] Write `GPXPreview.tsx` — small MapLibre map, renders parsed GeoJSON, fits bounds
- [ ] Write `/lib/gpx.ts` — GPX parsing + timestamp stripping
- [ ] Write `/lib/simplify.ts` — `@turf/simplify` wrapper
- [ ] Write `/lib/distance.ts` — `@turf/length` wrapper returning km
- [ ] Write `/app/api/upload/route.ts` (demo pipeline):
  - [ ] Check honeypot field
  - [ ] Validate file present and title non-empty
  - [ ] Parse GPX → GeoJSON
  - [ ] Validate coordinate ranges
  - [ ] Validate minimum route length > 100m
  - [ ] Strip timestamps
  - [ ] Simplify, calculate distance, centroid, bbox
  - [ ] Call `db.createRoute()` with `status = 'pending'`
  - [ ] Return `{ success: true, id }`
- [ ] Show success message on form after submission

#### Phase 5 — Admin Dashboard
- [ ] Write `/app/api/admin/login/route.ts` — compare password, set HttpOnly cookie
- [ ] Write `/app/admin/login/page.tsx` — password form
- [ ] Write `/app/admin/page.tsx` — two-tab layout (Pending / Flagged)
- [ ] Write `RouteQueue.tsx` — lists routes by status from `db.getPendingRoutes()` / `db.getFlaggedRoutes()`
- [ ] Write `RouteCard.tsx` — metadata, inline GPXPreview, Approve/Reject buttons
- [ ] Write `/app/api/admin/approve/route.ts` — calls `db.approveRoute(id)`
- [ ] Write `/app/api/admin/reject/route.ts` — calls `db.rejectRoute(id)`

---

### — DEMO REVIEW — show demo, get approval, then continue —

---

### Stage B — Production (accounts required)

#### Phase 6 — Supabase Integration *(you: create project, run SQL, provide keys)*
- [ ] You: create Supabase project, enable PostGIS, run schema SQL, create storage bucket
- [ ] Install `@supabase/supabase-js`
- [ ] Update `.env.local` with Supabase URL, anon key, service key; set `DEMO_MODE=false`
- [ ] Write `/lib/supabase-client.ts` and `/lib/supabase-server.ts`
- [ ] Rewrite `/lib/db.ts` to call Supabase (same exported function signatures)
- [ ] Update `/api/upload` to store original GPX in Supabase Storage
- [ ] Update GPX download to use signed Supabase Storage URL
- [ ] Write `/lib/rate-limit.ts` — IP rate limiting via `ip_hash` query

#### Phase 7 — MapTiler + Turnstile + Resend *(you: register each, provide keys)*
- [ ] You: register MapTiler → swap tile URL in `MapView.tsx`, add geocode proxy route `/api/geocode`
- [ ] You: register Cloudflare Turnstile → add widget to `UploadForm.tsx`, verify token in `/api/upload`
- [ ] You: register Resend → set up Supabase webhooks for submission + report emails

#### Phase 8 — Security Hardening
- [ ] File size limit enforced (reject > 10MB before reading body)
- [ ] File type validated (XML parse + GPX root element check)
- [ ] IP rate limiting active (max 3 uploads / IP / 24h)
- [ ] `SUPABASE_SERVICE_KEY` absent from client bundle (`next build` check)
- [ ] Admin cookie upgraded: Secure, SameSite=Strict, signed JWT, 7-day expiry
- [ ] Report throttle (max 1 report per IP per route)
- [ ] GPX downloads use signed Storage URLs (60s expiry)
- [ ] RLS tested: anon key cannot read pending/rejected routes

#### Phase 9 — Polish & Deploy *(you: Vercel account)*
- [ ] Loading skeleton while pins fetch, spinner on route select
- [ ] Empty-viewport message when no routes in view
- [ ] User-friendly upload error messages
- [ ] Upload form mobile-responsive
- [ ] Map attribution visible at all times
- [ ] `/api/routes` response has `Cache-Control: s-maxage=30`
- [ ] You: push repo to GitHub, import in Vercel, set env vars, deploy
- [ ] You: set Supabase connection pooling to "Transaction" mode
- [ ] You: confirm storage bucket is private
- [ ] You: configure custom domain (if applicable)
