import { z } from 'zod';

// Input validation schemas
export const messageSchema = z.string().min(1).max(2000);

export const contextSchema = z.object({
  memory: z.array(z.string()).optional().default([]),
  recentMessages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ).optional().default([]),
});

export const assistantRequestSchema = z.object({
  requestId: z.string().uuid('Invalid requestId format'),
  conversationId: z.string().uuid('Invalid conversationId format'),
  message: messageSchema,
  context: contextSchema.optional().default({ memory: [], recentMessages: [] }),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export interface AssistantResponse {
  success: boolean;
  requestId: string;
  answer: string;
  sources: Source[];
}

export interface Source {
  title: string;
  path: string;
  category?: string;
  version?: string;
}

// Knowledge base file loaded from the local dataset directory
export interface KnowledgeFile {
  name: string;
  path: string; // relative path inside the dataset dir, e.g. "academic/krs.md"
  category: string; // top-level folder, e.g. "academic"
  content: string;
}

// Sync request/response
export const syncRequestSchema = z.object({
  force: z.boolean().optional().default(false),
});

export type SyncRequest = z.infer<typeof syncRequestSchema>;

export interface SyncResponse {
  success: boolean;
  filesProcessed: number;
  filesSkipped: number;
  errors: string[];
}

// Rate limit tracking
export interface RateLimitEntry {
  timestamp: number;
  count: number;
}

// Queue item
export interface QueueItem {
  requestId: string;
  conversationId: string;
  timestamp: number;
  expiresAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: AssistantResponse;
  error?: string;
}

// Deduplication fingerprint
export interface RequestFingerprint {
  identity: string;
  conversationId: string;
  normalizedMessage: string;
}