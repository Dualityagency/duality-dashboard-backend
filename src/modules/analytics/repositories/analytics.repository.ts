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

    const projectsActifs = projectsYear.filter(p => p.status !== 'TERMINE').length;

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

    // 5. Weekly Activity (7 derniers jours) — 2 queries, grouped in memory
    // 4.1 Calculate Project Types
    const projectTypes = [
      { name: 'Web', value: projectsMonth.filter(p => !!p.webProject).length },
      { name: 'Marketing', value: projectsMonth.filter(p => !!p.marketingProject).length },
    ];

    // 5. Weekly Activity (7 derniers jours)
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const [weekTasks, weekSprintTasks] = await Promise.all([
      this.prisma.task.findMany({
        where: { OR: [{ createdAt: { gte: weekStart } }, { updatedAt: { gte: weekStart } }] },
        include: { timerTask: true },
      }),
      this.prisma.sprintTask.findMany({
        where: { OR: [{ createdAt: { gte: weekStart } }, { updatedAt: { gte: weekStart } }] },
        include: { timerTask: true },
      }),
    ]);

    const allWeekTasks = [...weekTasks, ...weekSprintTasks];

    const last7Days: ActivityDay[] = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() - (6 - i));
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const created = allWeekTasks.filter((t) => t.createdAt >= dayStart && t.createdAt <= dayEnd).length;
      const completed = allWeekTasks.filter((t) => t.status === 'TERMINE' && t.updatedAt >= dayStart && t.updatedAt <= dayEnd).length;

      // Sum timer hours for sessions that started on this day
      const hours = allWeekTasks.reduce((acc, t) => {
        const dayTimers = (t.timerTask as any[]).filter((tt) => tt.startTime >= dayStart && tt.startTime <= dayEnd);
        return acc + calculateTaskHours(dayTimers);
      }, 0);

      return {
        day: dayStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        created,
        completed,
        hours: Number(hours.toFixed(1)),
      };
    });

    // 6. Project Priority Distribution (Month)
    const priorityDistribution = [
      { name: 'Urgente', value: allTasks.filter(t => t.priority === 'URGENTE').length, color: '#602BC9' },
      { name: 'Haute', value: allTasks.filter(t => t.priority === 'HAUTE').length, color: '#DBF127' },
      { name: 'Moyenne', value: allTasks.filter(t => t.priority === 'MOYENNE').length, color: '#A368F4' },
      { name: 'Basse', value: allTasks.filter(t => t.priority === 'BASSE').length, color: '#BEA9E3' },
    ];

    // 7. Hours Per Employee (Month)
    const hoursPerEmployeeMap = new Map<number, { name: string, hours: number }>();

    allTasks.forEach(task => {
      if (task.employee) {
        const empId = task.employee.id;
        const taskHours = calculateTaskHours(task.timerTask);

        const current = hoursPerEmployeeMap.get(empId) || {
          name: `${task.employee.utilisateur.nom} ${task.employee.utilisateur.prenom.charAt(0)}.`,
          hours: 0
        };

        current.hours += taskHours;
        hoursPerEmployeeMap.set(empId, current);
      }
    });

    const hoursPerEmployee = Array.from(hoursPerEmployeeMap.values()).map(h => ({
      ...h,
      hours: Number(h.hours.toFixed(1))
    }));

    // 8. Detailed Stats
    const [totalEmployees, totalFeedbacksMois] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.feedback.count({
        where: {
          createdAt: {
            gte: startDateMonth,
            lte: endDateMonth
          }
        }
      })
    ]);

    const detailedStats = {
      employees: totalEmployees,
      projects: projectsMonth.length,
      tasks: allTasks.length,
      feedbacks: totalFeedbacksMois,
      totalHours: Number(heuresTotales.toFixed(1))
    };

    // 9. Feedback Analysis (Month)
    const feedbacksMoisData = await this.prisma.feedback.findMany({
      where: {
        createdAt: {
          gte: startDateMonth,
          lte: endDateMonth
        }
      }
    });


    const feedbackAnalysis = [
      { name: 'Positifs', value: (feedbacksMoisData as any[]).filter(f => f.sentiment === 'Positive').length, color: '#602BC9' },
      { name: 'Neutres', value: (feedbacksMoisData as any[]).filter(f => f.sentiment === 'Neutral').length, color: '#DBF127' },
      { name: 'Négatifs', value: (feedbacksMoisData as any[]).filter(f => f.sentiment === 'Negative').length, color: '#A368F4' },
    ];



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
      priority: priorityDistribution,
      projectTypes,
      hoursPerEmployee,
      detailedStats,
      feedbackAnalysis
    };





  }

  async getEmployeeAnalyticsStats(userId: number, year?: number, month?: number) {
    const now = new Date();
    const resolvedYear = year ?? now.getFullYear();
    const resolvedMonth = month ?? (now.getMonth() + 1);

    const periodStart = new Date(resolvedYear, resolvedMonth - 1, 1);
    const periodEnd = new Date(resolvedYear, resolvedMonth, 0, 23, 59, 59);

    const PRIORITY_LABELS: Record<string, string> = {
      BASSE: 'Basse', MOYENNE: 'Moyenne', HAUTE: 'Haute', URGENTE: 'Urgente',
    };
    const CHART_COLORS = ['#602BC9', '#DBF127', '#A368F4', 'rgba(96,43,201,0.56)', 'rgba(163,104,244,0.71)', 'rgba(219,241,39,0.48)'];

    const calcHours = (timers: any[]) =>
      timers.reduce((acc, t) => {
        if (t.startTime && t.endTime)
          return acc + (new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / (1000 * 60 * 60);
        return acc;
      }, 0);

    // Fetch all employee tasks + sprint tasks with timers
    const [marketingTasks, sprintTasks, activeProjects, completedProjects] = await Promise.all([
      this.prisma.task.findMany({
        where: { employee: { utilisateurId: userId } },
        include: { timerTask: true, marketingProject: { include: { project: true } } },
      }),
      this.prisma.sprintTask.findMany({
        where: { employee: { utilisateurId: userId } },
        include: { timerTask: true, sprint: { include: { webProject: { include: { project: true } } } } },
      }),
      this.prisma.project.count({
        where: { status: 'ACTIF', equipes: { some: { employee: { utilisateurId: userId } } } },
      }),
      this.prisma.project.count({
        where: { status: 'TERMINE', equipes: { some: { employee: { utilisateurId: userId } } } },
      }),
    ]);

    const allTasks = [
      ...marketingTasks.map((t) => ({ ...t, _type: 'MARKETING' as const, projectName: t.marketingProject?.project?.nom ?? null })),
      ...sprintTasks.map((t) => ({ ...t, _type: 'SPRINT' as const, projectName: t.sprint?.webProject?.project?.nom ?? null })),
    ];

    // Productivity score
    const totalCount = allTasks.length;
    const doneCount = allTasks.filter((t) => t.status === 'TERMINE').length;
    const productivityScore = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    // On-time delivery
    const doneTasks = allTasks.filter((t) => t.status === 'TERMINE');
    const onTime = doneTasks.filter((t) => t.updatedAt <= t.dateFin).length;
    const onTimeDelivery = doneTasks.length > 0 ? Math.round((onTime / doneTasks.length) * 100) : 0;

    // Avg task duration (days between createdAt and updatedAt for TERMINE)
    const avgTaskDuration = doneTasks.length > 0
      ? Math.round(doneTasks.reduce((acc, t) => acc + (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) / doneTasks.length)
      : 0;

    // Weekly activity — last 7 days
    const weeklyActivity = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const dayStart = new Date(now);
        dayStart.setDate(now.getDate() - (6 - i));
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        return { dayStart, dayEnd };
      }).map(async ({ dayStart, dayEnd }) => {
        const dayTasks = allTasks.filter((t) => t.createdAt >= dayStart && t.createdAt <= dayEnd);
        const completedDay = allTasks.filter((t) => t.status === 'TERMINE' && t.updatedAt >= dayStart && t.updatedAt <= dayEnd);
        const dayTimers = allTasks.flatMap((t) =>
          (t.timerTask as any[]).filter((tt) => tt.startTime >= dayStart && tt.startTime <= dayEnd),
        );
        const hours = Number(calcHours(dayTimers).toFixed(1));
        return {
          day: dayStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
          created: dayTasks.length,
          completed: completedDay.length,
          hours,
        };
      }),
    );

    // Task status distribution
    const STATUS_CONFIG = [
      { key: 'A_FAIRE',  name: 'À faire',   color: '#602BC9' },
      { key: 'EN_COURS', name: 'En cours',  color: '#A368F4' },
      { key: 'EN_PAUSE', name: 'En pause',  color: '#DBF127' },
      { key: 'TERMINE',  name: 'Terminées', color: 'rgba(190,169,227,0.5)' },
    ];
    const taskStatusDistribution = STATUS_CONFIG.map(({ key, name, color }) => ({
      name,
      count: allTasks.filter((t) => t.status === key).length,
      color,
    }));

    // Tasks by priority
    const tasksByPriority = ['BASSE', 'MOYENNE', 'HAUTE', 'URGENTE'].map((p) => ({
      priority: PRIORITY_LABELS[p],
      count: allTasks.filter((t) => t.priority === p).length,
    }));

    // Time per task — top 6 by total timer hours
    const taskHoursMap = allTasks.map((t) => ({
      name: t.titre,
      hours: Number(calcHours(t.timerTask as any[]).toFixed(2)),
    }));
    const timePerTask = taskHoursMap
      .filter((t) => t.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6)
      .map((t, i) => ({ ...t, color: CHART_COLORS[i % CHART_COLORS.length] }));

    // Overdue tasks
    const overdueTasks = allTasks
      .filter((t) => t.status !== 'TERMINE' && t.dateFin < now)
      .map((t) => ({
        id: t.id,
        taskName: t.titre,
        projectName: t.projectName ?? 'Projet inconnu',
        priority: PRIORITY_LABELS[t.priority] ?? t.priority,
        type: t._type,
      }));

    return {
      activeProjects,
      completedProjects,
      productivityScore,
      onTimeDelivery,
      avgTaskDuration,
      weeklyActivity,
      taskStatusDistribution,
      tasksByPriority,
      timePerTask,
      overdueTasks,
    };
  }
}
