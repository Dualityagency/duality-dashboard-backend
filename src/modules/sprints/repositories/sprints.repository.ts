import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSprintDto } from '../dto/create-sprint.dto';
import { UpdateSprintDto } from '../dto/update-sprint.dto';
import { CreateSprintTaskDto } from '../dto/create-sprint-task.dto';
import { UpdateSprintTaskDto } from '../dto/update-sprint-task.dto';

@Injectable()
export class SprintsRepository {
  constructor(private prisma: PrismaService) { }

  async findById(id: number) {
    return this.prisma.sprint.findUnique({
      where: { id },
      include: {
        webProject: {
          include: {
            project: {
              include: {
                client: {
                  include: {
                    utilisateur: true
                  }
                }
              }
            }
          }
        },
        tasks: {
          include: {
            employee: {
              include: {
                utilisateur: true
              }
            },
            timerTask: true
          }
        }
      }
    });
  }

  async create(data: CreateSprintDto) {
    const startDate = new Date(data.dateDebut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let status: any = 'A_FAIRE';
    if (startDate <= today) {
      status = 'EN_COURS';
    }

    return this.prisma.sprint.create({
      data: {
        nom: data.nom,
        goal: data.goal,
        status,
        dateDebut: startDate,
        dateFin: new Date(data.dateFin),
        velocityPrevue: data.velocityPrevue || 0,
        webProjectId: data.webProjectId
      }
    });
  }

  async update(id: number, data: UpdateSprintDto) {
    const startDate = data.dateDebut ? new Date(data.dateDebut) : undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let status = data.status;

    // Only auto-change status to EN_COURS if it's currently A_FAIRE and date is today/past
    if (startDate && startDate <= today) {
      const currentSprint = await this.prisma.sprint.findUnique({ where: { id } });
      if (currentSprint && currentSprint.status === 'A_FAIRE') {
        status = 'EN_COURS' as any;
      }
    }

    return this.prisma.sprint.update({
      where: { id },
      data: {
        nom: data.nom,
        goal: data.goal,
        status,
        dateDebut: startDate,
        dateFin: data.dateFin ? new Date(data.dateFin) : undefined,
        velocityPrevue: data.velocityPrevue,
        webProjectId: data.webProjectId
      }
    });
  }

  async delete(id: number) {
    return this.prisma.sprint.delete({
      where: { id }
    });
  }

  async findTaskById(id: number) {
    return this.prisma.sprintTask.findUnique({
      where: { id },
      include: { timerTask: true }
    });
  }

  async addTask(sprintId: number, data: CreateSprintTaskDto) {
    const task = await this.prisma.sprintTask.create({
      data: {
        titre: data.titre,
        status: data.status,
        priority: data.priority,
        dateFin: new Date(data.dateFin),
        storyPoints: data.storyPoints || 0,
        description: data.description,
        employeeId: data.employeeId,
        sprintId: sprintId
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

    await this.updateOverallStatusBySprintId(sprintId);

    return task;
  }

  async updateTask(id: number, data: UpdateSprintTaskDto) {
    const task = await this.prisma.sprintTask.update({
      where: { id },
      data: {
        titre: data.titre,
        status: data.status,
        priority: data.priority,
        dateFin: data.dateFin ? new Date(data.dateFin) : undefined,
        storyPoints: data.storyPoints,
        description: data.description,
        employeeId: data.employeeId
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

    // Automatically check and update sprint and project status
    await this.updateOverallStatus(id);

    return task;
  }

  async deleteTask(id: number) {
    const task = await this.prisma.sprintTask.findUnique({
      where: { id },
      select: { sprintId: true }
    });

    const deleted = await this.prisma.sprintTask.delete({
      where: { id }
    });

    if (task) {
      await this.updateOverallStatusBySprintId(task.sprintId);
    }

    return deleted;
  }

  private async updateOverallStatus(taskId: number) {
    const task = await this.prisma.sprintTask.findUnique({
      where: { id: taskId },
      select: { sprintId: true }
    });
    if (task) {
      await this.updateOverallStatusBySprintId(task.sprintId);
    }
  }

  private async updateOverallStatusBySprintId(sprintId: number) {
    // 1. Fetch the sprint with all its tasks and its webProject info
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        tasks: true,
        webProject: {
          include: {
            project: true,
            sprints: {
              include: {
                tasks: true
              }
            }
          }
        }
      }
    });

    if (!sprint || !sprint.webProject) return;

    // 2. Logic for current SPRINT status
    const allSprintTasksFinished = sprint.tasks.length > 0 && sprint.tasks.every(t => t.status === 'TERMINE');
    const newSprintStatus = allSprintTasksFinished ? 'TERMINE' : 'EN_COURS';

    if (sprint.status !== newSprintStatus) {
      await this.prisma.sprint.update({
        where: { id: sprintId },
        data: { status: newSprintStatus as any }
      });
    }

    // 3. Logic for PROJECT status
    // A project is finished if ALL its sprints are TERMINE (now including the one we just potentially updated)
    // We need to re-fetch or use the webProject info we already have, but the current sprint's status in memory might be old
    const allOtherSprints = sprint.webProject.sprints.filter(s => s.id !== sprintId);
    const areAllOtherSprintsFinished = allOtherSprints.every(s => s.status === 'TERMINE');
    const areAllSprintsFinished = areAllOtherSprintsFinished && newSprintStatus === 'TERMINE';

    // IMPORTANT: If there are NO sprints, we probably shouldn't set to TERMINE
    const hasSprints = sprint.webProject.sprints.length > 0;
    const newProjectStatus = (hasSprints && areAllSprintsFinished) ? 'TERMINE' : 'ACTIF';

    if (sprint.webProject.project.status !== newProjectStatus && sprint.webProject.project.status !== 'ANNULE' && sprint.webProject.project.status !== 'EN_PAUSE') {
      await this.prisma.project.update({
        where: { id: sprint.webProject.projectId },
        data: { status: newProjectStatus as any }
      });
    }
  }

  // ── Notification helpers ───────────────────────────────────────────────────

  async getWebProjectTeamUtilisateurIds(webProjectId: number): Promise<number[]> {
    const webProject = await this.prisma.webProject.findUnique({
      where: { id: webProjectId },
      select: { projectId: true },
    });
    if (!webProject) return [];
    const equipes = await this.prisma.equipe.findMany({
      where: { projectId: webProject.projectId },
      include: { employee: { select: { utilisateurId: true } } },
    });
    return equipes.map((e) => e.employee.utilisateurId);
  }

  async getProjectNameByWebProjectId(webProjectId: number): Promise<string> {
    const webProject = await this.prisma.webProject.findUnique({
      where: { id: webProjectId },
      include: { project: { select: { nom: true } } },
    });
    return webProject?.project?.nom ?? '';
  }

  async getProjectIdByWebProjectId(webProjectId: number): Promise<number | null> {
    const webProject = await this.prisma.webProject.findUnique({
      where: { id: webProjectId },
      select: { projectId: true },
    });
    return webProject?.projectId ?? null;
  }

  /**
   * Returns true if the task's update caused the parent project to become TERMINE.
   * Must be called AFTER updateTask has already run.
   */
  async wasProjectJustAutocompleted(taskId: number): Promise<boolean> {
    const task = await this.prisma.sprintTask.findUnique({
      where: { id: taskId },
      select: {
        status: true,
        sprint: {
          include: {
            webProject: {
              include: {
                project: { select: { status: true } },
                sprints: { include: { tasks: { select: { status: true } } } },
              },
            },
          },
        },
      },
    });

    if (!task || task.status !== 'TERMINE') return false;
    return task.sprint?.webProject?.project?.status === 'TERMINE';
  }

  async getProjectCompletionContext(taskId: number): Promise<{
    projectId: number;
    projectName: string;
    teamUserIds: number[];
    adminUserIds: number[];
  }> {
    const task = await this.prisma.sprintTask.findUnique({
      where: { id: taskId },
      select: {
        sprint: {
          include: {
            webProject: {
              include: {
                project: {
                  include: {
                    equipes: { include: { employee: { select: { utilisateurId: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const project = task?.sprint?.webProject?.project;
    if (!project) return { projectId: 0, projectName: '', teamUserIds: [], adminUserIds: [] };

    const teamUserIds = project.equipes.map((e) => e.employee.utilisateurId);
    const admins = await this.prisma.utilisateur.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    return {
      projectId: project.id,
      projectName: project.nom,
      teamUserIds,
      adminUserIds: admins.map((a) => a.id),
    };
  }
}
