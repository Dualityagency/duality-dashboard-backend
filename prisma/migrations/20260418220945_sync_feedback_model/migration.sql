/*
  Warnings:

  - You are about to drop the column `date` on the `feedbacks` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `feedbacks` table. All the data in the column will be lost.
  - You are about to drop the column `etoiles` on the `feedbacks` table. All the data in the column will be lost.
  - Added the required column `content` to the `feedbacks` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'RESOLU');

-- AlterTable
ALTER TABLE "feedbacks" DROP COLUMN "date",
DROP COLUMN "description",
DROP COLUMN "etoiles",
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "sentiment" TEXT,
ADD COLUMN     "status" "FeedbackStatus" NOT NULL DEFAULT 'EN_ATTENTE',
ADD COLUMN     "taskTitle" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "createdById" INTEGER;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
