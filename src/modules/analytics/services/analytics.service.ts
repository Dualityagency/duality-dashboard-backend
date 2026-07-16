import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';

@Injectable()
export class AnalyticsService {
  constructor(private analyticsRepository: AnalyticsRepository) { }

  async getPageAnalyseStats(year: number, month: number) {
    return this.analyticsRepository.getPageAnalyseStats(year, month);
  }
}
