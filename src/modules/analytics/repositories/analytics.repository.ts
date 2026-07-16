import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PageAnalyseKPI, AdminStats, ActivityDay } from '../types/analytics.types';

@Injectable()
export class AnalyticsRepository {
  constructor(private prisma: PrismaService) { }

  async getPageAnalyseStats(year: number, month: number): Promise<PageAnalyseKPI> {
    const startDateYear = new Date(year, 0, 1);
    const endDateYear = new Date(year, 11, 31, 23, 59, 59);

    const startDateMonth = new Date(year, month - 1, 1);
    const endDateMonth = new Date(year, month, 0, 23, 59, 59);

    // 1. Projects for the year
    const projectsYear = await this.prisma.project.findMany({
      where: {
        createdAt: {
          gte: startDateYear,
          lte: endDateYear,
        },
      },
      include: {
        marketingProject: {
          include: {
            tasks: true
          }
        },
        webProject: {
          include: {
            sprints: true
          }
        }
      }
    });

    const projectsActifs = projectsYear.filter(p => p.status === 'ACTIF').length;
    const projectsTermines = projectsYear.filter(p => p.status === 'TERMINE').length;

    // 1.1 Calculate Project Global Progress
    const projectGlobalProgress = projectsYear.map(project => {
      let progress = 0;

      if (project.marketingProject && project.marketingProject.tasks.length > 0) {
        const completedTasks = project.marketingProject.tasks.filter(t => t.status === 'TERMINE').length;
        progress = (completedTasks / project.marketingProject.tasks.length) * 100;
      } else if (project.webProject && project.webProject.sprints.length > 0) {
        const completedSprints = project.webProject.sprints.filter(s => s.status === 'TERMINE').length;
        progress = (completedSprints / project.webProject.sprints.length) * 100;
      }

      return {
        name: project.nom,
        progress: Number(progress.toFixed(0))
      };
    });

    // 2. Tasks for the month (Marketing + Sprint)
    // On inclut les tâches qui étaient "actives" durant ce mois :
    // - Créées avant la fin du mois
    // - ET (soit non terminées, soit terminées APRÈS le début du mois, soit créées DURANT le mois)
    const tasksMarketing = await this.prisma.task.findMany({
      where: {
        createdAt: {
          lte: endDateMonth,
        },
        OR: [
          { status: { not: 'TERMINE' } },
          { updatedAt: { gte: startDateMonth } }
        ]
      },
      include: {
        employee: {
          include: {
            utilisateur: true
          }
        },
        timerTask: true
      }
    });

    const tasksSprint = await this.prisma.sprintTask.findMany({
      where: {
        createdAt: {
          lte: endDateMonth,
        },
        OR: [
          { status: { not: 'TERMINE' } },
          { updatedAt: { gte: startDateMonth } }
        ]
      },
      include: {
        employee: {
          include: {
            utilisateur: true
          }
        },
        timerTask: true
      }
    });

    const allTasks = [...tasksMarketing, ...tasksSprint];
    const tasksEnCours = allTasks.filter(t => t.status === 'EN_COURS').length;
    const tasksTerminees = allTasks.filter(t => t.status === 'TERMINE').length;
    const tasksTotale = allTasks.length;
    const tauxCompletion = tasksTotale > 0 ? (tasksTerminees / tasksTotale) * 100 : 0;

    // 2.1 Calculate Workload
    const workloadMap = new Map<number, { name: string, active: number, completed: number }>();

    allTasks.forEach(task => {
      if (task.employee) {
        const empId = task.employee.id;
        const current = workloadMap.get(empId) || {
          name: `${task.employee.utilisateur.nom} ${task.employee.utilisateur.prenom.charAt(0)}.`,
          active: 0,
          completed: 0
        };

        if (task.status === 'TERMINE') {
          current.completed++;
        } else {
          current.active++;
        }
        workloadMap.set(empId, current);
      }
    });

    const workload = Array.from(workloadMap.values());

    // 3. Hours for the month (Total from active tasks)
    const calculateTaskHours = (timerTasks: any[]) => {
      return timerTasks.reduce((acc, t) => {
        if (t.startTime && t.endTime) {
          return acc + (new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / (1000 * 60 * 60);
        }
        return acc;
      }, 0);
    };

    const totalHoursMarketing = tasksMarketing.reduce((acc, t) => acc + calculateTaskHours(t.timerTask), 0);
    const totalHoursSprint = tasksSprint.reduce((acc, t) => acc + calculateTaskHours(t.timerTask), 0);
    const heuresTotales = totalHoursMarketing + totalHoursSprint;

    // 4. Revenue
    const revenueTotalAnnee = projectsYear.reduce((acc, p) => acc + (p.budget || 0), 0);

    const projectsMonth = projectsYear.filter(p =>
      p.createdAt >= startDateMonth && p.createdAt <= endDateMonth,
    );
    const revenueMois = projectsMonth.reduce((acc, p) => acc + (p.budget || 0), 0);

    // 5. Weekly Activity (7 derniers jours)
    const today = new Date();
    const last7Days: ActivityDay[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - i);
      dayDate.setHours(0, 0, 0, 0);

      const nextDayDate = new Date(dayDate);
      nextDayDate.setDate(dayDate.getDate() + 1);

      const [createdTasks, createdSprintTasks, completedTasks, completedSprintTasks, tasksModified, sprintTasksModified] = await Promise.all([
        this.prisma.task.count({ where: { createdAt: { gte: dayDate, lt: nextDayDate } } }),
        this.prisma.sprintTask.count({ where: { createdAt: { gte: dayDate, lt: nextDayDate } } }),
        this.prisma.task.count({ where: { status: 'TERMINE', updatedAt: { gte: dayDate, lt: nextDayDate } } }),
        this.prisma.sprintTask.count({ where: { status: 'TERMINE', updatedAt: { gte: dayDate, lt: nextDayDate } } }),
        this.prisma.task.findMany({ where: { updatedAt: { gte: dayDate, lt: nextDayDate } }, include: { timerTask: true } }),
        this.prisma.sprintTask.findMany({ where: { updatedAt: { gte: dayDate, lt: nextDayDate } }, include: { timerTask: true } }),
      ]);

      const totalHoursDay = [...tasksModified, ...sprintTasksModified].reduce((acc, t) => acc + calculateTaskHours(t.timerTask), 0);

      last7Days.push({
        day: dayDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        created: createdTasks + createdSprintTasks,
        completed: completedTasks + completedSprintTasks,
        hours: Number(totalHoursDay.toFixed(1)),
      });
    }

    return {
      projectsActifs,
      projectsTermines,
      tasksEnCours,
      tasksTotale,
      tauxCompletion: Number(tauxCompletion.toFixed(2)),
      heuresTotales: Number(heuresTotales.toFixed(2)),
      revenueTotalAnnee,
      revenueMois,
      weeklyActivity: last7Days,
      projectStatusDistribution: [
        { name: "Terminés", value: projectsYear.filter(p => p.status === 'TERMINE').length, color: "#602BC9" },
        { name: "En Cours", value: projectsYear.filter(p => p.status === 'ACTIF').length, color: "#DBF127" },
        { name: "En Pause", value: projectsYear.filter(p => p.status === 'EN_PAUSE').length, color: "#A368F4" },
        { name: "Annulés", value: projectsYear.filter(p => p.status === 'ANNULE').length, color: "#BEA9E3" },
      ],
      workload,
      projectGlobalProgress,
    };
  }
}
