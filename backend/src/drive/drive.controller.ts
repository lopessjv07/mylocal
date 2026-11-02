import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { Response } from 'express';
import { DriveService } from './drive.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const uploadStorageDir = path.resolve(
  process.cwd(),
  process.env.STORAGE_DIR || './storage/uploads',
);
if (!fs.existsSync(uploadStorageDir)) {
  fs.mkdirSync(uploadStorageDir, { recursive: true });
}

@Controller('api/drive')
@UseGuards(JwtAuthGuard)
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  @Get('contents')
  async getContents(
    @Req() req: any,
    @Query('folderId') folderId?: string,
    @Query('search') search?: string,
    @Query('section')
    section?: 'drive' | 'favorites' | 'recent' | 'images' | 'documents' | 'media',
  ) {
    return this.driveService.getContents(req.user.id, {
      folderId: folderId || undefined,
      search: search || undefined,
      section: section || 'drive',
    });
  }

  @Get('folders/all')
  async listAllFolders(@Req() req: any) {
    return this.driveService.listAllFolders(req.user.id);
  }

  @Post('folders')
  async createFolder(
    @Req() req: any,
    @Body() body: { name: string; parentId?: string | null },
  ) {
    return this.driveService.createFolder(req.user.id, body.name, body.parentId);
  }

  @Patch('folders/:id')
  async updateFolder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; parentId?: string | null },
  ) {
    return this.driveService.updateFolder(req.user.id, id, body);
  }

  @Delete('folders/:id')
  async deleteFolder(@Req() req: any, @Param('id') id: string) {
    return this.driveService.deleteFolder(req.user.id, id);
  }

  @Post('files/upload')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, uploadStorageDir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname || '').slice(0, 15);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB por arquivo
      },
    }),
  )
  async uploadFiles(
    @Req() req: any,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body('folderId') folderId?: string,
  ) {
    const cleanFolderId =
      folderId && folderId !== 'null' && folderId !== 'undefined' ? folderId : null;
    return this.driveService.saveUploadedFiles(req.user.id, files, cleanFolderId);
  }

  @Patch('files/:id')
  async updateFile(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; folderId?: string | null; isFavorite?: boolean },
  ) {
    return this.driveService.updateFile(req.user.id, id, body);
  }

  @Delete('files/:id')
  async deleteFile(@Req() req: any, @Param('id') id: string) {
    return this.driveService.deleteFile(req.user.id, id);
  }

  @Get('files/:id/content')
  async streamFile(
    @Req() req: any,
    @Param('id') id: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const { file, fullPath } = await this.driveService.getFileForStream(req.user.id, id);
    const disposition = download === '1' || download === 'true' ? 'attachment' : 'inline';
    const encodedName = encodeURIComponent(file.name);

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${file.name.replace(/"/g, '')}"; filename*=UTF-8''${encodedName}`,
    );

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  }
}

