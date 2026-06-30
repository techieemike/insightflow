import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { DatasetsService } from './datasets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('datasets')
@UseGuards(JwtAuthGuard)
export class DatasetsController {
  constructor(private service: DatasetsService) {}

  @Get() findAll() { return this.service.findAll(); }

  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/records')
  getRecords(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('showDuplicates') showDuplicates = 'true',
    @Query('column') column?: string,
    @Query('value') value?: string,
    @Query('equalsCol') equalsCol?: string,
    @Query('equals') equals?: string,
    @Query('minCol') minCol?: string,
    @Query('min') min?: string,
    @Query('maxCol') maxCol?: string,
    @Query('max') max?: string,
    @Query('dateFromCol') dateFromCol?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateToCol') dateToCol?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getRecords(id, +page, +limit, showDuplicates === 'true',
      column, value, equalsCol, equals, minCol, min, maxCol, max, dateFromCol, dateFrom, dateToCol, dateTo);
  }

  @Patch(':id/records/:recordId')
  updateRecord(@Param('id') id: string, @Param('recordId') recordId: string, @Body() body: { data: any }) {
    return this.service.updateRecord(id, recordId, body.data);
  }

  @Post(':id/transform')
  transform(@Param('id') id: string, @Body() body: { action: string; params?: any }) {
    return this.service.transform(id, body.action, body.params);
  }

  @Get(':id/insights') getInsights(@Param('id') id: string) {
    return this.service.getInsights(id);
  }

  @Get(':id/chart-data') getChartData(@Param('id') id: string) {
    return this.service.getChartData(id);
  }

  @Post('query')
  queryAll(@Body('sql') sql: string, @Body('confirm') confirm?: boolean) {
    return this.service.queryAll(sql || '', confirm);
  }

  @Post(':id/query')
  query(@Param('id') id: string, @Body('sql') sql: string, @Body('confirm') confirm?: boolean) {
    return this.service.queryDataset(id, sql || '', confirm);
  }
}
