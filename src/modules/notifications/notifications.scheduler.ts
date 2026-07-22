import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

import type { NotificationType as NotificationTypeEnum } from '@prisma/client';
const { NotificationType } = require('.prisma/client') as { NotificationType: typeof NotificationTypeEnum };

@Injectable()
export class NotificationsScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Africa/Tunis' })
  async handleDailyReminders() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);

    // ── Tasks due tomorrow ────────────────────────────────────────────────────
    const [marketingDue, sprintDue] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          status: { not: 'TERMINE' },
          dateFin: { gte: tomorrowStart, lte: tomorrowEnd },
          employee: { isNot: null },
        },
        include: { employee: true, marketingProject: { include: { project: true } } },
      }),
      this.prisma.sprintTask.findMany({
        where: {
          status: { not: 'TERMINE' },
          dateFin: { gte: tomorrowStart, lte: tomorrowEnd },
          employee: { isNot: null },
        },
        include: { employee: true, sprint: { include: { webProject: { include: { project: true } } } } },
      }),
    ]);

    // Batch-check which deadline notifications already exist today
    const marketingTaskIds = marketingDue.map((t) => t.id);
    const sprintTaskIds = sprintDue.map((t) => t.id);

    const [existingMarketingNotifs, existingSprintNotifs] = await Promise.all([
      marketingTaskIds.length
        ? this.prisma.notification.findMany({
            where: {
              type: 'TASK_DEADLINE_TODAY' as any,
              relatedEntityId: { in: marketingTaskIds },
              createdAt: { gte: todayStart },
            },
            select: { relatedEntityId: true },
          })
        : [],
      sprintTaskIds.length
        ? this.prisma.notification.findMany({
            where: {
              type: 'TASK_DEADLINE_TODAY' as any,
              relatedEntityId: { in: sprintTaskIds },
              createdAt: { gte: todayStart },
            },
            select: { relatedEntityId: true },
          })
        : [],
    ]);

    const notifiedMarketingIds = new Set(existingMarketingNotifs.map((n) => n.relatedEntityId));
    const notifiedSprintIds = new Set(existingSprintNotifs.map((n) => n.relatedEntityId));

    await Promise.all([
      ...marketingDue
        .filter((t) => t.employee && !notifiedMarketingIds.has(t.id))
        .map((task) =>
          this.notificationsService.createNotification(
            task.employee!.utilisateurId,
            NotificationType.TASK_DEADLINE_TODAY,
            'Deadline demain',
            `La tâche "${task.titre}" du projet "${task.marketingProject?.project?.nom ?? 'votre projet'}" arrive à échéance demain.`,
            task.id,
            'Task',
            task.marketingProject?.project?.id ?? undefined,
          ).catch(() => {}),
        ),
      ...sprintDue
        .filter((t) => t.employee && !notifiedSprintIds.has(t.id))
        .map((task) =>
          this.notificationsService.createNotification(
            task.employee!.utilisateurId,
            NotificationType.TASK_DEADLINE_TODAY,
            'Deadline demain',
            `La tâche "${task.titre}" du projet "${task.sprint?.webProject?.project?.nom ?? 'votre projet'}" arrive à échéance demain.`,
            task.id,
            'SprintTask',
            task.sprint?.webProject?.project?.id ?? undefined,
          ).catch(() => {}),
        ),
    ]);

    // ── Overloaded employees → notify all admins ──────────────────────────────
    const [employees, admins] = await Promise.all([
      this.prisma.employee.findMany({
        include: {
          utilisateur: true,
          assignedSprintTasks: { where: { status: { not: 'TERMINE' } }, select: { id: true } },
          assignedTasks: { where: { status: { not: 'TERMINE' } }, select: { id: true } },
        },
      }),
      this.prisma.utilisateur.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      }),
    ]);

    const overloaded = employees.filter(
      (e) => e.assignedSprintTasks.length + e.assignedTasks.length > 5,
    );

    if (overloaded.length === 0 || admins.length === 0) return;

    // Batch-check which overload notifications already exist today
    const overloadedEmployeeIds = overloaded.map((e) => e.id);
    const adminIds = admins.map((a) => a.id);

    const existingOverloadNotifs = await this.prisma.notification.findMany({
      where: {
        type: 'TASK_OVERDUE' as any,
        utilisateurId: { in: adminIds },
        relatedEntityId: { in: overloadedEmployeeIds },
        createdAt: { gte: todayStart },
      },
      select: { utilisateurId: true, relatedEntityId: true },
    });

    const notifiedSet = new Set(
      existingOverloadNotifs.map((n) => `${n.utilisateurId}-${n.relatedEntityId}`),
    );

    await Promise.all(
      overloaded.flatMap((emp) => {
        const activeCount = emp.assignedSprintTasks.length + emp.assignedTasks.length;
        return admins
          .filter((admin) => !notifiedSet.has(`${admin.id}-${emp.id}`))
          .map((admin) =>
            this.notificationsService.createNotification(
              admin.id,
              NotificationType.TASK_OVERDUE,
              'Employé surchargé',
              `${emp.utilisateur.prenom} ${emp.utilisateur.nom} a ${activeCount} tâches actives (seuil : 5).`,
              emp.id,
              'Employee',
            ).catch(() => {}),
          );
      }),
    );
  }
}
