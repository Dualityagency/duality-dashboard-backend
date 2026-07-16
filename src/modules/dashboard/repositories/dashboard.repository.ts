import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role, ProjectStatus, TaskStatus } from '@prisma/client';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserStats() {
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

  async getProjectStats() {
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

  async getTaskStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get marketing tasks for this month
    const marketingTasks = await this.prisma.task.findMany({
      where: {
        dateDebut: { gte: startOfMonth },
      },
    });

    // Get sprint tasks for this month (using sprint dateDebut as a proxy for 'this month')
    const sprintTasks = await this.prisma.sprintTask.findMany({
      where: {
        sprint: {
          dateDebut: { gte: startOfMonth },
        },
      },
    });

    const totalTasksThisMonth = marketingTasks.length + sprintTasks.length;
    
    // Combine statuses from both types of tasks
    const completedTasks = 
      marketingTasks.filter(t => t.status === TaskStatus.TERMINE).length +
      sprintTasks.filter(t => t.status === TaskStatus.TERMINE).length;

    // Overdue tasks: status not TERMINE and dateFin < now
    const overdueTasks = 
      marketingTasks.filter(t => t.status !== TaskStatus.TERMINE && t.dateFin < now).length +
      sprintTasks.filter(t => t.status !== TaskStatus.TERMINE && t.dateFin < now).length;

    return {
      totalTasksThisMonth,
      completedTasks,
      overdueTasks,
    };
  }

  async getMonthlyRevenue() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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

  async getOverloadedEmployees() {
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

    return employees
      .filter((emp) => (emp.assignedSprintTasks.length + emp.assignedTasks.length) > 5)
      .map((emp) => ({
        id: emp.id,
        prenom: emp.utilisateur.prenom,
        nom: emp.utilisateur.nom,
        activeTasks: emp.assignedSprintTasks.length + emp.assignedTasks.length,
      }));
  }

  async getProjectProgression() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);

    const projects = await this.prisma.project.findMany({
      where: {
        dateDebut: { gte: startOfYear },
      },
    });

    const months = [
      'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 
      'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'
    ];

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

  async getProjectStatusDistribution() {
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

    return Object.keys(statusMap).map(statusKey => {
      const count = projectStats.find(s => s.status === statusKey)?._count.id || 0;
      
      return {
        name: statusMap[statusKey],
        value: count,
      };
    }).filter(item => item.value > 0);
  }

  async getEmployeeWorkload() {
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

  async getRevenueEvolution() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

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
}
