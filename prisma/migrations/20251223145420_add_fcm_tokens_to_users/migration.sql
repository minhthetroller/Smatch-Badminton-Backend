-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fcm_tokens" TEXT[] DEFAULT ARRAY[]::TEXT[];
