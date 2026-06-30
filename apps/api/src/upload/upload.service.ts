import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileValidatorService } from './file-validator.service';
import { FileParserService } from './file-parser.service';
import { QualityService } from '../quality/quality.service';
import { InsightsService } from '../insights/insights.service';


@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private validator: FileValidatorService,
    private parser: FileParserService,
    private quality: QualityService,
    private insights: InsightsService,
  ) {}


  private async generateSlug(name: string): Promise<string> {
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed';
    let n = 2;
      while (await this.prisma.dataset.findFirst({ where: { slug } })) {
      slug = `${slug}_${n}`;
      n++;
    }
    return slug;
  }

  async processUpload(file: Express.Multer.File, name?: string) {
    const { ext } = this.validator.validate(file);
    const { columns, rows } = this.parser.parseFile(file.path, ext);
    const { rows: taggedRows, duplicateCount } = this.parser.detectDuplicates(rows);
    const emptyRowCount = this.parser.detectEmptyRows(rows);
    const quality = this.quality.analyze(rows, columns);
    const displayName = name?.trim() || file.originalname.replace(/\.[^.]+$/, '');
    const slug = await this.generateSlug(displayName);


    const dataset = await this.prisma.dataset.create({
      data: {
        slug,
        fileName: file.filename,
        originalName: displayName,
        fileSize: file.size,
        mimeType: file.mimetype,
        totalRecords: rows.length,
        columns: columns,
        sampleRows: rows.slice(0, 10),
        duplicateCount,
        missingCount: quality.totalMissing,
        emptyRowCount,
        qualityScore: quality.qualityScore,
        status: 'PROCESSING',
      }
    });


    const BATCH = 500;
    for (let i = 0; i < taggedRows.length; i += BATCH) {
      const batch = taggedRows.slice(i, i + BATCH);
      await this.prisma.dataRecord.createMany({
        data: batch.map((row, j) => ({
          datasetId: dataset.id,
          rowIndex: i + j,
          data: row,
          isDuplicate: row.__isDuplicate,
          rowHash: row.__hash,
          isEmptyRow: Object.values(row).every(v => v === '' || v === null),
        }))
      });
    }


    this.insights.generate(dataset.id, rows, columns).catch(console.error);


    await this.prisma.dataset.update({
      where: { id: dataset.id },
      data: { status: 'READY', processedAt: new Date() }
    });


    return {
      datasetId: dataset.id,
      fileName: file.originalname,
      totalRecords: rows.length,
      columns,
      sampleRows: rows.slice(0, 10),
      duplicateCount,
      emptyRowCount,
      qualityScore: quality.qualityScore,
      quality,
      uploadedAt: dataset.uploadedAt,
    };
  }
}