const ALLOWED_MIMES = [
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTS = ['.csv', '.txt', '.xls', '.xlsx', '.pdf', '.docx'];
const MAX_BYTES = 25 * 1024 * 1024;

const TABULAR_EXTS = ['.csv', '.txt', '.xls', '.xlsx'];
const DOCUMENT_EXTS = ['.pdf', '.docx'];

export function validateFile(file: { size: number; originalname: string; mimetype: string }) {
  if (!file) throw new Error('No file uploaded.');
  if (file.size > MAX_BYTES)
    throw new Error(`File exceeds 25 MB limit. Got ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
  const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext))
    throw new Error(`Unsupported file type: ${ext}. Allowed: .csv, .txt, .xls, .xlsx, .pdf, .docx`);
  const fileType = TABULAR_EXTS.includes(ext) ? 'tabular' : 'document';
  return { valid: true, ext, mime: file.mimetype, fileType };
}
