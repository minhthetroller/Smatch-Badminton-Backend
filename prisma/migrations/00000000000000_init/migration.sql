-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "phone_numbers" TEXT[],
    "address_street" VARCHAR(255),
    "address_ward" VARCHAR(100),
    "address_district" VARCHAR(100),
    "address_city" VARCHAR(100) DEFAULT 'Hà Nội',
    "details" JSONB NOT NULL DEFAULT '{}',
    "opening_hours" JSONB NOT NULL DEFAULT '{}',
    "location" geography(Point, 4326),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: fast map loading
CREATE INDEX "idx_courts_location" ON "courts" USING GIST ("location");

-- CreateIndex: fast filtering by district
CREATE INDEX "idx_courts_district" ON "courts"("address_district");

-- CreateIndex: fast search inside JSON data
CREATE INDEX "idx_courts_details" ON "courts" USING GIN ("details");

