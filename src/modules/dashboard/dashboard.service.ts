import { Injectable } from '@nestjs/common';
import { DashboardRepository } from './repositories/dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getAdminKpis() {
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
}
