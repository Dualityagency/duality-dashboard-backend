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

  async create(data: CreateProjectDto, creatorId: number) {
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
        include: {
          client: { select: { utilisateurId: true } }
        }
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

      const participantUserIds: number[] = [creatorId, project.client.utilisateurId];

      if (members && members.length > 0) {
        // Create team entries
        await tx.equipe.createMany({
          data: (members as any).map((employeeId: number) => ({
            projectId: project.id,
            employeeId,
          })),
        });

        // Fetch employee's utilisateurIds for conversation
        const employees = await tx.employee.findMany({
          where: { id: { in: (members as any).map(id => Number(id)) } },
          select: { utilisateurId: true }
        });
        
        employees.forEach(e => {
          if (!participantUserIds.includes(e.utilisateurId)) {
            participantUserIds.push(e.utilisateurId);
          }
        });
      }

      // Create Project Conversation
      await tx.conversation.create({
        data: {
          type: 'PROJECT',
          projectId: project.id,
          createdBy: creatorId,
          participants: {
            create: participantUserIds.map(userId => ({
              utilisateurId: userId
            }))
          }
        }
      });

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

  async findAllPaginated(page: number = 1, limit: number = 10, search?: string, employeeId?: number, clientId?: number) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { client: { nomSociete: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (employeeId) {
      where.equipes = { some: { employeeId } };
    }

    if (clientId) {
      where.clientId = clientId;
    }

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

        // 2b. Sync conversation participants for the project conversation
        const projectConversation = await tx.conversation.findFirst({
          where: { projectId: id, type: 'PROJECT' },
        });

        if (projectConversation) {
          // Collect all participant user IDs
          const participantUserIds: number[] = [];

          // Creator of the conversation
          participantUserIds.push(projectConversation.createdBy);

          // Client utilisateurId
          const project = await tx.project.findUnique({
            where: { id },
            include: { client: true },
          });
          if (project?.client?.utilisateurId) {
            participantUserIds.push(project.client.utilisateurId);
          }

          // All new employee members' utilisateurIds
          if (Array.isArray(members) && members.length > 0) {
            const employeeUsers = await tx.employee.findMany({
              where: { id: { in: members.map((e: any) => Number(e)) } },
              select: { utilisateurId: true },
            });
            employeeUsers.forEach((e) => participantUserIds.push(e.utilisateurId));
          }

          // Deduplicate
          const uniqueUserIds = [...new Set(participantUserIds)];

          // Rebuild participants
          await tx.conversationParticipant.deleteMany({
            where: { conversationId: projectConversation.id },
          });
          await tx.conversationParticipant.createMany({
            data: uniqueUserIds.map((userId) => ({
              conversationId: projectConversation.id,
              utilisateurId: userId,
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

  async getRawProjectWithClient(id: number) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        client: { include: { utilisateur: true } },
      }
    });
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
          where: { taskId: null },
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
      feedbacks: project.feedbacks.map((f: any) => ({
        id: f.id,
        content: f.content,
        score: f.score,
        createdAt: f.createdAt,
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

  async getMarketingProjectDetails(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        marketingProject: {
          include: {
            tasks: {
              include: {
                employee: {
                  include: {
                    utilisateur: true
                  }
                }
              }
            }
          }
        },
        feedbacks: {
          where: { taskId: null },
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

    if (!project || !project.marketingProject) return null;

    const totalTasks = project.marketingProject.tasks.length;
    const completedTasks = project.marketingProject.tasks.filter(t => t.status === 'TERMINE').length;
    const progression = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      marketingProjectId: project.marketingProject.id,
      titre: project.nom,
      description: project.description,
      progressionGlobale: progression,
      completedTasks,
      totalTasks,
      members: project.equipes ? project.equipes.map((e: any) => ({
        id: e.employee.id,
        fullname: `${e.employee.utilisateur.prenom} ${e.employee.utilisateur.nom}`,
        avatar: e.employee.utilisateur.avatar,
        email: e.employee.utilisateur.email
      })) : [],
      feedbacks: project.feedbacks.map((f: any) => ({
        id: f.id,
        content: f.content,
        score: f.score,
        createdAt: f.createdAt,
        client: {
          nom: `${f.client.utilisateur.prenom} ${f.client.utilisateur.nom}`,
          societe: f.client.nomSociete,
          avatar: f.client.utilisateur.avatar
        }
      })),
      tasks: project.marketingProject.tasks.map(t => ({
        id: t.id,
        titre: t.titre,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dateFin: t.dateFin,
        estimatedHours: t.estimatedHours,
        tags: t.tags,
        employee: t.employee ? {
          id: t.employee.id,
          name: `${t.employee.utilisateur.prenom} ${t.employee.utilisateur.nom}`,
          avatar: t.employee.utilisateur.avatar
        } : null
      }))
    };
  }

  async findByEmployeeId(employeeId: number) {
    const projects = await this.prisma.project.findMany({
      where: {
        equipes: {
          some: {
            employeeId: employeeId,
          },
        },
      },
      include: {
        client: { include: { utilisateur: true } },
        webProject: {
          include: {
            sprints: { select: { status: true } },
          },
        },
        marketingProject: {
          include: {
            tasks: { select: { status: true } },
          },
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
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return projects.map((p) => this.formatProject(p));
  }

  async getAdminCalendar(month: number, year: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const now = new Date();

    const projects = await this.prisma.project.findMany({
      where: {
        dateFin: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: {
        id: true,
        nom: true,
        dateFin: true,
        budget: true,
        status: true,
        webProject: {
          include: { sprints: { select: { status: true } } }
        },
        marketingProject: {
          include: { tasks: { select: { status: true } } }
        }
      },
    });

    const events = projects.map((p) => {
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
        status: p.status === 'ACTIF' ? 'Actif' : p.status === 'EN_PAUSE' ? 'En pause' : 'Terminé',
        budget: p.budget,
        progression,
      };
    });

    const sprintTasksOverdue = await this.prisma.sprintTask.count({
      where: {
        dateFin: {
          gte: startOfMonth,
          lte: endOfMonth,
          lt: now
        },
        status: { not: 'TERMINE' }
      }
    });

    const marketingTasksOverdue = await this.prisma.task.count({
      where: {
        dateFin: {
          gte: startOfMonth,
          lte: endOfMonth,
          lt: now
        },
        status: { not: 'TERMINE' }
      }
    });

    const overdueTasks = sprintTasksOverdue + marketingTasksOverdue;
    const completedProjects = projects.filter(p => p.status === 'TERMINE').length;

    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const employees = await this.prisma.employee.findMany({
      include: {
        utilisateur: {
          select: { prenom: true, nom: true, avatar: true, email: true }
        },
        assignedSprintTasks: {
          where: { status: { not: 'TERMINE' } }
        },
        assignedTasks: { 
          where: { status: { not: 'TERMINE' } }
        }
      }
    });

    const allEmployeesWorkloadList = employees.map(e => {
      let urgentTasksCount = 0;
      let weekDeadlinesCount = 0;
      let totalEstimatedHours = 0;

      const checkTaskConditions = (t: any) => {
        if (t.priority === 'HAUTE' || t.priority === 'URGENTE') urgentTasksCount++;
        if (t.dateFin) {
          const d = new Date(t.dateFin);
          if (d >= now && d <= sevenDaysFromNow) weekDeadlinesCount++;
        }
        
        if (typeof t.estimatedHours === 'number') {
          totalEstimatedHours += t.estimatedHours;
        }
        if (typeof t.storyPoints === 'number') {
          totalEstimatedHours += t.storyPoints;
        }
      };

      e.assignedSprintTasks.forEach(checkTaskConditions);
      e.assignedTasks.forEach(checkTaskConditions);

      const activeTasksCount = e.assignedSprintTasks.length + e.assignedTasks.length;

      return {
        id: e.id.toString(),
        name: `${e.utilisateur.prenom} ${e.utilisateur.nom}`,
        email: e.utilisateur.email,
        avatar: e.utilisateur.avatar || '/user.png',
        activeTasks: activeTasksCount,
        estimatedHours: totalEstimatedHours,
        urgentTasks: urgentTasksCount,
        weekDeadlines: weekDeadlinesCount,
        isOverloaded: activeTasksCount > 5
      };
    });

    const overloadedEmployeesList = allEmployeesWorkloadList.filter(e => e.isOverloaded);

    return {
      events,
      kpis: {
        activeDeadlines: events.length,
        overdueTasks,
        completedProjects,
        overloadedEmployees: overloadedEmployeesList.length,
        overloadedEmployeesList,
        workloadList: allEmployeesWorkloadList
      }
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

  /** Returns utilisateurId for every employee in the project's equipe */
  async getTeamUtilisateurIds(projectId: number): Promise<number[]> {
    const equipes = await this.prisma.equipe.findMany({
      where: { projectId },
      include: { employee: { select: { utilisateurId: true } } },
    });
    return equipes.map((e) => e.employee.utilisateurId);
  }
}
