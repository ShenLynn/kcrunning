# Research & Tech Stack Validation Report

**Project:** GPS Art / Running Route Map ("KCRunning")
**Stage:** Pre-implementation analysis
**Date:** 2026-03-05

---

## 1. Concept Summary

A public map-based platform where users anonymously upload GPX files of running routes, primarily to create GPS art (drawings made by running specific paths). Routes are moderated before being displayed publicly. Think Strava art meets a public mural board.

This is a niche but well-defined product. The core loop is: **upload GPX → moderate → display on map → community interaction (downloads, shares)**. The anonymous nature is intentional and central to the UX.

---

## 2. Frontend: Next.js (Decided)

### Decision

**Next.js** is the chosen framework. It is a production-grade framework built on top of React — not an alternative to it. The distinction from a plain React SPA matters:

**SSR (Server-Side Rendering):** When a user requests a page, the server generates the full HTML and sends it to the browser. The page is immediately readable — no waiting for JavaScript to load and run. This is important for shareable route URLs, because link preview scrapers (iMessage, Twitter, Slack) fetch the page like a basic HTTP client and will see a blank page from a pure SPA.

**SSG (Static Site Generation):** Pages are pre-rendered at build time into static HTML files. Good for pages that don't change often (e.g., the homepage). Faster than SSR because no server computation happens per request.

For this project, the map view is client-rendered (interactive, data changes), but individual route pages benefit from SSR for link previews.

**Built-in API Routes:** Next.js lets you write server-side code inside the same project under `/app/api/`. These are standard HTTP endpoints (GET, POST, etc.) that run on the server, not in the browser. This is useful for: receiving GPX file uploads, calling Supabase with a service key (not exposed to the browser), running server-side validation, and handling admin actions. Without this, you'd need a separate backend service.

### Why Not Pure Vite+React SPA

A pure SPA sends an empty HTML shell to the browser, then JavaScript renders the content. Link previews show nothing. Server-side logic requires a separate service. Next.js eliminates both problems at the cost of slightly more complexity — a worthwhile trade for this project.

---

## 3. Map: Leaflet.js vs MapLibre GL

### Leaflet.js Assessment

Leaflet is mature, well-documented, and easy to use. For simple pin-drop maps it's excellent. However, for this specific use case, it has meaningful weaknesses:

**Performance ceiling:** Leaflet renders using SVG/Canvas on top of raster tiles. With dozens of complex GPS art polylines (each potentially thousands of coordinate points), the DOM overhead becomes significant. Each polyline is a separate SVG element. At 100+ routes visible simultaneously, expect noticeable lag on mobile.

**Why SVG/Canvas is slow compared to GPU rendering:**

