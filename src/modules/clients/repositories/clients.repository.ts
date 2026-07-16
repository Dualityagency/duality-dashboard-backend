// src/modules/clients/repositories/clients.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ClientsRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.client.findMany({
      select: {
        id: true,
        utilisateur: {
          select: {
            nom: true,
            prenom: true,
          },
        },
      },
    });
  }
}
