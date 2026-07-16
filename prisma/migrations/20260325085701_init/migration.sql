/*
  Warnings:

  - You are about to drop the `administrateurs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `clients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `employers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `grades` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `marketing_projects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `projects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sprint_tasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sprints` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `utilisateurs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `web_projects` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "administrateurs" DROP CONSTRAINT "administrateurs_utilisateurId_fkey";

-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT "clients_utilisateurId_fkey";

-- DropForeignKey
ALTER TABLE "employers" DROP CONSTRAINT "employers_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "employers" DROP CONSTRAINT "employers_utilisateurId_fkey";

-- DropForeignKey
ALTER TABLE "marketing_projects" DROP CONSTRAINT "marketing_projects_projectId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_clientId_fkey";

-- DropForeignKey
ALTER TABLE "sprint_tasks" DROP CONSTRAINT "sprint_tasks_employerId_fkey";

-- DropForeignKey
ALTER TABLE "sprint_tasks" DROP CONSTRAINT "sprint_tasks_sprintId_fkey";

-- DropForeignKey
ALTER TABLE "sprints" DROP CONSTRAINT "sprints_webProjectId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_marketingProjectId_fkey";

-- DropForeignKey
ALTER TABLE "web_projects" DROP CONSTRAINT "web_projects_projectId_fkey";

-- DropTable
DROP TABLE "administrateurs";

-- DropTable
DROP TABLE "clients";

-- DropTable
DROP TABLE "employers";

-- DropTable
DROP TABLE "grades";

-- DropTable
DROP TABLE "marketing_projects";

-- DropTable
DROP TABLE "projects";

-- DropTable
DROP TABLE "sprint_tasks";

-- DropTable
DROP TABLE "sprints";

-- DropTable
DROP TABLE "tasks";

-- DropTable
DROP TABLE "utilisateurs";

-- DropTable
DROP TABLE "web_projects";

-- DropEnum
DROP TYPE "ProjectStatus";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "SprintStatus";

-- DropEnum
DROP TYPE "Status";

-- DropEnum
DROP TYPE "TaskStatus";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
