import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';

@Injectable()
export class AnalyticsService {
  constructor(private analyticsRepository: AnalyticsRepository) { }

  async getPageAnalyseStats(year: number, month: number) {
    return this.analyticsRepository.getPageAnalyseStats(year, month);
  }

  async getEmployeeAnalyticsStats(userId: number, year?: number, month?: number) {
    return this.analyticsRepository.getEmployeeAnalyticsStats(userId, year, month);
  }
}