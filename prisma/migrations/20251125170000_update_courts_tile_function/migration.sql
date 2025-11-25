-- Update courts_tile function to only select court id
-- This reduces tile payload size for better performance

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
    bounds := ST_TileEnvelope(z, x, y);

    -- Build the MVT (Mapbox Vector Tile) with only id
    SELECT INTO result ST_AsMVT(tile, 'courts', tile_extent, 'geom')
    FROM (
        SELECT
            c.id,
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
            AND ST_Intersects(
                c.location::geometry,
                ST_Transform(bounds, 4326)
            )
    ) AS tile
    WHERE tile.geom IS NOT NULL;

    RETURN COALESCE(result, '');
END;
$$;

