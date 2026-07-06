const {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, Packer, WidthType, ShadingType,
  BorderStyle, PageBreak,
  convertInchesToTwip,
} = require('docx');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.resolve(__dirname, '../../../InsightFlow_AI_Complete_Guide.docx');
const ACCENT = '7C3AED';
const ACCENT_LIGHT = 'EDE9FE';
const GRAY_BG = 'F3F4F6';
const WHITE = 'FFFFFF';
const DARK = '1F2937';

function txt(text, opts = {}) {
  return new TextRun({ text, font: 'Calibri', size: opts.size || 22, bold: opts.bold || false, italics: opts.italics || false, color: opts.color || DARK });
}

function para(runs, opts = {}) {
  const children = Array.isArray(runs) ? runs : [runs];
  const cfg = {};
  if (opts.heading) cfg.heading = opts.heading;
  if (opts.alignment) cfg.alignment = opts.alignment;
  if (opts.indent) cfg.indent = opts.indent;
  if (opts.bullet) cfg.bullet = { level: 0 };
  if (opts.spacing) cfg.spacing = opts.spacing;
  if (!cfg.spacing) cfg.spacing = {};
  if (opts.after !== void 0) cfg.spacing.after = opts.after;
  if (opts.before !== void 0) cfg.spacing.before = opts.before;
  return new Paragraph({ ...cfg, children });
}

function p(text, opts = {}) {
  return para([txt(text)], opts);
}

function h1(text) { return p(text, { heading: HeadingLevel.HEADING_1, before: 600, after: 300 }); }
function h2(text) { return p(text, { heading: HeadingLevel.HEADING_2, before: 400, after: 200 }); }
function h3(text) { return p(text, { heading: HeadingLevel.HEADING_3, before: 300, after: 150 }); }
function body(text) { return p(text, { after: 100 }); }
function bodyB(text) { return para([txt(text, { bold: true })], { after: 80 }); }
function bullet(text) { return p(text, { bullet: true, after: 60 }); }
function gap(h) { return p('', { after: h, before: 0 }); }

function codeBlock(s) {
  return s.split('\n').map(line => para([txt(line, { font: 'Consolas', size: 20, color: '1F2937' })], { after: 0, before: 0 }));
}

function boldBody(prefix, rest) {
  return para([txt(prefix, { bold: true }), txt(rest)], { after: 100 });
}

function makeTable(columns, rows) {
  const widths = columns.map(c => c.width);
  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map((c, i) =>
      new TableCell({
        children: [p(c.label, { bold: true })],
        shading: { type: ShadingType.CLEAR, fill: ACCENT },
        width: { size: widths[i], type: WidthType.PERCENTAGE },
      })
    ),
  });
  const dataRows = rows.map(row =>
    new TableRow({
      children: row.map((cellText, ci) =>
        new TableCell({
          children: [p(String(cellText))],
          width: { size: widths[ci], type: WidthType.PERCENTAGE },
        })
      ),
    })
  );
  return new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

