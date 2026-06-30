import { Injectable, BadRequestException } from '@nestjs/common';


const ALLOWED_MIMES = [
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ALLOWED_EXTS = ['.csv', '.txt', '.xls', '.xlsx'];
const MAX_BYTES = 25 * 1024 * 1024;


@Injectable()
export class FileValidatorService {
  validate(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded.');
    if (file.size > MAX_BYTES)
      throw new BadRequestException(`File exceeds 25 MB limit. Got ${(file.size/1024/1024).toFixed(1)} MB.`);
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext))
      throw new BadRequestException(`Unsupported file type: ${ext}. Allowed: .csv, .txt, .xls, .xlsx`);
    return { valid: true, ext, mime: file.mimetype };
  }
}
