import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TasksRepository } from '../repositories/tasks.repository';
import { TaskType } from '../dto/start-timer.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { AskAiDto } from '../dto/ask-ai.dto';
import Groq from 'groq-sdk';
import {
  mapIntPriorityToLabel,
  mapTaskToFrontend,
  mapSprintTaskToFrontend,
} from '../mappers/task.mapper';
import { UpdateSprintTaskDto } from '../dto/update-sprint-task.dto';
import { CreateSprintTaskDto } from '../dto/create-sprint-task.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TasksService {
  private readonly groq: Groq;

  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      this.groq = new Groq({ apiKey });
    } else {
      console.warn('GROQ_API_KEY is missing from environment variables');
    }
  }

  async getTasks(userId: number, query?: { status?: string; priority?: string; search?: string; page?: number; limit?: number; marketingProjectId?: number }) {
    const [sprintTasks, marketingTasks] = await Promise.all([
      this.tasksRepository.findSprintTasksByEmployeeUserId(userId),
      this.tasksRepository.findMarketingTasksByEmployeeUserId(userId),
    ]);

    let formattedSprintTasks = sprintTasks.map((task: any) => ({
      ...mapSprintTaskToFrontend(task),
      sprintName: task.sprint?.nom || undefined,
      type: TaskType.SPRINT,
    }));

    let formattedMarketingTasks = marketingTasks.map((task) => ({
      ...mapTaskToFrontend(task as any),
      type: TaskType.MARKETING,
    }));

    if (query?.status) {
      formattedSprintTasks = formattedSprintTasks.filter((t: any) => t.status === query.status);
      formattedMarketingTasks = formattedMarketingTasks.filter((t: any) => t.status === query.status);
    }

    if (query?.priority) {
      formattedSprintTasks = formattedSprintTasks.filter((t: any) => t.priority === query.priority);
      formattedMarketingTasks = formattedMarketingTasks.filter((t: any) => t.priority === query.priority);
    }

    if (query?.search) {
      const search = query.search.toLowerCase();
      formattedSprintTasks = formattedSprintTasks.filter((t: any) => t.titre?.toLowerCase().includes(search));
      formattedMarketingTasks = formattedMarketingTasks.filter((t: any) => t.titre?.toLowerCase().includes(search));
    }

    if (query?.marketingProjectId) {
      formattedMarketingTasks = formattedMarketingTasks.filter(
        (t: any) => t.marketingProjectId === query.marketingProjectId
      );
    }

    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const total = formattedMarketingTasks.length + formattedSprintTasks.length;

    return {
      tasks: formattedMarketingTasks,
      sprintTasks: formattedSprintTasks,
      page,
      limit,
      total,
    };
  }

  async getProjectsForEmployee(userId: number) {
    const projects = await this.tasksRepository.findMarketingProjectsForEmployee(userId);
    return projects.map((p) => ({
      id: p.id,
      label: p.project.nom,
    }));
  }

  async getTeamMembersForProject(marketingProjectId: number, userId: number) {
    const allowedProjects = await this.tasksRepository.findMarketingProjectsForEmployee(userId);
    const hasAccess = allowedProjects.some((p) => p.id === marketingProjectId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const teamMembers = await this.tasksRepository.findTeamMembersByMarketingProject(marketingProjectId);
    return teamMembers.map((equipe) => ({
      id: equipe.employee.id,
      name: `${equipe.employee.utilisateur.prenom} ${equipe.employee.utilisateur.nom}`,
      email: equipe.employee.utilisateur.email,
      avatar: equipe.employee.utilisateur.avatar ?? null,
    }));
  }

  async createTask(dto: CreateTaskDto, userId: number) {
    const allowedProjects = await this.tasksRepository.findMarketingProjectsForEmployee(userId);
    const hasAccess = allowedProjects.some((p) => p.id === dto.marketingProjectId);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this project');
    }

    if (dto.employeeId) {
      const teamMembers = await this.tasksRepository.findTeamMembersByMarketingProject(dto.marketingProjectId);
      const isMember = teamMembers.some((m) => m.employeeId === dto.employeeId);
      if (!isMember) {
        throw new BadRequestException('Employee does not belong to this project');
      }
    }

    const result = await this.tasksRepository.createTask(dto);

    if (dto.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        select: { utilisateurId: true },
      });
      if (employee) {
        this.notificationsService.createNotification(
          employee.utilisateurId,
          NotificationType.TASK_ASSIGNED,
          'Nouvelle tâche assignée',
          `La tâche "${result.titre}" vous a été assignée.`,
          result.id,
          'Task',
        ).catch(() => {});
      }
    }

    return mapTaskToFrontend(result);
  }

  async updateTask(taskId: number, dto: UpdateTaskDto, userId: number, userRole?: string) {
    const role = userRole || await this.tasksRepository.getRoleByUserId(userId);
    let existingTask;

    if (role === 'ADMIN') {
      existingTask = await this.tasksRepository.findTaskById(taskId);
    } else {
      existingTask = await this.tasksRepository.findTaskByIdAndUserId(taskId, userId);
    }

    if (!existingTask) {
      throw new NotFoundException('Task not found or you do not have permission');
    }

    if (role !== 'ADMIN' && dto.marketingProjectId) {
      const allowedProjects = await this.tasksRepository.findMarketingProjectsForEmployee(userId);
      const hasAccess = allowedProjects.some((p) => p.id === dto.marketingProjectId);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    if (dto.employeeId) {
      const projectId = dto.marketingProjectId || existingTask.marketingProjectId;
      if (projectId) {
        const teamMembers = await this.tasksRepository.findTeamMembersByMarketingProject(projectId);
        const isMember = teamMembers.some((m) => m.employeeId === dto.employeeId);
        if (!isMember) {
          throw new ForbiddenException('Employee does not belong to this project');
        }
      }
    }

    const result = await this.tasksRepository.updateTask(taskId, dto);

    if (dto.employeeId && dto.employeeId !== existingTask.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        select: { utilisateurId: true },
      });
      if (employee) {
        this.notificationsService.createNotification(
          employee.utilisateurId,
          NotificationType.TASK_ASSIGNED,
          'Tâche assignée',
          `La tâche "${result.titre}" vous a été assignée.`,
          result.id,
          'Task',
        ).catch(() => {});
      }
    }

    if (dto.status === 'TERMINE') {
      const fullTask = await this.tasksRepository.getTaskWithProject(result.id);
      const clientUser = fullTask?.marketingProject?.project?.client;
      if (clientUser) {
        this.notificationsService.createNotification(
          clientUser.utilisateurId,
          NotificationType.TASK_COMPLETED_CLIENT,
          'Tâche terminée',
          `La tâche "${result.titre}" du projet "${fullTask?.marketingProject?.project?.nom}" a été complétée.`,
          result.id,
          'Task',
        ).catch(() => {});
      }
    }

    return mapTaskToFrontend(result);
  }

  async createSprintTask(dto: CreateSprintTaskDto, userId: number) {
    // Verify the sprint exists and the user belongs to the web project's equipe
    const sprint = await this.tasksRepository.findSprintWithProject(dto.sprintId);
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const webProjectId = sprint.webProjectId;
    const teamMembers = await this.tasksRepository.findTeamMembersByWebProject(webProjectId);
    const userInTeam = teamMembers.some((m) => m.employee.utilisateurId === userId);
    if (!userInTeam) {
      throw new ForbiddenException('You do not belong to this project team');
    }

    if (dto.employeeId) {
      const employeeInTeam = teamMembers.some((m) => m.employeeId === dto.employeeId);
      if (!employeeInTeam) {
        throw new ForbiddenException('The assigned employee does not belong to this project team');
      }
    }

    const result = await this.tasksRepository.createSprintTask(dto);
    return mapSprintTaskToFrontend(result as any);
  }

  async deleteTask(taskId: number, userId: number) {
    const existingTask = await this.tasksRepository.findTaskByIdAndUserId(taskId, userId);
    if (!existingTask) {
      throw new NotFoundException('Task not found or you do not have permission');
    }

    await this.tasksRepository.deleteTask(taskId);
    return { message: 'Task deleted successfully' };
  }

  private sanitizeInput(input?: string): string | undefined {
    if (typeof input !== 'string') return input;
    return input.replace(/[\r\n]+/g, ' ').trim().substring(0, 500);
  }

  async askAI(dto: AskAiDto, userId: number): Promise<any> { 
    if (!this.groq) {
      throw new BadRequestException('AI service not initialized: missing API key');
    }

    dto.title = this.sanitizeInput(dto.title);
    dto.description = this.sanitizeInput(dto.description);
    dto.question = this.sanitizeInput(dto.question);

    const mode = dto.mode ?? 'chat'; 

    // Build context string 
    let context = ''; 
    if (dto.taskId) { 
      let task: any;
      if (dto.taskType === 'SPRINT') {
        task = await this.tasksRepository.findSprintTaskByIdAndUserId(dto.taskId, userId);
      } else if (dto.taskType === 'MARKETING') {
        task = await this.tasksRepository.findTaskByIdAndUserId(dto.taskId, userId);
      } else {
        // Fallback check if taskType is not explicitly provided
        task = await this.tasksRepository.findTaskByIdAndUserId(dto.taskId, userId);
        if (!task) {
          task = await this.tasksRepository.findSprintTaskByIdAndUserId(dto.taskId, userId);
        }
      }

      if (!task) throw new NotFoundException('Task not found or access denied'); 
      
      const projectName = task.marketingProject?.project?.nom || task.sprint?.webProject?.project?.nom || '';
      const priorityLabel = typeof task.priority === 'number' ? mapIntPriorityToLabel(task.priority) : task.priority;

      context = ` 
        Tâche: ${task.titre} 
        Projet: ${projectName} 
        Description: ${task.description ?? 'Aucune'} 
        Statut: ${task.status} 
        Priorité: ${priorityLabel} 
        Deadline: ${task.dateFin ? task.dateFin.toISOString().split('T')[0] : 'Aucune'} 
        ${task.tags ? `Tags: ${task.tags.join(', ')}` : ''} 
        ${task.assistantIA ? `Sous-tâches IA existantes: ${task.assistantIA.subtasks?.join(', ')}` : ''} 
      `.trim(); 
    } else { 
      context = ` 
        Tâche: ${dto.title ?? 'Sans titre'} 
        Type: ${dto.taskType ?? 'MARKETING'} 
        Description: ${dto.description ?? 'Aucune'} 
        Priorité: ${dto.priority ?? 'Non définie'} 
        Statut: ${dto.status ?? 'Non défini'} 
        ${dto.storyPoints ? `Story Points: ${dto.storyPoints}` : ''} 
        ${dto.sprintName ? `Sprint: ${dto.sprintName}` : ''} 
      `.trim(); 
    } 

    let prompt = ''; 

    switch (mode) { 
      case 'description': 
        prompt = `Tu es un assistant de gestion de projet. Voici le contexte:\n${context}\n\nGénère une description détaillée et une estimation en heures pour cette tâche.\n\nRéponds UNIQUEMENT en JSON valide sans markdown:\n{"description": "string", "estimatedHours": number}`; 
        break; 

      case 'suggestions': 
        prompt = `Tu es un assistant de gestion de projet. Voici le contexte:\n${context}\n\nGénère des suggestions IA complètes pour cette tâche.\n\nRéponds UNIQUEMENT en JSON valide sans markdown:\n{"subtasks": ["string"], "estimatedDuration": "string", "suggestedPriority": "BASSE|MOYENNE|HAUTE|URGENTE", "tips": ["string"]}`; 
        break; 

      case 'subtasks': 
        prompt = `Tu es un assistant de gestion de projet. Voici le contexte:\n${context}\n\nGénère 4 à 6 sous-tâches détaillées pour cette tâche${dto.taskType === 'SPRINT' ? ' en contexte agile avec story points' : ''}.\n\nRéponds UNIQUEMENT en JSON valide sans markdown:\n{"subtasks": [{"title": "string", "storyPoints": number, "reasoning": "string"}]}`; 
        break; 

      case 'estimation': 
        prompt = `Tu es un assistant de gestion de projet. Voici le contexte:\n${context}\n\nGénère une estimation précise pour cette tâche${dto.taskType === 'SPRINT' ? ' en story points agile' : ' en heures'}.\n\nRéponds UNIQUEMENT en JSON valide sans markdown:\n{"points": number, "hours": number, "confidence": number, "min": number, "max": number, "factors": ["string"]}`; 
        break; 

      case 'criteria': 
        prompt = `Tu es un assistant de gestion de projet. Voici le contexte:\n${context}\n\nGénère 4 à 6 critères d'acceptation clairs et mesurables pour cette tâche.\n\nRéponds UNIQUEMENT en JSON valide sans markdown:\n{"criteria": ["string"]}`; 
        break; 

      case 'recommendations': 
        prompt = `Tu es un assistant de gestion de projet. Voici le contexte:\n${context}\n\nGénère 2 à 3 recommandations concrètes pour réaliser cette tâche efficacement.\n\nRéponds UNIQUEMENT en JSON valide sans markdown:\n{"recommendations": [{"category": "string", "text": "string", "pros": ["string"], "cons": ["string"]}]}`; 
        break; 

      case 'chat': 
      default: 
        prompt = `Tu es un assistant de gestion de projet. Voici le contexte:\n${context}\n\nQuestion: ${dto.question ?? ''}\n\nRéponds en français de manière concise et utile. Réponds UNIQUEMENT en JSON valide sans markdown:\n{"answer": "string"}`; 
        break; 
    } 

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      });

      let raw = completion.choices[0]?.message?.content ?? '';
      raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(raw);

      if (mode === 'suggestions' && dto.taskId) {
        this.notificationsService.createNotification(
          userId,
          NotificationType.TASK_AI_COMPLETE,
          'Analyse IA terminée',
          `L'analyse IA de la tâche "${dto.title ?? 'votre tâche'}" est prête.`,
          dto.taskId,
          dto.taskType === 'SPRINT' ? 'SprintTask' : 'Task',
        ).catch(() => {});
      }

      return parsed;
    } catch (error: any) {
      console.error('Groq AI Error:', error);
      const is429 = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('rate limit');
      if (is429) {
        throw new BadRequestException('Le service IA est temporairement indisponible. Veuillez réessayer dans quelques instants.');
      }
      throw new BadRequestException('Erreur du service IA: ' + error?.message);
    }
  }

  async startTimer(taskId: number, type: TaskType, userId: number) {
    // 1. Verify task exists and belongs to user
    let taskExists = false;
    if (type === TaskType.SPRINT) {
      const task = await this.tasksRepository.findSprintTaskByIdAndUserId(taskId, userId);
      taskExists = !!task;
    } else {
      const task = await this.tasksRepository.findMarketingTaskByIdAndUserId(taskId, userId);
      taskExists = !!task;
    }

    if (!taskExists) {
      throw new NotFoundException(`Task not found or you don't have access to it`);
    }

    // 2. Check for active timer
    const activeTimer = await this.tasksRepository.findActiveTimerForUser(userId);

    // 3. Stop active timer if exists
    if (activeTimer) {
      // Don't restart the same timer if it's already running
      if (
        (type === TaskType.SPRINT && activeTimer.sprintTaskId === taskId) ||
        (type === TaskType.MARKETING && activeTimer.taskId === taskId)
      ) {
        return this.tasksRepository.findTimerByIdAndUserId(activeTimer.id, userId);
      }

      await this.tasksRepository.stopTimer(activeTimer.id);
    }

    // 4. Start new timer
    return this.tasksRepository.upsertTimer(taskId, type);
  }

  async stopTimer(taskId: number, type: TaskType, userId: number) {
    const timer = await this.tasksRepository.findActiveTimerByTaskId(taskId, type);
    
    if (!timer) {
      throw new NotFoundException('Active timer not found for this task');
    }

    if (timer.endTime) {
      throw new BadRequestException('Timer is already stopped');
    }

    // Verify user has access to the task before stopping it
    await this.verifyTaskAccess(taskId, userId, type);

    return this.tasksRepository.stopTimer(timer.id);
  }

  async verifyTaskAccess(taskId: number, userId: number, type?: TaskType): Promise<void> {
    const hasAccess = await this.tasksRepository.verifyTaskAccess(taskId, userId, type);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this task or its project');
    }
  }

  async getTaskFeedback(taskId: number) {
    const feedback = await this.tasksRepository.getFeedbackByTaskId(taskId);
    if (!feedback) return null;
    return {
      id: feedback.id,
      content: feedback.content,
      score: feedback.score,
      sentiment: feedback.sentiment,
      category: feedback.category,
      status: feedback.status,
      createdAt: feedback.createdAt,
      client: feedback.client ? {
        nom: `${feedback.client.utilisateur.prenom} ${feedback.client.utilisateur.nom}`,
        societe: feedback.client.nomSociete,
        avatar: feedback.client.utilisateur.avatar,
      } : null,
    };
  }

  async requestFeedback(taskId: number, userId: number) {
    await this.verifyTaskAccess(taskId, userId, TaskType.MARKETING);

    const task = await this.tasksRepository.getTaskWithProject(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const marketingProject = task.marketingProject;
    if (!marketingProject || !marketingProject.project || !marketingProject.project.client) {
      throw new BadRequestException('Task does not have an associated client');
    }

    if (task.feedbackRequests && task.feedbackRequests.length > 0) {
      throw new BadRequestException('Une demande de feedback est déjà en attente pour cette tâche');
    }

    const projectId = marketingProject.projectId;
    const clientId = marketingProject.project.client.id;
    const taskPriority = typeof task.priority === 'number' ? mapIntPriorityToLabel(task.priority) : task.priority;

    const feedback = await this.tasksRepository.createFeedbackRequest(taskId, clientId, projectId, task.titre, taskPriority);

    const clientUser = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { utilisateurId: true },
    });
    if (clientUser) {
      this.notificationsService.createNotification(
        clientUser.utilisateurId,
        NotificationType.FEEDBACK_REQUESTED,
        'Feedback demandé',
        `L'équipe vous demande un feedback sur la tâche "${task.titre}" du projet "${task.marketingProject.project.nom}".`,
        feedback.id,
        'Feedback',
      ).catch(() => {});
    }

    return { message: 'Demande de feedback envoyée', feedbackId: feedback.id };
  }

  async resolveFeedback(taskId: number, userId: number) {
    await this.verifyTaskAccess(taskId, userId, TaskType.MARKETING);
    return this.tasksRepository.resolveFeedbackByTaskId(taskId);
  }

  async attachFileToTask(taskId: number, file: Express.Multer.File) {
    const result = await this.tasksRepository.attachFileToTask(taskId, file);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { titre: true, employee: { select: { utilisateurId: true } } },
    });
    if (task?.employee) {
      this.notificationsService.createNotification(
        task.employee.utilisateurId,
        NotificationType.TASK_FILE_ATTACHED,
        'Fichier joint',
        `Un fichier "${file.originalname}" a été ajouté à la tâche "${task.titre}".`,
        taskId,
        'Task',
      ).catch(() => {});
    }

    return result;
  }

  async updateSprintTask(taskId: number, dto: UpdateSprintTaskDto, userId: number, userRole?: string) {
    const role = userRole || await this.tasksRepository.getRoleByUserId(userId);
    let existingTask;

    if (role === 'ADMIN') {
      existingTask = await this.tasksRepository.findSprintTaskById(taskId);
    } else {
      existingTask = await this.tasksRepository.findSprintTaskByIdAndUserId(taskId, userId);
    }

    if (!existingTask) {
      throw new NotFoundException('Sprint task not found or you do not have permission');
    }

    if (dto.employeeId && existingTask.sprint?.webProjectId) {
      const teamMembers = await this.tasksRepository.findTeamMembersByWebProject(existingTask.sprint.webProjectId);
      const isMember = teamMembers.some((m) => m.employeeId === dto.employeeId);
      if (!isMember) {
        throw new ForbiddenException('Employee does not belong to this project');
      }
    }

    const result = await this.tasksRepository.updateSprintTask(taskId, dto);

    if (dto.employeeId && dto.employeeId !== existingTask.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        select: { utilisateurId: true },
      });
      if (employee) {
        this.notificationsService.createNotification(
          employee.utilisateurId,
          NotificationType.SPRINT_TASK_ASSIGNED,
          'Tâche sprint assignée',
          `La tâche sprint "${(result as any).titre}" vous a été assignée.`,
          result.id,
          'SprintTask',
        ).catch(() => {});
      }
    }

    return mapSprintTaskToFrontend(result as any);
  }

  async deleteSprintTask(taskId: number, userId: number, userRole?: string) {
    const role = userRole || await this.tasksRepository.getRoleByUserId(userId);
    let existingTask;
    
    if (role === 'ADMIN') {
      existingTask = await this.tasksRepository.findSprintTaskById(taskId);
    } else {
      existingTask = await this.tasksRepository.findSprintTaskByIdAndUserId(taskId, userId);
    }

    if (!existingTask) {
      throw new NotFoundException('Sprint task not found or you do not have permission');
    }

    await this.tasksRepository.deleteSprintTask(taskId);
    return { message: 'Sprint task deleted successfully' };
  }

  async attachFileToSprintTask(taskId: number, file: Express.Multer.File) {
    const result = await this.tasksRepository.attachFileToSprintTask(taskId, file);

    const sprintTask = await this.prisma.sprintTask.findUnique({
      where: { id: taskId },
      select: { titre: true, employee: { select: { utilisateurId: true } } },
    });
    if (sprintTask?.employee) {
      this.notificationsService.createNotification(
        sprintTask.employee.utilisateurId,
        NotificationType.TASK_FILE_ATTACHED,
        'Fichier joint',
        `Un fichier "${file.originalname}" a été ajouté à la tâche "${sprintTask.titre}".`,
        taskId,
        'SprintTask',
      ).catch(() => {});
    }

    return result;
  }

  async getTimeTrackingStats(utilisateurId: number) {
    const [detailedData, aggregateStats] = await Promise.all([
      this.tasksRepository.getTimeTrackingData(utilisateurId),
      this.tasksRepository.getTimeTrackingStats(utilisateurId),
    ]);

    const { completedSessions, activeTimer } = detailedData;

    const nowUtc = new Date();
    const todayUtc = nowUtc.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // Build last-7-days date strings (UTC)
    const last7Dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(nowUtc);
      d.setUTCDate(d.getUTCDate() - i);
      last7Dates.push(d.toISOString().slice(0, 10));
    }
    const weekStart = last7Dates[0]; // oldest day

    // Helper: UTC date string from a Date
    const toUtcDate = (d: Date) => d.toISOString().slice(0, 10);

    // todayTotal
    const todayTotal = completedSessions
      .filter((s) => toUtcDate(s.startTime) === todayUtc)
      .reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);

    // weeklyTotal
    const weekSessions = completedSessions.filter((s) => toUtcDate(s.startTime) >= weekStart);
    const weeklyTotal = weekSessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);

    // dailySessions — one entry per day for the last 7 days (0 if no sessions)
    const dailyMap = new Map<string, number>(last7Dates.map((d) => [d, 0]));
    for (const s of weekSessions) {
      const day = toUtcDate(s.startTime);
      if (dailyMap.has(day)) {
        dailyMap.set(day, dailyMap.get(day)! + (s.durationSeconds ?? 0));
      }
    }
    const dailySessions = last7Dates.map((date) => ({
      date,
      totalSeconds: dailyMap.get(date)!,
    }));

    // averagePerDay
    const averagePerDay = Math.round(weeklyTotal / 7);

    // byProject
    const projectMap = new Map<string, { projectName: string; projectType: string; totalSeconds: number }>();
    for (const s of completedSessions) {
      const key = s.projectName ?? 'Unknown';
      const existing = projectMap.get(key);
      if (existing) {
        existing.totalSeconds += s.durationSeconds ?? 0;
      } else {
        projectMap.set(key, {
          projectName: key,
          projectType: s.projectType,
          totalSeconds: s.durationSeconds ?? 0,
        });
      }
    }
    const byProject = Array.from(projectMap.values());

    // recentSessions — last 10, already sorted desc by startTime from repo
    const recentSessions = completedSessions.slice(0, 10).map((s) => ({
      taskTitle: s.taskTitle,
      projectName: s.projectName,
      projectType: s.projectType,
      startTime: s.startTime,
      endTime: s.endTime,
      durationSeconds: s.durationSeconds,
      priority: s.priority,
    }));

    return {
      ...aggregateStats,
      todayTotal,
      weeklyTotal,
      dailySessions,
      averagePerDay,
      byProject,
      recentSessions,
      activeTimer: activeTimer
        ? {
            taskId: activeTimer.taskId,
            type: activeTimer.type,
            startTime: activeTimer.startTime,
            taskTitle: activeTimer.taskTitle,
          }
        : null,
    };
  }
}
