import { Controller, Get, Post, Param, Query, Res, Body, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private service: ExportService) {}

  @Get(':id/csv')
  async exportCsv(@Param('id') id: string, @Query('excludeDuplicates') exclude: string, @Res() res: Response) {
    const csv = await this.service.exportCsv(id, exclude === 'true');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="insightflow-export.csv"');
    res.send(csv);
  }

  @Get(':id/excel')
  async exportExcel(@Param('id') id: string, @Query('excludeDuplicates') exclude: string, @Res() res: Response) {
    const buffer = await this.service.exportExcel(id, exclude === 'true');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="insightflow-export.xlsx"');
    res.send(buffer);
  }

  @Post('rows')
  async exportRows(@Body() body: { format: string; columns: string[]; rows: Record<string, unknown>[] }, @Res() res: Response) {
    if (body.format === 'csv') {
      const csv = await this.service.exportRows(body.columns, body.rows, 'csv');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="query-results.csv"');
      res.send(csv);
    } else {
      const buffer = await this.service.exportRows(body.columns, body.rows, 'excel');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="query-results.xlsx"');
      res.send(buffer);
    }
  }
}
