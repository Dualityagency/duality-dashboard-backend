// src/modules/employees/controllers/employees.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