function noteBox(items) {
  const children = [para([txt('NOTE', { bold: true, color: ACCENT })], { after: 60 })];
  items.forEach(i => children.push(p('\u25B8 ' + i, { after: 40 })));
  return new Table({
    rows: [new TableRow({ children: [new TableCell({ children, shading: { type: ShadingType.CLEAR, fill: ACCENT_LIGHT } })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function tipBox(items) {
  const children = [para([txt('TIP', { bold: true, color: ACCENT })], { after: 60 })];
  items.forEach(i => children.push(p('\u25B8 ' + i, { after: 40 })));
  return new Table({
    rows: [new TableRow({ children: [new TableCell({ children, shading: { type: ShadingType.CLEAR, fill: GRAY_BG } })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function warnBox(items) {
  const children = [para([txt('WARNING', { bold: true, color: 'DC2626' })], { after: 60 })];
  items.forEach(i => children.push(p('\u25B8 ' + i, { after: 40 })));
  return new Table({
    rows: [new TableRow({ children: [new TableCell({ children, shading: { type: ShadingType.CLEAR, fill: 'FEF2F2' } })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ──────────────────────────────────────────────────────
// CONTENT DATA
// ──────────────────────────────────────────────────────

const qaPhases = [
  {
    phase: 'Project Scaffolding & Setup',
    questions: [
      { q: 'How do I create a new Next.js project?', a: 'Run `pnpm create next-app@latest apps/web --typescript --tailwind --eslint`. The root uses pnpm workspaces.' },
      { q: 'How do I initialise a pnpm workspace?', a: 'Create `pnpm-workspace.yaml` with `packages: ["apps/*"]`. Then run `pnpm install`.' },
      { q: 'How do I install packages in the workspace?', a: 'Use `pnpm add <package> --filter apps/web`. For dev deps: `pnpm add -D <package> --filter apps/web`.' },
      { q: 'How do I add Prisma to the project?', a: 'Run `pnpm add prisma @prisma/client --filter apps/web`, then `npx prisma init`.' },
      { q: 'What is next.config.ts for?', a: 'It configures Next.js. InsightFlow adds `serverExternalPackages: ["mammoth","pdf-parse","docx","sharp"]`.' },
      { q: 'What goes in root .gitignore?', a: '`node_modules`, `.next`, `.env`, `.env.local`, `*.xlsx`, `*.docx`, `.prisma`, `.vercel`, `dist`, `coverage`.' },
      { q: 'Why use pnpm instead of npm?', a: 'pnpm is faster, uses hard links, has strict dependency isolation, and supports workspaces natively.' },
      { q: 'How do I verify the project builds?', a: 'Run `pnpm build`. The build command uses `--webpack` to avoid Turbopack issues with native packages.' },
    ],
  },
  {
    phase: 'Git & GitHub Workflow',
    questions: [
      { q: 'How do I init a Git repo?', a: '`git init` in the project root. Creates a `.git` tracking directory.' },
      { q: 'How do I stage and commit?', a: '`git add -A` then `git commit -m "message"`.' },
      { q: 'How do I connect to GitHub?', a: '`git remote add origin https://github.com/you/insightflow.git` then `git push -u origin main`.' },
      { q: 'Push rejected (non-fast-forward)?', a: '`git pull origin main --rebase`, resolve conflicts, `git push`.' },
      { q: 'How to undo last commit (keep changes)?', a: '`git reset --soft HEAD~1`.' },
      { q: 'How to undo last commit (discard changes)?', a: '`git reset --hard HEAD~1`. Use caution.' },
      { q: 'How to create a branch?', a: '`git checkout -b feat/my-feature`.' },
      { q: 'How to merge a branch?', a: '`git checkout main && git merge feat/my-feature && git push`.' },
      { q: 'How to resolve merge conflicts?', a: 'Edit conflicted files (remove <<< === >>> markers), `git add`, `git commit`.' },
      { q: 'Why .env.local in .gitignore?', a: 'It contains secrets (passwords, API keys). Never push to GitHub.' },
      { q: 'How to clone on a new machine?', a: '`git clone <url> && cd insightflow && pnpm install && cp .env.example .env.local`.' },
      { q: 'How to stash work?', a: '`git stash` to save, `git stash pop` to restore.' },
    ],
  },
  {
    phase: 'Front End (UI & Components)',
    questions: [
      { q: 'How is the dashboard structured?', a: 'Collapsible sidebar with 5 tabs (Upload, My Data, Insights, Query, Chat). On mobile, sidebar becomes a hamburger drawer.' },
      { q: 'How does responsive design work?', a: 'Tailwind breakpoints: sm (640px), md (768px), lg (1024px). Sidebar collapses to drawer below md.' },
      { q: 'How does the UploadColumn component work?', a: 'Each column has independent state: select file > confirm > uploading > result. Uses react-dropzone.' },
      { q: 'How are chat messages rendered?', a: 'With react-markdown + remark-gfm. Supports bullet points, code blocks, tables, bold/italic.' },
      { q: 'How does the sidebar work?', a: 'Sidebar component with nav items array. Active tab highlighted purple. Mobile: hamburger + overlay.' },
      { q: 'How does the DataSection filter work?', a: 'Multi-filter dropdown with Tabular/Documents options. Each shows appropriate detail views.' },
      { q: 'How does the QuerySection work?', a: 'SQL-like textarea, Run button, results display in table, error messages shown in red.' },
      { q: 'How are markdown messages styled?', a: 'Custom CSS targeting react-markdown output: purple accent for assistant, distinct user style.' },
    ],
  },
  {
    phase: 'Back End (API Routes)',
    questions: [
      { q: 'How are auth routes structured?', a: 'POST /api/auth/register, POST /api/auth/login (return JWT), GET /api/auth/me (verify token).' },
      { q: 'How does the upload route work?', a: 'POST /api/upload: validates file, parses it, creates Dataset, branches on type (tabular -> insights, document -> summary + embeddings).' },
      { q: 'How are datasets served?', a: 'GET /api/datasets lists user datasets (filterable by type). GET /api/datasets/[id] returns full details.' },
      { q: 'How does chat work server-side?', a: 'POST /api/datasets/[id]/chat. For documents: RAG retrieval + Gemini. For tabular: direct query + Gemini.' },
      { q: 'How are exports served?', a: 'GET /api/datasets/[id]/export/{csv,excel,word}. Each builds the file format and returns it as a download.' },
      { q: 'How is auth validated on each request?', a: 'Check Authorization header for Bearer token, verify JWT with jsonwebtoken, extract userId.' },
      { q: 'How is the Prisma client used?', a: 'Singleton pattern in lib/prisma.ts. Disconnected in finally blocks to prevent connection leaks.' },
    ],
  },
  {
    phase: 'Database (Prisma + Supabase)',
    questions: [
      { q: 'What does the Prisma schema contain?', a: '5 models: User, Dataset, DataRecord, DocumentChunk, ChatMessage.' },
      { q: 'How do I update the schema?', a: 'Edit schema.prisma, run `npx prisma db push` (dev) or `npx prisma migrate dev` (production).' },
      { q: 'How to connect to Supabase?', a: 'Set DATABASE_URL to the session pooler string in .env.local.' },
      { q: 'What is the session pooler?', a: 'Manages connection pools for serverless functions. Port 5432, username `postgres.<project-ref>`.' },
      { q: 'How to create a Supabase project?', a: 'Go to supabase.com > New project. Wait ~2 min. Get connection string from Settings > Database.' },
      { q: 'Project paused?', a: 'Free tier auto-pauses after 7 days. Click Restore in Supabase dashboard.' },
      { q: 'db push vs migrate?', a: 'db push syncs directly (dev). migrate creates versioned files (production).' },
    ],
  },
  {
    phase: 'AI Integration (Gemini)',
    questions: [
      { q: 'How is Gemini integrated?', a: 'Using @google/generative-ai SDK. Primary model: gemini-2.0-flash. Fallbacks: gemini-1.5-flash, gemini-1.5-pro.' },
      { q: 'What if Gemini is rate-limited (429)?', a: 'Fallback chain: 3 models x 3 attempts with 2s exponential backoff. Then rule-based fallback.' },
      { q: 'How does RAG work for documents?', a: 'Text chunked (500 char, 100 overlap). Chunks embedded with text-embedding-004. Question embedded, cosine similarity finds top 3 chunks as context.' },
      { q: 'What if embedding API fails?', a: 'Keyword matching fallback: chunks with most keyword matches are retrieved.' },
      { q: 'How are insights generated?', a: 'Tabular: Gemini analyses data -> summary, top values, trends. Documents: Gemini generates summary, key points, word count.' },
    ],
  },
  {
    phase: 'File Upload & Processing',
    questions: [
      { q: 'What file types are supported?', a: 'Tabular: CSV, XLSX, XLS, TSV. Documents: PDF, DOCX, TXT.' },
      { q: 'How are PDFs parsed?', a: 'Using pdf-parse library. Extracts text from the PDF buffer.' },
      { q: 'How are DOCX files parsed?', a: 'Using mammoth with convertToHtml(). HTML is stripped to plain text.' },
      { q: 'How are CSVs parsed?', a: 'Using csv-parse/sync. Parsed into arrays of records.' },
      { q: 'How are Excel files parsed?', a: 'Using xlsx library with read(buf, { type: "buffer" }).' },
      { q: 'What happens after parsing?', a: 'Dataset created. Tabular: records stored, insights generated. Documents: chunks + embeddings created.' },
    ],
  },
  {
    phase: 'Export (CSV, Excel, Word)',
    questions: [
      { q: 'How does CSV export work?', a: 'csv-stringify converts records to CSV. Returned as downloadable file.' },
      { q: 'How does Excel export work?', a: 'xlsx library creates workbook with json_to_sheet. Returned as .xlsx file.' },
      { q: 'How does Word export work?', a: 'docx library creates document with overview table, AI insights, chart images (SVG > sharp PNG > ImageRun).' },
    ],
  },
  {
    phase: 'Vercel Deployment',
    questions: [
      { q: 'How to deploy to Vercel?', a: 'Push to GitHub. Import repo in Vercel. Set root directory to apps/web. Add env vars. Deploy.' },
      { q: 'What env vars are needed?', a: 'DATABASE_URL, GEMINI_API_KEY, JWT_SECRET.' },
      { q: 'Why --webpack flag?', a: 'Turbopack cant resolve native packages (sharp, docx, mammoth, pdf-parse).' },
      { q: 'Build failed on Vercel?', a: 'Check build logs. Common: missing env vars, native packages not in onlyBuiltDependencies, TS errors.' },
      { q: 'How to redeploy?', a: 'Push to GitHub (auto) or Vercel dashboard > Redeploy.' },
    ],
  },
];

const troubleshootingTable = [
  {
    section: 'Build / Deploy',
    rows: [
      ['Turbopack native module error', 'Module not found: sharp, mammoth, etc.', 'Add --webpack to dev/build scripts. Add packages to onlyBuiltDependencies.'],
      ['Prisma client not found', 'Cannot find module @prisma/client', 'Run prisma generate. Add it to build script: "build": "prisma generate && next build --webpack"'],
      ['Vercel build fails', 'Various errors in build logs', 'Check logs. Common: missing env vars, TypeScript errors, native packages not building.'],
      ['App shows 500', 'Error on page load', 'Check Vercel function logs. Usually missing env var or Prisma connection issue.'],
    ],
  },
  {
    section: 'Database',
    rows: [
      ['Supabase paused', 'Connection fails', 'Go to Supabase dashboard > Click Restore on the project.'],
      ['Connection refused', 'Connection refused in logs', 'Verify port: pooler 5432, direct 6543. Check project health.'],
      ['Too many connections', 'remaining connection slots error', 'Use session pooler connection string instead of direct connection.'],
      ['Schema not synced', 'New columns not found', 'Run npx prisma db push to sync schema.'],
    ],
  },
  {
    section: 'AI / Gemini',
    rows: [
      ['429 Rate Limited', 'AI responses failing', 'Fallback chain handles this (3 models x 3 attempts). Reduce request frequency.'],
      ['API key invalid', 'API key not valid error', 'Check GEMINI_API_KEY env var. Get key from makersuite.google.com.'],
      ['Empty AI response', 'AI returns empty', 'Check Gemini response parsing. Adjust prompt formatting.'],
    ],
  },
  {
    section: 'Auth',
    rows: [
      ['Infinite loading', 'Loading... never resolves', 'AuthContext has 8s timeout. Check Supabase reachability. Verify JWT_SECRET set.'],
      ['Login fails', 'Nothing happens on click', 'Check browser console. Verify API responds. Check password policy (alphanumeric only).'],
      ['Token expired', 'Redirected to login', 'Tokens expire after 7 days. Re-login. Check JWT_SECRET consistency across deployments.'],
    ],
  },
  {
    section: 'Git',
    rows: [
      ['Push rejected', 'non-fast-forward error', 'git pull origin main --rebase, resolve conflicts, push again.'],
      ['Merge conflict', 'Conflict markers in files', 'Edit files to remove <<< === >>> markers, then git add and git commit.'],
      ['Committed to main by accident', 'Changes on main', 'git reset HEAD~1, stash, switch branch, pop stash.'],
    ],
  },
];

// ──────────────────────────────────────────────────────
// BUILD DOCUMENT
// ──────────────────────────────────────────────────────

async function main() {
  console.log('Generating InsightFlow AI Complete Guide...');
  const children = [];

  // ── Title Page ──
  children.push(gap(3000));
  children.push(para([txt('InsightFlow AI', { bold: true, size: 48, color: ACCENT })], { alignment: AlignmentType.CENTER, after: 100 }));
  children.push(para([txt('Complete Developer Guide', { size: 28 })], { alignment: AlignmentType.CENTER, after: 200 }));
  children.push(para([txt('Version 1.0 \u2014 July 2026', { size: 22, color: '6B7280' })], { alignment: AlignmentType.CENTER, after: 100 }));
  children.push(para([txt('A comprehensive guide to building, deploying, and maintaining the InsightFlow AI platform.', { italics: true })], { alignment: AlignmentType.CENTER, after: 400 }));
  children.push(makeTable(
    [{ label: 'Info', width: 50 }, { label: 'Value', width: 50 }],
    [
      ['Repository', 'https://github.com/techieemike/insightflow.git'],
      ['Live Site', 'https://insightflow-web-delta.vercel.app'],
      ['Stack', 'Next.js 16 + Prisma v5 + Supabase + Gemini AI'],
    ]
  ));

  // ── Overview ──
  children.push(new PageBreak());
  children.push(h1('Project Overview'));
  children.push(body('InsightFlow AI is a full-stack data analytics platform. Users upload tabular data (CSV, Excel) or documents (PDF, DOCX, TXT), analyse them with Google Gemini AI, chat with their data using RAG, run SQL-like queries, and export reports in CSV, Excel, or Word format.'));
  children.push(gap(200));
  children.push(h2('Technology Stack'));
  children.push(makeTable(
    [{ label: 'Layer', width: 20 }, { label: 'Technology', width: 35 }, { label: 'Purpose', width: 45 }],
    [
      ['Frontend', 'Next.js 16, React 19, Tailwind CSS', 'Server-rendered UI, routing, responsive design'],
      ['Backend', 'Next.js API routes (App Router)', 'Serverless API endpoints'],
      ['Database ORM', 'Prisma v5', 'Type-safe database access, schema management'],
      ['Database', 'Supabase PostgreSQL (session pooler)', 'Managed cloud database'],
      ['AI', 'Google Gemini API', 'Insights, summaries, chat, embeddings'],
      ['File Parsing', 'pdf-parse, mammoth, xlsx, csv-parse', 'Document and spreadsheet parsing'],
      ['Export', 'docx, xlsx (SheetJS), csv-stringify', 'Word, Excel, CSV report generation'],
      ['Auth', 'JWT (jsonwebtoken), bcryptjs', 'User authentication'],
      ['Charts', 'recharts', 'Interactive data visualisations'],
      ['Deployment', 'Vercel (auto-deploy from GitHub)', 'Serverless hosting'],
    ]
  ));
  children.push(gap(200));
  children.push(h2('Feature Summary'));
  children.push(makeTable(
    [{ label: 'Feature', width: 25 }, { label: 'Description', width: 55 }, { label: 'Status', width: 20 }],
    [
      ['File Upload', 'Two-column drag-and-drop (tabular + documents)', 'Done'],
      ['Data Browser', 'Tabular and document views with filters', 'Done'],
      ['AI Insights', 'AI-generated analysis, summaries, charts', 'Done'],
      ['Chat (RAG)', 'Query documents with semantic search', 'Done'],
      ['SQL Query', 'Run SQL-like queries on tabular data', 'Done'],
      ['CSV Export', 'Export datasets as CSV', 'Done'],
      ['Excel Export', 'Export datasets as .xlsx', 'Done'],
      ['Word Export', 'Narrative reports with insights + charts', 'Done'],
      ['Auth', 'JWT-based login/register', 'Done'],
      ['Responsive UI', 'Mobile hamburger drawer, adaptive', 'Done'],
    ]
  ));

  // ── Folder Structure ──
  children.push(new PageBreak());
  children.push(h1('Complete Folder Structure'));
  children.push(body('The project root is the pnpm workspace. The Next.js app lives under `apps/web/`.'));
  children.push(gap(200));
  children.push(...codeBlock(`insightflow/
+-- apps/
|   +-- web/                        # Next.js application
|       +-- prisma/
|       |   +-- schema.prisma       # 5 models
|       +-- scripts/
|       |   +-- generate-guide.cjs  # This document generator
|       +-- src/
|       |   +-- app/
|       |   |   +-- page.tsx        # Landing page
|       |   |   +-- layout.tsx       # Root layout
|       |   |   +-- login/page.tsx  # Login/Register
|       |   |   +-- dashboard/
|       |   |   |   +-- page.tsx    # Main dashboard (5 tabs)
|       |   |   |   +-- [id]/page.tsx  # Dataset detail
|       |   |   +-- chat/
|       |   |   |   +-- [id]/page.tsx  # Standalone chat
|       |   |   +-- api/
|       |   |       +-- auth/{login,register,me}/route.ts
|       |   |       +-- upload/route.ts
|       |   |       +-- datasets/
|       |   |       |   +-- route.ts
|       |   |       |   +-- [id]/{route,records,insights,chat,export/*}/route.ts
|       |   |       +-- chat/[id]/history/route.ts
|       |   +-- context/
|       |   |   +-- AuthContext.tsx
|       |   |   +-- ChatContext.tsx
|       |   +-- components/
|       |   |   +-- Sidebar.tsx
|       |   |   +-- UploadColumn.tsx
|       |   |   +-- DataSection.tsx
|       |   |   +-- InsightsSection.tsx
|       |   |   +-- ChatSection.tsx
|       |   |   +-- QuerySection.tsx
|       |   +-- lib/
|       |       +-- prisma.ts        # Prisma singleton
|       |       +-- api.ts           # API client
|       |       +-- auth.ts          # JWT helpers
|       |       +-- file-parser.ts   # PDF/DOCX/CSV/Excel
|       |       +-- file-validator.ts
|       |       +-- insights.ts      # AI insight generation
|       |       +-- embeddings.ts    # RAG chunking + similarity
|       |       +-- chat.ts          # Chat + fallback chain
|       +-- next.config.ts
|       +-- tailwind.config.ts
|       +-- tsconfig.json
|       +-- package.json
+-- pnpm-workspace.yaml
+-- pnpm-lock.yaml
+-- package.json
+-- vercel.json
+-- .gitignore
+-- .env.example`));

  // ── Setting Up the Project ──
  children.push(new PageBreak());
  children.push(h1('Setting Up the Project'));
  children.push(h2('Scaffolding from Scratch'));
  children.push(body('If you need to recreate the project from nothing, follow these steps:'));
  children.push(gap(100));

  children.push(h3('1. Create the root directory'));
  children.push(...codeBlock(`mkdir insightflow && cd insightflow
git init`));
  children.push(gap(80));

  children.push(h3('2. Set up pnpm workspace'));
  children.push(...codeBlock(`echo 'packages:\n  - "apps/*"' > pnpm-workspace.yaml`));
  children.push(gap(80));

  children.push(h3('3. Create the Next.js app'));
  children.push(...codeBlock(`pnpm dlx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir
cd apps/web
pnpm add prisma @prisma/client @google/generative-ai jsonwebtoken bcryptjs recharts csv-parse csv-stringify xlsx mammoth pdf-parse docx sharp react-markdown remark-gfm`));
  children.push(gap(80));

  children.push(h3('4. Initialise Prisma'));
  children.push(...codeBlock(`npx prisma init
# Edit prisma/schema.prisma with the model definitions`));
  children.push(gap(80));

  children.push(h3('5. Set environment variables'));
  children.push(...codeBlock(`# apps/web/.env.local
DATABASE_URL="postgresql://postgres.<project>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
GEMINI_API_KEY="your-key-here"
JWT_SECRET="your-random-secret"`));
  children.push(gap(80));

  children.push(h3('6. Push to GitHub'));
  children.push(...codeBlock(`git add -A
git commit -m "Initial commit"
git remote add origin https://github.com/you/insightflow.git
git branch -M main
git push -u origin main`));
  children.push(gap(80));

  children.push(h3('7. Build and verify'));
  children.push(...codeBlock(`pnpm install
npx prisma generate
npx prisma db push
pnpm build`));
  children.push(gap(100));

  children.push(h2('Cloning for a New Developer'));
  children.push(...codeBlock(`git clone https://github.com/you/insightflow.git
cd insightflow
pnpm install
cd apps/web
cp .env.example .env.local   # Edit with your credentials
npx prisma generate
npx prisma db push
pnpm dev`));
  children.push(gap(100));
  children.push(tipBox([
    'Always run `prisma generate` after pulling schema changes.',
    'If you get "Cannot find module" errors, re-run `pnpm install`.',
  ]));

  // ── Coding Questions ──
  children.push(new PageBreak());
  children.push(h1('Coding Questions & Answers'));
  children.push(body('Questions organised by development area, covering everything from scaffolding to deployment.'));

  for (const section of qaPhases) {
    children.push(gap(300));
    children.push(h2(section.phase));

    const tableData = section.questions.map(q => [q.q, q.a]);
    children.push(makeTable(
      [{ label: 'Question', width: 35 }, { label: 'Answer', width: 65 }],
      tableData
    ));
  }

  // ── Troubleshooting ──
  children.push(new PageBreak());
  children.push(h1('Troubleshooting Common Issues'));
  for (const section of troubleshootingTable) {
    children.push(gap(200));
    children.push(h2(section.section));
    children.push(makeTable(
      [{ label: 'Issue', width: 30 }, { label: 'Symptom', width: 35 }, { label: 'Solution', width: 35 }],
      section.rows
    ));
  }

  // ── Supabase Setup ──
  children.push(new PageBreak());
  children.push(h1('Supabase Setup Guide'));

  children.push(h2('Creating a Project'));
  children.push(body('1. Go to supabase.com and sign in.'));
  children.push(body('2. Click "New project" and fill in the details.'));
  children.push(body('3. Wait ~2 minutes for provisioning.'));
  children.push(gap(80));

  children.push(h2('Getting the Connection String'));
  children.push(body('In the Supabase dashboard: Project Settings > Database > Connection string.'));
  children.push(body('Select "Session pooler" tab (not direct connection).'));
  children.push(body('Copy the URI, replace [YOUR-PASSWORD] with your database password.'));
  children.push(...codeBlock(`postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`));
  children.push(gap(80));

  children.push(h2('Connection Types'));
  children.push(makeTable(
    [{ label: '', width: 30 }, { label: 'Session Pooler (Recommended)', width: 35 }, { label: 'Direct Connection', width: 35 }],
    [
      ['Port', '5432', '6543'],
      ['Username', 'postgres.<project-ref>', 'postgres'],
      ['Use Case', 'Serverless (Vercel)', 'Long-running servers'],
      ['Connection Pooling', 'Yes (built-in)', 'No (manual)'],
    ]
  ));
  children.push(gap(80));

  children.push(h2('Syncing the Schema'));
  children.push(...codeBlock(`cd apps/web
npx prisma generate
npx prisma db push
# Verify in Supabase > Table Editor`));
  children.push(gap(80));

  children.push(h2('Managing Project State'));
  children.push(makeTable(
    [{ label: 'Status', width: 25 }, { label: 'Meaning', width: 40 }, { label: 'Action', width: 35 }],
    [
      ['Healthy', 'Running, accepting connections', 'Nothing needed'],
      ['Paused', 'Auto-paused after 7 days (free tier)', 'Click Restore in dashboard'],
      ['Unhealthy', 'Database issues', 'Check logs, verify password, contact support'],
    ]
  ));
  children.push(gap(100));
  children.push(noteBox([
    'Free-tier projects auto-pause after 7 days without API requests.',
    'The session pooler is essential for Vercel - it prevents "too many connections" errors.',
    'Never commit the connection string to GitHub. Use .env.local and Vercel env vars.',
  ]));

  // ── Vercel Deployment ──
  children.push(new PageBreak());
  children.push(h1('Vercel Deployment Guide'));

  children.push(h2('Step 1: Push to GitHub'));
  children.push(...codeBlock(`git add -A
git commit -m "chore: prepare for deployment"
git push origin main`));
  children.push(gap(80));

  children.push(h2('Step 2: Import in Vercel'));
  children.push(body('Go to vercel.com > Add New > Project. Connect GitHub, select the insightflow repo.'));
  children.push(gap(80));

  children.push(h2('Step 3: Configure Build'));
  children.push(makeTable(
    [{ label: 'Setting', width: 30 }, { label: 'Value', width: 70 }],
    [
      ['Framework', 'Next.js (auto-detected)'],
      ['Root Directory', 'Set in Dashboard > Settings > General > Root Directory = apps/web'],
      ['Build Command', 'pnpm build (from vercel.json)'],
      ['Output Directory', '.next (auto-detected)'],
    ]
  ));
  children.push(gap(80));

  children.push(h2('Step 4: Environment Variables'));
  children.push(makeTable(
    [{ label: 'Variable', width: 30 }, { label: 'Source', width: 70 }],
    [
      ['DATABASE_URL', 'Supabase > Settings > Database > Session pooler connection string'],
      ['GEMINI_API_KEY', 'makersuite.google.com/app/apikey'],
      ['JWT_SECRET', 'Generate any random string (openssl rand -base64 32)'],
    ]
  ));
  children.push(gap(80));

  children.push(h2('Step 5: Deploy & Verify'));
  children.push(body('Click Deploy. Vercel installs deps, generates Prisma client, builds Next.js, deploys. Verify:'));
  children.push(bullet('Login page loads correctly'));
  children.push(bullet('Can register and login'));
  children.push(bullet('File upload works'));
  children.push(bullet('AI insights and chat respond'));
  children.push(bullet('Export files download'));
  children.push(gap(80));

  children.push(h2('Configuration Notes'));
  children.push(bullet('Set root directory in Vercel Dashboard, NOT in vercel.json (vercel.json does not support rootDirectory).'));
  children.push(bullet('Build command uses --webpack flag: "prisma generate && next build --webpack". Turbopack cannot resolve native packages.'));
  children.push(bullet('Add sharp to pnpm.onlyBuiltDependencies in package.json for native builds.'));
  children.push(gap(100));
  children.push(warnBox([
    'Vercel Hobby plan has a 10-second serverless function timeout. Pro plan allows up to 60 seconds.',
    'Serverless functions have a 4.5 MB body size limit. Add client-side file size validation.',
  ]));

  // ── Appendix ──
  children.push(new PageBreak());
  children.push(h1('Appendix: Key File Reference'));
  children.push(makeTable(
    [{ label: 'File', width: 35 }, { label: 'Approx. Lines', width: 20 }, { label: 'Purpose', width: 45 }],
    [
      ['prisma/schema.prisma', '~60', 'Database schema (5 models)'],
      ['src/app/dashboard/page.tsx', '~700', 'Main dashboard with all 5 tabs'],
      ['src/app/api/upload/route.ts', '~120', 'File upload processing pipeline'],
      ['src/lib/chat.ts', '~200', 'Chat logic with RAG + Gemini fallback chain'],
      ['src/lib/embeddings.ts', '~150', 'Chunking, embeddings, cosine similarity'],
      ['src/lib/insights.ts', '~100', 'AI insight generation'],
      ['src/lib/api.ts', '~150', 'Frontend API client'],
      ['src/lib/file-parser.ts', '~80', 'PDF, DOCX, CSV, Excel parsing'],
      ['src/context/AuthContext.tsx', '~100', 'Auth state with 8s timeout'],
      ['src/app/api/export/[id]/word/route.ts', '~180', 'Word export with chart images'],
      ['next.config.ts', '~10', 'ServerExternalPackages config'],
      ['vercel.json', '~10', 'Deployment config'],
    ]
  ));
  children.push(gap(200));
  children.push(h1('Appendix: Git Workflow Reference'));
  children.push(makeTable(
    [{ label: 'Scenario', width: 30 }, { label: 'Commands', width: 70 }],
    [
      ['First push', 'git init && git add -A && git commit -m "init" && git remote add origin <url> && git push -u origin main'],
      ['Everyday commit', 'git add -A && git commit -m "feat: description" && git push'],
      ['New branch', 'git checkout -b feat/name && git push -u origin feat/name'],
      ['Merge branch', 'git checkout main && git pull && git merge feat/name && git push'],
      ['Sync fork', 'git remote add upstream <url> && git fetch upstream && git merge upstream/main'],
      ['Undo commit (keep)', 'git reset --soft HEAD~1'],
      ['Undo commit (discard)', 'git reset --hard HEAD~1'],
      ['Stash work', 'git stash && git stash pop'],
      ['Fix merge conflict', 'Edit files, remove markers, git add, git commit'],
    ]
  ));

  // ── Build ──
  const doc = new Document({
    title: 'InsightFlow AI Complete Guide',
    description: 'A comprehensive guide to the InsightFlow AI data analytics platform',
    creator: 'InsightFlow Team',
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: DARK },
          paragraph: { spacing: { after: 120 } },
        },
      },
    },
    sections: [{
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
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buffer);
  console.log('Done: ' + OUTPUT);
  console.log('Size: ' + (buffer.length / 1024).toFixed(1) + ' KB');
}

main().catch(console.error);
