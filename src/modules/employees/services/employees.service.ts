// src/modules/employees/services/employees.service.ts
import { Injectable } from '@nestjs/common';
import { EmployeesRepository } from '../repositories/employees.repository';
import { EmployeeListItem } from '../../../types/employee.types';

@Injectable()
export class EmployeesService {
  constructor(private employeesRepository: EmployeesRepository) {}

  async getAllEmployees(): Promise<EmployeeListItem[]> {
    const employees = await this.employeesRepository.findAll();
    return employees.map((emp) => ({
      id: emp.id,
      fullname: `${emp.utilisateur.prenom} ${emp.utilisateur.nom}`,
      avatar: emp.utilisateur.avatar,
      email: emp.utilisateur.email,
      poste: emp.poste,
    }));
  }
}
