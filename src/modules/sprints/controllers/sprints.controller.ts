import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards, Patch, Delete } from '@nestjs/common';
import { SprintsService } from '../services/sprints.service';
import { CreateSprintDto } from '../dto/create-sprint.dto';
import { UpdateSprintDto } from '../dto/update-sprint.dto';
import { CreateSprintTaskDto } from '../dto/create-sprint-task.dto';
import { UpdateSprintTaskDto } from '../dto/update-sprint-task.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('sprints')
export class SprintsController {
  constructor(private sprintsService: SprintsService) {}

  @Get(':id')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.sprintsService.getSprintDetails(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() createSprintDto: CreateSprintDto) {
    return this.sprintsService.create(createSprintDto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateSprintDto: UpdateSprintDto) {
    return this.sprintsService.update(id, updateSprintDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.sprintsService.delete(id);
  }

  @Post(':sprintId/tasks')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async addTask(@Param('sprintId', ParseIntPipe) sprintId: number, @Body() data: CreateSprintTaskDto) {
    return this.sprintsService.addTask(sprintId, data);
  }

  @Patch('tasks/:taskId')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateTask(@Param('taskId', ParseIntPipe) taskId: number, @Body() data: UpdateSprintTaskDto) {
    return this.sprintsService.updateTask(taskId, data);
  }

  @Delete('tasks/:taskId')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteTask(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.sprintsService.deleteTask(taskId);
  }

  @Get(':id/burndown')
  @Roles(Role.ADMIN, Role.EMPLOYEE, Role.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getBurndown(@Param('id', ParseIntPipe) id: number) {
    return this.sprintsService.getBurndownData(id);
  }
}
