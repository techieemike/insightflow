import { prisma } from './prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding, findRelevantChunks, extractRelevantSnippets } from './embeddings';

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.0-flash-001'];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (key && key.startsWith('AIzaSy')) return new GoogleGenerativeAI(key);
  return null;
}

const genAI = getGenAI();

export async function chat(datasetId: string, question: string) {
  const dataset = await prisma.dataset.findUnique({ where: { id: datasetId } });
  if (!dataset) throw new Error('Dataset not found');

  let context: any[];
  if (dataset.type === 'document' && dataset.content) {
    const text = dataset.content as string;
    const words = text.split(/\s+/).filter(Boolean);
    const fullText = text.slice(0, 50000);

    let relevantChunks: string[] = [];
    try {
      const queryEmbedding = await generateEmbedding(question);
      if (queryEmbedding) {
        const chunks = await prisma.documentChunk.findMany({
          where: { datasetId },
          orderBy: { chunkIndex: 'asc' },
        });
        const parsed = chunks.map(c => ({
          content: c.content,
          embedding: c.embedding ? JSON.parse(c.embedding) : null,
        })).filter(c => c.embedding);
        relevantChunks = findRelevantChunks(parsed, queryEmbedding);
      }
    } catch { /* RAG fallback — use keyword approach */ }

    if (!relevantChunks.length) {
      const keywords = question.toLowerCase().split(' ').filter(w => w.length > 3);
      relevantChunks = extractRelevantSnippets(text, keywords, 10);
    }

    const excerptText = relevantChunks.length ? `Relevant excerpts:\n${relevantChunks.join('\n\n')}` : '';
    context = [
      { _type: 'document', content: `Full document:\n${fullText}\n\n${excerptText}`, wordCount: words.length },
    ];
  } else {
    const keywords = question.toLowerCase().split(' ').filter(w => w.length > 3);
    const records = await prisma.dataRecord.findMany({
      where: { datasetId, isDuplicate: false },
      take: 100, orderBy: { rowIndex: 'asc' },
    });
    const scored = records.map(r => {
      const text = JSON.stringify(r.data).toLowerCase();
      const score = keywords.filter(kw => text.includes(kw)).length;
      return { ...r, score };
    }).sort((a, b) => b.score - a.score);
    context = scored.slice(0, 30).map(r => r.data);
  }

  await prisma.chatMessage.create({
    data: { datasetId, role: 'user', content: question }
  });

  let answer: string;
  try {
    if (genAI) {
      answer = await askGemini(dataset, question, context);
    } else {
      answer = conversationalFallback(dataset, question, context);
    }
  } catch (err) {
    console.error('Chat AI error, using conversational fallback:', err);
    answer = conversationalFallback(dataset, question, context);
  }

  await prisma.chatMessage.create({
    data: { datasetId, role: 'assistant', content: answer }
  });
  return { answer, context: context.slice(0, 5) };
}

