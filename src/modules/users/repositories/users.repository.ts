// src/modules/users/repositories/users.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, Utilisateur, Client, Employee, Admin } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  async createWithClient(
    userData: Prisma.UtilisateurCreateInput,
    clientData: Omit<Prisma.ClientCreateInput, 'utilisateur'>,
  ): Promise<Utilisateur & { client: Client | null }> {
    return this.prisma.utilisateur.create({
      data: {
        ...userData,
        client: {
          create: clientData,
        },
      },
      include: {
        client: true,
      },
    });
  }

  async createWithEmployee(
    userData: Prisma.UtilisateurCreateInput,
    employeeData: Omit<Prisma.EmployeeCreateInput, 'utilisateur'>,
  ): Promise<Utilisateur & { employee: Employee | null }> {
    return this.prisma.utilisateur.create({
      data: {
        ...userData,
        employee: {
          create: employeeData,
        },
      },
      include: {
        employee: true,
      },
    });
  }

  async createWithAdmin(
    userData: Prisma.UtilisateurCreateInput,
  ): Promise<Utilisateur & { admin: Admin | null }> {
    return this.prisma.utilisateur.create({
      data: {
        ...userData,
        admin: {
          create: {},
        },
      },
      include: {
        admin: true,
      },
    });
  }

  async findByEmail(email: string): Promise<
    | (Utilisateur & {
        client?: Client | null;
        employee?: Employee | null;
        admin?: Admin | null;
      })
    | null
  > {
    return this.prisma.utilisateur.findUnique({
      where: { email },
      include: {
        client: true,
        employee: true,
        admin: true,
      },
    });
  }

  async findById(id: number) {
    return this.prisma.utilisateur.findUnique({
      where: { id },
      include: {
        client: true,
        employee: true,
        admin: true,
      },
    });
  }

  async delete(id: number): Promise<Utilisateur> {
    return this.prisma.utilisateur.delete({
      where: { id },
    });
  }

  async update(id: number, data: any): Promise<Utilisateur> {
    const { client, employee, ...userData } = data;

    // On prépare l'update atomique avec Prisma
    return this.prisma.utilisateur.update({
      where: { id },
      data: {
        ...userData,
        ...(client && {
          client: {
            update: client,
          },
        }),
        ...(employee && {
          employee: {
            update: employee,
          },
        }),
      },
      include: {
        client: true,
        employee: true,
        admin: true,
      },
    });
  }

  async updateAvatar(id: number, avatarPath: string): Promise<Utilisateur> {
    return this.prisma.utilisateur.update({
      where: { id },
      data: { avatar: avatarPath }
    });
  }

  async countKPIs() {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const [
      clients,
      admins,
      employeesTotal,
      managers,
      clientsLastMonth,
      employeesLastMonth,
    ] = await Promise.all([
      // Count Clients
      this.prisma.utilisateur.count({ where: { role: 'CLIENT' } }),

      // Count Admins
      this.prisma.utilisateur.count({ where: { role: 'ADMIN' } }),

      // Total Employees
      this.prisma.utilisateur.count({ where: { role: 'EMPLOYEE' } }),

      // Count Managers (PO or Scrum Master)
      this.prisma.utilisateur.count({
        where: {
          role: 'EMPLOYEE',
          employee: {
            OR: [{ poste: 'Product Owner' }, { poste: 'Scrum Master' }],
          },
        },
      }),

      // For Growth calculation: Old counts
      this.prisma.utilisateur.count({
        where: { role: 'CLIENT', createdAt: { lt: lastMonth } },
      }),
      this.prisma.utilisateur.count({
        where: { role: 'EMPLOYEE', createdAt: { lt: lastMonth } },
      }),
    ]);

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    };

    return {
      clients,
      admins,
      employees: employeesTotal - managers,
      managers,
      clientGrowth: calculateGrowth(clients, clientsLastMonth),
      employeeGrowth: calculateGrowth(employeesTotal, employeesLastMonth),
    };
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UtilisateurWhereInput;
    orderBy?: Prisma.UtilisateurOrderByWithRelationInput;
  }) {
    const { skip, take, where, orderBy } = params;
    return this.prisma.utilisateur.findMany({
      skip,
      take,
      where,
      orderBy,
      include: {
        client: {
          include: {
            _count: {
              select: { projects: true },
            },
          },
        },
        employee: {
          include: {
            _count: {
              select: { equipes: true },
            },
          },
        },
        admin: true,
      },
    });
  }

  async count(where?: Prisma.UtilisateurWhereInput): Promise<number> {
    return this.prisma.utilisateur.count({ where });
  }
}
