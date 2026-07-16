// src/modules/clients/controllers/clients.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClientsService } from '../services/clients.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ClientListItem } from '../../../types/client.types';

@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll(): Promise<ClientListItem[]> {
    return this.clientsService.getAllClients();
  }
}
