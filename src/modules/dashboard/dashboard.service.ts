/**
 * @file dashboard.service.ts
 * @description Service orchestrant la collecte des données pour les différents types de tableaux de bord.
 * @feature Tableaux de bord et KPIs
 */

import { Injectable } from '@nestjs/common';
import { DashboardRepository } from './repositories/dashboard.repository';

/**
 * Service pour la logique métier des tableaux de bord.
 * @Injectable Marque la classe comme injectable.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  /**
   * Agrège toutes les statistiques nécessaires pour le dashboard Administrateur.
   * @returns {Promise<any>} Un objet contenant les stats utilisateurs, projets, tâches, revenus, etc.
   */
  async getAdminKpis() {
    // Exécution parallèle de toutes les requêtes de statistiques pour optimiser les performances
    const [userStats, projectStats, taskStats, monthlyRevenue, overloadedEmployees, projectProgression, projectStatusDistribution, employeeWorkload, revenueEvolution] = await Promise.all([
      this.dashboardRepository.getUserStats(),
      this.dashboardRepository.getProjectStats(),
      this.dashboardRepository.getTaskStats(),
      this.dashboardRepository.getMonthlyRevenue(),
      this.dashboardRepository.getOverloadedEmployees(),
      this.dashboardRepository.getProjectProgression(),
      this.dashboardRepository.getProjectStatusDistribution(),
      this.dashboardRepository.getEmployeeWorkload(),
      this.dashboardRepository.getRevenueEvolution(),
    ]);

    // Formatage de la réponse structurée pour le frontend
    return {
      users: {
        total: userStats.totalUsers,
        employees: userStats.totalEmployees,
        clients: userStats.totalClients,
      },
      projects: {
        total: projectStats.totalProjects,
        active: projectStats.activeProjects,
        completed: projectStats.completedProjects,
      },
      tasks: {
        totalThisMonth: taskStats.totalTasksThisMonth,
        completed: taskStats.completedTasks,
        overdue: taskStats.overdueTasks,
      },
      revenue: {
        thisMonth: monthlyRevenue,
      },
      overloadedEmployees,
      projectProgression,
      projectStatusDistribution,
      employeeWorkload,
      revenueEvolution,
    };
  }

  /**
   * Agrège les données spécifiques pour le dashboard d'un employé.
   * @param {number} utilisateurId - L'identifiant de l'utilisateur employé.
   * @returns {Promise<any>} Un objet contenant les KPIs, tâches (retard, aujourd'hui, deadlines), projets et activités récentes.
   */
  async getEmployeeDashboard(utilisateurId: number) {
    // Collecte de toutes les données liées à l'employé
    const [kpis, lateTasks, todayTasks, upcomingDeadlines, projects, recentActivity] = await Promise.all([
      this.dashboardRepository.getEmployeeKpis(utilisateurId),
      this.dashboardRepository.getEmployeeLateTasks(utilisateurId),
      this.dashboardRepository.getEmployeeTodayTasks(utilisateurId),
      this.dashboardRepository.getEmployeeUpcomingDeadlines(utilisateurId),
      this.dashboardRepository.getEmployeeProjects(utilisateurId),
      this.dashboardRepository.getEmployeeRecentActivity(utilisateurId),
    ]);

    return { kpis, lateTasks, todayTasks, upcomingDeadlines, projects, recentActivity };
  }

  /**
   * Récupère les données du dashboard pour un client.
   * @param {number} utilisateurId - L'identifiant de l'utilisateur client.
   * @returns {Promise<any>} Données d'avancement des projets et feedbacks.
   */
  async getClientDashboard(utilisateurId: number) {
    return this.dashboardRepository.getClientDashboard(utilisateurId);
  }
}
