import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { AdminStatsQueryDto } from '../dto/admin-stats-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

 

  @Get('page-analyse')
  async getPageAnalyse(@Query() query: AdminStatsQueryDto) {
    const year = query.year || new Date().getFullYear();
    const month = query.month || (new Date().getMonth() + 1);
    return this.analyticsService.getPageAnalyseStats(year, month);
  }


}
