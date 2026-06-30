import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { FileValidatorService } from './file-validator.service';
import { FileParserService } from './file-parser.service';
import { QualityModule } from '../quality/quality.module';
import { InsightsModule } from '../insights/insights.module';


@Module({
  imports: [QualityModule, InsightsModule],
  controllers: [UploadController],
  providers: [UploadService, FileValidatorService, FileParserService],
})
export class UploadModule {}
