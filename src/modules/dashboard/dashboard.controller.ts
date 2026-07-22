/**
 * @file dashboard.controller.ts
 * @description Ce fichier gère les requêtes HTTP pour les différents tableaux de bord (Admin, Employé, Client).
 * @feature Tableaux de bord et KPIs
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

/**
 * Contrôleur gérant les données des tableaux de bord.
 * @Controller Définit le préfixe de route 'dashboard'.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Récupère les KPIs pour le tableau de bord Administrateur.
   * @UseGuards Sécurise la route avec JWT.
   * @returns {Promise<any>} Statistiques globales (utilisateurs, projets, revenus, etc.).
   */
  @Get('admin/kpis')
  @UseGuards(JwtAuthGuard)
  async getAdminKpis() {
    return this.dashboardService.getAdminKpis();
  }

  /**
   * Récupère les données du tableau de bord pour l'employé connecté.
   * @UseGuards Sécurise la route avec JWT.
   * @param {any} user - L'utilisateur extrait du token.
   * @returns {Promise<any>} Tâches en retard, tâches du jour, deadlines à venir, projets.
   */
  @Get('employee/kpis')
  @UseGuards(JwtAuthGuard)
  async getEmployeeKpis(@GetUser() user: any) {
    return this.dashboardService.getEmployeeDashboard(user.id);
  }

  /**
   * Récupère les données du tableau de bord pour le client connecté.
   * @UseGuards Sécurise la route avec JWT.
   * @param {any} user - L'utilisateur extrait du token.
   * @returns {Promise<any>} État d'avancement des projets, KPIs et feedbacks récents.
   */
  @Get('client/kpis')
  @UseGuards(JwtAuthGuard)
  async getClientKpis(@GetUser() user: any) {
    return this.dashboardService.getClientDashboard(user.id);
  }
}
