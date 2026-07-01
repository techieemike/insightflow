import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, BorderStyle } from 'docx';
import sharp from 'sharp';

const CHART_W = 600;
const CHART_H = 300;
const COLORS = ['#7C3AED','#8B5CF6','#A78BFA','#C4B5FD','#DDD6FE','#F472B6','#FB923C','#FBBF24','#34D399','#60A5FA'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;

    const dataset = await prisma.dataset.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!dataset) {
      return NextResponse.json({ message: 'Dataset not found' }, { status: 404 });
    }

    const insights = dataset.insights as Record<string, unknown> | null;
    const children: (Paragraph | Table)[] = [];

    // --- Title ---
    children.push(
      new Paragraph({ text: 'InsightFlow AI Report', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Dataset: ${dataset.originalName}`, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` }),
      new Paragraph({ spacing: { after: 200 } }),
    );

    if (dataset.type === 'document' && insights) {
      // --- Document summary ---
      children.push(
        new Paragraph({ text: 'Document Summary', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `Word count: ${((insights.wordCount as number) || dataset.totalRecords)?.toLocaleString() || '—'}` }),
        new Paragraph({ text: `Estimated read time: ${insights.estimatedReadMinutes ? `~${insights.estimatedReadMinutes} minutes` : '—'}` }),
        new Paragraph({ spacing: { after: 200 } }),
      );

      if (insights.summary) {
        children.push(
          new Paragraph({ text: 'AI Summary', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: insights.summary as string }),
          new Paragraph({ spacing: { after: 200 } }),
        );
      }

      const keyPoints = insights.keyPoints as string[] | undefined;
      if (keyPoints?.length) {
        children.push(
          new Paragraph({ text: 'Key Points', heading: HeadingLevel.HEADING_2 }),
          ...keyPoints.map((kp: string) => new Paragraph({ text: `\u2022 ${kp}`, spacing: { after: 60 } })),
        );
      }
    } else {
      // --- Dataset Overview ---
      const statsRows: (string)[][] = [
        ['Total Records', dataset.totalRecords?.toLocaleString() || '0'],
        ['Columns', Array.isArray(dataset.columns) ? String(dataset.columns.length) : '0'],
        ['Quality Score', dataset.qualityScore != null ? `${dataset.qualityScore}/100` : '\u2014'],
        ['Duplicates', dataset.duplicateCount?.toLocaleString() || '0'],
        ['Missing Values', dataset.missingCount?.toLocaleString() || '0'],
      ];

      children.push(
        new Paragraph({ text: 'Dataset Overview', heading: HeadingLevel.HEADING_1 }),
        new Table({
          rows: statsRows.map(([label, value]) => new TableRow({
            children: [
              new TableCell({
                width: { size: 4000, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
              }),
              new TableCell({
                width: { size: 6000, type: WidthType.DXA },
                children: [new Paragraph({ text: value })],
              }),
            ],
          })),
        }),
        new Paragraph({ spacing: { after: 200 } }),
      );

      // --- AI Insights ---
      const keyInsights = insights?.keyInsights as string[] | undefined;
      if (keyInsights?.length) {
        children.push(
          new Paragraph({ text: 'AI Insights', heading: HeadingLevel.HEADING_1 }),
          ...keyInsights.map((insight: string) =>
            new Paragraph({ text: `\u2726 ${insight}`, spacing: { after: 80 } })
          ),
          new Paragraph({ spacing: { after: 200 } }),
        );
      }

      // --- Charts as images ---
      const chartImages = await buildChartImages(dataset.id);
      for (const img of chartImages) {
        children.push(
          new Paragraph({ text: img.title, heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [new ImageRun({ data: img.buffer, transformation: { width: CHART_W, height: img.h }, type: 'png' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
        );
      }

      // --- Top Performers ---
      const topPerforming = insights?.topPerforming as Array<Record<string, unknown>> | undefined;
      if (topPerforming?.length) {
        children.push(
          new Paragraph({ text: 'Top Performers', heading: HeadingLevel.HEADING_1 }),
          new Table({
            rows: [
              new TableRow({
                tableHeader: true,
                children: ['Category', 'Metric', 'Value', 'Total', 'Average'].map(h => new TableCell({
                  width: { size: 2400, type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })],
                })),
              }),
              ...topPerforming.slice(0, 10).map((tp: Record<string, unknown>) => new TableRow({
                children: [tp.category, tp.metric, tp.value, fmtChart(tp.total as number), fmtChart(tp.avg as number)].map(v => new TableCell({
                  width: { size: 2400, type: WidthType.DXA },
                  children: [new Paragraph({ text: String(v) })],
                })),
              })),
            ],
          }),
          new Paragraph({ spacing: { after: 200 } }),
        );
      }
    }

    children.push(
      new Paragraph({ text: '\u2014 End of Report \u2014', alignment: AlignmentType.CENTER, spacing: { before: 400 } }),
    );

    const doc = new Document({ sections: [{ children }] });
    const buf = await Packer.toBuffer(doc);

    return new NextResponse(buf as unknown as BodyInit | null, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="insightflow-report.docx"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Export failed' }, { status: 400 });
  }
}

// --- Chart image generation ---

async function buildChartImages(datasetId: string): Promise<{ title: string; buffer: Buffer; h: number }[]> {
  const dataset = await prisma.dataset.findUnique({ where: { id: datasetId } });
  if (!dataset || dataset.type === 'document') return [];

  const columns = dataset.columns as string[];
  if (!columns?.length) return [];

  const records = await prisma.dataRecord.findMany({
    where: { datasetId, isDuplicate: false },
    orderBy: { rowIndex: 'asc' },
  });
  const rows = records.map(r => r.data as any);
  if (rows.length === 0) return [];

  const isDateCol = (col: string) => {
    const sample = rows.slice(0, 50).map(r => r[col]).filter(v => v != null && v !== '');
    return sample.length > 0 && sample.every(v => !isNaN(Date.parse(String(v))));
  };

  const catCols = columns.filter(col => {
    const sample = rows.slice(0, 20).map(r => r[col]).filter(Boolean);
    return sample.length > 0 && sample.some(v => isNaN(Number(v))) && !isDateCol(col);
  });
  const numCols = columns.filter(col => {
    const sample = rows.slice(0, 20).map(r => r[col]).filter(Boolean);
    return sample.length > 0 && sample.every(v => !isNaN(Number(v)));
  });
  const dateCols = columns.filter(isDateCol);

  const results: { title: string; buffer: Buffer; h: number }[] = [];

  for (const catCol of catCols) {
    for (const numCol of numCols) {
      const grouped: Record<string, number[]> = {};
      for (const row of rows) {
        const key = String(row[catCol] ?? 'Unknown');
        const val = Number(row[numCol]);
        if (!isNaN(val)) {
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(val);
        }
      }
      const sorted = Object.entries(grouped)
        .map(([name, vals]) => ({ name, sum: +vals.reduce((a, b) => a + b, 0).toFixed(2), avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2), count: vals.length }))
        .sort((a, b) => b.sum - a.sum)
        .slice(0, 10);

      if (sorted.length > 0) {
        const barBuf = await renderBarChart(`${numCol} by ${catCol}`, sorted, 'sum');
        results.push({ title: `${numCol} by ${catCol} (Bar)`, buffer: barBuf, h: CHART_H + 30 });

        const pieBuf = await renderPieChart(`${numCol} distribution by ${catCol}`, sorted, 'sum');
        results.push({ title: `${numCol} distribution by ${catCol} (Pie)`, buffer: pieBuf, h: CHART_H + 30 });
      }
    }
  }

  for (const dateCol of dateCols) {
    for (const numCol of numCols) {
      const monthly: Record<string, { sum: number; count: number }> = {};
      for (const row of rows) {
        const d = new Date(row[dateCol]);
        if (isNaN(d.getTime())) continue;
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const val = Number(row[numCol]);
        if (!isNaN(val)) {
          if (!monthly[ym]) monthly[ym] = { sum: 0, count: 0 };
          monthly[ym].sum += val;
          monthly[ym].count++;
        }
      }
      const sorted = Object.entries(monthly)
        .map(([month, v]) => ({ name: month, value: +v.sum.toFixed(2) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (sorted.length > 1) {
        const lineBuf = await renderLineChart(`${numCol} over ${dateCol}`, sorted);
        results.push({ title: `${numCol} over ${dateCol}`, buffer: lineBuf, h: CHART_H + 30 });
      }
    }
  }

  if (numCols.length >= 2) {
    for (let i = 0; i < numCols.length; i++) {
      for (let j = i + 1; j < numCols.length; j++) {
        const scatter = rows.map(r => ({ x: Number(r[numCols[i]]) || 0, y: Number(r[numCols[j]]) || 0 })).filter(p => p.x !== 0 && p.y !== 0);
        if (scatter.length > 0) {
          const scBuf = await renderScatterChart(`${numCols[i]} vs ${numCols[j]}`, scatter.slice(0, 500), numCols[i], numCols[j]);
          results.push({ title: `${numCols[i]} vs ${numCols[j]}`, buffer: scBuf, h: CHART_H + 30 });
        }
      }
    }
  }

  return results.slice(0, 8);
}

// --- SVG renderers ---

function svgToPng(svg: string, h: number): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function fmtChart(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function autoLabel(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}

async function renderBarChart(title: string, data: { name: string; sum: number }[], dataKey: string): Promise<Buffer> {
  const pad = { t: 40, r: 20, b: 70, l: 70 };
  const w = CHART_W;
  const h = CHART_H;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxVal = Math.max(...data.map(d => d.sum), 1);

  const barW = Math.max(12, Math.min(40, innerW / data.length - 8));
  const gap = (innerW - barW * data.length) / (data.length + 1);
  const yAxisTicks = 4;
  const tickVal = Math.ceil(maxVal / yAxisTicks / (maxVal > 1000 ? 100 : 1)) * (maxVal > 1000 ? 100 : 1);

  let bars = '';
  data.forEach((d, i) => {
    const x = pad.l + gap + i * (barW + gap);
    const barH = (d.sum / maxVal) * innerH;
    const y = pad.t + innerH - barH;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${COLORS[i % COLORS.length]}" rx="2"/>
      <text x="${x + barW / 2}" y="${h - pad.b + 16}" text-anchor="middle" font-size="9" fill="#9CA3AF" transform="rotate(-35 ${x + barW / 2},${h - pad.b + 16})">${escapeXml(d.name)}</text>`;
  });

  let yGrid = '';
  for (let i = 0; i <= yAxisTicks; i++) {
    const val = i * tickVal;
    const y = pad.t + innerH - (val / maxVal) * innerH;
    yGrid += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#374151" stroke-width="0.5"/>
      <text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" font-size="9" fill="#9CA3AF">${autoLabel(val)}</text>`;
  }

  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:#1F2937">
    <text x="${w / 2}" y="20" text-anchor="middle" font-size="13" fill="#C4B5FD" font-weight="bold">${escapeXml(title)}</text>
    ${yGrid}${bars}
  </svg>`, h);
}

async function renderPieChart(title: string, data: { name: string; sum: number }[], dataKey: string): Promise<Buffer> {
  const w = CHART_W;
  const h = CHART_H;
  const cx = 180;
  const cy = 170;
  const r = 100;
  const total = data.reduce((s, d) => s + d.sum, 0);

  let cumulative = 0;
  let slices = '';
  let legend = '';
  data.forEach((d, i) => {
    const angle = (d.sum / total) * 360;
    const startRad = ((cumulative - 90) * Math.PI) / 180;
    const endRad = ((cumulative + angle - 90) * Math.PI) / 180;
    cumulative += angle;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const large = angle > 180 ? 1 : 0;
    slices += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z" fill="${COLORS[i % COLORS.length]}"/>`;

    const labelAngle = ((cumulative - angle / 2 - 90) * Math.PI) / 180;
    const lx = cx + (r + 20) * Math.cos(labelAngle);
    const ly = cy + (r + 20) * Math.sin(labelAngle);
    const pct = ((d.sum / total) * 100).toFixed(1);
    slices += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="8" fill="#D1D5DB">${pct}%</text>`;

    const ly2 = 155 + i * 18;
    const lx2 = 340;
    legend += `<rect x="${lx2}" y="${ly2 - 8}" width="10" height="10" fill="${COLORS[i % COLORS.length]}" rx="2"/>
      <text x="${lx2 + 16}" y="${ly2 + 2}" font-size="9" fill="#D1D5DB">${escapeXml(d.name)}</text>`;
  });

  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:#1F2937">
    <text x="${w / 2}" y="20" text-anchor="middle" font-size="13" fill="#C4B5FD" font-weight="bold">${escapeXml(title)}</text>
    ${slices}${legend}
  </svg>`, h);
}

async function renderLineChart(title: string, data: { name: string; value: number }[]): Promise<Buffer> {
  const pad = { t: 40, r: 20, b: 60, l: 70 };
  const w = CHART_W;
  const h = CHART_H;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;
  const yAxisTicks = 4;
  const tickVal = Math.ceil(maxVal / yAxisTicks / (maxVal > 1000 ? 100 : 1)) * (maxVal > 1000 ? 100 : 1);

  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  let points = '';
  data.forEach((d, i) => {
    if (i % Math.max(1, Math.floor(data.length / 10)) !== 0 && i !== data.length - 1) return;
    const x = pad.l + i * stepX;
    const y = pad.t + innerH - ((d.value - minVal) / range) * innerH;
    points += `<circle cx="${x}" cy="${y}" r="3" fill="#7C3AED"/>
      <text x="${x}" y="${pad.t + innerH + 16}" text-anchor="middle" font-size="8" fill="#9CA3AF" transform="rotate(-35 ${x},${pad.t + innerH + 16})">${escapeXml(d.name)}</text>`;
  });

  let polyline = '';
  if (data.length > 1) {
    const coords = data.map((d, i) => {
      const x = pad.l + i * stepX;
      const y = pad.t + innerH - ((d.value - minVal) / range) * innerH;
      return `${x},${y}`;
    }).join(' ');
    polyline = `<polyline points="${coords}" fill="none" stroke="#7C3AED" stroke-width="2"/>`;
  }

  let yGrid = '';
  for (let i = 0; i <= yAxisTicks; i++) {
    const val = i * tickVal;
    const y = pad.t + innerH - ((val - minVal) / range) * innerH;
    yGrid += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#374151" stroke-width="0.5"/>
      <text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" font-size="9" fill="#9CA3AF">${autoLabel(val)}</text>`;
  }

  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:#1F2937">
    <text x="${w / 2}" y="20" text-anchor="middle" font-size="13" fill="#C4B5FD" font-weight="bold">${escapeXml(title)}</text>
    ${yGrid}${polyline}${points}
  </svg>`, h);
}

async function renderScatterChart(title: string, data: { x: number; y: number }[], xKey: string, yKey: string): Promise<Buffer> {
  const pad = { t: 40, r: 20, b: 50, l: 70 };
  const w = CHART_W;
  const h = CHART_H;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxX = Math.max(...data.map(d => d.x), 1);
  const maxY = Math.max(...data.map(d => d.y), 1);
  const yAxisTicks = 4;
  const tickValY = Math.ceil(maxY / yAxisTicks / (maxY > 1000 ? 100 : 1)) * (maxY > 1000 ? 100 : 1);
  const tickValX = Math.ceil(maxX / 4 / (maxX > 1000 ? 100 : 1)) * (maxX > 1000 ? 100 : 1);

  let dots = '';
  data.forEach(d => {
    const dx = pad.l + (d.x / maxX) * innerW;
    const dy = pad.t + innerH - (d.y / maxY) * innerH;
    dots += `<circle cx="${dx}" cy="${dy}" r="2.5" fill="#7C3AED" opacity="0.6"/>`;
  });

  let yGrid = '';
  for (let i = 0; i <= yAxisTicks; i++) {
    const val = i * tickValY;
    const y = pad.t + innerH - (val / maxY) * innerH;
    yGrid += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#374151" stroke-width="0.5"/>
      <text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" font-size="9" fill="#9CA3AF">${autoLabel(val)}</text>`;
  }

  let xGrid = '';
  for (let i = 0; i <= 4; i++) {
    const val = i * tickValX;
    const x = pad.l + (val / maxX) * innerW;
    xGrid += `<text x="${x}" y="${h - pad.b + 14}" text-anchor="middle" font-size="8" fill="#9CA3AF">${autoLabel(val)}</text>`;
  }

  return svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:#1F2937">
    <text x="${w / 2}" y="20" text-anchor="middle" font-size="13" fill="#C4B5FD" font-weight="bold">${escapeXml(title)}</text>
    <text x="12" y="${pad.t + innerH / 2}" text-anchor="middle" font-size="9" fill="#9CA3AF" transform="rotate(-90 12,${pad.t + innerH / 2})">${escapeXml(yKey)}</text>
    <text x="${pad.l + innerW / 2}" y="${h - 8}" text-anchor="middle" font-size="9" fill="#9CA3AF">${escapeXml(xKey)}</text>
    ${yGrid}${xGrid}${dots}
  </svg>`, h);
}

function escapeXml(s: unknown): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
