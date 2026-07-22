-- CreateIndex
CREATE INDEX "feedbacks_clientId_idx" ON "feedbacks"("clientId");

-- CreateIndex
CREATE INDEX "feedbacks_taskId_idx" ON "feedbacks"("taskId");

-- CreateIndex
CREATE INDEX "feedbacks_status_idx" ON "feedbacks"("status");

-- CreateIndex
CREATE INDEX "notifications_utilisateurId_idx" ON "notifications"("utilisateurId");

-- CreateIndex
CREATE INDEX "notifications_utilisateurId_etat_idx" ON "notifications"("utilisateurId", "etat");

-- CreateIndex
CREATE INDEX "sprint_tasks_employeeId_idx" ON "sprint_tasks"("employeeId");

-- CreateIndex
CREATE INDEX "sprint_tasks_sprintId_idx" ON "sprint_tasks"("sprintId");

-- CreateIndex
CREATE INDEX "tasks_employeeId_idx" ON "tasks"("employeeId");

-- CreateIndex
CREATE INDEX "tasks_marketingProjectId_idx" ON "tasks"("marketingProjectId");

-- CreateIndex
CREATE INDEX "tasks_dateFin_idx" ON "tasks"("dateFin");

-- CreateIndex
CREATE INDEX "utilisateurs_email_idx" ON "utilisateurs"("email");
