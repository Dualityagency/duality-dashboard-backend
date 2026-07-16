-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIF', 'SUSPENDU');

-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIF';
