/*
  Warnings:

  - You are about to drop the column `district_unaccent` on the `courts` table. All the data in the column will be lost.
  - You are about to drop the column `name_unaccent` on the `courts` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `courts` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_courts_district_trgm";

-- DropIndex
DROP INDEX "idx_courts_district_unaccent_trgm";

-- DropIndex
DROP INDEX "idx_courts_name_trgm";

-- DropIndex
DROP INDEX "idx_courts_name_unaccent_trgm";

-- DropIndex
DROP INDEX "idx_courts_search_vector";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "group_id" UUID;

-- AlterTable
ALTER TABLE "courts" DROP COLUMN "district_unaccent",
DROP COLUMN "name_unaccent",
DROP COLUMN "search_vector";

-- CreateIndex
CREATE INDEX "idx_bookings_group_id" ON "bookings"("group_id");
