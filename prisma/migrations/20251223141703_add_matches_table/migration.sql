-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('TBY', 'Y', 'Y_PLUS', 'Y_PLUS_PLUS', 'TBK', 'TB', 'TB_PLUS', 'TB_PLUS_PLUS', 'K', 'K_PLUS', 'GIOI');

-- CreateEnum
CREATE TYPE "ShuttleType" AS ENUM ('TC77', 'BASAO', 'YONEX_AS30', 'YONEX_AS40', 'YONEX_AS50', 'VICTOR_MASTER_1', 'VICTOR_CHAMPION_1', 'RSL_CLASSIC', 'LINDAN_40', 'LINDAN_50', 'OTHER');

-- CreateEnum
CREATE TYPE "PlayerFormat" AS ENUM ('SINGLE_MALE', 'SINGLE_FEMALE', 'DOUBLE_MALE', 'DOUBLE_FEMALE', 'MIXED_DOUBLE', 'ANY');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchPlayerStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'LEFT');

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "court_id" UUID NOT NULL,
    "host_user_id" UUID NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skill_level" "SkillLevel" NOT NULL,
    "shuttle_type" "ShuttleType" NOT NULL,
    "player_format" "PlayerFormat" NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER NOT NULL DEFAULT 0,
    "slots_needed" INTEGER NOT NULL DEFAULT 1,
    "status" "MatchStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_players" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "MatchPlayerStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "position" INTEGER,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ,

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_matches_court_id" ON "matches"("court_id");

-- CreateIndex
CREATE INDEX "idx_matches_host_user_id" ON "matches"("host_user_id");

-- CreateIndex
CREATE INDEX "idx_matches_date_status" ON "matches"("date", "status");

-- CreateIndex
CREATE INDEX "idx_matches_skill_status" ON "matches"("skill_level", "status");

-- CreateIndex
CREATE INDEX "idx_match_players_match_status" ON "match_players"("match_id", "status");

-- CreateIndex
CREATE INDEX "idx_match_players_user_id" ON "match_players"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_match_players_unique" ON "match_players"("match_id", "user_id");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
