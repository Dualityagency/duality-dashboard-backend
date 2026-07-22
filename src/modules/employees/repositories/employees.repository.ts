// src/modules/employees/repositories/employees.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmployeesRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.employee.findMany({
      select: {
        id: true,
        poste: true,
        utilisateur: {
          select: {
            nom: true,
            prenom: true,
            avatar: true,
            email: true,
          },
        },
      },
    });
  }

  async getCalendar(employeeId: number, month: number, year: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const [projects, sprintTasks, genericTasks] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          equipes: {
            some: { employeeId },
          },
          dateFin: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        include: {
          webProject: {
            include: { sprints: { select: { status: true } } }
          },
          marketingProject: {
            include: { tasks: { select: { status: true } } }
          }
        }
      }),
      this.prisma.sprintTask.findMany({
        where: {
          employeeId,
          dateFin: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          id: true,
          titre: true,
          createdAt: true,
          dateFin: true,
          sprint: {
            select: {
              webProject: {
                select: {
                  project: {
                    select: { nom: true }
                  }
                }
              }
            }
          }
        },
      }),
      this.prisma.task.findMany({
        where: {
          employeeId,
          dateFin: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          id: true,
          titre: true,
          dateDebut: true,
          dateFin: true,
          marketingProject: {
            select: {
              project: {
                select: { nom: true }
              }
            }
          }
        },
      }),
    ]);

    return {
      projects: projects.map((p) => {
        let totalItems = 0;
        let completedItems = 0;

        if (p.webProject) {
          totalItems = p.webProject.sprints?.length || 0;
          completedItems = p.webProject.sprints?.filter((s: any) => s.status === 'TERMINE').length || 0;
        } else if (p.marketingProject) {
          totalItems = p.marketingProject.tasks?.length || 0;
          completedItems = p.marketingProject.tasks?.filter((t: any) => t.status === 'TERMINE').length || 0;
        }

        const progression = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        return {
          id: p.id.toString(),
          title: p.nom,
          date: p.dateFin?.toISOString().split('T')[0],
          type: 'project',
          status: 'Actif',
          progression,
        };
      }),
      tasks: [
        ...sprintTasks.map((t) => ({
          id: t.id.toString(),
          title: t.titre,
          projectName: t.sprint?.webProject?.project?.nom,
          date: t.dateFin?.toISOString().split('T')[0],
          startDate: t.createdAt?.toISOString().split('T')[0],
          type: 'task',
          status: 'En cours',
        })),
        ...genericTasks.map((t) => ({
          id: t.id.toString(),
          title: t.titre,
          projectName: t.marketingProject?.project?.nom,
          date: t.dateFin?.toISOString().split('T')[0],
          startDate: t.dateDebut?.toISOString().split('T')[0],
          type: 'task',
          status: 'En cours',
        })),
      ],
    };
  }
}