-- CreateTable: sub_courts
-- Individual playable courts within a venue
CREATE TABLE "sub_courts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "court_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "sub_courts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sub_courts_court_id_fkey" FOREIGN KEY ("court_id") 
        REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: sub_court_closures
-- Track exceptions when a sub-court is unavailable (maintenance, special closures)
CREATE TABLE "sub_court_closures" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "sub_court_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIME,                      -- NULL = full day closure
    "end_time" TIME,                        -- NULL = full day closure
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "sub_court_closures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sub_court_closures_sub_court_id_fkey" FOREIGN KEY ("sub_court_id") 
        REFERENCES "sub_courts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: pricing_rules
-- Tiered pricing at court level (weekday, weekend, holiday rates)
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "court_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "day_type" VARCHAR(20) NOT NULL,        -- 'weekday', 'weekend', 'holiday'
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "price_per_hour" INTEGER NOT NULL,      -- Price in VND
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pricing_rules_court_id_fkey" FOREIGN KEY ("court_id") 
        REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pricing_rules_valid_day_type" CHECK (
        day_type IN ('weekday', 'weekend', 'holiday')
    )
);

-- CreateTable: bookings
-- Track reservations per sub-court and time slot
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "sub_court_id" UUID NOT NULL,
    "user_id" UUID,                          -- NULL for guest, future FK to users
    "guest_name" VARCHAR(255),
    "guest_phone" VARCHAR(20),
    "guest_email" VARCHAR(255),
    "date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "total_price" INTEGER NOT NULL,          -- Calculated from pricing_rules
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bookings_sub_court_id_fkey" FOREIGN KEY ("sub_court_id") 
        REFERENCES "sub_courts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bookings_valid_hours" CHECK (start_time < end_time),
    CONSTRAINT "bookings_valid_status" CHECK (
        status IN ('pending', 'confirmed', 'cancelled', 'completed')
    ),
    CONSTRAINT "bookings_has_contact" CHECK (
        user_id IS NOT NULL OR guest_phone IS NOT NULL
    )
);

-- CreateTable: holidays
-- Track holidays for pricing rules
CREATE TABLE "holidays" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "date" DATE NOT NULL,
    "name" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "holidays_date_unique" UNIQUE ("date")
);

-- CreateIndexes for performance

-- Sub-courts: Fast lookup by court
CREATE INDEX "idx_sub_courts_court_id" ON "sub_courts"("court_id");

-- Sub-court closures: Fast lookup by sub-court and date
CREATE INDEX "idx_sub_court_closures_lookup" ON "sub_court_closures"("sub_court_id", "date");

-- Pricing rules: Fast lookup by court, day type, and active status
CREATE INDEX "idx_pricing_rules_court" ON "pricing_rules"("court_id", "day_type", "is_active");

-- Bookings: Fast lookup by sub-court, date, and status
CREATE INDEX "idx_bookings_sub_court_date" ON "bookings"("sub_court_id", "date", "status");

-- Bookings: Fast lookup by date range for availability calculation
CREATE INDEX "idx_bookings_date_range" ON "bookings"("date", "start_time", "end_time");

-- Holidays: Fast lookup by date
CREATE INDEX "idx_holidays_date" ON "holidays"("date");

