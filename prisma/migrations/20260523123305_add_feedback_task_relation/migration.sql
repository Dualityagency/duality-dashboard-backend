/*
  Warnings:

  - You are about to drop the column `createdById` on the `projects` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_createdById_fkey";

-- AlterTable
ALTER TABLE "feedbacks" ADD COLUMN     "feedbackRequestedAt" TIMESTAMP(3),
ADD COLUMN     "taskId" INTEGER;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "createdById";

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
