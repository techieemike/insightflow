const {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, Packer, WidthType, ShadingType,
  BorderStyle, PageBreak, TabStopType, TabStopPosition,
  Footer, Header, PageNumber, NumberFormat,
  convertInchesToTwip, TableOfContents, LevelFormat,
  Level, LevelSuffix, ExternalHyperlink, UnderlineType,
} = require('docx');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.resolve(__dirname, '../../../InsightFlow_AI_Complete_Guide.docx');
const ACCENT = '7C3AED';
const ACCENT_LIGHT = 'EDE9FE';
const GRAY_BG = 'F3F4F6';
const WHITE = 'FFFFFF';
const DARK = '1F2937';

// ── Helpers ──

function p(children, opts = {}) {
  const runs = Array.isArray(children) ? children : [children];
  const cfg = {};
  if (opts.heading) cfg.heading = opts.heading;
  if (opts.alignment) cfg.alignment = opts.alignment;
  if (opts.spacing) cfg.spacing = opts.spacing;
  if (opts.indent) cfg.indent = opts.indent;
  if (opts.bullet) cfg.bullet = { level: 0 };
  if (opts.numbering) cfg.numbering = opts.numbering;
  return new Paragraph({ ...cfg, spacing: { after: opts.after || 120, ...(opts.spacing || {}) }, children: runs });
}

function tr(text, opts = {}) {
  return new TextRun({ text, font: opts.font || 'Calibri', size: opts.size || 22, bold: opts.bold || false, italics: opts.italics || false, color: opts.color || DARK, ...opts });
}

function heading(text, level) {
  const sizes = { 1: 36, 2: 30, 3: 26, 4: 24 };
  return p([tr(text, { bold: true, size: sizes[level] || 24, color: ACCENT })], { heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4 });
}

function h1(t) { return heading(t, 1); }
function h2(t) { return heading(t, 2); }
function h3(t) { return heading(t, 3); }
function h4(t) { return heading(t, 4); }

function body(text, opts = {}) {
  return p([tr(text, { size: 22, ...opts })], { spacing: { after: 120 }, ...opts });
}

function bodyBold(text, opts = {}) {
  return p([tr(text, { size: 22, bold: true, ...opts })], { spacing: { after: 80 } });
}

function codeBlock(text) {
  const lines = text.split('\n');
  return lines.map(line =>
    p([tr(line, { font: 'Consolas', size: 20, color: '1F2937' })], { spacing: { after: 0, before: 0 } })
  );
}

function boldBody(prefix, text) {
  return p([
    tr(prefix, { bold: true, size: 22 }),
    tr(text, { size: 22 }),
  ]);
}

function bullet(text, indent = 0) {
  return p([tr(text, { size: 22 })], { bullet: true, indent: { left: indent * 360 + 360 } });
}

function spacer(after = 200) {
  return p([tr('', { size: 1, color: WHITE })], { spacing: { after } });
}

function cell(children, opts = {}) {
  const paras = Array.isArray(children) ? children : [children];
  return new TableCell({
    children: paras,
    verticalAlign: 'center',
    ...opts,
    ...(opts.shading ? { shading: { type: ShadingType.CLEAR, fill: opts.shading, color: opts.shading } } : {}),
  });
}

function headerCell(text, width) {
  return cell([p([tr(text, { bold: true, color: WHITE, size: 22 })])], { shading: ACCENT, width: { size: width, type: WidthType.PERCENTAGE } });
}

function dataCell(text, width, opts = {}) {
  return cell([p([tr(text, { size: 22, ...opts })])], { width: { size: width, type: WidthType.PERCENTAGE } });
}

function makeTable(columns, rows) {
  const widths = columns.map(c => c.width);
  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map((c, i) => headerCell(c.label, widths[i])),
  });
  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cellText, ci) => dataCell(String(cellText), widths[ci], { color: DARK })),
      ...(ri % 2 === 1 ? {} : {}),
    })
  );
  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function hdr(t) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [tr(t, { bold: true, size: 48, color: ACCENT })],
    spacing: { after: 200 },
  });
}

function subhdr(t) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [tr(t, { size: 28, color: DARK })],
    spacing: { after: 400 },
  });
}

function sectionTitle(t) {
  return p([tr(t, { bold: true, size: 36, color: ACCENT })], { spacing: { before: 600, after: 300 } });
}

