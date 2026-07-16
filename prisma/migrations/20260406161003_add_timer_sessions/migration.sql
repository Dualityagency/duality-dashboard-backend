/*
  Warnings:

  - You are about to drop the column `description` on the `task_assistant_ia` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('BASSE', 'MOYENNE', 'HAUTE', 'URGENTE');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'EN_PAUSE';

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_employeeId_fkey";

-- DropIndex
DROP INDEX "timer_tasks_sprintTaskId_key";

-- DropIndex
DROP INDEX "timer_tasks_taskId_key";

-- AlterTable
ALTER TABLE "task_assistant_ia" DROP COLUMN "description",
ADD COLUMN     "estimatedDuration" TEXT,
ADD COLUMN     "subtasks" TEXT[],
ADD COLUMN     "suggestedPriority" "TaskPriority",
ADD COLUMN     "tips" TEXT[];

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "blockedByTaskId" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "estimatedHours" INTEGER,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'BASSE',
ADD COLUMN     "tags" TEXT[],
ALTER COLUMN "dateDebut" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_blockedByTaskId_fkey" FOREIGN KEY ("blockedByTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
