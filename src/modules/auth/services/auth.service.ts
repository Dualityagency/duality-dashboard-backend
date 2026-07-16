// src/modules/auth/services/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersRepository } from '../../users/repositories/users.repository';
import { LoginDto } from '../dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersRepository.findByEmail(email);

    if (user && (user as any).status === 'SUSPENDU') {
      throw new UnauthorizedException(
        "Votre compte est suspendu. Veuillez contacter l'administration.",
      );  
    }

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
    };

    // Prepare response with additional info for employee
    const additionalInfo: any = {};
    if (user.role === Role.EMPLOYEE && user.employee) {
      additionalInfo.poste = user.employee.poste;
    } else if (user.role === Role.CLIENT && user.client) {
      additionalInfo.nomSociete = user.client.nomSociete;
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        ...additionalInfo,
      },
    };
  }
}
