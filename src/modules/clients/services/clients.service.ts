// src/modules/clients/services/clients.service.ts
import { Injectable } from '@nestjs/common';
import { ClientsRepository } from '../repositories/clients.repository';
import { ClientListItem } from '../../../types/client.types';

@Injectable()
export class ClientsService {
  constructor(private clientsRepository: ClientsRepository) {}

  async getAllClients(): Promise<ClientListItem[]> {
    const clients = await this.clientsRepository.findAll();
    return clients.map((client) => ({
      id: client.id,
      fullname: `${client.utilisateur.prenom} ${client.utilisateur.nom}`,
    }));
  }

  async getCalendar(clientId: number, month: number, year: number) {
    return this.clientsRepository.getCalendar(clientId, month, year);
  }
}
