import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => (req?.query?.token as string) || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'mylibrary-super-secret-jwt-key-change-in-production',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado ou sessão inválida.');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storageQuota: Number(user.storageQuota),
    };
  }
}

