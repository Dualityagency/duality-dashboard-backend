/**
 * @file dashboard.repository.ts
 * @description Repository gérant les requêtes complexes pour extraire les KPIs et données des tableaux de bord via Prisma.
 * @feature Tableaux de bord et KPIs
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role, ProjectStatus, TaskStatus, FeedbackStatus } from '@prisma/client';

/**
 * Repository dédié aux agrégations et statistiques des tableaux de bord.
 * @Injectable Marque la classe comme injectable.
 */
@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le décompte des utilisateurs par rôle.
   * @returns {Promise<any>} Statistiques sur les utilisateurs, employés et clients.
   */
  async getUserStats() {
    // Exécution parallèle des comptages par rôle
    const [totalUsers, totalEmployees, totalClients] = await Promise.all([
      this.prisma.utilisateur.count(),
      this.prisma.utilisateur.count({ where: { role: Role.EMPLOYEE } }),
      this.prisma.utilisateur.count({ where: { role: Role.CLIENT } }),
    ]);

    return {
      totalUsers,
      totalEmployees,
      totalClients,
    };
  }

  /**
   * Récupère les statistiques globales sur les projets.
   * @returns {Promise<any>} Nombre total, actifs et terminés.
   */
  async getProjectStats() {
    // Comptage des projets selon leur statut
    const [totalProjects, activeProjects, completedProjects] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.project.count({ where: { status: ProjectStatus.ACTIF } }),
      this.prisma.project.count({ where: { status: ProjectStatus.TERMINE } }),
    ]);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
    };
  }

  /**
   * Calcule les statistiques des tâches pour le mois en cours (Marketing et Sprint).
   * @returns {Promise<any>} Tâches du mois, complétées et en retard.
   */
  async getTaskStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Récupération des tâches marketing créées ce mois-ci
    const marketingTasks = await this.prisma.task.findMany({
      where: {
        dateDebut: { gte: startOfMonth },
      },
    });

    // Récupération des tâches de sprint associées à des sprints démarrés ce mois-ci
    const sprintTasks = await this.prisma.sprintTask.findMany({
      where: {
        sprint: {
          dateDebut: { gte: startOfMonth },
        },
      },
    });

    const totalTasksThisMonth = marketingTasks.length + sprintTasks.length;
    
    // Calcul combiné des tâches terminées (Marketing + Sprint)
    const completedTasks = 
      marketingTasks.filter(t => t.status === TaskStatus.TERMINE).length +
      sprintTasks.filter(t => t.status === TaskStatus.TERMINE).length;

    // Calcul des tâches en retard : non terminées et date de fin dépassée
    const overdueTasks = 
      marketingTasks.filter(t => t.status !== TaskStatus.TERMINE && t.dateFin < now).length +
      sprintTasks.filter(t => t.status !== TaskStatus.TERMINE && t.dateFin < now).length;

    return {
      totalTasksThisMonth,
      completedTasks,
      overdueTasks,
    };
  }

  /**
   * Calcule le revenu généré (somme des budgets) par les projets démarrés ce mois-ci.
   * @returns {Promise<number>} Somme des budgets des projets du mois.
   */
  async getMonthlyRevenue() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Agrégation Prisma pour sommer le champ budget
    const projectsThisMonth = await this.prisma.project.aggregate({
      _sum: {
        budget: true,
      },
      where: {
        dateDebut: { gte: startOfMonth },
      },
    });

    return projectsThisMonth._sum.budget || 0;
  }

  /**
   * Identifie les employés ayant plus de 5 tâches actives (en cours ou à faire).
   * @returns {Promise<any[]>} Liste des employés surchargés avec leur nombre de tâches.
   */
  async getOverloadedEmployees() {
    // Récupération des employés avec leurs tâches non terminées
    const employees = await this.prisma.employee.findMany({
      include: {
        utilisateur: true,
        assignedSprintTasks: {
          where: {
            status: { not: TaskStatus.TERMINE },
          },
        },
        assignedTasks: {
          where: {
            status: { not: TaskStatus.TERMINE },
          },
        },
      },
    });

    // Filtrage manuel pour identifier la surcharge (> 5 tâches)
    return employees
      .filter((emp) => (emp.assignedSprintTasks.length + emp.assignedTasks.length) > 5)
      .map((emp) => ({
        id: emp.id,
        prenom: emp.utilisateur.prenom,
        nom: emp.utilisateur.nom,
        activeTasks: emp.assignedSprintTasks.length + emp.assignedTasks.length,
      }));
  }

  /**
   * Génère les données de progression mensuelle des projets pour l'année en cours.
   * @returns {Promise<any[]>} Données formatées pour un graphique (Mois, Total, Terminés).
   */
  async getProjectProgression() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);

    // Récupération de tous les projets de l'année
    const projects = await this.prisma.project.findMany({
      where: {
        dateDebut: { gte: startOfYear },
      },
    });

    const months = [
      'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 
      'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'
    ];

    // Transformation des données par mois pour le graphique
    const progression = months.map((month, index) => {
      const monthProjects = projects.filter(p => p.dateDebut.getMonth() === index);
      const total = monthProjects.length;
      const termines = monthProjects.filter(p => p.status === ProjectStatus.TERMINE).length;

      return {
        name: month,
        Total: total,
        Terminés: termines,
      };
    });

    return progression;
  }

  /**
   * Récupère la répartition des projets par statut.
   * @returns {Promise<any[]>} Données pour un graphique en secteurs (Pie Chart).
   */
  async getProjectStatusDistribution() {
    // Groupement par statut avec comptage via Prisma
    const projectStats = await this.prisma.project.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statusMap: Record<string, string> = {
      [ProjectStatus.ACTIF]: 'Actifs',
      [ProjectStatus.EN_PAUSE]: 'En pause',
      [ProjectStatus.TERMINE]: 'Terminés',
      [ProjectStatus.ANNULE]: 'Annulés',
    };

    // Formatage pour le frontend en filtrant les catégories vides
    return Object.keys(statusMap).map(statusKey => {
      const count = projectStats.find(s => s.status === statusKey)?._count.id || 0;
      
      return {
        name: statusMap[statusKey],
        value: count,
      };
    }).filter(item => item.value > 0);
  }

  /**
   * Évalue la charge de travail actuelle de chaque employé (tâches assignées vs terminées).
   * @returns {Promise<any[]>} Données pour un graphique de charge de travail.
   */
  async getEmployeeWorkload() {
    // Récupération des employés avec leurs tâches de sprint
    const employees = await this.prisma.employee.findMany({
      include: {
        utilisateur: true,
        assignedSprintTasks: true,
      },
    });

    return employees.map(emp => {
      const total = emp.assignedSprintTasks.length;
      const done = emp.assignedSprintTasks.filter(t => t.status === TaskStatus.TERMINE).length;

      return {
        name: emp.utilisateur.prenom,
        work: total,
        done: done,
      };
    });
  }

  /**
   * Récupère l'évolution du revenu annuel sur les 5 dernières années.
   * @returns {Promise<any[]>} Données pour un graphique linéaire (Année, Revenu).
   */
  async getRevenueEvolution() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

    // Agrégation budgétaire annuelle pour chaque année
    const revenueEvolution = await Promise.all(
      years.map(async (year) => {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);

        const result = await this.prisma.project.aggregate({
          _sum: {
            budget: true,
          },
          where: {
            dateDebut: {
              gte: startOfYear,
              lte: endOfYear,
            },
          },
        });

        return {
          year: year.toString(),
          revenue: result._sum.budget || 0,
        };
      }),
    );

    return revenueEvolution;
  }

  // ─────────────────────────────────────────────
  // Employee dashboard methods
  // ─────────────────────────────────────────────

  /**
   * Récupère l'ID interne d'employé à partir de l'ID utilisateur.
   * @param {number} utilisateurId - L'ID utilisateur.
   * @returns {Promise<number|null>} L'ID employé ou null.
   */
  private async getEmployeeId(utilisateurId: number): Promise<number | null> {
    const employee = await this.prisma.employee.findUnique({ where: { utilisateurId } });
    return employee?.id ?? null;
  }

  // Mappage des libellés et couleurs pour les priorités de tâches
  private readonly PRIORITY_LABEL_MAP: Record<string, { label: string; colorClass: string }> = {
    BASSE:   { label: 'Basse',   colorClass: 'bg-gray-100 text-gray-600' },
    MOYENNE: { label: 'Moyenne', colorClass: 'bg-blue-100 text-blue-600' },
    HAUTE:   { label: 'Haute',   colorClass: 'bg-orange-100 text-orange-600' },
    URGENTE: { label: 'Urgente', colorClass: 'bg-red-100 text-red-600' },
  };

  // Mappage des couleurs d'accentuation pour les bordures
  private readonly PRIORITY_ACCENT_MAP: Record<string, string> = {
    BASSE:   '#D1D5DC',
    MOYENNE: '#C27AFF',
    HAUTE:   '#FB923C',
    URGENTE: '#EF4444',
  };

  /**
   * Calcule les KPIs individuels pour un employé (tâches actives, heures, retard, complétion).
   * @param {number} utilisateurId - L'ID de l'utilisateur employé.
   * @returns {Promise<any>} Objet contenant les KPIs formatés.
   */
  async getEmployeeKpis(utilisateurId: number) {
    const employeeId = await this.getEmployeeId(utilisateurId);
    if (!employeeId) return { activeTasks: 0, hoursThisMonth: '0h 0m', lateTasks: 0, completionRate: '0%' };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Décompte de toutes les tâches selon leur statut et deadline
    const [activeSprintTasks, activeTasks, lateSprintTasks, lateTasks, allSprintTasks, allTasks] = await Promise.all([
      this.prisma.sprintTask.count({ where: { employeeId, status: { not: TaskStatus.TERMINE } } }),
      this.prisma.task.count({ where: { employeeId, status: { not: TaskStatus.TERMINE } } }),
      this.prisma.sprintTask.count({ where: { employeeId, status: { not: TaskStatus.TERMINE }, dateFin: { lt: now } } }),
      this.prisma.task.count({ where: { employeeId, status: { not: TaskStatus.TERMINE }, dateFin: { lt: now } } }),
      this.prisma.sprintTask.count({ where: { employeeId } }),
      this.prisma.task.count({ where: { employeeId } }),
    ]);

    // Calcul du temps passé ce mois-ci via les entrées TimerTask
    const timers = await this.prisma.timerTask.findMany({
      where: {
        startTime: { gte: startOfMonth },
        endTime: { not: null },
        OR: [
          { sprintTask: { employeeId } },
          { task: { employeeId } },
        ],
      },
    });

    const totalMinutes = timers.reduce((acc, t) => {
      return acc + Math.floor((t.endTime!.getTime() - t.startTime.getTime()) / (1000 * 60));
    }, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    // Calcul du taux de complétion global (historique complet)
    const totalAll = allSprintTasks + allTasks;
    const [doneSprintTasks, doneTasks] = await Promise.all([
      this.prisma.sprintTask.count({ where: { employeeId, status: TaskStatus.TERMINE } }),
      this.prisma.task.count({ where: { employeeId, status: TaskStatus.TERMINE } }),
    ]);
    const totalDone = doneSprintTasks + doneTasks;
    const completionRate = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

    return {
      activeTasks: activeSprintTasks + activeTasks,
      hoursThisMonth: `${hours}h ${minutes}m`,
      lateTasks: lateSprintTasks + lateTasks,
      completionRate: `${completionRate}%`,
    };
  }

  /**
   * Récupère la liste des tâches en retard pour un employé.
   * @param {number} utilisateurId - L'ID de l'utilisateur employé.
   * @returns {Promise<any[]>} Liste des tâches avec leur durée de retard.
   */
  async getEmployeeLateTasks(utilisateurId: number) {
    const employeeId = await this.getEmployeeId(utilisateurId);
    if (!employeeId) return [];

    const now = new Date();

    // Recherche des tâches non terminées dont la date de fin est passée
    const [sprintTasks, tasks] = await Promise.all([
      this.prisma.sprintTask.findMany({
        where: { employeeId, status: { not: TaskStatus.TERMINE }, dateFin: { lt: now } },
        include: { sprint: { include: { webProject: { include: { project: true } } } } },
      }),
      this.prisma.task.findMany({
        where: { employeeId, status: { not: TaskStatus.TERMINE }, dateFin: { lt: now } },
        include: { marketingProject: { include: { project: true } } },
      }),
    ]);

    const sprintResults = sprintTasks.map((t) => ({
      id: t.id,
      title: t.titre,
      project: t.sprint?.webProject?.project?.nom ?? null,
      delay: `${Math.ceil((now.getTime() - t.dateFin.getTime()) / (1000 * 60 * 60 * 24))}jrs de retard`,
      type: 'sprint' as const,
    }));

    const marketingResults = tasks.map((t) => ({
      id: t.id,
      title: t.titre,
      project: t.marketingProject?.project?.nom ?? null,
      delay: `${Math.ceil((now.getTime() - t.dateFin.getTime()) / (1000 * 60 * 60 * 24))}jrs de retard`,
      type: 'marketing' as const,
    }));

    return [...sprintResults, ...marketingResults];
  }

  /**
   * Récupère les tâches assignées pour la journée en cours.
   * @param {number} utilisateurId - L'ID de l'utilisateur employé.
   * @returns {Promise<any[]>} Liste des tâches du jour avec priorité et temps restant.
   */
  async getEmployeeTodayTasks(utilisateurId: number) {
    const employeeId = await this.getEmployeeId(utilisateurId);
    if (!employeeId) return [];

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Fonction interne pour formater le compte à rebours avant la deadline
    const formatTimeRemaining = (dateFin: Date): string => {
      const diffMs = dateFin.getTime() - now.getTime();
      const diffMinutes = Math.round(diffMs / (1000 * 60));
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      if (diffMs < 0) return 'Expiré';
      if (diffMinutes < 60) return `Dans environ ${diffMinutes} minutes`;
      return `Dans environ ${diffHours} heures`;
    };

    // Recherche des tâches expirant entre 00:00 et 23:59 aujourd'hui
    const [sprintTasks, tasks] = await Promise.all([
      this.prisma.sprintTask.findMany({
        where: { employeeId, status: { not: TaskStatus.TERMINE }, dateFin: { gte: startOfDay, lte: endOfDay } },
        include: {
          sprint: { include: { webProject: { include: { project: true } } } },
          files: true,
        },
      }),
      this.prisma.task.findMany({
        where: { employeeId, status: { not: TaskStatus.TERMINE }, dateFin: { gte: startOfDay, lte: endOfDay } },
        include: {
          marketingProject: { include: { project: true } },
          files: true,
        },
      }),
    ]);

    const sprintResults = sprintTasks.map((t) => ({
      id: t.id,
      title: t.titre,
      project: t.sprint?.webProject?.project?.nom ?? null,
      time: formatTimeRemaining(t.dateFin),
      filesCount: t.files?.length ?? null,
      priority: this.PRIORITY_LABEL_MAP[t.priority]?.label ?? t.priority,
      priorityColor: this.PRIORITY_LABEL_MAP[t.priority]?.colorClass ?? '',
      type: 'sprint' as const,
    }));

    const marketingResults = tasks.map((t) => ({
      id: t.id,
      title: t.titre,
      project: t.marketingProject?.project?.nom ?? null,
      time: formatTimeRemaining(t.dateFin),
      filesCount: t.files?.length ?? null,
      priority: this.PRIORITY_LABEL_MAP[t.priority]?.label ?? t.priority,
      priorityColor: this.PRIORITY_LABEL_MAP[t.priority]?.colorClass ?? '',
      type: 'marketing' as const,
    }));

    return [...sprintResults, ...marketingResults];
  }

  /**
   * Récupère les deadlines prévues dans les 7 prochains jours.
   * @param {number} utilisateurId - L'ID de l'utilisateur employé.
   * @returns {Promise<any[]>} Liste des deadlines à venir formatées.
   */
  async getEmployeeUpcomingDeadlines(utilisateurId: number) {
    const employeeId = await this.getEmployeeId(utilisateurId);
    if (!employeeId) return [];

    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const in7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);

    // Recherche des tâches expirant entre demain et J+7
    const [sprintTasks, tasks] = await Promise.all([
      this.prisma.sprintTask.findMany({
        where: { employeeId, status: { not: TaskStatus.TERMINE }, dateFin: { gte: tomorrow, lte: in7Days } },
        include: { sprint: { include: { webProject: { include: { project: true } } } } },
      }),
      this.prisma.task.findMany({
        where: { employeeId, status: { not: TaskStatus.TERMINE }, dateFin: { gte: tomorrow, lte: in7Days } },
        include: { marketingProject: { include: { project: true } } },
      }),
    ]);

    const formatDaysRemaining = (dateFin: Date): string => {
      const days = Math.ceil((dateFin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return `dans ${days} jours`;
    };

    const sprintResults = sprintTasks.map((t) => ({
      id: t.id,
      title: t.titre,
      project: t.sprint?.webProject?.project?.nom ?? null,
      time: formatDaysRemaining(t.dateFin),
      priority: this.PRIORITY_LABEL_MAP[t.priority]?.label ?? t.priority,
      priorityColor: this.PRIORITY_LABEL_MAP[t.priority]?.colorClass ?? '',
      borderAccent: this.PRIORITY_ACCENT_MAP[t.priority] ?? '#D1D5DC',
      type: 'sprint' as const,
    }));

    const marketingResults = tasks.map((t) => ({
      id: t.id,
      title: t.titre,
      project: t.marketingProject?.project?.nom ?? null,
      time: formatDaysRemaining(t.dateFin),
      priority: this.PRIORITY_LABEL_MAP[t.priority]?.label ?? t.priority,
      priorityColor: this.PRIORITY_LABEL_MAP[t.priority]?.colorClass ?? '',
      borderAccent: this.PRIORITY_ACCENT_MAP[t.priority] ?? '#D1D5DC',
      type: 'marketing' as const,
    }));

    return [...sprintResults, ...marketingResults];
  }

  /**
   * Récupère tous les projets auxquels un employé est affecté, avec leur avancement.
   * @param {number} utilisateurId - L'ID de l'utilisateur employé.
   * @returns {Promise<any[]>} Liste des projets avec statistiques de complétion.
   */
  async getEmployeeProjects(utilisateurId: number) {
    const employeeId = await this.getEmployeeId(utilisateurId);
    if (!employeeId) return [];

    // Recherche via la table pivot Equipe
    const equipes = await this.prisma.equipe.findMany({
      where: { employeeId },
      include: {
        project: {
          include: {
            webProject: {
              include: {
                sprints: { include: { tasks: true } },
              },
            },
            marketingProject: { include: { tasks: true } },
          },
        },
      },
    });

    const STATUS_MAP: Record<string, { label: string; color: string }> = {
      ACTIF:    { label: 'Actif',     color: 'bg-green-100 text-green-600' },
      EN_PAUSE: { label: 'En pause',  color: 'bg-orange-100 text-orange-600' },
      TERMINE:  { label: 'Terminé',   color: 'bg-gray-100 text-gray-600' },
      ANNULE:   { label: 'Annulé',    color: 'bg-red-100 text-red-600' },
    };

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return equipes.map(({ project: p }) => {
      const isWeb = !!p.webProject;
      // Agrégation de toutes les tâches du projet pour calculer la progression
      const allTasks = isWeb
        ? p.webProject!.sprints.flatMap((s) => s.tasks)
        : (p.marketingProject?.tasks ?? []);

      const totalTasks = allTasks.length;
      const doneTasks = allTasks.filter((t) => t.status === TaskStatus.TERMINE).length;
      const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      return {
        id: p.id,
        nom: p.nom,
        type: isWeb ? 'Website' : 'Marketing',
        status: STATUS_MAP[p.status] ?? { label: p.status, color: '' },
        deadline: formatDate(p.dateFin),
        doneTasks,
        totalTasks,
        progressPercent,
      };
    });
  }

  /**
   * Récupère les notifications récentes d'un employé pour simuler un flux d'activité.
   * @param {number} utilisateurId - L'ID de l'utilisateur.
   * @returns {Promise<any[]>} Liste des dernières actions effectuées.
   */
  async getEmployeeRecentActivity(utilisateurId: number) {
    // Récupération simultanée des notifications et des infos utilisateur
    const [notifications, utilisateur] = await Promise.all([
      this.prisma.notification.findMany({
        where: { utilisateurId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.utilisateur.findUnique({ where: { id: utilisateurId } }),
    ]);

    if (!utilisateur) return [];

    return notifications.map((n) => ({
      id: n.id,
      avatar: utilisateur.avatar ?? null,
      name: `${utilisateur.prenom} ${utilisateur.nom}`,
      action: n.description,
      time: n.createdAt.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }),
    }));
  }

  /**
   * Construit les données complètes du dashboard Client (projets, KPIs, feedbacks).
   * @param {number} utilisateurId - L'ID de l'utilisateur client.
   * @returns {Promise<any>} Dashboard complet avec KPIs et liste de projets.
   */
  async getClientDashboard(utilisateurId: number) {
    // Récupération profonde du client, de ses projets et des feedbacks liés
    const client = await this.prisma.client.findUnique({
      where: { utilisateurId },
      include: {
        projects: {
          include: {
            webProject: {
              include: {
                sprints: {
                  include: {
                    tasks: {
                      include: {
                        employee: { include: { utilisateur: { select: { prenom: true, nom: true } } } },
                      },
                    },
                  },
                },
              },
            },
            marketingProject: {
              include: {
                tasks: {
                  include: {
                    employee: { include: { utilisateur: { select: { prenom: true, nom: true } } } },
                  },
                },
              },
            },
            feedbacks: true,
          },
        },
        feedbacks: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            content: true,
            taskTitle: true,
            sentiment: true,
            category: true,
            score: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            taskId: true,
            feedbackRequestedAt: true,
            taskPriority: true,
            clientId: true,
            projectId: true,
            project: { select: { nom: true } },
          },
        },
      },
    });

    // Retour par défaut si aucun client n'est trouvé
    if (!client) {
      return {
        kpis: { activeProjects: 0, totalTasks: 0, pendingFeedback: 0, pendingValidation: 0 },
        projects: [],
        recentFeedbacks: [],
        pendingFeedbackRequests: 0,
      };
    }

    const pendingFeedbackRequests = await this.prisma.feedback.count({
      where: {
        clientId: client.id,
        status: FeedbackStatus.EN_ATTENTE,
        feedbackRequestedAt: { not: null },
      },
    });

    const pendingFeedbackRequestsList = await this.prisma.feedback.findMany({
      where: {
        clientId: client.id,
        status: FeedbackStatus.EN_ATTENTE,
        feedbackRequestedAt: { not: null },
      },
      select: {
        id: true,
        taskTitle: true,
        taskPriority: true,
        feedbackRequestedAt: true,
        taskId: true,
        projectId: true,
        project: { select: { nom: true } },
      },
      orderBy: { feedbackRequestedAt: 'asc' },
    });

    const priorityToColor: Record<string, string> = {
      BASSE: '#D1D5DC',
      MOYENNE: '#C27AFF',
      HAUTE: '#05DF72',
    };

    const computeRelativeDeadline = (dateFin: Date | null): string => {
      if (!dateFin) return 'Aucune deadline';
      const diff = Math.round((dateFin.getTime() - Date.now()) / 86_400_000);
      if (diff > 0) return `dans ${diff} jour${diff > 1 ? 's' : ''}`;
      if (diff < 0) return `il y a ${Math.abs(diff)} jour${Math.abs(diff) > 1 ? 's' : ''}`;
      return "aujourd'hui";
    };

    const projects = client.projects;
    let totalTasks = 0;
    let doneTasks = 0;
    let pendingFeedback = 0;
    const allTaskUpdates: any[] = [];

    // Transformation et agrégation des données projets
    const mappedProjects = projects.map((p) => {
      const allTasks = p.webProject
        ? p.webProject.sprints.flatMap((s) => s.tasks)
        : (p.marketingProject?.tasks ?? []);

      const total = allTasks.length;
      const done = allTasks.filter((t) => t.status === 'TERMINE').length;

      // Cumul pour les KPIs globaux
      totalTasks += total;
      doneTasks += done;
      pendingFeedback += p.feedbacks.filter((f) => f.status === 'EN_ATTENTE').length;

      // Collect marketing tasks for taskUpdates
      if (p.marketingProject) {
        for (const t of p.marketingProject.tasks) {
          allTaskUpdates.push({
            id: t.id,
            titre: (t as any).titre,
            project: p.nom,
            priority: (t as any).priority ?? 'BASSE',
            accentColor: priorityToColor[(t as any).priority] ?? '#D1D5DC',
            time: computeRelativeDeadline((t as any).dateFin ?? null),
            _dateFin: (t as any).dateFin,
          });
        }
      }

      const statusMap: Record<string, string> = {
        ACTIF: 'Actif',
        EN_PAUSE: 'En pause',
        TERMINE: 'Terminé',
        ANNULE: 'Annulé',
      };

      const taskStatusMap: Record<string, string> = {
        TERMINE: 'Terminé',
        EN_COURS: 'En Cours',
        A_FAIRE: 'À Faire',
        EN_PAUSE: 'En pause',
        EN_REVISION: 'En Révision',
      };

      const mappedTasks = allTasks.map((t: any) => ({
        id: t.id,
        titre: t.titre,
        status: taskStatusMap[t.status] ?? t.status,
        priority: t.priority ?? 'BASSE',
        dateFin: t.dateFin ?? null,
        assignee: t.employee?.utilisateur
          ? `${t.employee.utilisateur.prenom} ${t.employee.utilisateur.nom}`
          : null,
      }));

      return {
        id: p.id,
        nom: p.nom,
        status: p.status,
        statusLabel: statusMap[p.status] ?? p.status,
        type: p.webProject ? 'Website' : 'Marketing',
        budget: p.budget ?? null,
        dateDebut: p.dateDebut ?? null,
        deadline: p.dateFin,
        tasksDone: done,
        tasksTotal: total,
        progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
        tasks: mappedTasks,
      };
    });

    // Keep only 5 upcoming/most-recent tasks sorted by deadline
    const taskUpdates = allTaskUpdates
      .sort((a, b) => {
        const da = a._dateFin ? new Date(a._dateFin).getTime() : Infinity;
        const db = b._dateFin ? new Date(b._dateFin).getTime() : Infinity;
        return da - db;
      })
      .slice(0, 5)
      .map(({ _dateFin, ...rest }) => rest);

    return {
      kpis: {
        activeProjects: projects.filter((p) => p.status === 'ACTIF').length,
        totalTasks,
        doneTasks,
        pendingFeedback,
        pendingValidation: 0,
      },
      projects: mappedProjects,
      taskUpdates,
      recentFeedbacks: client.feedbacks,
      pendingFeedbackRequests,
      pendingFeedbackRequestsList,
    };
  }
}