Your CPU handles everything in a browser by default. SVG is a list of XML shapes — when you pan the map or add a new route, the browser has to recalculate positions, re-draw each shape, and update the DOM (the browser's internal representation of the page). This happens on one core of your CPU. With 100 complex polylines, each with hundreds of points, the CPU is doing thousands of calculations every frame just to keep up with smooth scrolling. On a phone, which has a much slower CPU than a desktop, this falls apart quickly.

A GPU (graphics card) is designed to do one thing very fast: draw millions of pixels in parallel. WebGL is a browser API that lets JavaScript hand geometry data directly to the GPU. Instead of the CPU drawing each polyline point-by-point, it uploads all the route coordinates to the GPU once, and the GPU renders all of them simultaneously in a single frame. Panning, zooming, and adding new routes becomes cheap because the GPU is doing the heavy lifting. MapLibre GL uses WebGL this way — the CPU only manages data updates, the GPU handles all drawing.

In practical terms: Leaflet with 50 complex routes on mobile may drop to 15fps. MapLibre GL with 500 routes on the same device stays at 60fps.

**No vector tiles:** Leaflet uses raster map tiles (pre-rendered PNGs). Vector tiles (used by Mapbox/MapLibre) are sharper at all zoom levels, load faster, and allow custom styling of the base map — which matters if you want the routes to visually pop against the map background.

**Clustering:** Leaflet's built-in clustering (`leaflet.markercluster`) works but is a separate plugin with its own maintenance lifecycle.

### MapLibre GL Assessment

MapLibre GL is the open-source fork of Mapbox GL JS (Mapbox went proprietary in 2021). It uses WebGL for rendering, meaning:

- Polylines are rendered on the GPU — hundreds of routes render smoothly
- Vector tiles support — sharper, faster, customizable base maps
- First-class layer system — toggling route visibility, styling selected vs unselected routes is cleaner
- Better mobile performance due to WebGL

**Drawbacks:** Steeper learning curve, larger bundle size, WebGL required (though this is universally supported in 2026).

### Recommendation

**MapLibre GL** is the better technical fit for this use case. GPS art routes are complex polylines, and the viewport-culling + many-route rendering requirement is exactly where Leaflet struggles and MapLibre GL excels. Use `react-map-gl` (which supports MapLibre) for React integration.

---

## 4. Backend: Supabase vs Firebase

### Firebase Assessment

Firebase is a NoSQL document database. For geospatial data — routes with coordinates, bounding boxes, spatial queries — NoSQL is a poor fit. Bounding box queries ("give me all routes visible in the current map viewport") are not natively supported and require workarounds like GeoHash indexing, which adds complexity and has edge cases at the antimeridian and poles.

### Supabase Assessment

Supabase runs on PostgreSQL with **PostGIS** — a mature, industry-standard geospatial extension. This is a significant advantage:

- `ST_Within(route_bbox, viewport_bbox)` — native viewport culling query
- `ST_Length(geometry)` — accurate distance calculation in any unit
- Spatial indexes (`GIST`) — fast bounding box lookups even at scale
- Storing GeoJSON natively in `jsonb` columns or as PostGIS `geometry` types
- Row-level security for admin vs public access
- Built-in file storage for GPX files
- Edge Functions (Deno) for server-side logic

### Recommendation

**Supabase uPnambiguously**. Firebase is not suited for geospatial workloads. The PostGIS capability alone justifies Supabase. Store route geometry as a PostGIS `geometry` type with a spatial index. This makes the viewport-culling requirement (mentioned in spec) trivially implementable.

Schema recommendation:
```sql
-- Routes table (high level)
routes (
  id uuid,
  title text,
  description text,
  tags text[],
  gpx_file_url text,       -- Supabase Storage URL
  geojson jsonb,           -- Simplified GeoJSON for map rendering
  geometry geometry(LineString, 4326),  -- PostGIS for spatial queries
  bbox box2d,              -- Bounding box for viewport filtering
  distance_km float,
  status text,             -- 'pending' | 'approved' | 'rejected' | 'flagged'
  created_at timestamptz
)
```

---

## 5. GPX Processing Pipeline — Underspecified

The spec says "Parse GPX client-side or server-side" as if these are equivalent. They are not.

### Client-side Parsing

- **Library:** `@tmcw/togeojson` or `gpxparser`
- **Pros:** No server cost, instant feedback
- **Cons:** You cannot trust client-provided data. A malicious user could modify the GeoJSON before upload. Coordinates must be re-validated server-side regardless. Also, GPX files can be large (long routes = many trackpoints) — parsing a 10MB GPX file in the browser on mobile can freeze the UI.

### Server-side Parsing

- More reliable, validates the actual file content
- Can be done in a Supabase Edge Function (Deno)
- Can enforce file size limits before processing
- Can run simplification server-side without exposing the algorithm

### Recommendation

**Hybrid:** Parse client-side for immediate preview feedback (show user their route before submitting). Re-parse and validate server-side on submission. The server-side canonical version is what gets stored. Do not trust the client-provided GeoJSON.

### Critical Missing: Route Simplification

A GPS watch or phone records a point every 1-5 seconds. A 1-hour run = 720–3600 coordinate points. For map display, you do not need this resolution. Displaying raw GPX data will kill performance.

**Douglas-Peucker simplification** (implemented in `@turf/simplify`) reduces point count by 90%+ while preserving visual shape. This is essential and completely absent from the spec.

Store two versions:
1. `geojson_display` — simplified (for map rendering, ~100-300 points)
2. The original GPX file in Supabase Storage (for GPX downloads, preserving accuracy)

---

## 6. Viewport-Based Route Loading — Implementation Detail Missing

The spec mentions "limit initial load to bounds" which is correct thinking but underspecified.

**How it should work:**
1. On map move/zoom, get current viewport bounding box from the map library
2. Query Supabase: `SELECT * FROM routes WHERE bbox && ST_MakeEnvelope($west, $south, $east, $north, 4326)`
3. Only load routes whose bounding box intersects the viewport
4. Cache already-loaded routes client-side; only fetch new ones on pan

**Performance consideration:** At high zoom-out levels, many routes could be in view. Need a minimum zoom level before showing individual routes. At low zoom, show clustered pins only. At high zoom, show polylines.

This dual-mode display (pins at low zoom, polylines at high zoom) is not described in the spec and needs to be deliberately designed. The spec mentions "display all approved routes as pin and highlight the selected polyline route" — this implies pins are always shown and only the selected route becomes a polyline. That approach does not scale. If 500 routes are in view, 500 pins will cluster poorly and 500 polylines rendered simultaneously will lag.

---

## 7. Rating System — Deferred from MVP

Ratings and reviews are excluded from the MVP. The core problem is that anonymous uploads and a rating system are fundamentally incompatible without some form of session tracking — without it, ratings are trivially manipulated. This is a post-MVP feature that requires a proper design decision (lightweight auth, IP heuristics, or similar) before implementation.

The route popup will show title, distance, download and share buttons, and a report option. No star rating or review count.

---

## 8. Share Link

Share link is a simple URL to the route page (e.g. `/routes/[id]`). No thumbnail generation for MVP — this can be added later. The URL alone is sufficient for sharing.

---

## 9. Spam Prevention — Insufficient for Anonymous Uploads

The spec mentions "honeypot or captcha." For a public anonymous file upload form accepting GPX files, this is the minimum viable protection. Known weaknesses:

- **Honeypot:** Catches bots, not human spammers
- **Basic CAPTCHA (reCAPTCHA):** Effective but Google-owned, privacy concern
- **hCaptcha or Cloudflare Turnstile:** Privacy-respecting alternatives, recommended

**Missing protections not mentioned in spec:**
- **File size limit:** No mention of max GPX file size. A 100MB file upload is a trivial DoS vector
- **File type validation:** Validate it's actually GPX (XML with GPX schema), not just a `.gpx` extension
- **Rate limiting per IP:** Prevent mass submissions from one IP
- **Coordinate sanity check:** Reject routes with impossible coordinates, suspiciously short routes, or routes entirely in the ocean
- **Upload cooldown:** E.g., one submission per IP per hour

These are not nice-to-haves — they are necessary for a public anonymous upload form.

---

## 10. Privacy Concern — GPS Data and Home Addresses

GPS art routes typically start and end near the runner's home. A route uploaded without any anonymization will reveal approximately where someone lives, their regular running areas, and potentially their schedule (if timestamps are in GPX).

The spec has no mention of this. Consider:

- **Stripping timestamps** from GPX before storage (Strava does this for privacy)
- **Start/end point fuzzing** — Truncate the first/last N meters of a route before display
- **Disclosure to uploaders** — Inform users their route may reveal location data

This is not just a nice-to-have for GDPR compliance if any EU users are involved.

---

## 11. Admin Dashboard — Supabase May Be Enough

The spec calls for a "simple admin dashboard (basic login for me) to approve/delete/flagged uploads." This is often over-engineered as a custom UI when Supabase's built-in table editor already provides:

- Filter by `status = 'flagged'`
- Edit/delete rows
- View stored files

A minimal custom admin UI with a hardcoded password route (`/admin`) could be functional with ~100 lines of code: list pending/flagged routes with approve/reject buttons that call Supabase. Do not over-build this.

Email notifications on new submissions and flag reports can be handled by Supabase's built-in `pg_notify` + webhook, or a simple Resend/Postmark integration.

---

## 12. Missing Requirements — Items Not Addressed in Spec

| Gap | Risk | Notes |
|---|---|---|
| GPX file size limit | High | Needed before launch |
| Route simplification | High | Performance-critical |
| Start/end point fuzzing | Medium | Privacy, especially for EU |
| IP rate limiting on uploads | Medium | Spam/DoS protection |
| Coordinate validation | Medium | Data quality |
| Min zoom level for polyline display | Medium | Performance at scale |
| Route deduplication | Low | Same route uploaded many times |
| Map tile provider choice | Low | OSM default tiles may clash visually with art routes |

---

## 13. Deployment

**Vercel** — natural home for Next.js (same company, best integration). No strong reason to use Netlify given the framework choice.

---

## 14. Recommended Stack (Final)

| Layer | Recommended | Original | Reason |
|---|---|---|---|
| Framework | **Next.js** | React/Next.js SPA | SSR for route pages, built-in API routes |
| Styling | Tailwind CSS | Tailwind CSS | No change |
| Map | **MapLibre GL** (via react-map-gl) | Leaflet.js | WebGL perf, better polyline rendering |
| Map Tiles | **Stadia Maps or MapTiler** (OSM-based, free tier) | OpenStreetMap | Better visual contrast for art routes |
| GPX Parsing | `@tmcw/togeojson` + server re-validation | Client or server | Trust no client data |
| Route Simplification | `@turf/simplify` | Not mentioned | Critical for performance |
| Backend | **Supabase** + PostGIS | Supabase or Firebase | PostGIS is decisive |
| Spam prevention | **Cloudflare Turnstile** | Honeypot/CAPTCHA | Privacy-respecting, effective |
| Deployment | **Vercel** | Vercel or Netlify | Next.js native home |

---

## 15. Open Decisions Before Implementation

1. **MapLibre GL or Leaflet?** — Commit before building the map layer; they have incompatible APIs. MapLibre GL is strongly recommended.
2. **Route privacy policy** — Decide whether to fuzz start/end coordinates. Easier to build in from the start than retrofit.
