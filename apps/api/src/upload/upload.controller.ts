import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private service: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
      }
    }),
    limits: { fileSize: 25 * 1024 * 1024 }
  }))
  async upload(@UploadedFile() file: Express.Multer.File, @Body('name') name?: string) {
    return this.service.processUpload(file, name);
  }
}
