import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(requesterRole: string) {
    if (requesterRole !== Role.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem gerenciar usuários.');
    }

    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { files: true, folders: true },
        },
      },
    });

    const storageAgg = await this.prisma.fileItem.groupBy({
      by: ['userId'],
      _sum: { size: true },
    });

    const usedMap = new Map<string, number>();
    for (const row of storageAgg) {
      usedMap.set(row.userId, Number(row._sum.size || 0));
    }

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      storageQuota: Number(u.storageQuota),
      storageUsed: usedMap.get(u.id) || 0,
      filesCount: u._count.files,
      foldersCount: u._count.folders,
      createdAt: u.createdAt,
    }));
  }

  async createUser(
    requesterRole: string,
    data: { name: string; email: string; password: string; role?: 'ADMIN' | 'USER' },
  ) {
    if (requesterRole !== Role.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem criar usuários.');
    }

    const email = data.email?.trim().toLowerCase();
    if (!data.name?.trim() || !email || !data.password || data.password.length < 6) {
      throw new BadRequestException(
        'Informe nome, e-mail válido e senha com no mínimo 6 caracteres.',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const created = await this.prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        passwordHash,
        role: data.role === 'ADMIN' ? Role.ADMIN : Role.USER,
      },
    });

    // Cria pastas padrão para a nova conta
    await this.prisma.folder.createMany({
      data: [
        { name: 'Documentos', userId: created.id },
        { name: 'Fotos & Mídia', userId: created.id },
      ],
    });

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      storageQuota: Number(created.storageQuota),
      createdAt: created.createdAt,
    };
  }

  async deleteUser(requesterId: string, requesterRole: string, targetId: string) {
    if (requesterRole !== Role.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem remover usuários.');
    }
    if (requesterId === targetId) {
      throw new BadRequestException('Você não pode excluir sua própria conta ativa.');
    }

    const existing = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!existing) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    await this.prisma.user.delete({ where: { id: targetId } });
    return { message: 'Usuário removido com sucesso.' };
  }
}

