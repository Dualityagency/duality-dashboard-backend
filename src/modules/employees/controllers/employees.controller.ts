// src/modules/employees/controllers/employees.controller.ts
import { Controller, Get, UseGuards, Param, Query, ParseIntPipe } from '@nestjs/common';
import { EmployeesService } from '../services/employees.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { EmployeeListItem } from '../../../types/employee.types';

@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll(): Promise<EmployeeListItem[]> {
    return this.employeesService.getAllEmployees();
  }

  @Get(':id/calendar')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getCalendar(
    @Param('id', ParseIntPipe) id: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.employeesService.getCalendar(id, month, year);
  }
}
