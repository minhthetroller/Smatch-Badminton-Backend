-- Enable PostGIS extension for location features
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable unaccent extension for Vietnamese diacritics-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

