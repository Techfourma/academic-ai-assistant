import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';
import { KnowledgeFile, Source } from '../types/api.js';

// ---------------------------------------------------------------------------
// Local academic knowledge base service.
//
// Provides:
//  - A lazy-loaded, cached index of every supported file inside the local
//    dataset directory (default: <project root>/dataset).
//  - Deterministic keyword-based retrieval (`retrieveRelevantContext`) that
//    feeds relevant excerpts into the Gemini prompt as retrieved context.
//
// The dataset is a local folder of markdown/text files, so NO external
// network calls (e.g. GitHub) are involved.
// ---------------------------------------------------------------------------

// Project root, resolved once from the module location so it works both from
// src/ (dev via tsx) and dist/ (compiled build).
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const DEFAULT_MAX_FILES = 3;
const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt']);
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git']);

/** Common Indonesian/English words that carry no retrieval value. */
const STOPWORDS = new Set<string>([
  // Indonesian
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'atau', 'ini',
  'itu', 'akan', 'tidak', 'tak', 'bisa', 'dapat', 'saya', 'anda', 'kami',
  'kita', 'mereka', 'adalah', 'apakah', 'bagaimana', 'kapan', 'dimana',
  'mengapa', 'apa', 'siapa', 'sesuai', 'per', 'karena', 'agar', 'supaya',
  'sebagai', 'secara', 'tersebut', 'beserta', 'oleh', 'juga', 'sudah',
  'belum', 'harus', 'wajib', 'boleh', 'mohon', 'silakan', 'tolong', 'harap',
  'melalui', 'antara', 'sejak', 'setiap', 'bila', 'jika', 'kalau', 'maka',
  'sehingga', 'namun', 'tetapi', 'sedangkan', 'kecuali', 'selain',
  'mengingat', 'berdasarkan', 'adapun', 'para', 'sebuah', 'beberapa',
  'semua', 'masing', 'misalnya', 'contoh', 'yaitu', 'yakni', 'dapatkah',
  'apakahkah', 'saat', 'hari', 'tahun', 'bulan',
  // English
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that',
  'it', 'these', 'those', 'do', 'does', 'did', 'can', 'could', 'should',
  'would', 'will', 'shall', 'may', 'might', 'must', 'not', 'no', 'yes',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'your',
  'you', 'i', 'we', 'they', 'he', 'she', 'me', 'us', 'them', 'my', 'our',
  'their', 'his', 'her', 'as', 'but', 'if', 'then', 'than', 'so', 'also',
  'etc', 'please', 'about', 'more', 'most', 'every', 'each', 'some', 'any',
  'such', 'only', 'just', 'very', 'its', 'within', 'into', 'upon', 'down',
  'up', 'out', 'over', 'under', 'again', 'once', 'here', 'there',
]);

interface ScoredFile {
  file: KnowledgeFile;
  score: number;
  matchedTokens: number;
}

// In-memory index of the local dataset
let knowledgeIndex: KnowledgeFile[] = [];
let isLoaded = false;
let currentVersion = 0;

/**
 * Absolute path of the dataset directory, resolved relative to the project
 * root unless KNOWLEDGE_BASE_DIR is an absolute path already.
 */
export function getDatasetDirectory(): string {
  const dir = config.KNOWLEDGE_BASE_DIR;
  return path.isAbsolute(dir) ? dir : path.resolve(PROJECT_ROOT, dir);
}

/** Recursively collect supported files inside a directory. */
async function walkDirectory(
  dir: string,
  baseDir: string
): Promise<KnowledgeFile[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    // Directory does not exist or is unreadable -> treated as empty
    return [];
  }

  // Deterministic ordering across platforms
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const collected: KnowledgeFile[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collected.push(...(await walkDirectory(fullPath, baseDir)));
      continue;
    }

    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) continue;

    let content: string;
    try {
      content = await fs.readFile(fullPath, 'utf-8');
    } catch {
      // Skip files that cannot be read
      continue;
    }

    const relativePath = path.relative(baseDir, fullPath).split(path.sep).join('/');
    const rawCategory = path.relative(baseDir, path.dirname(fullPath));

    collected.push({
      name: entry.name,
      path: relativePath,
      category: rawCategory === '.' || rawCategory === '' ? 'root' : rawCategory.split(path.sep).join('/'),
      content,
    });
  }

  return collected;
}

