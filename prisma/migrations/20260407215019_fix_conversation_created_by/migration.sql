-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
