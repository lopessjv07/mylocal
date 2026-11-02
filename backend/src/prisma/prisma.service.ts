import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.ensureDefaultAdmin();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async ensureDefaultAdmin() {
    const userCount = await this.user.count();
    if (userCount === 0) {
      const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@mylibrary.local';
      const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const name = process.env.DEFAULT_ADMIN_NAME || 'Administrador';
      const passwordHash = await bcrypt.hash(password, 10);

      const admin = await this.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: Role.ADMIN,
        },
      });

      // Cria pastas iniciais de exemplo para o administrador
      await this.folder.createMany({
        data: [
          { name: 'Documentos', userId: admin.id },
          { name: 'Fotos & Mídia', userId: admin.id },
          { name: 'Projetos', userId: admin.id },
        ],
      });

      this.logger.log(`Conta Admin padrão criada: ${email}`);
    }
  }
}
