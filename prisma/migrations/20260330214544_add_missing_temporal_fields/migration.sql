/*
  Warnings:

  - You are about to drop the `task_assignees` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `employeeId` to the `tasks` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "task_assignees" DROP CONSTRAINT "task_assignees_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "task_assignees" DROP CONSTRAINT "task_assignees_taskId_fkey";

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "message_read_statuses" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "employeeId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "task_assignees";

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
