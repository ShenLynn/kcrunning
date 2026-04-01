-- Run this entire file in your Supabase SQL editor (supabase.com → project → SQL Editor)
-- Step 1: Enable PostGIS (if not already enabled via Dashboard → Extensions)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Routes table
CREATE TABLE IF NOT EXISTS routes (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT        NOT NULL,
  description     TEXT,
  tags            TEXT[]      DEFAULT '{}',
  gpx_file_path   TEXT,
  geojson         JSONB       NOT NULL,
  geometry        GEOMETRY(LineString, 4326),
  centroid        GEOMETRY(Point, 4326),
  bbox            BOX2D,
  distance_km     FLOAT,
  status          TEXT        DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  ip_hash         TEXT,
  report_count    INT         DEFAULT 0,
  report_reasons  TEXT[]      DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Reports table
CREATE TABLE IF NOT EXISTS reports (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id    UUID    REFERENCES routes(id) ON DELETE CASCADE,
  reason      TEXT,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Indexes
CREATE INDEX IF NOT EXISTS routes_geometry_gist  ON routes USING GIST (geometry);
CREATE INDEX IF NOT EXISTS routes_centroid_gist  ON routes USING GIST (centroid);
CREATE INDEX IF NOT EXISTS routes_status_idx     ON routes (status);

-- Step 5: Row-level security
ALTER TABLE routes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Public can only read approved routes
CREATE POLICY "public_read_approved" ON routes
  FOR SELECT USING (status = 'approved');

-- Step 6: Viewport query function
CREATE OR REPLACE FUNCTION routes_in_bbox(
  west float, south float, east float, north float
)
RETURNS TABLE (id uuid, title text, distance_km float, lng float, lat float)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    title,
    distance_km,
    ST_X(centroid::geometry) AS lng,
    ST_Y(centroid::geometry) AS lat
  FROM routes
  WHERE
    status = 'approved'
    AND centroid && ST_MakeEnvelope(west, south, east, north, 4326)::geometry
$$;
