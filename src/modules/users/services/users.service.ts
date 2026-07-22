import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { Role, UserStatus, Prisma } from '@prisma/client';
import { generatePassword } from 'src/common/utils/random.utils';
import { MailService } from '../../mail/services/mail.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private usersRepository: UsersRepository,
    private mailService: MailService,
    private notificationsGateway: NotificationsGateway,
    private notificationsService: NotificationsService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { nom, prenom, email, telephone, role, nomSociete, poste } =
      createUserDto;

    const existingUser = await this.usersRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    let user;
    const commonData = {
      nom,
      prenom,
      email,
      password: hashedPassword,
      telephone,
      role,
      status: UserStatus.ACTIF,
    };

    switch (role) {
      case Role.CLIENT:
        if (!nomSociete) {
          throw new BadRequestException(
            'Le nom de société est requis pour un client',
          );
        }
        user = await this.usersRepository.createWithClient(commonData, {
          nomSociete,
        });
        break;

      case Role.EMPLOYEE:
        if (!poste) {
          throw new BadRequestException('Le poste est requis pour un employé');
        }
        user = await this.usersRepository.createWithEmployee(commonData, {
          poste,
        });
        break;

      case Role.ADMIN:
        user = await this.usersRepository.createWithAdmin(commonData);
        break;

      default:
        throw new BadRequestException('Role invalide');
    }

    await this.mailService.sendUserCredentials(
      email,
      nom,
      prenom,
      plainPassword,
    );

    return {
      user,
      generatedPassword: plainPassword,
    };
  }

  async delete(id: number) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`Utilisateur avec ID ${id} introuvable`);
    }

    await this.usersRepository.delete(id);
    return { message: 'Utilisateur supprimé avec succès' };
  }

  async update(id: number, updateUserDto: Record<string, any>, callerRole?: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`Utilisateur avec ID ${id} introuvable`);
    }

    const { nomSociete, poste, ...userData } = updateUserDto;
    const updateData: Record<string, any> = { ...userData };

    if (user.role === Role.CLIENT && nomSociete) {
      updateData.client = { nomSociete };
    } else if (user.role === Role.EMPLOYEE && poste) {
      updateData.employee = { poste };
    }

    const result = await this.usersRepository.update(id, updateData);

    // Notify user if updated by an admin
    if (callerRole === 'ADMIN') {
      this.notificationsService.createNotification(
        id,
        NotificationType.PROFILE_UPDATED_BY_ADMIN,
        'Profil mis à jour',
        'Un administrateur a mis à jour votre profil.',
      ).catch(() => {});
    }

    return result;
  }

  async updateAvatar(id: number, avatarPath: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`Utilisateur avec ID ${id} introuvable`);
    }

    return this.usersRepository.updateAvatar(id, avatarPath);
  }

  async toggleStatus(id: number) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`Utilisateur avec ID ${id} introuvable`);
    }

    const newStatus = user.status === 'ACTIF' ? 'SUSPENDU' : 'ACTIF';
    const updated = await this.usersRepository.update(id, { status: newStatus });

    if (newStatus === 'SUSPENDU') {
      this.notificationsGateway.forceLogout(id);
    } else {
      // Account reactivated — notify the user
      this.notificationsService.createNotification(
        id,
        NotificationType.ACCOUNT_REACTIVATED,
        'Compte réactivé',
        'Votre compte a été réactivé par un administrateur.',
      ).catch(() => {});
    }

    return updated;
  }

  async getAdminKPIs() {
    return this.usersRepository.countKPIs();
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    roleFilter?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.UtilisateurWhereInput = {};

    // Search logic
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Role Filter logic
    if (roleFilter && roleFilter !== 'Tous les rôles') {
      if (roleFilter === 'Manager') {
        where.role = Role.EMPLOYEE;
        where.employee = {
          poste: { in: ['Product Owner', 'Scrum Master'] },
        };
      } else if (roleFilter === 'Employee') {
        where.role = Role.EMPLOYEE;
        where.employee = {
          poste: { notIn: ['Product Owner', 'Scrum Master'] },
        };
      } else {
        where.role = roleFilter.toUpperCase() as Role;
      }
    }

    const [users, total] = await Promise.all([
      this.usersRepository.findAll({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.usersRepository.count(where),
    ]);

    const transformedUsers = users.map((user) => {
      let poste: string = user.role;
      let projectsCount = 0;

      if (user.role === Role.EMPLOYEE && user.employee) {
        poste = user.employee.poste;
        projectsCount = user.employee._count?.equipes || 0;
      } else if (user.role === Role.CLIENT && user.client) {
        projectsCount = user.client._count?.projects || 0;
      }

      return {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        role: user.role,
        createdAt: user.createdAt,
        avatar: user.avatar,
        status: user.status === 'ACTIF' ? 'Actif' : 'Suspendu',
        poste,
        position: user.employee?.poste,
        nomSociete: user.client?.nomSociete,
        projectsCount,
      };
    });

    return {
      data: transformedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: number) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`Utilisateur avec ID ${id} introuvable`);
    }

    let poste: string = user.role;
    let nomSociete: string | undefined = undefined;

    if (user.role === Role.EMPLOYEE && user.employee) {
      poste = user.employee.poste;
    } else if (user.role === Role.CLIENT && user.client) {
      nomSociete = user.client.nomSociete;
    }

    return {
      id: user.id,
      lastName: user.nom,
      firstName: user.prenom,
      email: user.email,
      phone: user.telephone,
      avatar: user.avatar,
      role: user.role,
      joinedAt: user.createdAt,
      status: user.status === "ACTIF" ? "Actif" : "Suspendu",
      position: poste,
      poste,
      nomSociete,
      preferences: user.preferences ?? null,
    };
  }

  async changePassword(id: number, currentPassword: string, newPassword: string, confirmPassword: string) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas');
    }
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const currentHash = await this.usersRepository.findPasswordById(id);
    const valid = await bcrypt.compare(currentPassword, currentHash ?? '');
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.updatePassword(id, hashed);
    return { message: 'Mot de passe mis à jour avec succès' };
  }

  async updatePreferences(id: number, preferences: Record<string, any>) {
    await this.usersRepository.updatePreferences(id, preferences);
    return { message: 'Préférences enregistrées' };
  }

  async deleteMe(id: number) {
    await this.usersRepository.delete(id);
    return { message: 'Compte supprimé' };
  }
}
