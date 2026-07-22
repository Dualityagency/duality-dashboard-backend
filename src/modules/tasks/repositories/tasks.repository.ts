import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TaskType } from '../dto/start-timer.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TASK_DETAIL_INCLUDE, TASK_LIST_INCLUDE, SPRINT_TASK_DETAIL_INCLUDE } from '../constants/task.constants';
import { UpdateSprintTaskDto } from '../dto/update-sprint-task.dto';
import { CreateSprintTaskDto } from '../dto/create-sprint-task.dto';
import { TaskPriority, TaskStatus, FeedbackStatus } from '@prisma/client';

export interface TaskTimeStats {
  totalEstimatedHours: number;
  totalActualSeconds: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksToDo: number;
}

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) { }

  async getRoleByUserId(userId: number): Promise<string | null> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role ?? null;
  }

  async getTaskWithProject(taskId: number) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        marketingProject: {
          include: { project: { include: { client: true } } },
        },
        feedbackRequests: {
          where: { status: FeedbackStatus.EN_ATTENTE },
        },
      },
    });
  }

  async getFeedbackByTaskId(taskId: number) {
    return this.prisma.feedback.findFirst({
      where: { taskId },
      select: {
        id: true,
        content: true,
        score: true,
        sentiment: true,
        category: true,
        status: true,
        createdAt: true,
        taskTitle: true,
        client: {
          select: {
            nomSociete: true,
            utilisateur: { select: { prenom: true, nom: true, avatar: true } },
          },
        },
      },
    });
  }

  async resolveFeedbackByTaskId(taskId: number) {
    return this.prisma.feedback.updateMany({
      where: { taskId, status: FeedbackStatus.EN_COURS },
      data: { status: FeedbackStatus.RESOLU },
    });
  }

  async createFeedbackRequest(taskId: number, clientId: number, projectId: number, taskTitle: string, taskPriority: string) {
    return this.prisma.feedback.create({
      data: {
        content: '',
        taskTitle,
        status: FeedbackStatus.EN_ATTENTE,
        clientId,
        projectId,
        taskId,
        taskPriority,
        feedbackRequestedAt: new Date(),
      },
    });
  }

  async findMarketingTasksByEmployeeUserId(userId: number) {
    return this.prisma.task.findMany({
      where: {
        employee: {
          utilisateurId: userId,
        },
      },
      include: TASK_LIST_INCLUDE,
      orderBy: {
        dateFin: 'asc',
      },
    });
  }

  async findSprintTasksByEmployeeUserId(userId: number) {
    return this.prisma.sprintTask.findMany({
      where: {
        employee: {
          utilisateurId: userId,
        },
      },
      include: {
        timerTask: true,
        sprint: {
          include: {
            webProject: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });
  }

  async findTaskByIdAndUserId(taskId: number, userId: number) {
    return this.prisma.task.findFirst({
      where: {
        id: taskId,
        employee: {
          utilisateurId: userId,
        },
      },
      include: TASK_DETAIL_INCLUDE,
    });
  }

  async findTaskById(taskId: number) { 
    return this.prisma.task.findUnique({ 
      where: { id: taskId }, 
      include: TASK_DETAIL_INCLUDE, 
    }); 
  }

  async createTask(dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        titre: dto.titre,
        description: dto.description,
        marketingProjectId: dto.marketingProjectId,
        status: dto.status,
        priority: dto.priority,
        dateFin: new Date(dto.dateFin),
        estimatedHours: dto.estimatedHours,
        tags: dto.tags || [],
        blockedByTaskId: dto.blockedByTaskId,
        employeeId: dto.employeeId,
      },
      include: TASK_DETAIL_INCLUDE,
    });
  }

  async updateTask(taskId: number, dto: UpdateTaskDto) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.titre !== undefined && { titre: dto.titre }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.marketingProjectId !== undefined && { marketingProjectId: dto.marketingProjectId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.dateFin !== undefined && { dateFin: new Date(dto.dateFin) }),
        ...(dto.estimatedHours !== undefined && { estimatedHours: dto.estimatedHours }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.blockedByTaskId !== undefined && { blockedByTaskId: dto.blockedByTaskId }),
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
      },
      include: TASK_DETAIL_INCLUDE,
    });
  }

  async deleteTask(taskId: number) {
    return this.prisma.task.delete({
      where: { id: taskId },
    });
  }

  async findActiveTimerForUser(userId: number) {
    return this.prisma.timerTask.findFirst({
      where: {
        endTime: null,
        OR: [
          {
            sprintTask: {
              employee: {
                utilisateurId: userId,
              },
            },
          },
          {
            task: {
              employee: {
                utilisateurId: userId,
              },
            },
          },
        ],
      },
    });
  }

  async upsertTimer(taskId: number, type: TaskType) {
    return this.prisma.$transaction(async (tx) => {
      if (type === TaskType.SPRINT) {
        // Lock the sprint_task row to prevent race conditions during timer upsert
        await tx.$executeRaw`SELECT id FROM sprint_tasks WHERE id = ${taskId} FOR UPDATE`;
        const existing = await tx.timerTask.findFirst({
          where: { sprintTaskId: taskId, endTime: null },
        });
        if (existing) {
          return existing;
        }
        return tx.timerTask.create({
          data: { sprintTaskId: taskId, startTime: new Date() },
        });
      } else {
        // Lock the tasks row to prevent race conditions during timer upsert
        await tx.$executeRaw`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`;
        const existing = await tx.timerTask.findFirst({
          where: { taskId: taskId, endTime: null },
        });
        if (existing) {
          return existing;
        }
        return tx.timerTask.create({
          data: { taskId, startTime: new Date() },
        });
      }
    });
  }

  async stopTimer(timerId: number) {
    return this.prisma.timerTask.update({
      where: { id: timerId },
      data: { endTime: new Date() },
    });
  }



  async findActiveTimerByTaskId(taskId: number, type: TaskType) {
    if (type === TaskType.SPRINT) {
      return this.prisma.timerTask.findFirst({
        where: {
          endTime: null,
          sprintTaskId: taskId,
        },
      });
    } else {
      return this.prisma.timerTask.findFirst({
        where: {
          endTime: null,
          taskId: taskId,
        },
      });
    }
  }

  async findTimerByIdAndUserId(timerId: number, userId: number) {
    return this.prisma.timerTask.findFirst({
      where: {
        id: timerId,
        OR: [
          {
            sprintTask: {
              employee: {
                utilisateurId: userId,
              },
            },
          },
          {
            task: {
              employee: {
                utilisateurId: userId,
              },
            },
          },
        ],
      },
    });
  }

  async findSprintTaskByIdAndUserId(taskId: number, userId: number) {
    return this.prisma.sprintTask.findFirst({
      where: {
        id: taskId,
        employee: {
          utilisateurId: userId,
        },
      },
      include: SPRINT_TASK_DETAIL_INCLUDE,
    });
  }

  async findMarketingTaskByIdAndUserId(taskId: number, userId: number) {
    return this.prisma.task.findFirst({
      where: {
        id: taskId,
        employee: {
          utilisateurId: userId,
        },
      },
    });
  }

  async findMarketingProjectsForEmployee(userId: number) {
    return this.prisma.marketingProject.findMany({
      where: {
        project: {
          equipes: {
            some: {
              employee: {
                utilisateurId: userId,
              },
            },
          },
        },
      },
      include: {
        project: true,
      },
    });
  }

  async findTeamMembersByMarketingProject(marketingProjectId: number) {
    return this.prisma.equipe.findMany({
      where: {
        project: {
          marketingProject: {
            id: marketingProjectId,
          },
        },
      },
      include: {
        employee: {
          include: {
            utilisateur: true,
          },
        },
      },
    });
  }

  async verifyTaskAccess(taskId: number, userId: number, type?: TaskType): Promise<boolean> {
    const role = await this.getRoleByUserId(userId);
    if (role === 'ADMIN') return true;

    if (!type || type === TaskType.MARKETING) {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          employee: true,
          marketingProject: {
            include: { project: { include: { equipes: { include: { employee: true } } } } },
          },
        },
      });

      if (task) {
        if (task.employee?.utilisateurId === userId) return true;
        if (task.marketingProject?.project?.equipes?.some(e => e.employee.utilisateurId === userId)) return true;
      }
    }

    if (!type || type === TaskType.SPRINT) {
      const sprintTask = await this.prisma.sprintTask.findUnique({
        where: { id: taskId },
        include: {
          employee: true,
          sprint: {
            include: {
              webProject: {
                include: { project: { include: { equipes: { include: { employee: true } } } } },
              },
            },
          },
        },
      });

      if (sprintTask) {
        if (sprintTask.employee?.utilisateurId === userId) return true;
        if (sprintTask.sprint?.webProject?.project?.equipes?.some(e => e.employee.utilisateurId === userId)) return true;
      }
    }

    return false;
  }

  async attachFileToTask(taskId: number, file: Express.Multer.File) {
    return this.prisma.file.create({
      data: {
        name: file.originalname,
        url: '/uploads/tasks/' + (file.filename || file.originalname),
        taskId: taskId,
      },
    });
  }

  async findSprintWithProject(sprintId: number) {
    return this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { webProject: { include: { project: true } } },
    });
  }

  async createSprintTask(dto: CreateSprintTaskDto) {
    return this.prisma.sprintTask.create({
      data: {
        titre: dto.titre,
        description: dto.description,
        sprintId: dto.sprintId,
        status: dto.status,
        priority: dto.priority ?? TaskPriority.BASSE,
        dateFin: new Date(dto.dateFin),
        storyPoints: dto.storyPoints ?? 0,
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
      },
      include: SPRINT_TASK_DETAIL_INCLUDE,
    });
  }

  async findSprintTaskById(taskId: number) {
    return this.prisma.sprintTask.findUnique({
      where: { id: taskId },
      include: SPRINT_TASK_DETAIL_INCLUDE,
    });
  }

  async updateSprintTask(taskId: number, dto: UpdateSprintTaskDto) {
    return this.prisma.sprintTask.update({
      where: { id: taskId },
      data: {
        ...(dto.titre !== undefined && { titre: dto.titre }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.dateFin !== undefined && { dateFin: new Date(dto.dateFin) }),
        ...(dto.storyPoints !== undefined && { storyPoints: dto.storyPoints }),
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
      },
      include: SPRINT_TASK_DETAIL_INCLUDE,
    });
  }

  async deleteSprintTask(taskId: number) {
    return this.prisma.sprintTask.delete({
      where: { id: taskId },
    });
  }

  async attachFileToSprintTask(taskId: number, file: Express.Multer.File) {
    return this.prisma.file.create({
      data: {
        name: file.originalname,
        url: '/uploads/tasks/' + (file.filename || file.originalname),
        sprintTask: { connect: { id: taskId } },
      },
    });
  }

  async findTeamMembersByWebProject(webProjectId: number) {
    return this.prisma.equipe.findMany({
      where: {
        project: {
          webProject: {
            id: webProjectId,
          },
        },
      },
      include: {
        employee: {
          include: {
            utilisateur: true,
          },
        },
      },
    });
  }

  async getTimeTrackingData(utilisateurId: number) {
    const sessions = await this.prisma.timerTask.findMany({
      where: {
        OR: [
          { task: { employee: { utilisateurId } } },
          { sprintTask: { employee: { utilisateurId } } },
        ],
      },
      include: {
        task: {
          include: {
            marketingProject: { include: { project: true } },
          },
        },
        sprintTask: {
          include: {
            sprint: {
              include: {
                webProject: { include: { project: true } },
              },
            },
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    const mapped = sessions.map((s) => {
      const isMarketing = s.task !== null;
      const taskTitle = isMarketing ? s.task!.titre : s.sprintTask!.titre;
      const projectName = isMarketing
        ? (s.task!.marketingProject?.project?.nom ?? null)
        : (s.sprintTask!.sprint?.webProject?.project?.nom ?? null);
      const projectType = isMarketing ? 'MARKETING' : 'SPRINT';
      const taskId = isMarketing ? s.task!.id : s.sprintTask!.id;

      const durationSeconds =
        s.endTime !== null
          ? Math.floor((s.endTime.getTime() - s.startTime.getTime()) / 1000)
          : null;

      return {
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        durationSeconds,
        taskTitle,
        projectName,
        projectType,
        taskId,
        type: projectType,
        priority: isMarketing ? s.task!.priority : s.sprintTask!.priority,
      };
    });

    const activeTimer = mapped.find((s) => s.endTime === null) ?? null;
    const completedSessions = mapped.filter(
      (s) => s.endTime !== null && (s.durationSeconds ?? 0) > 0,
    );

    return { sessions: mapped, completedSessions, activeTimer };
  }

  async getTimeTrackingStats(userId: number): Promise<TaskTimeStats> {
    const [marketingAgg, sprintAgg, timerSessions, marketingGroups, sprintGroups] = await Promise.all([
      this.prisma.task.aggregate({
        where: { employee: { utilisateurId: userId } },
        _sum: { estimatedHours: true },
      }),
      this.prisma.sprintTask.aggregate({
        where: { employee: { utilisateurId: userId } },
        _sum: { storyPoints: true },
      }),
      this.prisma.timerTask.findMany({
        where: {
          OR: [
            { task: { employee: { utilisateurId: userId } } },
            { sprintTask: { employee: { utilisateurId: userId } } },
          ],
          endTime: { not: null },
        },
        select: { startTime: true, endTime: true },
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { employee: { utilisateurId: userId } },
        _count: { id: true },
      }),
      this.prisma.sprintTask.groupBy({
        by: ['status'],
        where: { employee: { utilisateurId: userId } },
        _count: { id: true },
      }),
    ]);

    const totalEstimatedHours = (marketingAgg._sum.estimatedHours || 0) + (sprintAgg._sum.storyPoints || 0);

    const totalActualSeconds = timerSessions.reduce((acc, s) => {
      if (s.endTime) {
        return acc + Math.floor((s.endTime.getTime() - s.startTime.getTime()) / 1000);
      }
      return acc;
    }, 0);

    const counts = {
      completed: 0,
      inProgress: 0,
      toDo: 0,
    };

    const processGroups = (groups: any[]) => {
      groups.forEach(g => {
        if (g.status === TaskStatus.TERMINE) counts.completed += g._count.id;
        else if (g.status === TaskStatus.EN_COURS) counts.inProgress += g._count.id;
        else if (g.status === TaskStatus.A_FAIRE) counts.toDo += g._count.id;
      });
    };

    processGroups(marketingGroups);
    processGroups(sprintGroups);

    return {
      totalEstimatedHours,
      totalActualSeconds,
      tasksCompleted: counts.completed,
      tasksInProgress: counts.inProgress,
      tasksToDo: counts.toDo,
    };
  }
}
