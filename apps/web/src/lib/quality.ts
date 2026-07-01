export function analyzeQuality(rows: any[], columns: string[]) {
  const totalRows = rows.length;
  if (totalRows === 0) return emptyResult();

  const missingByColumn: Record<string, number> = {};
  let totalMissing = 0;
  for (const col of columns) {
    const missing = rows.filter(r => r[col] === '' || r[col] === null || r[col] === undefined).length;
    missingByColumn[col] = missing;
    totalMissing += missing;
  }

  const columnTypes: Record<string, string> = {};
  for (const col of columns) {
    const sample = rows.slice(0, 50).map(r => r[col]).filter(v => v !== '');
    columnTypes[col] = inferType(sample);
  }

  const totalCells = totalRows * columns.length;
  const missingPct = totalCells > 0 ? (totalMissing / totalCells) * 100 : 0;
  const qualityScore = Math.max(0, Math.round(100 - missingPct * 2));

  return {
    totalRows, totalColumns: columns.length,
    missingByColumn, totalMissing,
    columnTypes, qualityScore,
  };
}

export function inferType(values: any[]): string {
  if (values.length === 0) return 'unknown';
  const allNum = values.every(v => !isNaN(Number(v)));
  if (allNum) return 'number';
  const allDate = values.every(v => !isNaN(Date.parse(String(v))));
  if (allDate) return 'date';
  return 'string';
}

function emptyResult() {
  return { totalRows: 0, totalColumns: 0, missingByColumn: {}, totalMissing: 0, columnTypes: {}, qualityScore: 0 };
}
