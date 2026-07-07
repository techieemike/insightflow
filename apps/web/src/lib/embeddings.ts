import { GoogleGenerativeAI } from '@google/generative-ai';

function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (key && key.startsWith('AIzaSy')) return new GoogleGenerativeAI(key);
  return null;
}

const genAI = getGenAI();

export function chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;
    if (end < text.length) {
      const lookahead = text.slice(end - overlap, Math.min(end + overlap, text.length));
      const sentenceEnd = lookahead.search(/[.!?]\s/);
      if (sentenceEnd > 0 && sentenceEnd < overlap * 1.5) {
        end = end - overlap + sentenceEnd + 1;
      }
    }
    const chunk = text.slice(start, Math.min(end, text.length)).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch {
    return null;
  }
}

export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!genAI || texts.length === 0) return texts.map(() => null);
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.batchEmbedContents({
      requests: texts.map(t => ({ content: { role: 'user', parts: [{ text: t }] } })),
    });
    return result.embeddings.map(e => e.values);
  } catch {
    return texts.map(() => null);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function findRelevantChunks(
  chunks: { content: string; embedding: number[] }[],
  queryEmbedding: number[],
  topN = 15
): string[] {
  if (!queryEmbedding?.length || !chunks.length) return [];
  return chunks
    .filter(c => c.embedding?.length)
    .map(c => ({ content: c.content, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(c => c.content);
}

export function extractRelevantSnippets(text: string, keywords: string[], maxSnippets: number): string[] {
  if (!keywords.length || !text) return [];
  const lower = text.toLowerCase();
  const sentences = text.split(/[.!?]+\s*/).filter(Boolean);
  return sentences
    .map(s => ({ sentence: s.trim(), score: keywords.filter(kw => lower.includes(kw)).length }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSnippets)
    .map(s => s.sentence);
}
