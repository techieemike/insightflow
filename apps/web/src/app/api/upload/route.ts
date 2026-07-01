import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { validateFile } from '@/lib/file-validator';
import { parseFile, parseDocument, detectDuplicates, detectEmptyRows } from '@/lib/file-parser';
import { analyzeQuality } from '@/lib/quality';
import { generateInsights } from '@/lib/insights';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function POST(request: Request) {
  try {
    const userId = requireAuth(request);

    const formData = await request.formData();
    const fileField = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;

    if (!fileField) {
      return NextResponse.json({ message: 'No file uploaded.' }, { status: 400 });
    }

    const buffer = Buffer.from(await fileField.arrayBuffer());
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `${Date.now()}-${fileField.name}`);
    fs.writeFileSync(tmpFile, buffer);

    const multerLikeFile = {
      size: fileField.size,
      originalname: fileField.name,
      mimetype: fileField.type,
    };

    const { ext, fileType } = validateFile(multerLikeFile);
    const displayName = name?.trim() || fileField.name.replace(/\.[^.]+$/, '');
    let slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed';
    let n = 2;
    while (await prisma.dataset.findFirst({ where: { slug } })) {
      slug = `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed'}_${n}`;
      n++;
    }

    if (fileType === 'document') {
      const content = await parseDocument(tmpFile, ext);
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      const dataset = await prisma.dataset.create({
        data: {
          slug,
          fileName: fileField.name,
          originalName: displayName,
          fileSize: fileField.size,
          mimeType: fileField.type,
          type: 'document',
          content,
          totalRecords: wordCount,
          columns: [],
          sampleRows: [],
          duplicateCount: 0,
          missingCount: 0,
          emptyRowCount: 0,
          qualityScore: null,
          status: 'PROCESSING',
        },
      });

      await generateInsights(dataset.id, [], [], fileType, content);

      const docUpdated = await prisma.dataset.findUnique({
        where: { id: dataset.id },
        select: { id: true, insights: true },
      });

      await prisma.dataset.update({
        where: { id: dataset.id },
        data: { status: 'READY', processedAt: new Date() },
      });

      try { fs.unlinkSync(tmpFile); } catch {}

      return NextResponse.json({
        datasetId: dataset.id,
        fileName: fileField.name,
        fileType: 'document',
        totalRecords: wordCount,
        columns: [],
        contentPreview: content.slice(0, 500),
        wordCount,
        insights: docUpdated?.insights,
        uploadedAt: dataset.uploadedAt,
      });
    }

    const { columns, rows } = parseFile(tmpFile, ext);
    const { rows: taggedRows, duplicateCount } = detectDuplicates(rows);
    const emptyRowCount = detectEmptyRows(rows);
    const quality = analyzeQuality(rows, columns);

    const dataset = await prisma.dataset.create({
      data: {
        slug,
        fileName: fileField.name,
        originalName: displayName,
        fileSize: fileField.size,
        mimeType: fileField.type,
        type: 'tabular',
        totalRecords: rows.length,
        columns: columns,
        sampleRows: rows.slice(0, 10),
        duplicateCount,
        missingCount: quality.totalMissing,
        emptyRowCount,
        qualityScore: quality.qualityScore,
        status: 'PROCESSING',
      },
    });

    const BATCH = 500;
    for (let i = 0; i < taggedRows.length; i += BATCH) {
      const batch = taggedRows.slice(i, i + BATCH);
      await prisma.dataRecord.createMany({
        data: batch.map((row, j) => ({
          datasetId: dataset.id,
          rowIndex: i + j,
          data: row,
          isDuplicate: row.__isDuplicate,
          rowHash: row.__hash,
          isEmptyRow: Object.values(row).every(v => v === '' || v === null),
        })),
      });
    }

    generateInsights(dataset.id, rows, columns).catch(console.error);

    await prisma.dataset.update({
      where: { id: dataset.id },
      data: { status: 'READY', processedAt: new Date() },
    });

    try { fs.unlinkSync(tmpFile); } catch {}

    return NextResponse.json({
      datasetId: dataset.id,
      fileName: fileField.name,
      fileType: 'tabular',
      totalRecords: rows.length,
      columns,
      sampleRows: rows.slice(0, 10),
      duplicateCount,
      emptyRowCount,
      qualityScore: quality.qualityScore,
      quality,
      uploadedAt: dataset.uploadedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Upload failed' }, { status: 400 });
  }
}