function noteBox(items) {
  const noteTitle = new Paragraph({
    children: [tr('📝 NOTE', { bold: true, size: 22, color: ACCENT })],
    spacing: { after: 80 },
  });
  const noteItems = items.map(i => p([tr(`▸ ${i}`, { size: 22, color: DARK })], { spacing: { after: 60 } }));
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [noteTitle, ...noteItems],
            shading: { type: ShadingType.CLEAR, fill: ACCENT_LIGHT, color: ACCENT_LIGHT },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function tipBox(items) {
  const tipTitle = new Paragraph({
    children: [tr('💡 TIP', { bold: true, size: 22, color: ACCENT })],
    spacing: { after: 80 },
  });
  const tipItems = items.map(i => p([tr(`▸ ${i}`, { size: 22, color: DARK })], { spacing: { after: 60 } }));
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [tipTitle, ...tipItems],
            shading: { type: ShadingType.CLEAR, fill: GRAY_BG, color: GRAY_BG },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function warningBox(items) {
  const wTitle = new Paragraph({
    children: [tr('⚠️ WARNING', { bold: true, size: 22, color: 'DC2626' })],
    spacing: { after: 80 },
  });
  const wItems = items.map(i => p([tr(`▸ ${i}`, { size: 22, color: DARK })], { spacing: { after: 60 } }));
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [wTitle, ...wItems],
            shading: { type: ShadingType.CLEAR, fill: 'FEF2F2', color: 'FEF2F2' },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function spacedHeading(text, level, spacing = 400) {
  const h = heading(text, level);
  h.spacing = { before: spacing, after: 200 };
  return h;
}

// ── DATA: Coding Q&A ──

const codingQA = [
  {
    category: '1. Project Setup & Initialisation',
    questions: [
      { q: 'How do I create a new Next.js project for InsightFlow?', a: 'Run `pnpm create next-app@latest apps/web --typescript --tailwind --eslint`. The root uses pnpm workspaces with `pnpm-workspace.yaml` pointing to `apps/*`.' },
      { q: 'How do I initialise a pnpm workspace?', a: 'Create `pnpm-workspace.yaml` at the root with content: `packages:\n  - "apps/*"`. Then run `pnpm install`.' },
      { q: 'What does `pnpm-workspace.yaml` look like?', a: "```yaml\npackages:\n  - 'apps/*'\n```\nThis tells pnpm that all subdirectories under `apps/` are workspace packages." },
      { q: 'How do I install a package in the workspace?', a: 'Run `pnpm add <package> --filter apps/web`. For dev deps: `pnpm add -D <package> --filter apps/web`.\n\nExample: `pnpm add @google/generative-ai --filter apps/web`' },
      { q: 'How do I add Prisma to the project?', a: 'Run `pnpm add prisma @prisma/client --filter apps/web`, then `cd apps/web && npx prisma init`. This creates `prisma/schema.prisma` and a `.env` file with `DATABASE_URL`.' },
      { q: 'What is the purpose of `next.config.ts`?', a: 'It configures Next.js behaviour. For InsightFlow, it includes `serverExternalPackages: ["mammoth", "pdf-parse", "docx", "sharp"]` so these native packages work in serverless functions.' },
      { q: 'What is the purpose of `tailwind.config.ts`?', a: 'It configures Tailwind CSS with custom colours, fonts, and purge paths. InsightFlow uses custom purple accents (`--primary: #7C3AED`).' },
      { q: 'How do I set up TypeScript path aliases?', a: 'In `tsconfig.json`, add:\n```json\n{\n  "compilerOptions": {\n    "paths": {\n      "@/*": ["./src/*"]\n    }\n  }\n}\n```' },
      { q: 'What is the root `.gitignore` supposed to contain?', a: '```\nnode_modules\n.next\n.env\n.env.local\n*.xlsx\n.prisma\n.vercel\ndist\ncoverage\n```' },
      { q: 'Why use pnpm instead of npm or yarn?', a: 'pnpm is faster, uses hard links to save disk space, has strict dependency isolation, and supports workspaces natively. It is the recommended package manager for Vercel deployments.' },
      { q: 'How do I verify the project builds correctly?', a: 'Run `pnpm build` (which runs `prisma generate && next build --webpack`). The `--webpack` flag avoids Turbopack issues with native packages like sharp.' },
      { q: 'What is `postcss.config.js` for?', a: 'It configures PostCSS with Tailwind CSS and autoprefixer plugins. It tells PostCSS how to process the CSS in your project.' },
      { q: 'How do I add environment variables?', a: 'Create `.env.local` in `apps/web/` (not tracked by git). Add variables like `DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET`. For deployment, set these in Vercel dashboard.' },
      { q: 'How do I configure ESLint for the project?', a: 'ESLint is bundled with Next.js. The config file is `eslint.config.js` (or `.eslintrc.json` in older versions). Customise rules in there.' },
    ],
  },
  {
    category: '2. Git & GitHub',
    questions: [
      { q: 'How do I initialise a Git repository?', a: 'Run `git init` in the project root. This creates a `.git` directory tracking all changes.' },
      { q: 'How do I stage all files for the first commit?', a: 'Run `git add -A`. This stages all files except those listed in `.gitignore`.' },
      { q: 'How do I create the first commit?', a: 'Run `git commit -m "Initial commit: InsightFlow AI project"`.' },
      { q: 'How do I connect the local repo to GitHub?', a: '```bash\ngit remote add origin https://github.com/yourusername/insightflow.git\ngit branch -M main\ngit push -u origin main\n```' },
      { q: 'What if my GitHub push fails with "non-fast-forward"?', a: 'Pull first: `git pull origin main --rebase`. Resolve any conflicts, then `git push`.' },
      { q: 'How do I undo the last commit (keep changes)?', a: 'Run `git reset --soft HEAD~1`. This undoes the commit but keeps your files staged.' },
      { q: 'How do I undo the last commit (discard changes)?', a: 'Run `git reset --hard HEAD~1`. This permanently removes the last commit and its changes. Use with caution.' },
      { q: 'How do I revert a specific file to its previous state?', a: 'Run `git checkout -- <file>` to discard unstaged changes. For a specific commit: `git checkout <commit-hash> -- <file>`.' },
      { q: 'How do I check what has changed?', a: '`git status` shows modified/staged files. `git diff` shows unstaged changes. `git diff --staged` shows staged changes (what will be committed).' },
      { q: 'How do I see the commit history?', a: '`git log --oneline -10` shows the last 10 commits in a compact format. `git log --graph --oneline --all` shows a visual branch graph.' },
      { q: 'How do I create a new branch?', a: '`git checkout -b feature/my-feature` creates and switches to a new branch. Or `git branch feature/my-feature` plus `git checkout feature/my-feature` in two steps.' },
      { q: 'How do I merge a branch into main?', a: '```bash\ngit checkout main\ngit pull origin main\ngit merge feature/my-feature\ngit push origin main\n```' },
      { q: 'How do I resolve merge conflicts?', a: 'Git marks conflicted files. Open them, look for `<<<<<<<`, `=======`, `>>>>>>>` markers, edit to keep the correct code, remove the markers, then `git add` the file and `git commit`.' },
      { q: 'What is `.gitkeep` and when to use it?', a: 'Git tracks files, not folders. To keep an empty directory in version control, add a `.gitkeep` file (any name works but `.gitkeep` is conventional).' },
      { q: 'Why is `.env.local` in `.gitignore`?', a: 'Environment variables contain secrets (database passwords, API keys, JWT secrets). Pushing them to GitHub would leak credentials. Each developer/deployment has its own `.env.local`.' },
      { q: 'How do I clone the repo on a new machine?', a: '```bash\ngit clone https://github.com/yourusername/insightflow.git\ncd insightflow\npnpm install\n```\nThen create `.env.local` with your own values.' },
      { q: 'How do I update my local repo with remote changes?', a: '`git pull origin main` fetches and merges. `git fetch origin` then `git merge origin/main` does the same in two steps (safer).' },
      { q: 'How do I delete a branch locally and remotely?', a: 'Local: `git branch -d feature/my-feature`. Remote: `git push origin --delete feature/my-feature`.' },
      { q: 'How do I stash uncommitted changes?', a: '`git stash` saves and cleans. `git stash pop` restores them. `git stash list` shows all stashes. Useful when you need to switch branches mid-work.' },
      { q: 'What is a good commit message format?', a: 'Use the conventional commits format: `<type>(<scope>): <description>`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`. Example: `feat(upload): add two-column upload layout`.' },
    ],
  },
  {
    category: '3. Database (Prisma + Supabase)',
    questions: [
      { q: 'What does the Prisma schema look like?', a: 'The schema has 5 models: `User` (id, email, password, createdAt), `Dataset` (id, name, type, content, columns, data, summary, timelineData, userId, createdAt), `DataRecord` (id, datasetId, record, createdAt), `DocumentChunk` (id, datasetId, content, embedding, createdAt), and `ChatMessage` (id, datasetId, role, content, createdAt).' },
      { q: 'How do I update the database schema?', a: 'Edit `prisma/schema.prisma`, then run `npx prisma db push` to sync the schema with the database (no migration files needed). For production: `npx prisma migrate dev --name description`.' },
      { q: 'How do I create a new model in Prisma?', a: 'Add a model block to `schema.prisma`, define its fields with types and relations, then run `prisma db push`.' },
      { q: 'What is the difference between `prisma db push` and `prisma migrate`?', a: '`db push` syncs the schema directly (no migration files, good for development). `migrate` creates versioned SQL files for controlled, reversible changes (good for production).' },
      { q: 'How do I connect to Supabase from Prisma?', a: 'Set `DATABASE_URL` in `.env.local` to the Supabase session pooler string:\n```\nDATABASE_URL="postgresql://postgres.octopetbkyblqdjsoutj:Uniporthome111@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"\n```' },
      { q: 'What is the Supabase session pooler?', a: 'The pooler (`pooler.supabase.com`) manages a pool of database connections. It is more reliable for serverless functions (Vercel) because it handles connection limits gracefully.' },
      { q: 'How do I create a Supabase project?', a: 'Go to `supabase.com`, sign in, click "New project", enter details (name, database password, region), and wait for provisioning (~2 minutes).' },
      { q: 'How do I get the connection string from Supabase?', a: 'In Supabase dashboard, go to Project Settings → Database → Connection string. Select "Session pooler" mode, copy the URI, and replace `[YOUR-PASSWORD]` with your database password.' },
      { q: 'What if the Supabase project is unhealthy?', a: 'Check Supabase dashboard status. If "PAUSED", click "Restore" to unpause. Free-tier projects auto-pause after 7 days of inactivity. If unhealthy for other reasons, check the database logs.' },
      { q: 'How do I reset the Supabase database password?', a: 'In Supabase dashboard: Project Settings → Database → Reset database password. Update the password in `.env.local` and Vercel environment variables afterwards.' },
      { q: 'How do I view my database tables in Supabase?', a: 'Go to Supabase dashboard → Table Editor. You\'ll see all tables created by Prisma. You can browse, filter, insert, and edit data from the UI.' },
      { q: 'How do I run SQL queries directly in Supabase?', a: 'Go to Supabase dashboard → SQL Editor. You can run raw SQL commands, which is useful for debugging or bulk operations.' },
      { q: 'What is the difference between session pooler and direct connection?', a: 'Session pooler (port 5432) uses `postgres.octopetbkyblqdjsoutj` as username and handles connection pooling. Direct connection (port 6543) connects directly to the database but requires `postgres` as user. Pooler is recommended for serverless.' },
    ],
  },
  {
    category: '4. Authentication',
    questions: [
      { q: 'How does authentication work in InsightFlow?', a: 'It uses JWT tokens stored in `localStorage`. The `AuthContext` manages state globally. Login/register endpoints return the token + user data. A timeout fallback (8 seconds) prevents infinite loading if Supabase is unreachable.' },
      { q: 'How is the JWT token created?', a: 'In `apps/web/src/app/api/auth/login/route.ts` (and register), after validating credentials, a JWT is signed with `jsonwebtoken` using the `JWT_SECRET` env var. The token contains `{ userId, email }` and expires in 7 days.' },
      { q: 'How is the JWT token verified on each request?', a: 'The `AuthContext` stores the token in localStorage. On page load, it reads the token, decodes it, and fetches `/api/auth/me` to validate it server-side. If invalid/expired, the user is redirected to login.' },
      { q: 'How does the login page work?', a: '`apps/web/src/app/login/page.tsx` has a form with email, password (with show/hide toggle), login button, and a toggle to switch to register mode. On submit, it calls the API and redirects to `/dashboard` on success.' },
      { q: 'How does the password show/hide toggle work?', a: 'A state variable `showPassword` toggles the input `type` between `"password"` and `"text"`. An eye icon button (👁/🙈) next to the field controls it.' },
      { q: 'What happens when the AuthContext times out?', a: 'After 8 seconds without a response from `/api/auth/me`, the context sets `loading = false` and `user = null`, redirecting the user to the login page instead of showing an infinite spinner.' },
      { q: 'What is the password policy?', a: 'Passwords must be alphanumeric (letters and numbers only, no special characters). This is validated both client-side and server-side.' },
      { q: 'How are passwords stored in the database?', a: 'Passwords are hashed with `bcryptjs` before storage. The hash (not the plaintext) is stored in the `password` field of the `User` model.' },
    ],
  },
  {
    category: '5. File Upload & Processing',
    questions: [
      { q: 'How does the file upload work?', a: 'The upload has a two-step flow: (1) Drag-and-drop or click to select a file in the dropzone. (2) Confirm the upload, which sends the file to `/api/upload` and processes it server-side (parsing, AI analysis, embeddings for documents).' },
      { q: 'What file types are supported?', a: 'Tabular files: CSV, XLSX, XLS, TSV. Document files: PDF, DOCX, TXT. Files are validated by extension and MIME type before upload.' },
      { q: 'How does the upload UI work?', a: 'The dashboard has two columns: "Tabular Data" (CSV, Excel) on the left and "Documents" (PDF, DOCX, TXT) on the right. Each column has its own dropzone and state via the reusable `UploadColumn` component.' },
      { q: 'How are uploaded files processed on the server?', a: 'The `/api/upload` route: (1) Parses the file (CSV/Tabular → array of records, Document → text). (2) Creates a `Dataset` entry. (3) For tabular: generates insights, charts, and stores records. (4) For documents: generates a summary + chunks the text + creates embeddings.' },
      { q: 'How are PDFs parsed?', a: 'Using `pdf-parse` library. The file buffer is passed to `pdf-parse`, which extracts text content. Encoding issues are handled with `latin1` decoding fallback.' },
      { q: 'How are DOCX files parsed?', a: 'Using `mammoth` library with `convertToHtml({ buffer })`. The HTML result is stripped of tags to get plain text.' },
      { q: 'What happens after a document is parsed?', a: 'The text is stored in `Dataset.content`. Then: (1) A summary is generated via `generateDocumentSummary()`. (2) The text is chunked (500 characters with 100 overlap) and embeddings are created via Google Gemini `text-embedding-004`.' },
      { q: 'How are tabular files parsed?', a: 'CSV files are parsed with `csv-parse/sync`. Excel files (XLSX/XLS) are parsed with `xlsx` library using `read(buf, { type: "buffer" })` and converting each sheet to JSON.' },
      { q: 'What happens after a tabular file is parsed?', a: 'Records are stored in `DataRecord` table. AI insights are generated from the data. Summary statistics, timeline data, and chart configurations are computed and stored in the Dataset model.' },
      { q: 'How do I limit file size?', a: 'Vercel serverless has a 4.5 MB body limit. Add file size validation before parse: check `file.size` and reject files over a threshold (e.g., 4 MB) with a friendly error message.' },
    ],
  },
  {
    category: '6. AI & RAG (Chat)',
    questions: [
      { q: 'How is Gemini AI integrated?', a: 'Using the `@google/generative-ai` SDK. The `GEMINI_API_KEY` env var is used to initialise `GoogleGenerativeAI`. Models used: `gemini-2.0-flash` (primary), `gemini-1.5-flash`, `gemini-1.5-pro` (fallbacks).' },
      { q: 'What happens when Gemini returns a 429 (rate-limited)?', a: 'A retry chain fires: 3 models × 3 attempts each with 2-second exponential backoff between retries. If all fail, it falls back to rule-based responses.' },
      { q: 'How does the fallback chain work?', a: 'The system cycles through `["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]`. For each model, it tries up to 3 times with `delay * 2^attempt` backoff. If a model succeeds, it returns immediately. If all fail, it uses pre-written rule-based responses.' },
      { q: 'How does RAG work for document Q&A?', a: '(1) The document text is chunked into 500-char segments with 100-char overlap. (2) Each chunk gets an embedding vector via `text-embedding-004`. (3) User question is also embedded. (4) Cosine similarity finds the 3 most relevant chunks. (5) Chunks + question are sent to Gemini for a contextual answer.' },
      { q: 'What if the embedding API fails?', a: 'It falls back to keyword matching: chunks containing the most keyword matches from the user\'s question are retrieved. If even keyword matching fails, a generic response is returned.' },
      { q: 'How is the chat prompt structured?', a: 'The prompt asks Gemini to respond with bullet points, numbered lists, and line breaks for readability. For RAG, the prompt includes the retrieved chunks as context before the user\'s question.' },
      { q: 'How are chat messages rendered?', a: 'Using `react-markdown` with `remark-gfm` plugin. Messages are styled with purple accent (#7C3AED) for the assistant, and a secondary colour for the user. Tables, code blocks, lists, and bold/italic text are supported.' },
      { q: 'How is the chat context managed?', a: 'ChatContext provides global state. ChatSection uses it to load messages for the selected dataset, sends new messages to the API, and displays responses with markdown rendering.' },
      { q: 'How are suggested questions generated?', a: 'For documents, predefined questions relate to summarisation and content extraction (e.g., "Summarise this document", "What are the key points?"). For tabular data, questions relate to data analysis (e.g., "What are the top values?", "Show me trends").' },
      { q: 'What is the embedding model used?', a: '`text-embedding-004` via the Google Generative AI SDK. It produces 768-dimensional vectors suitable for semantic similarity search.' },
    ],
  },
  {
    category: '7. Insights & Charts',
    questions: [
      { q: 'How are AI insights generated for tabular data?', a: 'After upload, the dataset is analysed. Key columns and rows are identified. A Gemini prompt asks for: data summary, top/bottom performers, trends, and outlier detection. The response is stored in `Dataset.summary`.' },
      { q: 'How are AI insights generated for documents?', a: 'The `generateDocumentSummary()` function sends document text to Gemini with a prompt asking for: overall summary, key points (bullet list), word count, and estimated reading time. If Gemini fails, a rule-based summary returns the first 500 characters.' },
      { q: 'How are charts generated?', a: 'Chart configurations are computed client-side using the dataset\'s `columns` and `data` fields. Bar charts show top values. Line charts show trends over time. Tables show raw data with search.' },
      { q: 'What chart libraries are used?', a: 'Charts are rendered with `recharts` (React charting library). SVG charts are used, which can be converted to PNG for Word export.' },
      { q: 'How is the insights page organised?', a: 'The Insights tab has two views: Tabular (charts, stat cards, AI analysis breakdowns) and Document (summary card, key points, word count, read time, content preview, export buttons).' },
      { q: 'How are chart SVGs converted to PNG for Word export?', a: 'The SVG string is rendered to PNG using `sharp` (Buffer via `sharp(Buffer.from(svg)).png().toBuffer()`). The PNG buffer is then embedded in the Word document via `ImageRun`.' },
    ],
  },
  {
    category: '8. Export (CSV, Excel, Word)',
    questions: [
      { q: 'How does CSV export work?', a: 'The `/api/export/[id]/csv` route retrieves the dataset and its records, converts them to CSV format using the `csv-stringify` library, and returns the file with `Content-Type: text/csv` headers.' },
      { q: 'How does Excel export work?', a: 'The `/api/export/[id]/excel` route uses the `xlsx` library to create a workbook from the dataset records. It creates a worksheet, adds headers and data, and writes the buffer as the response.' },
      { q: 'How does Word export work?', a: 'The `/api/export/[id]/word` route uses the `docx` library. It creates a Word document with: (1) a dataset overview table, (2) AI insights section, (3) chart images (SVG→sharp PNG→ImageRun in docx table), (4) a top performers table.' },
      { q: 'How are chart images embedded in the Word document?', a: 'Chart SVGs are converted to PNG buffers via `sharp`. The PNG buffer is then embedded using the `docx` library\'s `ImageRun` class with `{ type: ImageRun, data: pngBuffer, transformation: { width, height } }`.' },
      { q: 'Where is the Word export button?', a: 'On the Insights page for both tabular and document datasets, and on the document detail view in the My Data tab.' },
      { q: 'Can I add new export formats?', a: 'Yes. Create a new route at `/api/export/[id]/<format>/route.ts`, implement the conversion logic, and add the download button in the frontend. The pattern follows the existing CSV/Excel/Word routes.' },
    ],
  },
  {
    category: '9. Dashboard & UI',
    questions: [
      { q: 'How is the dashboard layout structured?', a: 'The dashboard has a collapsible sidebar with 5 tabs: Upload, My Data, Insights, Query, Chat. Content area shows the selected tab. On mobile, the sidebar becomes a hamburger slide-out drawer.' },
      { q: 'How does the sidebar work?', a: '`Sidebar` component with `navItems` array. Active tab is highlighted with purple background. On mobile (`useMediaQuery` hook), a hamburger button toggles a slide-out drawer with overlay.' },
      { q: 'How does responsive design work?', a: 'Tailwind breakpoints are used: `sm:` (640px+), `md:` (768px+), `lg:` (1024px+). The sidebar collapses to a drawer below `md`. Content padding adjusts: `p-4 md:p-8`. Chat bubbles: `max-w-[90%] sm:max-w-xl`.' },
      { q: 'How is the Upload tab organised?', a: 'Two-column layout: left column for Tabular Data, right column for Documents. Each column has an `UploadColumn` component with independent state (drag-over, file selected, uploading, result).' },
      { q: 'How is the My Data tab organised?', a: 'Filterable list with two tabs: "Tabular" and "Documents". Each dataset shows name, type icon, upload date. Clicking opens detail view: for tabular (data table with search) or for documents (AI summary + text preview).' },
      { q: 'How is the Chat tab organised?', a: 'A dropdown to select the active dataset (showing name + type indicator). Messages display in a scrollable container. Input box at the bottom. Document-specific suggested question buttons above the input.' },
      { q: 'How is the Query tab organised?', a: 'A SQL editor textarea where users type queries. A "Run Query" button executes the query against the dataset. Results display in a table below. Error messages show for invalid queries.' },
      { q: 'How does the standalone chat page work?', a: '`/chat/[id]` loads a specific chat session with a full-width chat interface. It uses the same ChatSection component but without the dashboard sidebar. Mobile responsive with proper padding.' },
      { q: 'How does the standalone dashboard detail page work?', a: '`/dashboard/[id]` shows a full-page view of a dataset\'s details (insights, data table, chat). Mobile responsive. Uses the same components as the dashboard tabs.' },
      { q: 'How is the "Loading..." state handled?', a: 'A loading spinner (animated circle) and "Loading..." text are shown during data fetches. The AuthContext has an 8-second timeout to prevent infinite loading when the database is unreachable.' },
      { q: 'How are errors displayed to the user?', a: 'Error messages appear as red text below the relevant section. API errors are caught and displayed. Network errors show "Failed to connect to server" messages.' },
    ],
  },
  {
    category: '10. Vercel Deployment',
    questions: [
      { q: 'How do I deploy InsightFlow to Vercel?', a: '(1) Push to GitHub. (2) Go to vercel.com → Add New Project → Import GitHub repo. (3) Set Framework to Next.js. (4) Set root directory (if needed, in Settings → General). (5) Add environment variables. (6) Deploy.' },
      { q: 'What environment variables are needed on Vercel?', a: '`DATABASE_URL` (Supabase session pooler string), `GEMINI_API_KEY` (Google AI API key), `JWT_SECRET` (any random string for signing tokens).' },
      { q: 'Why does the build use `--webpack`?', a: 'Turbopack (Vercel\'s default bundler) cannot resolve native packages like `sharp`, `docx`, `mammoth`, `pdf-parse`. The `--webpack` flag forces Next.js to use webpack, which handles native packages correctly.' },
      { q: 'How do I set the root directory in Vercel?', a: 'In Vercel dashboard → Project → Settings → General → Root Directory. Since the Next.js app is in `apps/web/`, set it to `apps/web` here, NOT in `vercel.json` (the property doesn\'t exist there).' },
      { q: 'How do I check Vercel build logs?', a: 'In Vercel dashboard → Deployments → Click the deployment → "View logs". Build errors show here. Common issues: missing env vars, build command failures, native module build errors.' },
      { q: 'How do I redeploy after a git push?', a: 'Vercel auto-deploys on every push to the connected branch. To manually trigger: Vercel dashboard → Deployments → "Redeploy" button. Or push a new commit to GitHub.' },
      { q: 'Why did my build fail on Vercel?', a: 'Common causes: (1) Missing env vars → Add them in Settings. (2) Native package build errors → Add to `pnpm.onlyBuiltDependencies` in `package.json`. (3) TypeScript errors → Fix locally and push. (4) Prisma not generated → Build command needs `prisma generate`.' },
      { q: 'What build commands are configured?', a: 'In `vercel.json`: `"buildCommand": "pnpm build"`. In `package.json`: `"build": "prisma generate && next build --webpack"`. The `prisma generate` step creates the Prisma client before the Next.js build.' },
      { q: 'How do I connect a custom domain on Vercel?', a: 'Vercel dashboard → Project → Settings → Domains → Add your domain. Follow the DNS configuration instructions (add CNAME record pointing to `cname.vercel-dns.com`).' },
      { q: 'Can I preview deployments before production?', a: 'Yes. Vercel creates preview deployments for every PR/push to non-main branches. Each preview gets a unique URL. Enable "Preview" in the deployment settings.' },
      { q: 'What is the Vercel serverless function timeout?', a: 'Vercel Hobby plan: 10 seconds for serverless functions. Pro plan: 60 seconds (configurable up to 900s). If your function (e.g., file parsing + AI analysis) exceeds the limit, consider splitting work or upgrading.' },
      { q: 'How do I configure the Node.js version on Vercel?', a: 'Vercel auto-detects the Node.js version from `.nvmrc` or `engines` in `package.json`. If not specified, it uses the default (currently Node 18.x or 20.x).' },
    ],
  },
];

// ── DATA: Statement Q&A ──

const statementQA = [
  {
    category: 'Git & GitHub',
    items: [
      { s: '`git add -A` stages all changes including untracked files.', t: true, e: 'Yes, `git add -A` (or `git add --all`) stages all changes (modified, deleted, and new untracked files) in the entire working tree.' },
      { s: '`.env.local` should be committed to GitHub.', t: false, e: 'No, `.env.local` contains sensitive credentials. It is listed in `.gitignore` and must never be pushed to GitHub.' },
      { s: 'The `.gitignore` file is pushed to GitHub.', t: true, e: 'Yes, `.gitignore` itself is tracked by git (it is a project config file) and should be pushed to share ignore rules with the team.' },
      { s: '`git pull` is equivalent to `git fetch` followed by `git merge`.', t: true, e: 'Correct. `git pull = git fetch + git merge`. `git fetch` downloads changes without merging them.' },
      { s: 'You need to run `git add` before every `git commit`.', t: true, e: 'Yes, changes must be staged with `git add` before committing. The only exception is `git commit -a` which auto-stages tracked files.' },
      { s: '`git reset --hard HEAD~1` can permanently delete your work.', t: true, e: 'True. This command discards all uncommitted changes AND the last commit. If you haven\'t pushed, those changes cannot be recovered easily.' },
      { s: 'A merge conflict means your repository is corrupted.', t: false, e: 'No, merge conflicts are normal when two branches modify the same file. Git pauses the merge and asks you to resolve the conflict manually.' },
      { s: '`git stash` temporarily saves uncommitted changes.', t: true, e: 'Yes, `git stash` saves working directory changes to a stack so you can work on something else, then restore them with `git stash pop`.' },
      { s: 'You must fork a repo to contribute on GitHub.', t: false, e: 'Not necessarily. Team members with write access can push branches directly. Forking is for external contributors who don\'t have access.' },
      { s: '`git log --oneline` shows a one-line summary per commit.', t: true, e: 'Yes, it shows just the abbreviated commit hash and the first line of the commit message for each commit.' },
    ],
  },
  {
    category: 'Supabase',
    items: [
      { s: 'Supabase free-tier projects auto-pause after 7 days of inactivity.', t: true, e: 'True. Free-tier Supabase projects pause after 7 days without API requests. To unpause, click "Restore" in the dashboard.' },
      { s: 'The Supabase direct connection uses port 5432.', t: false, e: 'False. The session pooler uses port 5432. The direct connection uses port 6543.' },
      { s: 'Supabase provides a built-in SQL editor in the dashboard.', t: true, e: 'Yes, Supabase has a SQL Editor (in the sidebar) where you can run raw SQL queries against your database.' },
      { s: 'You can browse database tables from the Supabase dashboard.', t: true, e: 'True. The Table Editor in Supabase lets you view, filter, insert, and edit data directly from the UI.' },
      { s: 'Supabase only supports PostgreSQL.', t: true, e: 'True. Supabase is built on PostgreSQL. It adds auth, real-time, storage, and edge functions on top of a PostgreSQL database.' },
      { s: 'A paused Supabase project still serves API requests.', t: false, e: 'False. A paused project is completely inactive. All API requests fail until the project is restored.' },
      { s: 'The session pooler connection string has a different username format.', t: true, e: 'True. Session pooler uses `postgres.<project-ref>` as the username, while direct connection uses just `postgres`.' },
      { s: 'Supabase connection pooler manages connection limits for serverless functions.', t: true, e: 'True. The pooler queues and manages connections, preventing the "too many connections" error common with serverless functions.' },
      { s: 'You can create multiple Supabase projects under one account.', t: true, e: 'True. Free tier allows up to 2 projects. Pro and Team plans allow more.' },
      { s: 'Supabase auto-generates GraphQL APIs.', t: false, e: 'False. Supabase provides REST APIs via PostgREST. GraphQL is not built-in (though you can use pg_graphql or a third-party service).' },
    ],
  },
  {
    category: 'Vercel',
    items: [
      { s: 'Vercel auto-deploys on every git push to the connected branch.', t: true, e: 'True. Vercel watches the connected git repository and automatically deploys when changes are pushed to the production branch.' },
      { s: 'Environment variables are set in `.env.local` for Vercel deployments.', t: false, e: 'No. Environment variables for Vercel are set in the Vercel dashboard (Project → Settings → Environment Variables). `.env.local` is only for local development.' },
      { s: 'Preview deployments are automatically created for pull requests.', t: true, e: 'Yes, Vercel creates a unique preview URL for every PR, allowing testing before merging.' },
      { s: 'Vercel\'s Hobby plan has a 10-second serverless function timeout.', t: true, e: 'True. Functions on the Hobby plan time out after 10 seconds. Pro plan allows up to 60 seconds (configurable up to 900s).' },
      { s: 'Custom domains can only be added on the Pro plan.', t: false, e: 'No, custom domains are available on the Hobby plan too. You can connect any domain you own.' },
      { s: 'Build logs help diagnose deployment failures.', t: true, e: 'True. Build logs show exactly what failed during the build/deploy process, including TypeScript errors, missing packages, and misconfigurations.' },
      { s: 'Turbopack is the default bundler for Next.js on Vercel.', t: true, e: 'True. Vercel uses Turbopack by default. For InsightFlow, we override this with `--webpack` due to native package compatibility issues.' },
      { s: 'You can roll back a Vercel deployment to a previous version.', t: true, e: 'Yes. In the dashboard, select a previous deployment and click "Redeploy". You can also promote a preview deployment to production.' },
      { s: 'Vercel automatically provisions a PostgreSQL database.', t: false, e: 'No, Vercel is a frontend/edge platform. It does not provide databases. InsightFlow uses Supabase for PostgreSQL.' },
      { s: 'The `vercel.json` file must be at the repository root.', t: true, e: 'True. `vercel.json` (if used) should be at the root of the repository, not inside the app directory. It configures build settings, rewrites, headers, etc.' },
    ],
  },
  {
    category: 'Prisma & Database',
    items: [
      { s: 'Prisma `db push` creates migration files.', t: false, e: 'False. `prisma db push` directly syncs the schema without creating migration files. `prisma migrate dev` creates versioned migration files.' },
      { s: 'The Prisma client must be regenerated after schema changes.', t: true, e: 'True. Run `prisma generate` after changing `schema.prisma` to regenerate the Prisma client with the updated types.' },
      { s: '`prisma db push` is safe for production databases.', t: false, e: 'Not recommended for production. `prisma migrate deploy` with versioned migration files is safer for production environments.' },
      { s: 'A Prisma model name is typically singular (e.g., `User`, not `Users`).', t: true, e: 'True. Prisma convention is singular model names, which map to plural table names in PostgreSQL (Prisma auto-pluralises).' },
      { s: 'PostgreSQL is the only database supported by Prisma.', t: false, e: 'No. Prisma supports PostgreSQL, MySQL, SQLite, SQL Server, MongoDB, and CockroachDB.' },
      { s: 'Relations in Prisma are defined with `@relation` decorator.', t: true, e: 'True. Relations between models use the `@relation` attribute to specify foreign key constraints and behaviour.' },
      { s: 'Prisma Studio is a GUI for browsing database data.', t: true, e: 'True. Run `npx prisma studio` to open a browser-based GUI for viewing and editing database records.' },
      { s: 'Unique constraints in Prisma are defined with `@unique`.', t: true, e: 'Yes. The `@unique` attribute on a field creates a unique constraint in the database.' },
      { s: 'Prisma automatically creates an `id` field if you don\'t define one.', t: false, e: 'No, you must explicitly define an `id` field in each model. Prisma does not auto-generate fields.' },
      { s: '`prisma format` auto-formats your Prisma schema file.', t: true, e: 'Yes. `npx prisma format` standardises indentation, field ordering, and attribute formatting in `schema.prisma`.' },
    ],
  },
  {
    category: 'AI & Gemini',
    items: [
      { s: 'Gemini 2.0 Flash is the primary AI model used in InsightFlow.', t: true, e: 'True. `gemini-2.0-flash` is the primary model. `gemini-1.5-flash` and `gemini-1.5-pro` are fallbacks.' },
      { s: 'The Gemini API returns HTTP 429 when rate-limited.', t: true, e: 'True. A 429 status code means "Too Many Requests". InsightFlow handles this with a retry chain: 3 models × 3 attempts with exponential backoff.' },
      { s: '`text-embedding-004` produces 512-dimensional embedding vectors.', t: false, e: 'False. It produces 768-dimensional vectors.' },
      { s: 'The Gemini free tier allows 60 requests per minute.', t: true, e: 'True. Google\'s free tier for Gemini API allows 60 requests per minute (RPM). Exceeding this triggers 429 errors.' },
      { s: 'Gemini API requires an API key from Google AI Studio.', t: true, e: 'True. Get the key from `makersuite.google.com/app/apikey`. Set it as `GEMINI_API_KEY` environment variable.' },
      { s: 'RAG stands for "Retrieval-Augmented Generation".', t: true, e: 'Correct. RAG retrieves relevant document chunks and passes them as context to the LLM for more accurate, grounded answers.' },
      { s: 'Cosine similarity measures how different two vectors are.', t: false, e: 'False. Cosine similarity measures how SIMILAR two vectors are (range: -1 to 1, where 1 = identical direction).' },
      { s: 'Chunking text improves RAG retrieval accuracy.', t: true, e: 'True. Smaller, meaningful chunks (500 chars) with overlap (100 chars) allow the retriever to find precisely relevant context.' },
      { s: 'The embedding model is called only once per API request.', t: false, e: 'No, for each user question, the embedding model is called to embed the question, then again to compare with stored document chunk embeddings.' },
      { s: 'Rule-based fallback returns AI-quality responses.', t: false, e: 'False. Rule-based fallback provides generic or keyword-based responses that are less intelligent than AI-generated ones. It is a last resort when the AI is unavailable.' },
    ],
  },
  {
    category: 'Frontend & UI',
    items: [
      { s: 'Tailwind CSS uses utility-first class names.', t: true, e: 'True. Tailwind provides small utility classes (like `flex`, `p-4`, `text-lg`) that you compose directly in HTML/JSX.' },
      { s: '`useEffect` in React runs synchronously after every render.', t: false, e: 'False. `useEffect` runs ASYNCHRONOUSLY after the browser paints, not synchronously. It runs after every render by default (or when dependencies change).' },
      { s: 'JSX must be returned from every React component.', t: true, e: 'Yes, React components must return JSX (or null, or another React element). The JSX defines what the component renders.' },
      { s: 'The `key` prop in React lists improves rendering performance.', t: true, e: 'True. The `key` prop helps React identify which items changed, were added, or removed, enabling efficient re-rendering.' },
      { s: 'Client components in Next.js App Router use the `"use client"` directive.', t: true, e: 'True. Any component that uses state, effects, or browser APIs must have `"use client"` at the top of the file.' },
      { s: 'Tailwind breakpoints end with `flex` suffix.', t: false, e: 'False. Tailwind breakpoints use prefixes like `sm:`, `md:`, `lg:`, `xl:`, `2xl:`. Example: `md:flex` makes an element flex on medium screens and up.' },
      { s: 'A responsive hamburger menu requires JavaScript.', t: true, e: 'Yes, a hamburger slide-out drawer needs JavaScript (or React state) to toggle visibility of the mobile menu overlay.' },
      { s: '`react-markdown` renders Markdown as React components.', t: true, e: 'True. `react-markdown` parses Markdown text and renders it as React elements. `remark-gfm` adds GitHub Flavored Markdown support (tables, strikethrough, etc.).' },
      { s: 'The `fetch` API is only available in browser environments.', t: false, e: 'False. Since Node.js 18, `fetch` is available natively in Node.js server environments, including Next.js server components and API routes.' },
      { s: 'CSS modules scope styles to a single component.', t: true, e: 'True. CSS Modules generate unique class names that prevent style conflicts between components.' },
    ],
  },
  {
    category: 'File Processing & Export',
    items: [
      { s: '`pdf-parse` extracts text content from PDF files.', t: true, e: 'True. `pdf-parse` parses PDF buffer and returns extracted text content along with metadata (page count, etc.).' },
      { s: '`mammoth` converts DOCX files to Markdown.', t: false, e: 'False. `mammoth` converts DOCX to HTML, not Markdown. The HTML output needs further processing to get plain text.' },
      { s: 'The `xlsx` library can create Excel files from data.', t: true, e: 'True. The `xlsx` library (SheetJS) can both parse and create Excel files. InsightFlow uses `xlsx.utils.json_to_sheet()` to create worksheets from data.' },
      { s: 'Sharp is used for image resizing and format conversion.', t: true, e: 'True. `sharp` is a high-performance Node.js image processing library. InsightFlow uses it to convert chart SVGs to PNGs for Word export.' },
      { s: 'CSV files cannot contain commas within a cell value.', t: false, e: 'False. CSV values containing commas must be enclosed in double quotes. Libraries like `csv-stringify` handle this automatically.' },
      { s: 'The `docx` library can embed images in Word documents.', t: true, e: 'True. `docx` supports embedding images via the `ImageRun` class with data buffers and transformation dimensions.' },
      { s: 'SVGs are vector graphic files that scale indefinitely.', t: true, e: 'True. SVG (Scalable Vector Graphics) is a vector format that does not pixelate at any resolution.' },
      { s: 'The file size limit on Vercel Hobby plan is 10 MB.', t: false, e: 'False. Vercel serverless functions have a 4.5 MB body size limit. For larger files, consider chunked uploads or a different platform.' },
      { s: 'Excel supports up to 1,048,576 rows per sheet.', t: true, e: 'True. Excel (.xlsx) format supports up to 1,048,576 rows and 16,384 columns per worksheet.' },
      { s: 'Unicode characters are supported in Excel CSV exports.', t: false, e: 'Not by default. Excel expects CSVs in the system encoding. For proper Unicode support, add a BOM (`\\uFEFF`) at the start of the CSV or use Excel format instead.' },
    ],
  },
];

// ── DATA: Phases ──

function getPhaseChildren() {
  return [
    // ── Phase 1: Project Overview ──
    h1('Phase 1: Project Overview'),
    body('InsightFlow AI is a full-stack data analytics platform that allows users to upload tabular data (CSV, Excel) and documents (PDF, DOCX, TXT), analyse them with Google Gemini AI, chat with their data using RAG (Retrieval-Augmented Generation), run SQL-like queries, and export reports in multiple formats (CSV, Excel, Word).'),
    body('The platform is built with Next.js 16 (App Router), uses Prisma v5 with Supabase PostgreSQL, and is deployed on Vercel with GitHub for version control. Google Gemini AI powers insights, summaries, and chat functionality.'),
    spacer(200),
    h2('Technology Stack'),
    makeTable(
      [{ label: 'Layer', width: 20 }, { label: 'Technology', width: 35 }, { label: 'Purpose', width: 45 }],
      [
        ['Frontend', 'Next.js 16, React 19, Tailwind CSS', 'Server-rendered UI, routing, responsive design'],
        ['Backend', 'Next.js API routes (App Router)', 'Serverless API endpoints'],
        ['Database ORM', 'Prisma v5', 'Type-safe database access, schema management'],
        ['Database', 'Supabase PostgreSQL', 'Managed cloud database with connection pooler'],
        ['AI', 'Google Gemini API', 'Insights, summaries, chat, embeddings'],
        ['File Parsing', 'pdf-parse, mammoth, xlsx, csv-parse', 'Document and spreadsheet parsing'],
        ['Export', 'docx, xlsx (SheetJS), csv-stringify', 'Word, Excel, CSV report generation'],
        ['Auth', 'JWT (jsonwebtoken), bcryptjs', 'User authentication and password hashing'],
        ['Charts', 'recharts', 'Interactive data visualisations'],
        ['Deployment', 'Vercel', 'Serverless hosting with auto-deploy from GitHub'],
      ]
    ),
    spacer(200),
    h2('Feature Summary'),
    makeTable(
      [{ label: 'Feature', width: 25 }, { label: 'Description', width: 55 }, { label: 'Status', width: 20 }],
      [
        ['File Upload', 'Two-column drag-and-drop upload for tabular + documents', 'Done'],
        ['Data Browser', 'Tabular and document views with search and filters', 'Done'],
        ['AI Insights', 'AI-generated analysis, summaries, charts, key points', 'Done'],
        ['Chat (RAG)', 'Query documents with semantic search + LLM answers', 'Done'],
        ['SQL Query', 'Run SQL-like queries against tabular datasets', 'Done'],
        ['CSV Export', 'Export datasets as CSV files', 'Done'],
        ['Excel Export', 'Export datasets as .xlsx files', 'Done'],
        ['Word Export', 'Narrative reports with AI insights and chart images', 'Done'],
        ['Auth', 'JWT-based login/register with alphanumeric passwords', 'Done'],
        ['Responsive UI', 'Mobile hamburger drawer, adaptive layouts', 'Done'],
      ]
    ),

    // ── Phase 2: Folder Structure ──
    spacer(600),
    h1('Phase 2: Complete Folder Structure'),
    body('Below is the full directory tree of the InsightFlow project. Understanding the folder structure is essential for navigating and extending the codebase.'),
    spacer(100),
    codeBlock(`insightflow/                              # Repository root
├── apps/
│   └── web/                                 # Next.js application
│       ├── prisma/
│       │   └── schema.prisma                # Database schema (5 models)
│       ├── public/
│       │   ├── favicon.ico
│       │   └── logo.svg
│       ├── scripts/
│       │   └── generate-guide.cjs           # This guide generator
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx               # Root layout (fonts, metadata)
│       │   │   ├── page.tsx                 # Landing page (redirects to login)
│       │   │   ├── globals.css              # Tailwind + custom styles
│       │   │   ├── login/
│       │   │   │   └── page.tsx             # Login/Register page
│       │   │   ├── dashboard/
│       │   │   │   ├── page.tsx             # Main dashboard (5 tabs)
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx         # Standalone dataset detail view
│       │   │   ├── chat/
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx         # Standalone chat view
│       │   │   ├── api/
│       │   │   │   ├── auth/
│       │   │   │   │   ├── login/route.ts
│       │   │   │   │   ├── register/route.ts
│       │   │   │   │   └── me/route.ts
│       │   │   │   ├── upload/route.ts
│       │   │   │   ├── datasets/
│       │   │   │   │   ├── route.ts
│       │   │   │   │   └── [id]/
│       │   │   │   │       ├── route.ts
│       │   │   │   │       ├── records/route.ts
│       │   │   │   │       ├── insights/route.ts
│       │   │   │   │       ├── chat/route.ts
│       │   │   │   │       └── export/
│       │   │   │   │           ├── csv/route.ts
│       │   │   │   │           ├── excel/route.ts
│       │   │   │   │           └── word/route.ts
│       │   │   │   └── chat/
│       │   │   │       └── [id]/
│       │   │   │           └── history/route.ts
│       │   │   ├── context/
│       │   │   │   ├── AuthContext.tsx
│       │   │   │   └── ChatContext.tsx
│       │   │   └── components/
│       │   │       ├── Sidebar.tsx
│       │   │       ├── UploadColumn.tsx
│       │   │       ├── DataSection.tsx
│       │   │       ├── InsightsSection.tsx
│       │   │       ├── ChatSection.tsx
│       │   │       └── QuerySection.tsx
│       │   ├── lib/
│       │   │   ├── prisma.ts                # Prisma client singleton
│       │   │   ├── api.ts                   # Frontend API client
│       │   │   ├── auth.ts                  # JWT helpers
│       │   │   ├── file-parser.ts           # File parsing (pdf, docx, csv, excel)
│       │   │   ├── file-validator.ts        # File type/size validation
│       │   │   ├── insights.ts              # AI insight generation
│       │   │   ├── embeddings.ts            # RAG: chunking, embeddings, similarity
│       │   │   └── chat.ts                  # Chat logic with RAG + Gemini
│       │   ├── next.config.ts
│       │   ├── tailwind.config.ts
│       │   ├── tsconfig.json
│       │   ├── postcss.config.js
│       │   ├── eslint.config.js
│       │   └── package.json
│       └── node_modules/
├── node_modules/                            # pnpm workspace root deps
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── package.json                             # Root package.json
├── vercel.json                              # Vercel deployment config
├── .gitignore
├── .env.example                             # Example environment variables
└── InsightFlow_AI_Complete_Guide.docx       # This document (generated)`),
    spacer(100),
    noteBox([
      'The `apps/web` directory is the only workspace package. Future packages (e.g., `mobile`, `cli`) can be added under `apps/`.',
      'The `scripts/` directory contains utility scripts like this guide generator.',
      'API routes follow the Next.js App Router convention: `/api/<resource>/<action>/route.ts`.',
    ]),

    // ── Phase 3: Scaffolding from Scratch ──
    spacer(600),
    h1('Phase 3: Scaffolding the Project from Scratch'),
    body('This phase walks through creating InsightFlow from nothing — useful if you want to reproduce the exact setup on a fresh machine or understand how everything fits together.'),
    spacer(200),

    h2('Step 1: Create the Root Directory'),
    codeBlock(`mkdir insightflow && cd insightflow
git init
echo "node_modules" > .gitignore
echo ".next" >> .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore`),
    spacer(100),

    h2('Step 2: Set Up pnpm Workspace'),
    codeBlock(`# Create pnpm-workspace.yaml
echo 'packages:
  - "apps/*"' > pnpm-workspace.yaml

# Create root package.json
echo '{"name":"insightflow","private":true,"scripts":{"build":"pnpm --filter apps/web build"}}' > package.json`),
    spacer(100),

    h2('Step 3: Create the Next.js App'),
    codeBlock(`pnpm dlx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir
cd apps/web
pnpm add prisma @prisma/client @google/generative-ai jsonwebtoken bcryptjs recharts csv-parse csv-stringify xlsx mammoth pdf-parse docx sharp react-markdown remark-gfm
pnpm add -D @types/jsonwebtoken @types/bcryptjs typescript`),
    spacer(100),

    h2('Step 4: Initialise Prisma'),
    codeBlock(`cd apps/web
npx prisma init
# Edit prisma/schema.prisma with the model definitions
# Edit .env with DATABASE_URL`),
    spacer(100),

    h2('Step 5: Create the Prisma Schema'),
    body('Write the 5-model schema into `prisma/schema.prisma`. The models are: User, Dataset, DataRecord, DocumentChunk, and ChatMessage (with proper relations and indexes).'),
    spacer(100),

    h2('Step 6: Configure next.config.ts'),
    codeBlock(`// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth", "pdf-parse", "docx", "sharp"],
};

export default nextConfig;`),
    spacer(100),

    h2('Step 7: Set Up Environment Variables'),
    codeBlock(`# apps/web/.env.local
DATABASE_URL="postgresql://postgres.octopetbkyblqdjsoutj:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
GEMINI_API_KEY="your-google-ai-api-key"
JWT_SECRET="your-random-jwt-secret-string"`),
    spacer(100),

    h2('Step 8: Create Directory Structure'),
    codeBlock(`cd apps/web/src
mkdir -p app/{api/{auth/{login,register,me},upload,datasets/{[id]/{records,insights,chat,export/{csv,excel,word}}},chat/{[id]/history},login,dashboard/{[id]},chat/{[id]}},context,components,lib}`),
    spacer(100),

    h2('Step 9: Implement Backend (API routes)'),
    body('Create all API routes in order: auth (login, register, me), upload, datasets, chat, export. Refer to the Backend Phase section for route details.'),
    spacer(100),

    h2('Step 10: Implement Frontend (Pages & Components)'),
    body('Create the dashboard page, sidebar, upload column, data browser, insights, chat, and query sections. Add the AuthContext and ChatContext providers.'),
    spacer(100),

    h2('Step 11: Build and Test'),
    codeBlock(`cd apps/web
# Install dependencies
pnpm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Run development server
pnpm dev

# Build for production
pnpm build`),
    spacer(200),
    tipBox([
      'Add `--webpack` to `next dev` and `next build` commands to avoid Turbopack issues: `"dev": "next dev --webpack"` and `"build": "prisma generate && next build --webpack"`.',
      'After scaffolding, commit your project to GitHub for deployment to Vercel. See Phase 5 (GitHub) and Phase 11 (Vercel).',
    ]),

    // ── Phase 4: Cloning for a New User ──
    spacer(600),
    h1('Phase 4: Cloning the Repository for a New Developer'),
    body('Use these steps when setting up the project on a new machine.'),
    spacer(200),

    h2('Step 1: Clone the Repository'),
    codeBlock(`git clone https://github.com/yourusername/insightflow.git
cd insightflow`),
    spacer(100),

    h2('Step 2: Install Dependencies'),
    codeBlock(`pnpm install`),
    spacer(100),

    h2('Step 3: Set Environment Variables'),
    codeBlock(`cd apps/web
cp .env.example .env.local
# Edit .env.local with your actual credentials (DATABASE_URL, GEMINI_API_KEY, JWT_SECRET)`),
    spacer(100),

    h2('Step 4: Generate Prisma Client & Sync Schema'),
    codeBlock(`npx prisma generate
npx prisma db push`),
    spacer(100),

    h2('Step 5: Start Development Server'),
    codeBlock(`pnpm dev`),
    spacer(100),
    tipBox([
      'If you encounter "Cannot find module" errors, re-run `pnpm install`.',
      'If Prisma client errors occur, re-run `npx prisma generate`.',
      'If the database connection fails, verify your `DATABASE_URL` in `.env.local`.',
      'Use `pnpm build` to verify everything compiles before submitting a PR.',
    ]),

    // ── Phase 5: Pushing to GitHub ──
    spacer(600),
    h1('Phase 5: Pushing the Project to GitHub'),
    body('This phase covers setting up GitHub version control — from first push to everyday workflows.'),
    spacer(200),

    h2('Initial Push (First Time)'),
    codeBlock(`# From the project root
git init
git add -A
git commit -m "Initial commit: InsightFlow AI data analytics platform"
git branch -M main
git remote add origin https://github.com/yourusername/insightflow.git
git push -u origin main`),
    spacer(100),

    h2('Everyday Workflow'),
    codeBlock(`# Check what changed
git status
git diff

# Stage and commit
git add -A
git commit -m "feat(upload): add two-column upload layout"

# Push to GitHub
git push origin main`),
    spacer(100),

    h2('Branch Workflow'),
    codeBlock(`# Create a feature branch
git checkout -b feat/new-feature

# Make changes, commit
git add -A
git commit -m "feat: add new feature"

# Push branch
git push origin feat/new-feature

# Create a pull request on GitHub.com

# After PR is merged, delete the branch
git checkout main
git pull origin main
git branch -d feat/new-feature`),
    spacer(100),

    h2('Resolving Common Git Issues'),
    boldBody('Push rejected (non-fast-forward): ', 'Pull first, then retry.'),
    codeBlock(`git pull origin main --rebase
# Fix any conflicts, then
git push origin main`),
    spacer(50),
    boldBody('Committed on the wrong branch: ', 'Move the commit to the correct branch.'),
    codeBlock(`git checkout correct-branch
git cherry-pick main
git checkout main
git reset --hard HEAD~1`),
    spacer(50),
    boldBody('Accidentally committed a secret: ', 'Remove it from history.'),
    codeBlock(`# If just committed (not pushed)
git reset --soft HEAD~1
# Unstage the secret file, edit .gitignore, re-commit

# If already pushed (⚠️ force push required)
git filter-branch --force --index-filter \\
  "git rm --cached --ignore-unmatch apps/web/.env.local" \\
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all`),
    spacer(100),
    warningBox([
      'Force pushing rewrites history. Only do this on private repos or with team coordination.',
      'After force pushing, all team members must `git pull --rebase` instead of `git pull`.',
    ]),
    spacer(100),
    noteBox([
      'Always commit `.gitignore` first to avoid accidentally committing secrets.',
      'Use descriptive commit messages following conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.',
      'Keep commits atomic — one logical change per commit.',
      'The main branch is `main`. Vercel auto-deploys from `main`.',
    ]),

    // ── Phase 6: Database Phase ──
    spacer(600),
    h1('Phase 6: Database Phase (Prisma + Supabase)'),
    h2('Prisma Schema Design'),
    body('The database uses 5 models with the following relationships:'),
    spacer(50),
    makeTable(
      [{ label: 'Model', width: 20 }, { label: 'Key Fields', width: 45 }, { label: 'Relations', width: 35 }],
      [
        ['User', 'id, email, password, createdAt', 'Has many Datasets, ChatMessages'],
        ['Dataset', 'id, name, type, content, columns, data, summary, timelineData, userId', 'Belongs to User, has many DataRecords, DocumentChunks, ChatMessages'],
        ['DataRecord', 'id, datasetId, record (JSON), createdAt', 'Belongs to Dataset'],
        ['DocumentChunk', 'id, datasetId, content, embedding (JSON), createdAt', 'Belongs to Dataset'],
        ['ChatMessage', 'id, datasetId, role, content, createdAt', 'Belongs to User, Dataset'],
      ]
    ),
    spacer(100),

    h2('Database Connection & Pooling'),
    body('InsightFlow uses Supabase PostgreSQL with the session pooler for serverless compatibility. Key points:'),
    bullet('Session pooler URL format: `postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`'),
    bullet('Direct connection (port 6543) is NOT used — the pooler (port 5432) handles connection limits from Vercel serverless functions.'),
    bullet('Prisma `db push` syncs schema directly (no migration files). For production, use `prisma migrate deploy`.'),
    bullet('Auto-generation of `@default(autoincrement())` and `@default(uuid())` for primary keys. Timestamps use `@default(now())`.'),
    spacer(100),

    h2('Common Database Commands'),
    makeTable(
      [{ label: 'Command', width: 40 }, { label: 'Purpose', width: 60 }],
      [
        ['npx prisma generate', 'Regenerate Prisma client after schema changes'],
        ['npx prisma db push', 'Sync schema to database (no migration files)'],
        ['npx prisma migrate dev --name desc', 'Create a versioned migration'],
        ['npx prisma migrate deploy', 'Apply migrations in production'],
        ['npx prisma studio', 'Open browser-based data browser GUI'],
        ['npx prisma format', 'Auto-format schema.prisma'],
      ]
    ),
    spacer(100),
    tipBox([
      'Run `prisma generate` after every schema change to keep the TypeScript types in sync.',
      'Use `prisma db push` during development and `prisma migrate deploy` for production.',
      'Check Supabase Table Editor to verify tables after running `db push`.',
    ]),

    // ── Phase 7: Backend Phase ──
    spacer(600),
    h1('Phase 7: Backend Phase (API Routes)'),
    body('All API routes follow the Next.js App Router convention: each route is a `route.ts` file exporting HTTP handler functions (GET, POST, PUT, DELETE).'),
    spacer(200),

    h2('Authentication Routes'),
    makeTable(
      [{ label: 'Route', width: 30 }, { label: 'Method', width: 10 }, { label: 'Description', width: 60 }],
      [
        ['/api/auth/register', 'POST', 'Register a new user (email, alphanumeric password). Returns JWT token.'],
        ['/api/auth/login', 'POST', 'Authenticate user, return JWT token.'],
        ['/api/auth/me', 'GET', 'Verify JWT token and return current user data. Used by AuthContext on page load.'],
      ]
    ),
    spacer(100),

    h2('Dataset Routes'),
    makeTable(
      [{ label: 'Route', width: 30 }, { label: 'Method', width: 10 }, { label: 'Description', width: 60 }],
      [
        ['/api/upload', 'POST', 'Upload and process a file. Branches on type (tabular vs document). Generates insights + embeddings.'],
        ['/api/datasets', 'GET', 'List all datasets for the authenticated user, optionally filtered by type.'],
        ['/api/datasets/[id]', 'GET', 'Get a single dataset with full details (by UUID ID).'],
        ['/api/datasets/[id]', 'DELETE', 'Delete a dataset and its associated records/chunks/messages.'],
        ['/api/datasets/[id]/records', 'GET', 'Get paginated records for a tabular dataset. Supports page/limit query params.'],
        ['/api/datasets/[id]/insights', 'GET', 'Get AI-generated insights for the dataset. Falls back to cached summary.'],
        ['/api/datasets/[id]/chat', 'POST', 'Send a chat message. Uses RAG for documents, direct query for tabular data.'],
        ['/api/chat/[id]/history', 'GET', 'Get chat message history for a dataset.'],
      ]
    ),
    spacer(100),

    h2('Export Routes'),
    makeTable(
      [{ label: 'Route', width: 30 }, { label: 'Method', width: 10 }, { label: 'Description', width: 60 }],
      [
        ['/api/datasets/[id]/export/csv', 'GET', 'Export dataset as CSV file.'],
        ['/api/datasets/[id]/export/excel', 'GET', 'Export dataset as .xlsx Excel file.'],
        ['/api/datasets/[id]/export/word', 'GET', 'Export as Word doc with overview table, AI insights, chart images, top performers.'],
      ]
    ),
    spacer(100),

    h2('Upload Route Flow'),
    body('The `/api/upload` route is the most complex. Here is its processing pipeline:'),
    boldBody('1. Authentication check: ', 'Verify JWT from Authorization header.'),
    boldBody('2. File validation: ', 'Check file exists, validate extension and MIME type.'),
    boldBody('3. Tabular branch (.csv, .xlsx, .xls, .tsv): ', '(a) Parse file → array of records. (b) Create Dataset + DataRecords. (c) Generate AI insights. (d) Compute timeline data.'),
    boldBody('4. Document branch (.pdf, .docx, .txt): ', '(a) Parse file → extracted text. (b) Create Dataset with content field. (c) Generate AI document summary. (d) Chunk text (500 chars, 100 overlap). (e) Generate embeddings for each chunk.'),
    boldBody('5. Return: ', 'Dataset ID, name, type, and summary message.'),
    spacer(100),
    tipBox([
      'All routes use `prisma.$disconnect()` in finally blocks to prevent connection leaks.',
      'UUID-based Dataset IDs are looked up with `OR: [{ id: slug }, { slug }]` for backward compatibility.',
      'Error responses follow the format: `{ error: "message" }` with appropriate HTTP status codes.',
    ]),

    // ── Phase 8: Frontend Phase ──
    spacer(600),
    h1('Phase 8: Frontend Phase (Pages & Components)'),
    h2('Page Architecture'),
    makeTable(
      [{ label: 'Page', width: 25 }, { label: 'Route', width: 25 }, { label: 'Description', width: 50 }],
      [
        ['Login', '/login', 'Login/Register form with password toggle, JWT storage'],
        ['Dashboard', '/dashboard', 'Main app with 5 tabs (Upload, My Data, Insights, Query, Chat)'],
        ['Dashboard Detail', '/dashboard/[id]', 'Full-page dataset detail view'],
        ['Chat Standalone', '/chat/[id]', 'Full-page chat interface for a specific dataset'],
      ]
    ),
    spacer(100),

    h2('Component Architecture'),
    boldBody('Sidebar: ', 'Collapsible navigation with 5 tabs. On mobile (<768px), becomes a hamburger slide-out drawer with overlay.'),
    boldBody('UploadColumn: ', 'Reusable two-column upload component. Each column has independent state (select file → confirm → uploading → result).'),
    boldBody('DataSection: ', 'Shows user\'s datasets with multi-filter dropdown (Tabular/Documents). Document detail view includes AI summary card + text preview.'),
    boldBody('InsightsSection: ', 'Tabular view: charts, stat cards, AI breakdowns. Document view: summary, key points, word count, read time, content preview + Word export button.'),
    boldBody('ChatSection: ', 'Dataset selector dropdown, message display with markdown rendering (react-markdown + remark-gfm), document-specific suggested questions.'),
    boldBody('QuerySection: ', 'SQL-like query textarea, Run button, results table, error display.'),
    spacer(100),

    h2('State Management'),
    body('Authentication state: `AuthContext` (React Context + localStorage). Stores JWT token, user data, and loading/error states. 8-second timeout prevents infinite loading when Supabase is unreachable.'),
    body('Chat state: `ChatContext` (React Context). Manages active dataset, messages, loading state for current chat session.'),
    spacer(100),

    h2('Responsive Design Strategy'),
    makeTable(
      [{ label: 'Breakpoint', width: 20 }, { label: 'Size', width: 15 }, { label: 'Behaviour', width: 65 }],
      [
        ['sm', '≥640px', 'Wider chat bubbles, larger cards, adjusted padding'],
        ['md', '≥768px', 'Sidebar expands from drawer to fixed sidebar. Two-column layout activates'],
        ['lg', '≥1024px', 'Maximum content width, full table views, side-by-side charts'],
      ]
    ),
    spacer(100),
    tipBox([
      'The `useMediaQuery` hook detects screen size and conditionally renders the sidebar as drawer vs fixed sidebar.',
      'Tailwind classes like `hidden md:flex` show/hide elements at different breakpoints.',
      'The hamburger button uses an `onClick` toggle instead of CSS-only for better accessibility.',
    ]),

    // ── Phase 9: AI Phase ──
    spacer(600),
    h1('Phase 9: AI Phase (Gemini Integration & RAG)'),
    h2('Google Gemini Integration'),
    body('InsightFlow uses the `@google/generative-ai` SDK to access Google\'s Gemini models. The integration is designed with a robust fallback chain to handle rate limits (429 errors).'),
    spacer(100),

    h2('Fallback Chain Architecture'),
    codeBlock(`Models (in order): gemini-2.0-flash → gemini-1.5-flash → gemini-1.5-pro
Each model: up to 3 attempts with exponential backoff
Delay formula: delay * 2^attempt (2s base delay)
Total: 3 models × 3 attempts = 9 tries before rule-based fallback`),
    spacer(100),

    h2('RAG Pipeline (Documents)'),
    body('RAG (Retrieval-Augmented Generation) enables Q&A on uploaded documents. The pipeline:'),
    boldBody('1. Document Processing (on upload): ', 'Extract text → Chunk into 500-char segments (100-char overlap) → Generate embeddings via `text-embedding-004`.'),
    boldBody('2. Query Processing (on chat): ', 'Embed user question → Find top 3 chunks by cosine similarity (threshold ≥ 0.5) → Build prompt with retrieved context → Send to Gemini.'),
    boldBody('3. Fallback: ', 'If embedding API fails, use keyword matching (count keyword overlaps between question and chunks). If all fails, return generic response.'),
    spacer(100),

    h2('Insight Generation'),
    body('Tabular data: After upload, a Gemini prompt asks the AI to analyse the dataset and return: data overview, top/bottom values, trends, and notable patterns. Results are stored in `Dataset.summary`.'),
    body('Documents: `generateDocumentSummary()` sends document content to Gemini with a prompt asking for: overall summary, key points (bullet list), word count, and estimated reading time. Falls back to first-500-characters if AI fails.'),
    spacer(100),
    tipBox([
      'Set `GEMINI_API_KEY` in both `.env.local` (local) and Vercel environment variables (deployment).',
      'The free tier is generous (60 RPM) but not guaranteed. The fallback chain handles occasional rate limiting gracefully.',
      'Use the `text-embedding-004` model for embeddings — it produces 768-dimensional vectors with good semantic accuracy.',
    ]),

    // ── Phase 10: Supabase Setup ──
    spacer(600),
    h1('Phase 10: Supabase Database Setup'),
    h2('Creating a Supabase Project'),
    body('1. Go to `supabase.com` and sign in (or sign up).'),
    body('2. Click "New project".'),
    body('3. Enter your organisation name, project name, database password, and select a region (choose one close to your users, e.g., `eu-west-1` for Europe).'),
    body('4. Click "Create new project" and wait ~2 minutes for provisioning.'),
    spacer(100),

    h2('Getting the Connection String'),
    body('1. In the Supabase dashboard, go to Project Settings → Database.'),
    body('2. Scroll to "Connection string".'),
    body('3. Select the "Session pooler" tab (not "Direct connection").'),
    body('4. Copy the URI string.'),
    body('5. Replace `[YOUR-PASSWORD]` with the database password you set during project creation.'),
    body('6. The format will be:'),
    codeBlock(`postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`),
    spacer(100),

    h2('Understanding Connection Types'),
    makeTable(
      [{ label: 'Property', width: 30 }, { label: 'Session Pooler (Recommended)', width: 35 }, { label: 'Direct Connection', width: 35 }],
      [
        ['Port', '5432', '6543'],
        ['Username', 'postgres.<project-ref>', 'postgres'],
        ['Use Case', 'Serverless (Vercel)', 'Long-running servers, local tools'],
        ['Connection Pooling', 'Yes (built-in)', 'No (manual)'],
        ['Recommended for InsightFlow', '✅ Yes', '❌ No'],
      ]
    ),
    spacer(100),

    h2('Syncing Schema via Prisma'),
    codeBlock(`# Generate Prisma client
cd apps/web
npx prisma generate

# Push schema to Supabase
npx prisma db push

# Verify in Supabase dashboard → Table Editor
# You should see all 5 tables: User, Dataset, DataRecord, DocumentChunk, ChatMessage`),
    spacer(100),

    h2('Managing Supabase Project State'),
    makeTable(
      [{ label: 'Status', width: 25 }, { label: 'What It Means', width: 40 }, { label: 'What To Do', width: 35 }],
      [
        ['Healthy', 'Project is running, accepting connections', 'Nothing — continue working'],
        ['Paused (inactive)', 'Auto-paused after 7 days free tier inactivity', 'Click "Restore" in dashboard'],
        ['Unhealthy', 'Database has issues', 'Check logs, verify password, contact Supabase support'],
      ]
    ),
    spacer(100),
    tipBox([
      'Free-tier Supabase projects auto-pause after 7 days without API requests. If your app shows "database connection failed", check if the project is paused.',
      'The session pooler is essential for Vercel — it prevents "too many connections" errors from serverless functions.',
      'Never commit the connection string to GitHub. Use `.env.local` and Vercel environment variables.',
    ]),

    // ── Phase 11: Vercel Deployment ──
    spacer(600),
    h1('Phase 11: Vercel Deployment'),
    h2('Deploying InsightFlow to Vercel'),
    body('Step-by-step guide to get the application live on Vercel.'),
    spacer(100),

    h2('Step 1: Push to GitHub'),
    codeBlock(`# Ensure everything is committed and pushed
git add -A
git commit -m "chore: prepare for Vercel deployment"
git push origin main`),
    spacer(100),

    h2('Step 2: Import Repository in Vercel'),
    body('1. Go to `vercel.com` and sign in.'),
    body('2. Click "Add New..." → "Project".'),
    body('3. Connect your GitHub account if not already connected.'),
    body('4. Search for "insightflow" and select the repository.'),
    spacer(100),

    h2('Step 3: Configure Build Settings'),
    body('Vercel auto-detects Next.js. Verify or configure these settings:'),
    makeTable(
      [{ label: 'Setting', width: 25 }, { label: 'Value', width: 75 }],
      [
        ['Framework Preset', 'Next.js (auto-detected)'],
        ['Root Directory', 'Set in Vercel Dashboard → Settings → General → Root Directory → `apps/web` (NOT in vercel.json)'],
        ['Build Command', '`pnpm build` (from vercel.json)'],
        ['Output Directory', '`.next` (auto-detected)'],
        ['Install Command', '`pnpm install` (auto-detected)'],
        ['Node.js Version', '20.x (auto-detected from package.json engines or .nvmrc)'],
      ]
    ),
    spacer(100),

    h2('Step 4: Set Environment Variables'),
    body('In Vercel dashboard → Project → Settings → Environment Variables, add:'),
    makeTable(
      [{ label: 'Variable', width: 25 }, { label: 'Value', width: 55 }, { label: 'Notes', width: 20 }],
      [
        ['DATABASE_URL', 'Supabase session pooler connection string', 'Required'],
        ['GEMINI_API_KEY', 'Google AI API key', 'Required'],
        ['JWT_SECRET', 'Any random string for signing JWTs', 'Required'],
      ]
    ),
    spacer(100),

    h2('Step 5: Deploy'),
    body('Click "Deploy". Vercel will: (1) Install dependencies with pnpm, (2) Generate Prisma client, (3) Build the Next.js app with `--webpack` flag, (4) Deploy to Vercel\'s global edge network.'),
    spacer(100),

    h2('Step 6: Verify Deployment'),
    body('After deployment completes, Vercel provides a URL (e.g., `https://insightflow-web-delta.vercel.app`). Verify:'),
    bullet('The login page loads correctly'),
    bullet('You can register and login'),
    bullet('File upload works'),
    bullet('AI insights and chat respond'),
    bullet('Export files download correctly'),
    spacer(100),

    h2('Redeploying After Changes'),
    body('Vercel auto-deploys on every push to the main branch. No manual steps needed. To trigger a manual redeploy:'),
    codeBlock(`# Option 1: Push a new commit
git add -A
git commit -m "fix: resolve upload issue"
git push origin main

# Option 2: Vercel Dashboard → Deployments → Redeploy (on the latest deployment)
# Option 3: Vercel Dashboard → Deployments → "Trigger Deployment" button`),
    spacer(100),

    h2('Troubleshooting Build Failures'),
    makeTable(
      [{ label: 'Error', width: 30 }, { label: 'Likely Cause', width: 35 }, { label: 'Solution', width: 35 }],
      [
        ['Module not found: sharp', 'sharp not listed in pnpm.onlyBuiltDependencies', 'Add `sharp` to `onlyBuiltDependencies` in `apps/web/package.json`'],
        ['PrismaClientInitializationError', 'DATABASE_URL not set or incorrect', 'Verify DATABASE_URL in Vercel env vars'],
        ['Build failed: TypeScript error', 'Type error in source code', 'Fix locally, re-push'],
        ['Vercel 500: Internal Server Error', 'Missing env var or runtime error', 'Check function logs in Vercel dashboard'],
        ['Function timed out', 'Serverless function exceeded 10s limit', 'Optimise the route or upgrade to Pro plan for longer timeout'],
      ]
    ),
    spacer(100),
    tipBox([
      'Set `"buildCommand": "pnpm build"` in `vercel.json` — do NOT set `rootDirectory` there (use Vercel dashboard).',
      'Use `pnpm.onlyBuiltDependencies` in `apps/web/package.json` to allow `sharp` native builds.',
      'Build command: `"build": "prisma generate && next build --webpack"` — the `--webpack` flag is essential.',
    ]),

    // ── Phase 12: GitHub Workflows ──
    spacer(600),
    h1('Phase 12: GitHub Workflows & Best Practices'),
    h2('Recommended Git Workflow'),
    body('InsightFlow follows a simplified trunk-based development workflow:'),
    bullet('`main` branch is the single source of truth. Always deployable.'),
    bullet('Feature branches (`feat/*`, `fix/*`) for new work.'),
    bullet('Pull Requests for code review before merging to main.'),
    bullet('Vercel auto-deploys main and creates preview deployments for PRs.'),
    spacer(100),

    h2('Common Git Scenarios'),
    boldBody('Starting a new feature: '),
    codeBlock(`git checkout main
git pull origin main
git checkout -b feat/my-feature
# ... make changes, commit, push ...`),
    spacer(50),
    boldBody('Saving work to switch branches: '),
    codeBlock(`git stash
git checkout main
# ... do something ...
git checkout feat/my-feature
git stash pop`),
    spacer(50),
    boldBody('Updating feature branch with latest main: '),
    codeBlock(`git checkout feat/my-feature
git fetch origin
git merge origin/main
# or: git rebase origin/main`),
    spacer(50),
    boldBody('Creating a pull request (CLI): '),
    codeBlock(`gh pr create --title "feat: my feature" --body "Description of changes"
# Or use GitHub.com UI`),
    spacer(50),
    boldBody('Merging a pull request: '),
    codeBlock(`# After PR approval
git checkout main
git pull origin main
git merge feat/my-feature
git push origin main

# Or merge via GitHub UI (recommended) using "Squash and merge"`),
    spacer(100),

    h2('Commit Message Convention'),
    makeTable(
      [{ label: 'Type', width: 15 }, { label: 'Scope Example', width: 20 }, { label: 'Example', width: 65 }],
      [
        ['feat', 'upload', 'feat(upload): add excel file support'],
        ['fix', 'chat', 'fix(chat): handle empty document response'],
        ['chore', 'deps', 'chore(deps): update prisma to 5.22'],
        ['docs', 'guide', 'docs(guide): add RAG pipeline section'],
        ['refactor', 'api', 'refactor(api): extract auth middleware'],
        ['style', 'ui', 'style(ui): responsive sidebar drawer'],
        ['test', 'upload', 'test(upload): add e2e test for csv upload'],
      ]
    ),
    spacer(100),

    h2('Syncing with Vercel'),
    body('Vercel integrates directly with GitHub:'),
    bullet('Every push to `main` triggers a production deployment.'),
    bullet('Every PR creates a preview deployment with a unique URL.'),
    bullet('Deployment status appears in the PR (check/status badge).'),
    bullet('Preview deployments use the same environment variables as production.'),
    spacer(100),
    tipBox([
      'Never push directly to `main` — use feature branches and PRs.',
      'Keep PRs small and focused on a single change.',
      'Always pull the latest `main` before starting new work to minimise merge conflicts.',
      'Use `gh` (GitHub CLI) for quick PR and issue management from the terminal.',
    ]),
  ];
}

// ── Build Coding QA Children ──

function buildCodingQA() {
  const children = [];
  children.push(spacer(600));
  children.push(h1('Coding Questions & Answers'));
  body('This section contains 100+ coding questions and answers covering all aspects of InsightFlow development, organised by category.');

  for (const category of codingQA) {
    children.push(spacer(400));
    children.push(h2(category.category));

    const tableData = category.questions.map(q => [q.q, q.a]);
    children.push(makeTable(
      [{ label: 'Question', width: 35 }, { label: 'Answer', width: 65 }],
      tableData
    ));
  }
  return children;
}

// ── Build Statement QA Children ──

function buildStatementQA() {
  const children = [];
  children.push(spacer(600));
  children.push(h1('True/False Statements'));
  children.push(body('Test your knowledge with these true/false statements about InsightFlow and its underlying technologies. Each statement includes a detailed explanation.'));
  children.push(spacer(200));

  for (const category of statementQA) {
    children.push(spacer(300));
    children.push(h2(category.category));

    const tableData = category.items.map(item => [item.s, item.t ? '✅ True' : '❌ False', item.e]);
    children.push(makeTable(
      [{ label: 'Statement', width: 40 }, { label: 'Answer', width: 15 }, { label: 'Explanation', width: 45 }],
      tableData
    ));
  }
  return children;
}

// ── Build Troubleshooting ──

function buildTroubleshooting() {
  return [
    spacer(600),
    h1('Troubleshooting Common Issues'),
    spacer(200),

    h2('Build/Deploy Issues'),
    makeTable(
      [{ label: 'Issue', width: 30 }, { label: 'Symptom', width: 30 }, { label: 'Solution', width: 40 }],
      [
        ['Turbopack native module error', '"Module not found: sharp/mammoth/pdf-parse/docx"', 'Use `next dev --webpack` and `next build --webpack` in package.json scripts'],
        ['Prisma client not found', '"Cannot find module @prisma/client"', 'Run `npx prisma generate` before build. Add to build script: `"build": "prisma generate && next build --webpack"`'],
        ['Build fails on Vercel', 'Various errors in build logs', 'Check Vercel build logs. Common: env vars missing, TypeScript errors, native packages not building'],
        ['Deployment succeeds but app shows 500', '500 error on page load', 'Check Vercel function logs. Usually missing env var or Prisma connection issue'],
      ]
    ),
    spacer(200),

    h2('Database Issues'),
    makeTable(
      [{ label: 'Issue', width: 30 }, { label: 'Symptom', width: 30 }, { label: 'Solution', width: 40 }],
      [
        ['Supabase project paused', 'Database connection fails', 'Go to Supabase dashboard → Click "Restore" on the project'],
        ['Connection refused', '"Connection refused" in logs', 'Verify DATABASE_URL port: pooler uses 5432, direct uses 6543. Check if Supabase project is healthy'],
        ['Too many connections', '"remaining connection slots" error', 'Use session pooler connection string instead of direct connection'],
        ['Prisma schema not synced', 'New columns/models not found', 'Run `npx prisma db push` to sync schema changes'],
      ]
    ),
    spacer(200),

    h2('AI / Gemini Issues'),
    makeTable(
      [{ label: 'Issue', width: 30 }, { label: 'Symptom', width: 30 }, { label: 'Solution', width: 40 }],
      [
        ['429 Rate Limited', 'AI responses delayed or failing', 'The fallback chain handles this: 3 models × 3 attempts with exponential backoff. Reduce request frequency if persistent'],
        ['API key invalid', '"API key not valid" error', 'Check GEMINI_API_KEY env var. Get a new key from makersuite.google.com/app/apikey'],
        ['Empty AI response', 'AI returns empty string', 'Check Gemini response parsing in the code. May need to handle non-standard response formats'],
        ['Embedding API fails', 'RAG not retrieving chunks', 'Falls back to keyword matching. Check text-embedding-004 model availability'],
      ]
    ),
    spacer(200),

    h2('Upload / File Processing Issues'),
    makeTable(
      [{ label: 'Issue', width: 30 }, { label: 'Symptom', width: 30 }, { label: 'Solution', width: 40 }],
      [
        ['File too large', 'Upload fails with no error', 'Vercel limit is ~4.5 MB. Add client-side validation to reject files > 4 MB before upload'],
        ['PDF parse empty result', 'PDF text is empty', 'PDF may be scanned/image-only. pdf-parse only extracts text layers. Use OCR for scanned PDFs'],
        ['DOCX parse error', 'mammoth throws error', 'Check if DOCX file is corrupted. Try opening it in Word first'],
        ['CSV encoding issues', 'Special characters garbled', 'Add BOM to output: `\\uFEFF` at start of CSV. Ensure `latin1` decoding for non-UTF8 files'],
      ]
    ),
    spacer(200),

    h2('Auth Issues'),
    makeTable(
      [{ label: 'Issue', width: 30 }, { label: 'Symptom', width: 30 }, { label: 'Solution', width: 40 }],
      [
        ['Infinite loading on dashboard', '"Loading..." never resolves', 'AuthContext has 8-second timeout. Check if Supabase is reachable. Verify JWT_SECRET is set'],
        ['Login fails silently', 'Clicking login does nothing', 'Check browser console for errors. Verify API route is responding. Check password policy (alphanumeric only)'],
        ['JWT token expired', 'Redirected to login after working', 'Tokens expire after 7 days. User must log in again. Check JWT_SECRET consistency across deployments'],
      ]
    ),
    spacer(200),

    h2('Git Issues'),
    makeTable(
      [{ label: 'Issue', width: 30 }, { label: 'Symptom', width: 30 }, { label: 'Solution', width: 40 }],
      [
        ['Push rejected', '"non-fast-forward" error', 'Run `git pull origin main --rebase`, resolve conflicts, then push again'],
        ['Merge conflict', 'Conflict markers in files', 'Edit files to remove conflict markers (<<<<<<<, =======, >>>>>>>), then `git add` and `git commit`'],
        ['Accidentally committed to main', 'Changes on main instead of branch', '`git reset HEAD~1` to uncommit, `git stash`, switch to correct branch, `git stash pop`'],
        ['File not in gitignore', 'Secret file tracked by git', 'Add to .gitignore, then `git rm --cached <file>` to untrack without deleting locally'],
      ]
    ),
  ];
}

// ── Build Footer ──

function getFooter() {
  return [
    spacer(600),
    h1('Appendix: Key File Reference'),
    body('Quick reference for the most important files in the InsightFlow codebase.'),
    spacer(100),
    makeTable(
      [{ label: 'File', width: 35 }, { label: 'Line Count (Approx.)', width: 25 }, { label: 'Purpose', width: 40 }],
      [
        ['apps/web/prisma/schema.prisma', '~60', 'Database schema (5 models)'],
        ['apps/web/src/app/dashboard/page.tsx', '~700', 'Main dashboard with all 5 tabs'],
        ['apps/web/src/app/api/upload/route.ts', '~120', 'File upload processing pipeline'],
        ['apps/web/src/lib/chat.ts', '~200', 'Chat logic with RAG + Gemini fallback chain'],
        ['apps/web/src/lib/embeddings.ts', '~150', 'Chunking, embedding generation, similarity search'],
        ['apps/web/src/lib/insights.ts', '~100', 'AI insight generation for tabular + documents'],
        ['apps/web/src/lib/api.ts', '~150', 'Frontend API client (all endpoints)'],
        ['apps/web/src/lib/file-parser.ts', '~80', 'PDF, DOCX, CSV, Excel file parsing'],
        ['apps/web/src/lib/prisma.ts', '~20', 'Prisma client singleton'],
        ['apps/web/src/lib/auth.ts', '~40', 'JWT sign/verify helpers'],
        ['apps/web/src/context/AuthContext.tsx', '~100', 'Auth state management with 8s timeout'],
        ['apps/web/src/context/ChatContext.tsx', '~80', 'Chat state management'],
        ['apps/web/src/app/api/datasets/[id]/export/word/route.ts', '~180', 'Word document export with chart images'],
        ['apps/web/next.config.ts', '~10', 'Next.js configuration (server external packages)'],
        ['apps/web/package.json', '~60', 'Dependencies and build scripts'],
        ['vercel.json', '~10', 'Vercel deployment configuration'],
      ]
    ),
    spacer(200),
    h1('Appendix: Environment Variables Reference'),
    makeTable(
      [{ label: 'Variable', width: 25 }, { label: 'Required', width: 10 }, { label: 'Where to Get It', width: 65 }],
      [
        ['DATABASE_URL', '✅', 'Supabase Dashboard → Settings → Database → Connection string (Session pooler)'],
        ['GEMINI_API_KEY', '✅', 'Google AI Studio: makersuite.google.com/app/apikey'],
        ['JWT_SECRET', '✅', 'Generate any random string: openssl rand -base64 32 or use a UUID generator'],
      ]
    ),
    spacer(100),
    noteBox([
      'All environment variables must be set in BOTH `.env.local` (local development) AND Vercel (deployment).',
      'Never commit `.env.local` to GitHub — it is in `.gitignore`.',
      'Use different Supabase projects/API keys for development vs production.',
    ]),
  ];
}

// ── Main Document Assembly ──

async function main() {
  console.log('Generating InsightFlow AI Complete Guide...');

  const children = [];

  // ── Title Page ──
  children.push(spacer(3000));
  children.push(hdr('InsightFlow AI'));
  children.push(subhdr('Complete Developer Guide'));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [tr('Version 1.0 — July 2026', { size: 24, color: '6B7280' })],
    spacing: { after: 200 },
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [tr('A comprehensive guide to building, deploying, and maintaining the InsightFlow AI data analytics platform.', { size: 22, color: DARK, italics: true })],
    spacing: { after: 600 },
  }));
  children.push(new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({ children: [tr('Repository:', { bold: true, size: 22 })], spacing: { after: 40 } }),
              new Paragraph({ children: [tr('https://github.com/techieemike/insightflow.git', { size: 22 })] }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [tr('Deployed URL:', { bold: true, size: 22 })], spacing: { after: 40 } }),
              new Paragraph({ children: [tr('https://insightflow-web-delta.vercel.app', { size: 22 })] }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
    ],
    width: { size: 80, type: WidthType.PERCENTAGE },
  }));

  // ── Table of Contents ──
  children.push(new PageBreak());
  children.push(h1('Table of Contents'));
  children.push(new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingLevelRange: "1-3",
  }));

  // ── All Phases ──
  children.push(new PageBreak());
  children.push(...getPhaseChildren());

  // ── Coding Q&A ──
  children.push(new PageBreak());
  children.push(...buildCodingQA());

  // ── Statement Q&A ──
  children.push(new PageBreak());
  children.push(...buildStatementQA());

  // ── Troubleshooting ──
  children.push(new PageBreak());
  children.push(...buildTroubleshooting());

  // ── Appendices ──
  children.push(new PageBreak());
  children.push(...getFooter());

  // ── Build Document ──
  const doc = new Document({
    title: 'InsightFlow AI Complete Guide',
    description: 'A comprehensive guide to the InsightFlow AI data analytics platform',
    creator: 'InsightFlow Team',
    features: {
      updateFields: true,
    },
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: DARK },
          paragraph: { spacing: { after: 120 } },
        },
        heading1: {
          run: { font: 'Calibri', size: 36, bold: true, color: ACCENT },
          paragraph: { spacing: { before: 600, after: 300 } },
        },
        heading2: {
          run: { font: 'Calibri', size: 30, bold: true, color: ACCENT },
          paragraph: { spacing: { before: 400, after: 200 } },
        },
        heading3: {
          run: { font: 'Calibri', size: 26, bold: true, color: ACCENT },
          paragraph: { spacing: { before: 300, after: 150 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  tr('InsightFlow AI Guide', { size: 18, color: '9CA3AF', italics: true }),
                ],
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT } },
                spacing: { after: 8 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  tr('Page ', { size: 18, color: '9CA3AF' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '9CA3AF' }),
                  tr(' of ', { size: 18, color: '9CA3AF' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '9CA3AF' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  // ── Generate File ──
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`\n✅ Guide generated successfully: ${OUTPUT}`);
  console.log(`   File size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
