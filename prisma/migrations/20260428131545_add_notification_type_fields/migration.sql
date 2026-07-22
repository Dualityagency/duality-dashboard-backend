/*
  Warnings:

  - Added the required column `type` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_OVERDUE', 'TASK_DEADLINE_TODAY', 'TASK_FILE_ATTACHED', 'TASK_AI_COMPLETE', 'PROJECT_ASSIGNED', 'PROJECT_STATUS_CHANGED', 'PROJECT_MEMBER_ADDED', 'PROJECT_CDC_UPLOADED', 'PROJECT_AI_SPRINTS', 'SPRINT_CREATED', 'SPRINT_TASK_ASSIGNED', 'PROJECT_AUTOCOMPLETED', 'ACCOUNT_REACTIVATED', 'PROFILE_UPDATED_BY_ADMIN');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "relatedEntityId" INTEGER,
ADD COLUMN     "relatedEntityType" TEXT,
ADD COLUMN     "type" "NotificationType" NOT NULL;
