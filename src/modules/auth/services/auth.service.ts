import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersRepository } from '../../users/repositories/users.repository';
import { LoginDto } from '../dto/login.dto';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const ACCESS_EXPIRY_MS = 15 * 60 * 1000;        // 15 minutes
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
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

  async login(loginDto: LoginDto, res: Response) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) throw new UnauthorizedException('Identifiants invalides');

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      employeeId: user.employee?.id,
      clientId: user.client?.id,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.getRefreshSecret(),
        expiresIn: '7d' as any,
      },
    );

    await this.storeRefreshToken(user.id, refreshToken);

    this.setTokenCookies(res, accessToken, refreshToken);

    const additionalInfo: Record<string, string | number> = {};
    if (user.role === Role.EMPLOYEE && user.employee) {
      additionalInfo.poste = user.employee.poste;
      additionalInfo.employeeId = user.employee.id;
    } else if (user.role === Role.CLIENT && user.client) {
      additionalInfo.nomSociete = user.client.nomSociete;
      additionalInfo.clientId = user.client.id;
    }

    return {
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

  async refresh(req: Request, res: Response) {
    const token: string | undefined = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!token) throw new UnauthorizedException('Refresh token manquant');

    let payload: any;
    try {
      payload = this.jwtService.verify(token, { secret: this.getRefreshSecret() });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: { utilisateurId: payload.sub, expiresAt: { gt: new Date() } },
    });

    if (!stored || !(await bcrypt.compare(token, stored.tokenHash))) {
      throw new UnauthorizedException('Refresh token révoqué');
    }

    const user = await this.usersRepository.findById(payload.sub);
    if (!user || (user as any).status === 'SUSPENDU') {
      throw new UnauthorizedException('Utilisateur non trouvé ou suspendu');
    }

    const newPayload = {
      email: user.email,
      sub: user.id,
      role: (user as any).role,
      employeeId: (user as any).employee?.id,
      clientId: (user as any).client?.id,
    };

    const newAccessToken = this.jwtService.sign(newPayload);
    const newRefreshToken = this.jwtService.sign(
      { sub: user.id },
      { secret: this.getRefreshSecret(), expiresIn: '7d' as any },
    );

    // Rotate: delete old, store new
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    await this.storeRefreshToken(user.id, newRefreshToken);

    this.setTokenCookies(res, newAccessToken, newRefreshToken);

    return { ok: true };
  }

  async logout(req: Request, res: Response) {
    const token: string | undefined = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (token) {
      try {
        const payload: any = this.jwtService.verify(token, {
          secret: this.getRefreshSecret(),
        });
        const stored = await this.prisma.refreshToken.findFirst({
          where: { utilisateurId: payload.sub },
        });
        if (stored && (await bcrypt.compare(token, stored.tokenHash))) {
          await this.prisma.refreshToken.delete({ where: { id: stored.id } });
        }
      } catch {
        // token already invalid — still clear cookies
      }
    }

    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions());
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions());

    return { ok: true };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private getRefreshSecret(): string {
    const secret = this.configService.get<string>('REFRESH_TOKEN_SECRET');
    if (!secret) throw new Error('REFRESH_TOKEN_SECRET is not set');
    return secret;
  }

  private async storeRefreshToken(userId: number, token: string) {
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS);
    await this.prisma.refreshToken.create({
      data: { utilisateurId: userId, tokenHash, expiresAt },
    });
  }

  private cookieOptions(maxAge?: number): Record<string, unknown> {
    return {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict' as const,
      ...(maxAge !== undefined ? { maxAge } : {}),
    };
  }

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, this.cookieOptions(ACCESS_EXPIRY_MS));
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, this.cookieOptions(REFRESH_EXPIRY_MS));
  }
}