async function callGeminiWithRetry(ai: GoogleGenerativeAI, prompt: string): Promise<string> {
  for (const modelName of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const model = ai.getGenerativeModel({ model: modelName });
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

async function askGemini(dataset: any, question: string, context: any[]) {
  const history = await prisma.chatMessage.findMany({
    where: { datasetId: dataset.id }, orderBy: { createdAt: 'asc' }, take: 20
  });
  const historyText = history.slice(0, -1).map(m =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n');

  const prompt = [
    'You are InsightFlow AI, a friendly data analyst assistant.',
    `The dataset has columns: ${JSON.stringify(dataset.columns)}.`,
    `Relevant data: ${JSON.stringify(context)}.`,
    `Insights: ${JSON.stringify(dataset.insights)}.`,
    'Use bullet points (•), numbered lists, and line breaks to structure your response for readability. Be concise but thorough. If asked a greeting, greet back. If asked about data, analyze it.',
    '',
    historyText ? `Chat history:\n${historyText}` : '',
    `User: ${question}`,
    'Assistant:',
  ].filter(Boolean).join('\n');

  return callGeminiWithRetry(genAI!, prompt);
}

function conversationalFallback(dataset: any, question: string, context: any[]) {
  const q = question.toLowerCase().trim();
  const cols = dataset.columns as string[];

  if (/^(hi+|hello|hey|howdy|greetings|yo|sup)\b/.test(q))
    return `Hello! I'm InsightFlow AI. This dataset has ${cols.length} columns (${cols.join(', ')}) with ${dataset.totalRecords} records. Try asking "Which region has the highest revenue?" or just "Summarize this"!`;

  if (/how are you|how('s| is) it going|what'?s up\b/.test(q))
    return `I'm doing great, thanks for asking! Ready to help you explore this dataset. It has ${cols.length} columns: ${cols.join(', ')}. What would you like to know?`;

  if (/thank|thanks|appreciate/.test(q))
    return `You're welcome! Let me know if you have any questions about the data.`;

  if (/bye|goodbye|see you|cya/.test(q))
    return `Goodbye! Feel free to come back anytime for more data insights.`;

  if (/what can you (do|help|tell)|how (do|can) you (work|help)|capabilities|features|help/.test(q))
    return capabilitiesMessage(cols, dataset);

  if (/who (are|made|created) you|what are you/.test(q))
    return `I'm InsightFlow AI, your data analysis assistant. I can answer questions about this dataset, show trends, identify top performers, and more. What data would you like to explore?`;

  if (/column|field/.test(q) && !/which|what|top|best|worst/.test(q))
    return `This dataset has ${cols.length} columns: ${cols.join(', ')}.`;

  if (/record|row|entries/.test(q) && !/which|what|top|best|worst/.test(q))
    return `The dataset has ${dataset.totalRecords} records.`;

  if (/duplicate/.test(q))
    return `There are ${dataset.duplicateCount || 0} duplicate records.`;

  if (/quality|score|clean|missing/.test(q))
    return `Data quality score is ${dataset.qualityScore || 'N/A'}/100.`;

  if (/summary|summarize|overview|tell me about|describe/.test(q))
    return `This dataset has ${dataset.totalRecords} records across ${cols.length} columns: ${cols.join(', ')}. Quality score: ${dataset.qualityScore || 'N/A'}/100.${context.length > 0 ? ' ' + summarizeContext(context.slice(0, 3), cols) : ''}`;

  if (/best|top|highest|most|leading/.test(q))
    return topPerformer(dataset, context, cols);

  if (/worst|lowest|least|bottom|weakest/.test(q))
    return lowestPerformer(dataset, context, cols);

  if (/trend|pattern|change|over time/.test(q))
    return 'I can check trends if your data has date columns. Upload data with a date column and I can analyze patterns over time.';

  if (/chart|graph|plot|visualize/.test(q))
    return 'Charts are available in the Insights tab! I can describe what to visualize — just ask about specific columns or comparisons.';

  if (/compare|versus|vs|difference/.test(q))
    return compareCategories(dataset, context, cols, q);

  if (/how many|count|number of/.test(q))
    return `The dataset has ${dataset.totalRecords} records across ${cols.length} columns.`;

  if (/list|show|what (are|is)|which/.test(q))
    return whichQuestion(dataset, context, cols, q);

  if (/can you|will you|could you|would you/.test(q))
    return `Sure! Just let me know what you'd like to know about this data. I can help with summaries, comparisons, and identifying top or bottom performers.`;

  const sample = context.slice(0, 2);
  if (sample.length > 0)
    return `Based on the data I have, ${summarizeContext(sample, cols)} Is there something specific you'd like to drill into?`;

  const dataSummary = summarizeContext(
    (dataset.sampleRows as any[])?.slice(0, 2) || [],
    cols
  );
  return `Hi! This dataset has ${cols.length} columns: ${cols.join(', ')} with ${dataset.totalRecords} records. I can help analyze it — try asking "What's the top region by revenue?" or "Show me a summary."`;
}

function capabilitiesMessage(cols: string[], dataset: any) {
  return `I can help you explore this dataset (${cols.length} columns, ${dataset.totalRecords} records). Try asking:\n• "Summarize this dataset"\n• "Which region has the highest revenue?"\n• "What are the top drugs by units sold?"\n• "Are there any duplicates or quality issues?"\n• "Compare revenue across regions"`;
}

function whichQuestion(dataset: any, context: any[], cols: string[], q: string) {
  const catCol = cols.find(c => context.some(r => isNaN(Number(r[c]))));
  const numCol = cols.find(c => context.some(r => !isNaN(Number(r[c]))));
  if (!catCol || !numCol) return summarizeContext(context.slice(0, 3), cols);
  const grouped = buildGrouped(context, catCol, numCol);
  if (grouped.length === 0) return `No data found for ${numCol} by ${catCol}.`;
  return `Here's what I found:\n${grouped.slice(0, 5).map((g, i) => `${i + 1}. ${g.name}: ${fmt(g.sum)}`).join('\n')}`;
}

function compareCategories(dataset: any, context: any[], cols: string[], q: string) {
  const catCol = cols.find(c => context.some(r => isNaN(Number(r[c]))));
  const numCol = cols.find(c => context.some(r => !isNaN(Number(r[c]))));
  if (!catCol || !numCol) return 'Not enough data to compare.';
  const grouped = buildGrouped(context, catCol, numCol);
  if (grouped.length < 2) return 'Need at least two categories to compare.';
  return `Comparing ${numCol} across ${catCol}:\n${grouped.map(g => `• ${g.name}: ${fmt(g.sum)} (avg ${fmt(g.avg)})`).join('\n')}`;
}

function topPerformer(dataset: any, context: any[], cols: string[]) {
  const catCol = cols.find(c => context.some(r => isNaN(Number(r[c]))));
  const numCol = cols.find(c => context.some(r => !isNaN(Number(r[c]))));
  if (!catCol || !numCol) return 'Not enough data to determine top performers.';
  const grouped = buildGrouped(context, catCol, numCol);
  if (grouped.length === 0) return 'No numeric data found.';
  const total = grouped.reduce((s, g) => s + g.sum, 0);
  const top = grouped[0];
  const pct = total > 0 ? ((top.sum / total) * 100).toFixed(1) : '0';
  let msg = `Top ${catCol} by ${numCol}: ${top.name} (${fmt(top.sum)}, ${pct}% of total).`;
  if (grouped.length > 1) msg += ` Next: ${grouped.slice(1, 3).map(g => `${g.name} (${fmt(g.sum)})`).join(', ')}.`;
  return msg;
}

function lowestPerformer(dataset: any, context: any[], cols: string[]) {
  const catCol = cols.find(c => context.some(r => isNaN(Number(r[c]))));
  const numCol = cols.find(c => context.some(r => !isNaN(Number(r[c]))));
  if (!catCol || !numCol) return 'Not enough data to determine lowest performers.';
  const grouped = buildGrouped(context, catCol, numCol);
  if (grouped.length === 0) return 'No numeric data found.';
  const low = grouped[grouped.length - 1];
  return `Lowest ${catCol} by ${numCol}: ${low.name} (${fmt(low.sum)}).`;
}

function buildGrouped(context: any[], catCol: string, numCol: string) {
  const grouped: Record<string, number[]> = {};
  for (const row of context) {
    const k = String(row[catCol] ?? 'Unknown');
    const v = Number(row[numCol]);
    if (!isNaN(v)) {
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(v);
    }
  }
  return Object.entries(grouped)
    .map(([name, vals]) => ({
      name, sum: vals.reduce((a, b) => a + b, 0),
      avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
    }))
    .sort((a, b) => b.sum - a.sum);
}

function summarizeContext(sample: any[], cols: string[]) {
  const parts: string[] = [];
  for (const col of cols) {
    const vals = sample.map(r => r[col]).filter(v => v !== '' && v != null);
    if (vals.length === 0) continue;
    const nums = vals.map(Number).filter(n => !isNaN(n));
    if (nums.length > 0) {
      const sum = nums.reduce((a, b) => a + b, 0);
      parts.push(`${col} ranges from ${fmt(Math.min(...nums))} to ${fmt(Math.max(...nums))} (total ${fmt(sum)})`);
    } else {
      const unique = [...new Set(vals.map(String))];
      parts.push(`${col} has values: ${unique.slice(0, 5).join(', ')}${unique.length > 5 ? ` and ${unique.length - 5} more` : ''}`);
    }
  }
  return parts.join('. ') + '.';
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}

export async function getHistory(datasetId: string) {
  return prisma.chatMessage.findMany({
    where: { datasetId }, orderBy: { createdAt: 'asc' }
  });
}


