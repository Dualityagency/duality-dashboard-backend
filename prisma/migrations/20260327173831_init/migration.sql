/*
  Warnings:

  - The `type` column on the `conversations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'PROJECT');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "projectId" INTEGER,
DROP COLUMN "type",
ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'DIRECT';

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
