/**
 * @file prisma.service.ts
 * @description Service NestJS encapsulant le client Prisma pour l'accès à la base de données PostgreSQL.
 * @feature Infrastructure / Base de données
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Service Prisma global pour l'application.
 * @Injectable Marque la classe comme injectable.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Configuration de l'adaptateur pour PostgreSQL
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    // Initialisation du client Prisma avec l'adaptateur
    super({ adapter });
  }

  /**
   * Méthode appelée lors de l'initialisation du module.
   * Établit la connexion à la base de données.
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Méthode appelée lors de la destruction du module.
   * Ferme proprement la connexion à la base de données.
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
