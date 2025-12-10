-- Migration: Add 'failed' status to bookings
-- Date: 2025-12-11
-- Purpose: Allow bookings to be marked as 'failed' when payment fails or times out

-- Drop the existing constraint
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_valid_status";

-- Recreate the constraint with 'failed' status included
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_valid_status" 
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'failed'));
