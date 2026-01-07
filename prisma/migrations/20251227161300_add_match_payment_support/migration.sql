-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('BOOKING', 'MATCH_JOIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MatchPlayerStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "MatchPlayerStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "match_player_id" UUID,
ADD COLUMN     "payment_type" "PaymentType" NOT NULL DEFAULT 'BOOKING',
ALTER COLUMN "booking_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "idx_payments_match_player_id" ON "payments"("match_player_id");

-- CreateIndex
CREATE INDEX "idx_payments_type" ON "payments"("payment_type");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_match_player_id_fkey" FOREIGN KEY ("match_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
