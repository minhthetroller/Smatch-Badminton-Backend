-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable unaccent extension for Vietnamese diacritics-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create an IMMUTABLE wrapper function for unaccent
-- PostgreSQL's unaccent is STABLE, but we need IMMUTABLE for generated columns
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE STRICT;

-- Add unaccented name column for faster Vietnamese search
ALTER TABLE courts ADD COLUMN IF NOT EXISTS name_unaccent text
  GENERATED ALWAYS AS (lower(immutable_unaccent(name))) STORED;

-- Add unaccented district column for faster Vietnamese search  
ALTER TABLE courts ADD COLUMN IF NOT EXISTS district_unaccent text
  GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce(address_district, '')))) STORED;

-- Add composite search column for full-text search performance
-- Uses immutable_unaccent for Vietnamese diacritics-insensitive search
ALTER TABLE courts ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce(address_district, ''))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce(address_ward, ''))), 'C')
  ) STORED;

-- GIN index for trigram similarity (fuzzy search on name)
CREATE INDEX IF NOT EXISTS idx_courts_name_trgm ON courts USING GIN (name gin_trgm_ops);

-- GIN index for trigram similarity on unaccented name (Vietnamese support)
CREATE INDEX IF NOT EXISTS idx_courts_name_unaccent_trgm ON courts USING GIN (name_unaccent gin_trgm_ops);

-- GIN index for trigram similarity (fuzzy search on district)
CREATE INDEX IF NOT EXISTS idx_courts_district_trgm ON courts USING GIN (address_district gin_trgm_ops);

-- GIN index for trigram similarity on unaccented district (Vietnamese support)
CREATE INDEX IF NOT EXISTS idx_courts_district_unaccent_trgm ON courts USING GIN (district_unaccent gin_trgm_ops);

-- GIN index for full-text search vector
CREATE INDEX IF NOT EXISTS idx_courts_search_vector ON courts USING GIN (search_vector);

