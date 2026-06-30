import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.0-flash-001'];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

@Injectable()
export class InsightsService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    const key = config.get('GEMINI_API_KEY');
    if (key && key.startsWith('AIzaSy')) {
      this.genAI = new GoogleGenerativeAI(key);
    }
  }

  async generate(datasetId: string, rows: any[], columns: string[]) {
    try {
      const stats = this.computeStats(rows, columns);
      let insights: any;
      if (this.genAI) {
        try {
          insights = await this.generateWithAI(rows, columns, stats);
        } catch (err) {
          console.error('Gemini AI failed, using rule-based:', err);
          insights = this.generateRuleBased(rows, columns, stats);
        }
      } else {
        insights = this.generateRuleBased(rows, columns, stats);
      }
      await this.prisma.dataset.update({
        where: { id: datasetId },
        data: { insights }
      });
    } catch (err) {
      console.error('Insights generation completely failed:', err);
    }
  }

  computeStats(rows: any[], columns: string[]) {
    const stats: Record<string, any> = {};
    for (const col of columns) {
      const vals = rows.map(r => r[col]).filter(v => v !== '' && v != null);
      const nums = vals.map(Number).filter(n => !isNaN(n));
      if (nums.length > 0) {
        const sum = nums.reduce((a, b) => a + b, 0);
        const sorted = [...nums].sort((a, b) => a - b);
        stats[col] = {
          type: 'number', count: nums.length,
          sum: +sum.toFixed(2),
          mean: +(sum / nums.length).toFixed(2),
          min: sorted[0], max: sorted[sorted.length - 1],
          median: sorted[Math.floor(sorted.length / 2)],
        };
      } else if (
        vals.filter(v => v !== '').slice(0, 50).every(v => !isNaN(Date.parse(String(v))))
      ) {
        const dates = vals.map(v => new Date(v)).sort((a, b) => a.getTime() - b.getTime());
        const yearMonthCounts: Record<string, number> = {};
        dates.forEach(d => {
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          yearMonthCounts[ym] = (yearMonthCounts[ym] || 0) + 1;
        });
        stats[col] = {
          type: 'date',
          min: dates[0].toISOString().split('T')[0],
          max: dates[dates.length - 1].toISOString().split('T')[0],
          months: Object.entries(yearMonthCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ym, count]) => ({ month: ym, count })),
        };
      } else {
        const freq: Record<string, number> = {};
        vals.forEach(v => { freq[String(v)] = (freq[String(v)] || 0) + 1; });
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        stats[col] = {
          type: 'categorical', uniqueCount: sorted.length,
          topValues: sorted.slice(0, 5),
          bottomValues: sorted.slice(-5),
        };
      }
    }
    return stats;
  }

  private async callGeminiWithRetry(prompt: string): Promise<string> {
    for (const modelName of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const model = this.genAI!.getGenerativeModel({ model: modelName });
          const res = await model.generateContent(prompt);
          return res.response.text();
        } catch (err: any) {
          const status = err.status || err.statusCode || 0;
          const isRateLimit = status === 429 || String(err.message || '').includes('429');
          if (isRateLimit && attempt < 2) {
            await sleep((attempt + 1) * 2000);
            continue;
          }
          if (!isRateLimit) break;
        }
      }
    }
    throw new Error('All Gemini models exhausted');
  }

  private async generateWithAI(rows: any[], columns: string[], stats: any) {
    const sample = rows.slice(0, 30);
    const numCols = Object.entries(stats).filter(([, v]: any) => v.type === 'number').map(([c]) => c);
    const catCols = Object.entries(stats).filter(([, v]: any) => v.type === 'categorical').map(([c]) => c);

    const prompt = [
      'You are a data analyst. Analyze this dataset and return ONLY valid JSON with these keys:',
      'summaryStats (array of {column, mean, min, max, sum}),',
      'topPerforming (array of {category, metric, value, total, avg}),',
      'lowestPerforming (array of {category, metric, value, total, avg}),',
      'trends (array of strings describing any trends),',
      'anomalies (array of strings describing outliers or unusual data),',
      'keyInsights (array of 5-8 concise string insights about what the data shows).',
      '',
      'For topPerforming and lowestPerforming, analyze each numerical column grouped by each categorical column.',
      'Example if Revenue and Region: {category: "Region", metric: "Revenue", value: "EMEA", total: 1200000, avg: 400000}.',
      '',
      'Dataset columns: ' + columns.join(', '),
      'Numerical columns: ' + numCols.join(', '),
      'Categorical columns: ' + catCols.join(', '),
      'Sample rows (first 30): ' + JSON.stringify(sample),
      'Column statistics: ' + JSON.stringify(stats),
      '',
      'Return ONLY valid JSON. No markdown, no code fences, no explanation.',
    ].join('\n');

    const text = await this.callGeminiWithRetry(prompt);
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  }

  private generateRuleBased(rows: any[], columns: string[], stats: any) {
    const numCols = Object.entries(stats).filter(([, v]: any) => v.type === 'number');
    const catCols = Object.entries(stats).filter(([, v]: any) => v.type === 'categorical');
    const dateCols = Object.entries(stats).filter(([, v]: any) => v.type === 'date');

    const summaryStats = numCols.map(([col, v]: any) => ({
      column: col, mean: v.mean, min: v.min, max: v.max, sum: v.sum
    }));

    const topPerforming: any[] = [];
    const lowestPerforming: any[] = [];
    const keyInsights: string[] = [];
    const trends: string[] = [];

    if (columns.length > 0) keyInsights.push(`Dataset has ${columns.length} columns and ${rows.length} records.`);
    if (numCols.length > 0) keyInsights.push(`Numerical columns: ${numCols.map(([c]) => c).join(', ')}.`);
    if (catCols.length > 0) keyInsights.push(`Categorical columns: ${catCols.map(([c]) => c).join(', ')}.`);
    if (dateCols.length > 0) keyInsights.push(`Date columns: ${dateCols.map(([c]) => c).join(', ')}.`);

    for (const [catCol] of catCols) {
      for (const [numCol] of numCols) {
        const grouped: Record<string, number[]> = {};
        for (const row of rows) {
          const key = String(row[catCol] || 'Unknown');
          const val = Number(row[numCol]);
          if (!isNaN(val)) {
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(val);
          }
        }
        const totals = Object.entries(grouped).map(([k, vals]) => ({
          name: k, sum: vals.reduce((a, b) => a + b, 0),
          avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length
        })).sort((a, b) => b.sum - a.sum);

        if (totals.length > 0) {
          const best = totals[0];
          const worst = totals[totals.length - 1];
          topPerforming.push({ category: catCol, metric: numCol, value: best.name, total: best.sum, avg: +best.avg.toFixed(2) });
          lowestPerforming.push({ category: catCol, metric: numCol, value: worst.name, total: worst.sum, avg: +worst.avg.toFixed(2) });
          keyInsights.push(`Top ${catCol} by ${numCol}: ${best.name} (${fmt(best.sum)} total).`);
        }
      }
    }

    for (const [dateCol] of dateCols) {
      for (const [numCol] of numCols) {
        const monthly: Record<string, number[]> = {};
        for (const row of rows) {
          const d = new Date(row[dateCol]);
          if (isNaN(d.getTime())) continue;
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const val = Number(row[numCol]);
          if (!isNaN(val)) {
            if (!monthly[ym]) monthly[ym] = [];
            monthly[ym].push(val);
          }
        }
        const sorted = Object.entries(monthly)
          .map(([m, vals]) => ({ month: m, sum: vals.reduce((a, b) => a + b, 0), avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
          .sort((a, b) => a.month.localeCompare(b.month));
        if (sorted.length >= 2) {
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const change = last.sum - first.sum;
          const pct = first.sum !== 0 ? Math.round((change / first.sum) * 100) : 0;
          if (pct > 0) {
            trends.push(`${numCol} grew by ${pct}% from ${first.month} to ${last.month}.`);
          } else if (pct < 0) {
            trends.push(`${numCol} declined by ${Math.abs(pct)}% from ${first.month} to ${last.month}.`);
          }
          keyInsights.push(`${numCol} ${pct >= 0 ? 'increased' : 'decreased'} ${Math.abs(pct)}% from ${first.month} to ${last.month}.`);
        }
      }
    }

    for (const [dateCol, v] of dateCols) {
      const d = v as any;
      keyInsights.push(`${dateCol} ranges from ${d.min} to ${d.max} (${d.months.length} months).`);
    }

    return {
      summaryStats, topPerforming, lowestPerforming,
      trends, keyInsights,
      anomalies: numCols.map(([col, v]: any) => `${col}: range ${fmt(v.min)} – ${fmt(v.max)}, mean ${fmt(v.mean)}`),
      stats
    };
  }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}
