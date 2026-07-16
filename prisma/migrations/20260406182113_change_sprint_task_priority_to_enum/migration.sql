/*
  Warnings:

  - The `priority` column on the `sprint_tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `avis` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "avis" DROP CONSTRAINT "avis_clientId_fkey";

-- DropForeignKey
ALTER TABLE "avis" DROP CONSTRAINT "avis_projectId_fkey";

-- AlterTable
ALTER TABLE "sprint_tasks" DROP COLUMN "priority",
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'BASSE';

-- DropTable
DROP TABLE "avis";

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "etoiles" INTEGER NOT NULL DEFAULT 5,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
