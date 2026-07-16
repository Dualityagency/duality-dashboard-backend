// src/modules/projects/services/projects.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsRepository } from '../repositories/projects.repository';
import { CreateProjectDto } from '../dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private projectsRepository: ProjectsRepository) {}

  async create(createProjectDto: CreateProjectDto) {
    return this.projectsRepository.create(createProjectDto);
  }

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    return this.projectsRepository.findAllPaginated(page, limit, search);
  }

  async findOne(id: number) {
    const project = await this.projectsRepository.findOne(id);
    if (!project) {
      throw new NotFoundException(`Le projet avec l'ID ${id} n'existe pas.`);
    }
    return project;
  }

  async getWebProjectDetails(id: number) {
    const project = await this.projectsRepository.getWebProjectDetails(id);
    if (!project) {
      throw new NotFoundException(`Details for web project with ID ${id} not found.`);
    }
    return project;
  }

  async update(id: number, data: any) {
    return this.projectsRepository.update(id, data);
  }

  async delete(id: number) {
    const project = await this.projectsRepository.delete(id);
    if (!project) {
       throw new NotFoundException(`Projet with ID ${id} not found`);
    }
    return project;
  }

  async updateCahierDesCharges(id: number, url: string) {
    return this.projectsRepository.updateCahierDesCharges(id, url);
  }
}
