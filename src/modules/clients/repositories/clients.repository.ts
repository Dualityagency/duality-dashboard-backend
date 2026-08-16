// src/modules/clients/repositories/clients.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ClientsRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.client.findMany({
      include: { utilisateur: true },
    });
  }

  async getCalendar(clientId: number, month: number, year: number) {
    const client = await this.prisma.client.findFirst({
      where: {
        OR: [{ id: clientId }, { utilisateurId: clientId }],
      },
    });

    if (!client) {
      return { projects: [], tasks: [] };
    }

    const actualClientId = client.id;

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const [projects, sprintTasks, marketingTasks] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          clientId: actualClientId,
          dateFin: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      this.prisma.sprintTask.findMany({
        where: {
          sprint: {
            webProject: {
              project: {
                clientId: actualClientId,
              },
            },
          },
          dateFin: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        include: {
          sprint: {
            include: {
              webProject: {
                include: { project: true },
              },
            },
          },
        },
      }),
      this.prisma.task.findMany({
        where: {
          marketingProject: {
            project: {
              clientId: actualClientId,
            },
          },
          dateFin: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        include: {
          marketingProject: {
            include: {
              project: true,
            },
          },
        },
      }),
    ]);

    console.log('Projects:', projects);
    // console.log('Sprint Tasks:', sprintTasks);
    // console.log('Marketing Tasks:', marketingTasks);
    // console.log('Start of Month:', startOfMonth);
    // console.log('End of Month:', endOfMonth);
    // console.log('Client ID:', clientId);
    return {
      projects: projects.map((project) => ({
        id: project.id.toString(),
        title: project.nom,
        date: project.dateFin?.toISOString().split('T')[0],
        type: 'project',
        status: 'Actif',
        progression: 0,
      })),
      tasks: [
        ...sprintTasks.map((task) => ({
          id: task.id.toString(),
          title: task.titre,
          projectName: task.sprint?.webProject?.project?.nom,
          date: task.dateFin?.toISOString().split('T')[0],
          startDate: task.createdAt?.toISOString().split('T')[0],
          type: 'task',
          status: 'En cours',
        })),
        ...marketingTasks.map((task) => ({
          id: task.id.toString(),
          title: task.titre,
          projectName: task.marketingProject?.project?.nom,
          date: task.dateFin?.toISOString().split('T')[0],
          startDate: task.createdAt?.toISOString().split('T')[0],
          type: 'task',
          status: 'En cours',
        })),
      ],
    };
  }
}
