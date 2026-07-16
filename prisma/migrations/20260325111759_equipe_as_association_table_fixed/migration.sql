/*
  Warnings:

  - The values [EN_ATTENTE,EN_COURS] on the enum `ProjectStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PLANIFIE] on the enum `SprintStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [EN_REVISION] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `equipeId` on the `employees` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[employeeId,projectId]` on the table `equipes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `employeeId` to the `equipes` table without a default value. This is not possible if the table is not empty.
  - Made the column `projectId` on table `equipes` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('ACTIF', 'EN_PAUSE', 'TERMINE', 'ANNULE');
ALTER TABLE "public"."projects" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "status" TYPE "ProjectStatus_new" USING ("status"::text::"ProjectStatus_new");
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "public"."ProjectStatus_old";
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'ACTIF';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SprintStatus_new" AS ENUM ('A_FAIRE', 'EN_COURS', 'TERMINE');
ALTER TABLE "public"."sprints" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sprints" ALTER COLUMN "status" TYPE "SprintStatus_new" USING ("status"::text::"SprintStatus_new");
ALTER TYPE "SprintStatus" RENAME TO "SprintStatus_old";
ALTER TYPE "SprintStatus_new" RENAME TO "SprintStatus";
DROP TYPE "public"."SprintStatus_old";
ALTER TABLE "sprints" ALTER COLUMN "status" SET DEFAULT 'A_FAIRE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('A_FAIRE', 'EN_COURS', 'TERMINE');
ALTER TABLE "public"."sprint_tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sprint_tasks" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "sprint_tasks" ALTER COLUMN "status" SET DEFAULT 'A_FAIRE';
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'A_FAIRE';
COMMIT;

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_equipeId_fkey";

-- DropForeignKey
ALTER TABLE "equipes" DROP CONSTRAINT "equipes_projectId_fkey";

-- DropIndex
DROP INDEX "equipes_projectId_key";

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "equipeId";

-- AlterTable
ALTER TABLE "equipes" ADD COLUMN     "employeeId" INTEGER NOT NULL,
ALTER COLUMN "projectId" SET NOT NULL;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'ACTIF';

-- AlterTable
ALTER TABLE "sprints" ALTER COLUMN "status" SET DEFAULT 'A_FAIRE';

-- CreateIndex
CREATE UNIQUE INDEX "equipes_employeeId_projectId_key" ON "equipes"("employeeId", "projectId");

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
