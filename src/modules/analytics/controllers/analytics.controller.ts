import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { AdminStatsQueryDto } from '../dto/admin-stats-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../../common/types/authenticated-request';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

  @Get('page-analyse')
  @UseGuards(JwtAuthGuard)
  async getPageAnalyse(@Query() query: AdminStatsQueryDto) {
    const year = query.year || new Date().getFullYear();
    const month = query.month || (new Date().getMonth() + 1);
    return this.analyticsService.getPageAnalyseStats(year, month);
  }

  @Get('employee-stats')
  @UseGuards(JwtAuthGuard)
  async getEmployeeStats(
    @Req() req: AuthenticatedRequest,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    const resolvedYear = year ? parseInt(year, 10) : now.getFullYear();
    const resolvedMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
    return this.analyticsService.getEmployeeAnalyticsStats(req.user.id, resolvedYear, resolvedMonth);
  }
}