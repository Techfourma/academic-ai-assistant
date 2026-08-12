import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env with override so the project's .env ALWAYS wins over any
// pre-existing GEMINI_API_KEY (or other) exported in the shell environment.
// Otherwise a stale placeholder exported in ~/.bashrc overrides the real key.
dotenv.config({ override: true });

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  AI_ASSISTANT_SECRET: z.string().min(1, 'AI_ASSISTANT_SECRET is required'),

  // Path to the local academic knowledge dataset (relative to project root)
  KNOWLEDGE_BASE_DIR: z.string().default('dataset'),

  AI_MAX_INPUT_CHARS: z.string().default('1200'),
  AI_MAX_OUTPUT_TOKENS: z.string().default('500'),
  AI_MAX_HISTORY_MESSAGES: z.string().default('6'),
  AI_MAX_MEMORIES_IN_CONTEXT: z.string().default('5'),

  AI_MAX_REQUESTS_PER_MINUTE: z.string().default('5'),
  AI_MAX_REQUESTS_PER_HOUR: z.string().default('30'),
  AI_MAX_RETRIES: z.string().default('2'),
  AI_REQUEST_TIMEOUT_MS: z.string().default('30000'),
  AI_MAX_SERVER_QUEUE: z.string().default('2'),

  AI_MOCK_MODE: z.string().default('false'),
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3000'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    result.error.issues.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

export const config = parseEnv();

export const limits = {
  maxInputChars: parseInt(config.AI_MAX_INPUT_CHARS, 10),
  maxOutputTokens: parseInt(config.AI_MAX_OUTPUT_TOKENS, 10),
  maxHistoryMessages: parseInt(config.AI_MAX_HISTORY_MESSAGES, 10),
  maxMemoriesInContext: parseInt(config.AI_MAX_MEMORIES_IN_CONTEXT, 10),
  maxRequestsPerMinute: parseInt(config.AI_MAX_REQUESTS_PER_MINUTE, 10),
  maxRequestsPerHour: parseInt(config.AI_MAX_REQUESTS_PER_HOUR, 10),
  maxRetries: parseInt(config.AI_MAX_RETRIES, 10),
  requestTimeoutMs: parseInt(config.AI_REQUEST_TIMEOUT_MS, 10),
  maxServerQueue: parseInt(config.AI_MAX_SERVER_QUEUE, 10),
};

export const isMockMode = config.AI_MOCK_MODE === 'true';
export const isProduction = config.NODE_ENV === 'production';

/**
 * True when a secret mostly looks like a masked/placeholder value
 * (e.g. "your_gemini_api_key" or "AIzaSy...xxxx"), which is not usable.
 */
export function looksLikePlaceholder(value: string): boolean {
  return value.includes('xxxx') || value.includes('your_') || value.includes('xxx');
}