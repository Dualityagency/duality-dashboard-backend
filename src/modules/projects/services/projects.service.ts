// src/modules/projects/services/projects.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsRepository } from '../repositories/projects.repository';
import { CreateProjectDto } from '../dto/create-project.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(
    private projectsRepository: ProjectsRepository,
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  async create(createProjectDto: CreateProjectDto, creatorId: number) {
    const result = await this.projectsRepository.create(createProjectDto, creatorId);

    if (createProjectDto.members?.length) {
      const employees = await this.prisma.employee.findMany({
        where: { id: { in: (createProjectDto.members as number[]).map(Number) } },
        select: { utilisateurId: true },
      });
      for (const emp of employees) {
        this.notificationsService.createNotification(
          emp.utilisateurId,
          NotificationType.PROJECT_ASSIGNED,
          'Nouveau projet assigné',
          `Vous avez été ajouté au projet "${createProjectDto.title}".`,
          (result as any).id,
          'Project',
        ).catch(() => {});
      }
    }

    return result;
  }

  async findAll(page: number = 1, limit: number = 10, search?: string, employeeId?: number, clientId?: number) {
    return this.projectsRepository.findAllPaginated(page, limit, search, employeeId, clientId);
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

  async getMarketingProjectDetails(id: number) {
    const project = await this.projectsRepository.getMarketingProjectDetails(id);
    if (!project) {
      throw new NotFoundException(`Details for marketing project with ID ${id} not found.`);
    }
    return project;
  }

  async update(id: number, data: Record<string, any>) {
    // Capture current team before update to detect newly added members
    let oldEmployeeIds: number[] = [];
    if (Array.isArray(data.members)) {
      const currentEquipes = await this.prisma.equipe.findMany({
        where: { projectId: id },
        select: { employeeId: true },
      });
      oldEmployeeIds = currentEquipes.map((e) => e.employeeId);
    }

    const updatedProject = await this.projectsRepository.update(id, data);

    if (Array.isArray(data.members) && data.members.length) {
      const newEmployeeIds = (data.members as number[]).map(Number).filter(
        (eid) => !oldEmployeeIds.includes(eid),
      );
      if (newEmployeeIds.length) {
        const employees = await this.prisma.employee.findMany({
          where: { id: { in: newEmployeeIds } },
          select: { utilisateurId: true },
        });
        for (const emp of employees) {
          this.notificationsService.createNotification(
            emp.utilisateurId,
            NotificationType.PROJECT_MEMBER_ADDED,
            'Ajouté à un projet',
            `Vous avez été ajouté au projet "${updatedProject.nom}".`,
            id,
            'Project',
          ).catch(() => {});
        }
      }
    }

    if (data.status) {
      const projectFromDb = await this.projectsRepository.getRawProjectWithClient(id);
      if (projectFromDb?.client?.utilisateurId) {
        const statusLabel: Record<string, string> = {
          EN_PAUSE: 'mis en pause',
          TERMINE: 'terminé',
          ANNULE: 'annulé',
          ACTIF: 'réactivé',
        };
        this.notificationsService.createNotification(
          projectFromDb.client.utilisateurId,
          NotificationType.PROJECT_STATUS_CHANGED,
          'Statut du projet mis à jour',
          `Le statut de votre projet "${projectFromDb.nom}" a été ${statusLabel[data.status] ?? 'mis à jour'}.`,
          id,
          'Project',
        ).catch(() => {});
      }
    }

    return updatedProject;
  }

  async delete(id: number) {
    const project = await this.projectsRepository.delete(id);
    if (!project) {
       throw new NotFoundException(`Projet with ID ${id} not found`);
    }
    return project;
  }

  async findByEmployeeId(employeeId: number) {
    return this.projectsRepository.findByEmployeeId(employeeId);
  }

  async getAdminCalendar(month: number, year: number) {
    return this.projectsRepository.getAdminCalendar(month, year);
  }

  async updateCahierDesCharges(id: number, url: string) {
    const result = await this.projectsRepository.updateCahierDesCharges(id, url);

    const project = await this.projectsRepository.getRawProjectWithClient(id);
    if (project?.client?.utilisateurId) {
      this.notificationsService.createNotification(
        project.client.utilisateurId,
        NotificationType.PROJECT_CDC_UPLOADED,
        'Cahier des charges disponible',
        `Le cahier des charges du projet "${project.nom}" a été mis à jour.`,
        id,
        'Project',
      ).catch(() => {});
    }

    return result;
  }
}