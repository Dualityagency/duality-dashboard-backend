-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_createdBy_fkey";

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "sprintTaskId" INTEGER;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_sprintTaskId_fkey" FOREIGN KEY ("sprintTaskId") REFERENCES "sprint_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