/**
 * Scan the local dataset directory and (re)build the in-memory index.
 * When `force` is false and the index is already loaded, the cached result
 * is returned. Set `force=true` to rescan the folder (used by sync).
 */
export async function loadKnowledgeBase(force = false): Promise<KnowledgeFile[]> {
  if (isLoaded && !force) {
    return knowledgeIndex;
  }

  const datasetDir = getDatasetDirectory();
  const files = await walkDirectory(datasetDir, datasetDir);

  knowledgeIndex = files;
  currentVersion += 1;
  isLoaded = true;

  return knowledgeIndex;
}

export function isKnowledgeLoaded(): boolean {
  return isLoaded;
}

/** Monotonic version that increments every time the index is (re)built. */
export function getKnowledgeVersion(): number {
  return currentVersion;
}

/** Snapshot of the current index. */
export function getKnowledgeFiles(): KnowledgeFile[] {
  return [...knowledgeIndex];
}

/** Reset module state (mainly for tests). */
export function resetKnowledgeBase(): void {
  knowledgeIndex = [];
  isLoaded = false;
  currentVersion = 0;
}

/** Split text into normalized, meaningful tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(token => token.length >= 2 && !STOPWORDS.has(token));
}

/** Exact/substring token match (e.g. "sks" inside "SKS", "krs" inside "KRS"). */
function containsExactToken(tokens: string[], queryToken: string): boolean {
  return tokens.some(token => token === queryToken || token.startsWith(queryToken));
}

export interface RetrievedKnowledge {
  context: string;
  sources: Source[];
}

/**
 * Retrieve the most relevant knowledge excerpts for a user query.
 *
 * Scoring is a simple, deterministic term-overlap function: every query token
 * found in a file body scores +2 (bonus +1 if it also appears in the file name
 * or category). The top matching files are turned into a prompt context block
 * with markdown source markers ([name](path)) so Gemini can cite them.
 *
 * Returns `null` when the index is empty or nothing matched.
 */
export function retrieveRelevantContext(
  query: string,
  maxFiles: number = DEFAULT_MAX_FILES
): RetrievedKnowledge | null {
  if (!isLoaded || knowledgeIndex.length === 0) {
    return null;
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return null;
  }

  const scored: ScoredFile[] = [];

  for (const file of knowledgeIndex) {
    const bodyTokens = tokenize(file.content);
    const headerTokens = tokenize(`${file.name} ${file.category}`);

    let score = 0;
    let matchedTokens = 0;

    for (const queryToken of queryTokens) {
      const inBody = containsExactToken(bodyTokens, queryToken);
      const inHeader = containsExactToken(headerTokens, queryToken);

      if (inBody) {
        score += 2;
        matchedTokens += 1;
      }
      if (inHeader) {
        score += 1;
      }
    }

    if (score > 0) {
      scored.push({ file, score, matchedTokens });
    }
  }

  if (scored.length === 0) {
    return null;
  }

  // Highest score first; stable tie-break by path for determinism
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.matchedTokens - a.matchedTokens ||
      a.file.path.localeCompare(b.file.path)
  );

  const top = scored.slice(0, Math.max(1, maxFiles));

  const context = top
    .map(({ file }) => {
      const body = file.content.trim();
      return `[${file.path}](${file.path})\nKategori: ${file.category}\n${body}`;
    })
    .join('\n\n---\n\n');

  const sources: Source[] = top.map(({ file }) => ({
    title: file.name,
    path: file.path,
    category: file.category,
  }));

  return { context, sources };
}