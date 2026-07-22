-- Delete stale TASK_OVERDUE notifications sent to non-admin users.
-- These were created by an older scheduler version that no longer exists.
-- Current scheduler only sends TASK_OVERDUE to admins.
DELETE FROM notifications
WHERE type = 'TASK_OVERDUE'
  AND "utilisateurId" NOT IN (
    SELECT id FROM utilisateurs WHERE role = 'ADMIN'
  );