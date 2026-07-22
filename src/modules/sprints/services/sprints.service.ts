import { Injectable, NotFoundException } from '@nestjs/common';
import { SprintsRepository } from '../repositories/sprints.repository';
import { CreateSprintDto } from '../dto/create-sprint.dto';
import { UpdateSprintDto } from '../dto/update-sprint.dto';
import { CreateSprintTaskDto } from '../dto/create-sprint-task.dto';
import { UpdateSprintTaskDto } from '../dto/update-sprint-task.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class SprintsService {
  constructor(
    private sprintsRepository: SprintsRepository,
    private notificationsService: NotificationsService,
  ) {}

  private formatTask(t: any) {
    return {
      id: t.id,
      titre: t.titre,
      status: t.status,
      priority: t.priority,
      dateFin: t.dateFin,
      storyPoints: t.storyPoints,
      description: t.description,
      createdAt: t.createdAt,
      tempsPasse: (t.timerTask || []).reduce((acc: number, timer: any) => {
        if (timer.startTime && timer.endTime) {
          return acc + (new Date(timer.endTime).getTime() - new Date(timer.startTime).getTime()) / (1000 * 60 * 60);
        }
        return acc;
      }, 0),
      employee: t.employee ? {
        id: t.employee.id,
        nom: `${t.employee.utilisateur.prenom} ${t.employee.utilisateur.nom}`,
        avatar: t.employee.utilisateur.avatar,
        poste: t.employee.poste,
      } : null,
    };
  }

  async getSprintDetails(id: number) {
    const sprint = await this.sprintsRepository.findById(id);
    if (!sprint) throw new NotFoundException(`Sprint with ID ${id} not found.`);

    const dateDebut = new Date(sprint.dateDebut);
    const dateFin = new Date(sprint.dateFin);
    const dureeEnJours = Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: sprint.id,
      nom: sprint.nom,
      status: sprint.status,
      goal: sprint.goal,
      dateDebut: sprint.dateDebut,
      dateFin: sprint.dateFin,
      velocityPrevue: sprint.velocityPrevue,
      dureeEnJours,
      tasks: sprint.tasks.map((t) => this.formatTask(t)),
    };
  }

  async create(createSprintDto: CreateSprintDto) {
    const sprint = await this.sprintsRepository.create(createSprintDto);

    // Notify all employees in the web project's equipe
    const [teamUserIds, projectName, projectId] = await Promise.all([
      this.sprintsRepository.getWebProjectTeamUtilisateurIds(createSprintDto.webProjectId),
      this.sprintsRepository.getProjectNameByWebProjectId(createSprintDto.webProjectId),
      this.sprintsRepository.getProjectIdByWebProjectId(createSprintDto.webProjectId),
    ]);
    for (const uid of teamUserIds) {
      this.notificationsService.createNotification(
        uid,
        NotificationType.SPRINT_CREATED,
        'Nouveau sprint créé',
        `Le sprint "${sprint.nom}" a été créé dans le projet "${projectName}".`,
        sprint.id,
        'Sprint',
        projectId ?? undefined,
      ).catch(() => {});
    }

    return sprint;
  }

  async update(id: number, updateSprintDto: UpdateSprintDto) {
    const sprint = await this.sprintsRepository.findById(id);
    if (!sprint) throw new NotFoundException(`Sprint with ID ${id} not found.`);
    
    const updatedSprint = await this.sprintsRepository.update(id, updateSprintDto);

    if (updateSprintDto.status === 'TERMINE') {
      const fullSprint = await this.sprintsRepository.findById(id);
      const project = fullSprint?.webProject?.project;
      if (project?.client?.utilisateurId) {
        this.notificationsService.createNotification(
          project.client.utilisateurId,
          NotificationType.SPRINT_COMPLETED,
          'Sprint terminé',
          `Le sprint "${sprint.nom}" de votre projet "${project.nom}" est terminé.`,
          id,
          'Sprint',
          project.id,
        ).catch(() => {});
      }
    }

    return updatedSprint;
  }

  async delete(id: number) {
    const sprint = await this.sprintsRepository.findById(id);
    if (!sprint) throw new NotFoundException(`Sprint with ID ${id} not found.`);
    return this.sprintsRepository.delete(id);
  }

  async addTask(sprintId: number, data: CreateSprintTaskDto) {
    const sprint = await this.sprintsRepository.findById(sprintId);
    if (!sprint) throw new NotFoundException(`Sprint with ID ${sprintId} not found.`);

    const newTask = await this.sprintsRepository.addTask(sprintId, data);

    // Notify assigned employee
    if (newTask.employee?.utilisateurId) {
      const projectName = (sprint as any).webProject?.project?.nom ?? 'votre projet';
      const parentProjectId = (sprint as any).webProject?.project?.id ?? undefined;
      this.notificationsService.createNotification(
        newTask.employee.utilisateurId,
        NotificationType.SPRINT_TASK_ASSIGNED,
        'Nouvelle tâche sprint assignée',
        `La tâche "${newTask.titre}" du projet "${projectName}" vous a été assignée.`,
        newTask.id,
        'SprintTask',
        parentProjectId,
      ).catch(() => {});
    }

    return this.formatTask(newTask);
  }

  async updateTask(taskId: number, data: UpdateSprintTaskDto) {
    const task = await this.sprintsRepository.findTaskById(taskId);
    if (!task) throw new NotFoundException(`SprintTask with ID ${taskId} not found.`);

    const updatedTask = await this.sprintsRepository.updateTask(taskId, data);

    if (data.status === 'TERMINE') {
      const sprint = await this.sprintsRepository.findById(updatedTask.sprintId);
      const project = sprint?.webProject?.project;
      if (project?.client?.utilisateurId) {
        this.notificationsService.createNotification(
          project.client.utilisateurId,
          NotificationType.TASK_COMPLETED_CLIENT,
          'Tâche terminée',
          `La tâche "${updatedTask.titre}" du projet "${project.nom}" a été complétée.`,
          updatedTask.id,
          'SprintTask',
          project.id,
        ).catch(() => {});
      }
    }

    // Notify newly assigned employee (if employeeId changed)
    if (data.employeeId && updatedTask.employee?.utilisateurId) {
      const sprintForUpdate = await this.sprintsRepository.findById(updatedTask.sprintId);
      const parentProjectId = (sprintForUpdate as any)?.webProject?.project?.id ?? undefined;
      this.notificationsService.createNotification(
        updatedTask.employee.utilisateurId,
        NotificationType.SPRINT_TASK_ASSIGNED,
        'Tâche sprint assignée',
        `La tâche "${updatedTask.titre}" vous a été assignée.`,
        taskId,
        'SprintTask',
        parentProjectId,
      ).catch(() => {});
    }

    // Check if project was auto-completed by this task update
    const wasAutocompleted = await this.sprintsRepository.wasProjectJustAutocompleted(taskId);
    if (wasAutocompleted) {
      const { projectId, projectName, teamUserIds, adminUserIds } =
        await this.sprintsRepository.getProjectCompletionContext(taskId);

      const allUserIds = [...new Set([...teamUserIds, ...adminUserIds])];
      for (const uid of allUserIds) {
        this.notificationsService.createNotification(
          uid,
          NotificationType.PROJECT_AUTOCOMPLETED,
          'Projet terminé',
          `Le projet "${projectName}" a été automatiquement marqué comme terminé.`,
          projectId,
          'Project',
        ).catch(() => {});
      }
    }

    return this.formatTask(updatedTask);
  }

  async deleteTask(taskId: number) {
    const task = await this.sprintsRepository.findTaskById(taskId);
    if (!task) throw new NotFoundException(`SprintTask with ID ${taskId} not found.`);
    return this.sprintsRepository.deleteTask(taskId);
  }

  async getBurndownData(sprintId: number) {
    const sprint = await this.sprintsRepository.findById(sprintId);
    if (!sprint) throw new NotFoundException(`Sprint with ID ${sprintId} not found.`);

    const tasks = sprint.tasks;
    const totalStoryPoints = tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
    const dailyVelocity = sprint.velocityPrevue || 0;

    const startDate = new Date(sprint.dateDebut);
    const endDate = new Date(sprint.dateFin);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;

    const burndown: any[] = [];

    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      currentDate.setHours(23, 59, 59, 999);

      const pointsFinishedUntilNow = tasks
        .filter((t) => {
          const completedAt = new Date(t.updatedAt);
          return t.status === 'TERMINE' && completedAt >= startDate && completedAt <= currentDate;
        })
        .reduce((sum, task) => sum + (task.storyPoints || 0), 0);

      const actualRemaining = Math.max(0, totalStoryPoints - pointsFinishedUntilNow);
      const idealRemaining = Math.max(0, totalStoryPoints - dailyVelocity * i);

      const now = new Date();
      now.setHours(23, 59, 59, 999);

      burndown.push({
        day: i,
        date: currentDate.toISOString().split('T')[0],
        ideal: parseFloat(idealRemaining.toFixed(2)),
        actual: currentDate > now ? 0 : parseFloat(actualRemaining.toFixed(2)),
      });
    }

    return { sprintNom: sprint.nom, totalStoryPoints, totalDays, burndown };
  }
}
