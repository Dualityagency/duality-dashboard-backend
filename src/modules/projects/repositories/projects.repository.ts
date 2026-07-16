// src/modules/projects/repositories/projects.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProjectDto } from '../dto/create-project.dto';

@Injectable()
export class ProjectsRepository {
  constructor(private prisma: PrismaService) { }

  private formatProject(p: any) {
    let totalItems = 0;
    let completedItems = 0;

    if (p.webProject) {
      totalItems = p.webProject.sprints?.length || 0;
      completedItems = p.webProject.sprints?.filter((s: any) => s.status === 'TERMINE').length || 0;
    } else if (p.marketingProject) {
      totalItems = p.marketingProject.tasks?.length || 0;
      completedItems = p.marketingProject.tasks?.filter((t: any) => t.status === 'TERMINE').length || 0;
    }

    const progression = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    return {
      id: p.id,
      nom: p.nom,
      description: p.description,
      nomClient: p.client?.nomSociete || '',
      clientId: p.client?.id || 0,
      budget: p.budget,
      dateDebut: p.dateDebut,
      dateFin: p.dateFin,
      status: p.status,
      type: p.webProject ? 'Web' : 'Marketing',
      tasksCompleted: completedItems,
      totalTasks: totalItems,
      progression: Math.round(progression),
      members: p.equipes ? p.equipes.map((e: any) => {
        if (!e.employee || !e.employee.utilisateur) return null;
        return {
          id: e.employee.id,
          fullname: `${e.employee.utilisateur.prenom} ${e.employee.utilisateur.nom}`,
          avatar: e.employee.utilisateur.avatar,
          email: e.employee.utilisateur.email
        };
      }).filter(Boolean) : []
    };
  }

  async create(data: CreateProjectDto) {
    const { title, description, budget, startDate, endDate, client, projectType, members } = data;

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          nom: title,
          description: description || '',
          budget,
          dateDebut: new Date(startDate),
          dateFin: new Date(endDate),
          clientId: client,
        },
      });

      if (projectType === 'Web') {
        await tx.webProject.create({
          data: { projectId: project.id },
        });
      } else {
        await tx.marketingProject.create({
          data: { projectId: project.id },
        });
      }

      if (members && members.length > 0) {
        await tx.equipe.createMany({
          data: (members as any).map((employeeId: number) => ({
            projectId: project.id,
            employeeId,
          })),
        });
      }

      const result = await tx.project.findUnique({
        where: { id: project.id },
        include: {
          client: { include: { utilisateur: true } },
          equipes: { include: { employee: { include: { utilisateur: true } } } },
          webProject: { include: { sprints: true } },
          marketingProject: { include: { tasks: true } },
        },
      });

      return this.formatProject(result);
    });
  }

  async findAllPaginated(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = search ? {
      OR: [
        { nom: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { client: { nomSociete: { contains: search, mode: 'insensitive' } } }
      ]
    } : {};

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: { include: { utilisateur: true } },
          webProject: {
            include: {
              sprints: { select: { status: true } }
            }
          },
          marketingProject: {
            include: {
              tasks: { select: { status: true } }
            }
          },
          equipes: {
            include: {
              employee: {
                include: {
                  utilisateur: {
                    select: {
                      id: true,
                      nom: true,
                      prenom: true,
                      avatar: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { id: 'desc' }
      }),
      this.prisma.project.count({ where })
    ]);

    return {
      data: projects.map(p => this.formatProject(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async update(id: number, data: any) {
    const { title, description, budget, startDate, endDate, client, members, status } = data;

    const statusMap: Record<string, any> = {
      'Actif': 'ACTIF',
      'En pause': 'EN_PAUSE',
      'Terminé': 'TERMINE',
      'Annulé': 'ANNULE'
    };

    return this.prisma.$transaction(async (tx) => {
      // 1. Mise à jour des informations de base
      await tx.project.update({
        where: { id },
        data: {
          nom: title,
          description: description || '',
          budget: budget ? Number(budget) : undefined,
          dateDebut: startDate ? new Date(startDate) : undefined,
          dateFin: endDate ? new Date(endDate) : undefined,
          clientId: client ? Number(client) : undefined,
          status: status ? statusMap[status] : undefined,
        },
      });

      // 2. Synchronisation de l'équipe
      if (members !== undefined) {
        await tx.equipe.deleteMany({
          where: { projectId: id },
        });

        if (Array.isArray(members) && members.length > 0) {
          await tx.equipe.createMany({
            data: members.map((employeeId: any) => ({
              projectId: id,
              employeeId: Number(employeeId),
            })),
          });
        }
      }

      // 3. Récupération du résultat complet
      const result = await tx.project.findUnique({
        where: { id },
        include: {
          client: { include: { utilisateur: true } },
          equipes: { include: { employee: { include: { utilisateur: true } } } },
          webProject: { include: { sprints: true } },
          marketingProject: { include: { tasks: true } },
        },
      });

      return this.formatProject(result);
    });
  }

  async findOne(id: number) {
    const result = await this.prisma.project.findUnique({
      where: { id },
      include: {
        client: { include: { utilisateur: true } },
        equipes: { include: { employee: { include: { utilisateur: true } } } },
        webProject: { include: { sprints: true } },
        marketingProject: { include: { tasks: true } },
      },
    });

    if (!result) return null;
    return this.formatProject(result);
  }

  async getWebProjectDetails(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        webProject: {
          include: {
            sprints: {
              include: {
                tasks: true
              }
            }
          }
        },
        feedbacks: {
          include: {
            client: {
              include: {
                utilisateur: true
              }
            }
          }
        },
        equipes: {
          include: {
            employee: {
              include: {
                utilisateur: true
              }
            }
          }
        }
      }
    });

    if (!project || !project.webProject) return null;

    const totalSprints = project.webProject.sprints.length;
    const completedSprints = project.webProject.sprints.filter(s => s.status === 'TERMINE').length;
    const progression = totalSprints > 0 ? Math.round((completedSprints / totalSprints) * 100) : 0;

    return {
      webProjectId: project.webProject.id,
      titre: project.nom,
      description: project.description,
      cahierDesCharges: project.webProject.cahierDesCharges,
      progressionGlobale: progression,
      completedSprints,
      totalSprints,
      members: project.equipes ? project.equipes.map((e: any) => ({
        id: e.employee.id,
        fullname: `${e.employee.utilisateur.prenom} ${e.employee.utilisateur.nom}`,
        avatar: e.employee.utilisateur.avatar,
        email: e.employee.utilisateur.email
      })) : [],
      feedbacks: project.feedbacks.map(f => ({
        id: f.id,
        description: f.description,
        etoiles: f.etoiles,
        date: f.date,
        client: {
          nom: `${f.client.utilisateur.prenom} ${f.client.utilisateur.nom}`,
          societe: f.client.nomSociete,
          avatar: f.client.utilisateur.avatar
        }
      })),
      sprints: project.webProject.sprints.map(s => ({
        id: s.id,
        nom: s.nom,
        status: s.status,
        goal: s.goal,
        dateDebut: s.dateDebut,
        dateFin: s.dateFin,
        velocityPrevue: s.velocityPrevue,
        taskCount: s.tasks.length,
        completedTaskCount: s.tasks.filter(t => t.status === 'TERMINE').length
      }))
    };
  }

  async delete(id: number) {
    return this.prisma.project.delete({
      where: { id }
    });
  }

  async updateCahierDesCharges(id: number, url: string) {
    return this.prisma.webProject.update({
      where: { projectId: id },
      data: { cahierDesCharges: url }
    });
  }
}
