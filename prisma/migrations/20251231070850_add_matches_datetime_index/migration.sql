-- Add expression index for efficient filtering of future matches
-- This index uses PostgreSQL's datetime arithmetic (date + time) to enable
-- fast queries filtering matches by (date + end_time) > NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_datetime_end 
ON matches ((date + end_time), status);