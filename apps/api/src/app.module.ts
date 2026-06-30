import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UploadModule } from './upload/upload.module';
import { DatasetsModule } from './datasets/datasets.module';
import { InsightsModule } from './insights/insights.module';
import { ChatModule } from './chat/chat.module';
import { ExportModule } from './export/export.module';
import { QualityModule } from './quality/quality.module';
import { AuthModule } from './auth/auth.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UploadModule,
    DatasetsModule,
    InsightsModule,
    ChatModule,
    ExportModule,
    QualityModule,
  ],
})
export class AppModule {}