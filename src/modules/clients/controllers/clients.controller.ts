// src/modules/clients/controllers/clients.controller.ts
import { Controller, Get, UseGuards, Param, Query, ParseIntPipe } from '@nestjs/common';
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
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll() {
    return this.clientsService.getAllClients();
  }

  @Get(':id/calendar')
  @Roles(Role.ADMIN, Role.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getCalendar(
    @Param('id', ParseIntPipe) id: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.clientsService.getCalendar(id, month, year);
  }
}
