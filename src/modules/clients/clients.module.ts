// src/modules/clients/clients.module.ts
import { Module } from '@nestjs/common';
import { ClientsController } from './controllers/clients.controller';
import { ClientsService } from './services/clients.service';
import { ClientsRepository } from './repositories/clients.repository';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsRepository],
  exports: [ClientsService],
})
export class ClientsModule {}
