-- Create function to generate vector tiles for courts
-- This function:
-- 1. Accepts tile coordinates (z, x, y) as integer arguments
-- 2. Transforms coordinates from WGS84 (EPSG:4326) to Web Mercator (EPSG:3857)
-- 3. Uses ST_AsMVTGeom to format geometry for vector tiles

CREATE OR REPLACE FUNCTION public.courts_tile(
    z integer,
    x integer,
    y integer
)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    result bytea;
    bounds geometry;
    tile_extent integer := 4096;
    buffer integer := 256;
BEGIN
    -- Calculate tile bounds in Web Mercator (EPSG:3857)
    -- ST_TileEnvelope converts z/x/y tile coordinates to a bounding box
    bounds := ST_TileEnvelope(z, x, y);

    -- Build the MVT (Mapbox Vector Tile)
    SELECT INTO result ST_AsMVT(tile, 'courts', tile_extent, 'geom')
    FROM (
        SELECT
            c.id,
            c.name,
            c.description,
            c.phone_numbers,
            c.address_street,
            c.address_ward,
            c.address_district,
            c.address_city,
            c.details,
            c.opening_hours,
            -- Transform geometry for vector tile:
            -- 1. Cast geography to geometry
            -- 2. Transform from WGS84 (4326) to Web Mercator (3857)
            -- 3. Convert to MVT geometry within tile bounds
            ST_AsMVTGeom(
                ST_Transform(c.location::geometry, 3857),
                bounds,
                tile_extent,
                buffer,
                true
            ) AS geom
        FROM courts c
        WHERE 
            c.location IS NOT NULL
            -- Filter courts that intersect with the tile bounds
            -- Transform bounds back to WGS84 for comparison with geography column
            AND ST_Intersects(
                c.location::geometry,
                ST_Transform(bounds, 4326)
            )
    ) AS tile
    WHERE tile.geom IS NOT NULL;

    RETURN COALESCE(result, '');
END;
$$;

-- Create index on location for faster spatial queries (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_courts_location'
    ) THEN
        CREATE INDEX idx_courts_location ON courts USING GIST (location);
    END IF;
END$$;

-- Grant execute permission to public for pg_tileserv access
GRANT EXECUTE ON FUNCTION public.courts_tile(integer, integer, integer) TO PUBLIC;

-- Add comment for pg_tileserv discovery
COMMENT ON FUNCTION public.courts_tile IS 'Vector tile function for badminton courts. Returns MVT format tiles for map rendering.';

