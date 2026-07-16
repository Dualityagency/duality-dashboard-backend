import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TasksRepository } from '../repositories/tasks.repository';
import { TaskType } from '../dto/start-timer.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { AskAiDto } from '../dto/ask-ai.dto';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  mapIntPriorityToLabel,
  mapTaskToFrontend,
  mapSprintTaskToFrontend,
} from '../mappers/task.mapper';
import { UpdateSprintTaskDto } from '../dto/update-sprint-task.dto';
import { CreateSprintTaskDto } from '../dto/create-sprint-task.dto';

@Injectable()
export class TasksService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly aiModel: GenerativeModel;

  constructor(private readonly tasksRepository: TasksRepository) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.aiModel = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    } else {
      console.warn('GEMINI_API_KEY is missing from environment variables');
    }
  }

  async getTasks(userId: number) {
    const [sprintTasks, marketingTasks] = await Promise.all([
      this.tasksRepository.findSprintTasksByEmployeeUserId(userId),
      this.tasksRepository.findMarketingTasksByEmployeeUserId(userId),
    ]);

    const formattedSprintTasks = sprintTasks.map((task: any) => ({
      ...mapSprintTaskToFrontend(task),
      sprintName: task.sprint?.nom || undefined,
      type: TaskType.SPRINT,
    }));

    return {
      tasks: marketingTasks.map((task) => ({ ...mapTaskToFrontend(task as any), type: TaskType.MARKETING })),
      sprintTasks: formattedSprintTasks,
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
    if (!this.aiModel) { 
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
      const result = await this.aiModel.generateContent(prompt); 
      const response = await result.response; 
      let raw = response.text(); 
      if (raw) { 
        raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim(); 
      } 
      return JSON.parse(raw); 
    } catch (error: any) { 
      console.error('Gemini SDK Error:', error); 
      throw new BadRequestException('AI service error: ' + error.message); 
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

  async attachFileToTask(taskId: number, file: Express.Multer.File) {
    return this.tasksRepository.attachFileToTask(taskId, file);
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
    return this.tasksRepository.attachFileToSprintTask(taskId, file);
  }
}
