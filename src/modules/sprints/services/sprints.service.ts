import { Injectable, NotFoundException } from '@nestjs/common';
import { SprintsRepository } from '../repositories/sprints.repository';
import { CreateSprintDto } from '../dto/create-sprint.dto';
import { UpdateSprintDto } from '../dto/update-sprint.dto';
import { CreateSprintTaskDto } from '../dto/create-sprint-task.dto';
import { UpdateSprintTaskDto } from '../dto/update-sprint-task.dto';

@Injectable()
export class SprintsService {
  constructor(private sprintsRepository: SprintsRepository) { }

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
        poste: t.employee.poste
      } : null
    };
  }

  async getSprintDetails(id: number) {
    const sprint = await this.sprintsRepository.findById(id);

    if (!sprint) {
      throw new NotFoundException(`Sprint with ID ${id} not found.`);
    }

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
      tasks: sprint.tasks.map(t => this.formatTask(t))
    };
  }

  async create(createSprintDto: CreateSprintDto) {
    return this.sprintsRepository.create(createSprintDto);
  }

  async update(id: number, updateSprintDto: UpdateSprintDto) {
    const sprint = await this.sprintsRepository.findById(id);
    if (!sprint) {
      throw new NotFoundException(`Sprint with ID ${id} not found.`);
    }
    return this.sprintsRepository.update(id, updateSprintDto);
  }

  async delete(id: number) {
    const sprint = await this.sprintsRepository.findById(id);
    if (!sprint) {
      throw new NotFoundException(`Sprint with ID ${id} not found.`);
    }
    return this.sprintsRepository.delete(id);
  }

  async addTask(sprintId: number, data: CreateSprintTaskDto) {
    const sprint = await this.sprintsRepository.findById(sprintId);
    if (!sprint) {
      throw new NotFoundException(`Sprint with ID ${sprintId} not found.`);
    }
    const newTask = await this.sprintsRepository.addTask(sprintId, data);
    return this.formatTask(newTask);
  }

  async updateTask(taskId: number, data: UpdateSprintTaskDto) {
    const task = await this.sprintsRepository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`SprintTask with ID ${taskId} not found.`);
    }
    const updatedTask = await this.sprintsRepository.updateTask(taskId, data);
    return this.formatTask(updatedTask);
  }

  async deleteTask(taskId: number) {
    const task = await this.sprintsRepository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`SprintTask with ID ${taskId} not found.`);
    }
    return this.sprintsRepository.deleteTask(taskId);
  }

  async getBurndownData(sprintId: number) {
    const sprint = await this.sprintsRepository.findById(sprintId);
    if (!sprint) {
      throw new NotFoundException(`Sprint with ID ${sprintId} not found.`);
    }

    const tasks = sprint.tasks;
    const totalStoryPoints = tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
    const dailyVelocity = sprint.velocityPrevue || 0;

    const startDate = new Date(sprint.dateDebut);
    const endDate = new Date(sprint.dateFin);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;

    const burndown: any[] = [];
    
    // Sort tasks by updated date to correctly track progression if needed, 
    // but here we filter by day i in the loop.

    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      currentDate.setHours(23, 59, 59, 999); // End of the day

      // Actual curve: Total Points - Sum of points of tasks finished DURING the sprint (>= startDate)
      // This ensures the actual line also starts at totalStoryPoints on Day 0
      const pointsFinishedUntilNow = tasks
        .filter(t => {
          const completedAt = new Date(t.updatedAt);
          return t.status === 'TERMINE' 
            && completedAt >= startDate           // After sprint start
            && completedAt <= currentDate;        // Before or on end of the current day
        })
        .reduce((sum, task) => sum + (task.storyPoints || 0), 0);

      const actualRemaining = Math.max(0, totalStoryPoints - pointsFinishedUntilNow);

      // Ideal curve formula: pointsIdeaux(J) = max(0, totalPoints - velocityPrevue * J)
      const idealRemaining = Math.max(0, totalStoryPoints - (dailyVelocity * i));

      // User requested: set to 0 if the day has not arrived yet
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const isFutureDay = currentDate > now;

      burndown.push({
        day: i,
        date: currentDate.toISOString().split('T')[0],
        ideal: parseFloat(idealRemaining.toFixed(2)),
        actual: isFutureDay ? 0 : parseFloat(actualRemaining.toFixed(2))
      });
    }

    return {
      sprintNom: sprint.nom,
      totalStoryPoints,
      totalDays,
      burndown
    };
  }
}
