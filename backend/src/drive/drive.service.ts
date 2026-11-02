import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface BreadcrumbItem {
  id: string;
  name: string;
}

@Injectable()
export class DriveService {
  private readonly storageDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.storageDir = path.resolve(
      process.cwd(),
      process.env.STORAGE_DIR || './storage/uploads',
    );
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  getStorageDir(): string {
    return this.storageDir;
  }

  private serializeFile(file: any) {
    return {
      id: file.id,
      name: file.name,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: Number(file.size),
      isFavorite: file.isFavorite,
      folderId: file.folderId,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  async getContents(
    userId: string,
    options: {
      folderId?: string;
      search?: string;
      section?: 'drive' | 'favorites' | 'recent' | 'images' | 'documents' | 'media';
    },
  ) {
    const section = options.section || 'drive';
    const search = options.search?.trim();
    const folderId = options.folderId || null;

    let currentFolder: { id: string; name: string; parentId: string | null } | null = null;
    const breadcrumbs: BreadcrumbItem[] = [];

    if (section === 'drive' && folderId && !search) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: folderId, userId },
      });
      if (!folder) {
        throw new NotFoundException('Pasta não encontrada.');
      }
      currentFolder = {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
      };

      // Reconstrói o caminho (breadcrumbs) da pasta atual até a raiz
      let cursor: typeof folder | null = folder;
      const chain: BreadcrumbItem[] = [];
      let safety = 0;
      while (cursor && safety < 30) {
        chain.unshift({ id: cursor.id, name: cursor.name });
        if (!cursor.parentId) break;
        cursor = await this.prisma.folder.findFirst({
          where: { id: cursor.parentId, userId },
        });
        safety++;
      }
      breadcrumbs.push(...chain);
    }

    // Busca pastas (apenas na visão principal 'drive' ou durante busca textual)
    let folders: any[] = [];
    if (section === 'drive') {
      const folderWhere: any = { userId };
      if (search) {
        folderWhere.name = { contains: search };
      } else {
        folderWhere.parentId = folderId;
      }

      const rawFolders = await this.prisma.folder.findMany({
        where: folderWhere,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { children: true, files: true },
          },
        },
      });

      folders = rawFolders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        itemsCount: f._count.children + f._count.files,
      }));
    }

    // Busca arquivos conforme a seção e filtros
    const fileWhere: any = { userId };
    if (search) {
      fileWhere.name = { contains: search };
    } else if (section === 'drive') {
      fileWhere.folderId = folderId;
    } else if (section === 'favorites') {
      fileWhere.isFavorite = true;
    } else if (section === 'images') {
      fileWhere.mimeType = { startsWith: 'image/' };
    } else if (section === 'media') {
      fileWhere.OR = [
        { mimeType: { startsWith: 'video/' } },
        { mimeType: { startsWith: 'audio/' } },
      ];
    } else if (section === 'documents') {
      fileWhere.OR = [
        { mimeType: { contains: 'pdf' } },
        { mimeType: { startsWith: 'text/' } },
        { mimeType: { contains: 'word' } },
        { mimeType: { contains: 'document' } },
        { mimeType: { contains: 'spreadsheet' } },
        { mimeType: { contains: 'excel' } },
        { mimeType: { contains: 'presentation' } },
        { mimeType: { contains: 'json' } },
      ];
    }

    const rawFiles = await this.prisma.fileItem.findMany({
      where: fileWhere,
      orderBy: section === 'recent' ? { updatedAt: 'desc' } : { name: 'asc' },
      take: section === 'recent' ? 50 : undefined,
    });

    // Estatísticas de uso do armazenamento do usuário
    const [usageAgg, totalFiles, totalFolders, userRecord] = await Promise.all([
      this.prisma.fileItem.aggregate({
        where: { userId },
        _sum: { size: true },
      }),
      this.prisma.fileItem.count({ where: { userId } }),
      this.prisma.folder.count({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { storageQuota: true },
      }),
    ]);

    return {
      currentFolder,
      breadcrumbs,
      folders,
      files: rawFiles.map((f) => this.serializeFile(f)),
      stats: {
        usedBytes: Number(usageAgg._sum.size || 0),
        quotaBytes: Number(userRecord?.storageQuota || 10737418240),
        totalFiles,
        totalFolders,
      },
    };
  }

  async listAllFolders(userId: string) {
    const folders = await this.prisma.folder.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    });
    return { folders };
  }

  async createFolder(userId: string, name: string, parentId?: string | null) {
    const cleanName = name?.trim();
    if (!cleanName) {
      throw new BadRequestException('Informe um nome válido para a pasta.');
    }

    if (parentId) {
      const parent = await this.prisma.folder.findFirst({
        where: { id: parentId, userId },
      });
      if (!parent) {
        throw new NotFoundException('Pasta pai não encontrada.');
      }
    }

    const duplicate = await this.prisma.folder.findFirst({
      where: {
        userId,
        parentId: parentId || null,
        name: cleanName,
      },
    });

    if (duplicate) {
      throw new BadRequestException('Já existe uma pasta com este nome neste local.');
    }

    const folder = await this.prisma.folder.create({
      data: {
        name: cleanName,
        parentId: parentId || null,
        userId,
      },
    });

    return folder;
  }

  async updateFolder(
    userId: string,
    folderId: string,
    data: { name?: string; parentId?: string | null },
  ) {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) {
      throw new NotFoundException('Pasta não encontrada.');
    }

    const updateData: any = {};

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) {
        throw new BadRequestException('O nome da pasta não pode ficar vazio.');
      }
      updateData.name = cleanName;
    }

    if (data.parentId !== undefined) {
      const targetParentId = data.parentId || null;
      if (targetParentId === folderId) {
        throw new BadRequestException('Não é possível mover uma pasta para dentro dela mesma.');
      }
      if (targetParentId) {
        const targetParent = await this.prisma.folder.findFirst({
          where: { id: targetParentId, userId },
        });
        if (!targetParent) {
          throw new NotFoundException('Pasta de destino não encontrada.');
        }

        // Verifica se targetParentId é descendente de folderId para evitar ciclo
        let cursor: typeof targetParent | null = targetParent;
        let safety = 0;
        while (cursor && safety < 50) {
          if (cursor.parentId === folderId) {
            throw new BadRequestException(
              'Não é possível mover uma pasta para dentro de uma subpasta sua.',
            );
          }
          if (!cursor.parentId) break;
          cursor = await this.prisma.folder.findFirst({
            where: { id: cursor.parentId, userId },
          });
          safety++;
        }
      }
      updateData.parentId = targetParentId;
    }

    return this.prisma.folder.update({
      where: { id: folderId },
      data: updateData,
    });
  }

  async deleteFolder(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) {
      throw new NotFoundException('Pasta não encontrada.');
    }

    // Coleta todas as subpastas recursivamente para apagar os arquivos físicos do disco
    const allUserFolders = await this.prisma.folder.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });

    const folderIdsToRemove = new Set<string>([folderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of allUserFolders) {
        if (f.parentId && folderIdsToRemove.has(f.parentId) && !folderIdsToRemove.has(f.id)) {
          folderIdsToRemove.add(f.id);
          added = true;
        }
      }
    }

    const filesToDelete = await this.prisma.fileItem.findMany({
      where: {
        userId,
        folderId: { in: Array.from(folderIdsToRemove) },
      },
      select: { storageKey: true },
    });

    for (const file of filesToDelete) {
      const fullPath = path.join(this.storageDir, path.basename(file.storageKey));
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // Ignora erro caso arquivo já tenha sido removido
        }
      }
    }

    await this.prisma.folder.delete({
      where: { id: folderId },
    });

    return { message: 'Pasta e todo o seu conteúdo foram removidos.' };
  }

  async saveUploadedFiles(
    userId: string,
    files: Array<Express.Multer.File>,
    folderId?: string | null,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }

    const targetFolderId = folderId || null;
    if (targetFolderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, userId },
      });
      if (!folder) {
        throw new NotFoundException('Pasta de destino não encontrada.');
      }
    }

    const createdFiles: any[] = [];
    for (const file of files) {
      // Corrige codificação UTF-8 de nomes com acentos vindos do multipart/form-data
      let decodedOriginalName = file.originalname;
      try {
        const candidate = Buffer.from(file.originalname, 'latin1').toString('utf8');
        if (!candidate.includes('\ufffd')) {
          decodedOriginalName = candidate;
        }
      } catch {
        decodedOriginalName = file.originalname;
      }

      const record = await this.prisma.fileItem.create({
        data: {
          name: decodedOriginalName,
          originalName: decodedOriginalName,
          mimeType: file.mimetype || 'application/octet-stream',
          size: BigInt(file.size),
          storageKey: file.filename,
          folderId: targetFolderId,
          userId,
        },
      });
      createdFiles.push(this.serializeFile(record));
    }

    return { files: createdFiles };
  }

  async updateFile(
    userId: string,
    fileId: string,
    data: { name?: string; folderId?: string | null; isFavorite?: boolean },
  ) {
    const file = await this.prisma.fileItem.findFirst({
      where: { id: fileId, userId },
    });
    if (!file) {
      throw new NotFoundException('Arquivo não encontrado.');
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) {
        throw new BadRequestException('O nome do arquivo não pode ficar vazio.');
      }
      updateData.name = cleanName;
    }

    if (data.folderId !== undefined) {
      const targetFolderId = data.folderId || null;
      if (targetFolderId) {
        const folder = await this.prisma.folder.findFirst({
          where: { id: targetFolderId, userId },
        });
        if (!folder) {
          throw new NotFoundException('Pasta de destino não encontrada.');
        }
      }
      updateData.folderId = targetFolderId;
    }

    if (data.isFavorite !== undefined) {
      updateData.isFavorite = Boolean(data.isFavorite);
    }

    const updated = await this.prisma.fileItem.update({
      where: { id: fileId },
      data: updateData,
    });

    return this.serializeFile(updated);
  }

  async deleteFile(userId: string, fileId: string) {
    const file = await this.prisma.fileItem.findFirst({
      where: { id: fileId, userId },
    });
    if (!file) {
      throw new NotFoundException('Arquivo não encontrado.');
    }

    const fullPath = path.join(this.storageDir, path.basename(file.storageKey));
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // Ignora erro se já não existir no disco
      }
    }

    await this.prisma.fileItem.delete({
      where: { id: fileId },
    });

    return { message: 'Arquivo excluído com sucesso.' };
  }

  async getFileForStream(userId: string, fileId: string) {
    const file = await this.prisma.fileItem.findFirst({
      where: { id: fileId, userId },
    });
    if (!file) {
      throw new NotFoundException('Arquivo não encontrado.');
    }

    const fullPath = path.join(this.storageDir, path.basename(file.storageKey));
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Arquivo físico não encontrado no disco do servidor.');
    }

    return {
      file: this.serializeFile(file),
      fullPath,
    };
  }
}

