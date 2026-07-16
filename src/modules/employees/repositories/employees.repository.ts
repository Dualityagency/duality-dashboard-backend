// src/modules/employees/repositories/employees.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmployeesRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.employee.findMany({
      select: {
        id: true,
        poste: true,
        utilisateur: {
          select: {
            nom: true,
            prenom: true,
            avatar: true,
            email: true,
          },
        },
      },
    });
  }
}
