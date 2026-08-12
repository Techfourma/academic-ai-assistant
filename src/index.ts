import express, { Request, Response, NextFunction } from 'express';
import { config, isProduction, isMockMode, looksLikePlaceholder } from './config/env.js';
import { validateAuth, validateRequest } from './middleware/validation.js';
import { rateLimit } from './middleware/rateLimit.js';
import { concurrencyGuard } from './middleware/concurrency.js';
import { deduplicate } from './middleware/deduplicate.js';
import { scopeGuard } from './middleware/scopeGuard.js';
import { generateResponse } from './services/gemini.js';
import { syncKnowledge, getSyncStatus } from './services/sync.js';
import {
  loadKnowledgeBase,
  getDatasetDirectory,
  retrieveRelevantContext,
} from './services/knowledgeBase.js';
import { AIError } from './types/errors.js';

const app = express();
const PORT = parseInt(config.PORT, 10);

// Body parser with size limit
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// Health check endpoint
// ---------------------------------------------------------------------------
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mockMode: process.env.AI_MOCK_MODE === 'true',
  });
});

// ---------------------------------------------------------------------------
// Main assistant endpoint
// ---------------------------------------------------------------------------
app.post(
  '/api/assistant',
  validateAuth,
  validateRequest,
  deduplicate,
  rateLimit,
  concurrencyGuard,
  scopeGuard,

  // Main handler
  async (req: Request, res: Response) => {
    const request = req.validatedBody!;
    const requestId = request.requestId;
    const startTime = Date.now();

    console.log(`[REQUEST] Processing request ${requestId}`);

    try {
      // Retrieve relevant academic knowledge from the local dataset
      const retrieval = retrieveRelevantContext(request.message);
      const retrievedContext = retrieval?.context;
      const retrievedSources = retrieval?.sources ?? [];

      console.log(
        `[RAG] Retrieved ${retrievedSources.length} source(s) for request ${requestId}`
      );

      const response = await generateResponse(request, retrievedContext, retrievedSources);
      const duration = Date.now() - startTime;
      console.log(`[REQUEST] Completed request ${requestId} in ${duration}ms`);

      res.json(response);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (error instanceof AIError) {
        console.log(`[ERROR] Request ${requestId} failed: ${error.code} (${duration}ms)`);
        return res.status(error.statusCode).json({
          success: false,
          error: error.code,
          message: error.message,
        });
      }

      console.error(`[ERROR] Request ${requestId} unexpected error:`, error);
      return res.status(500).json({
        success: false,
        error: 'AI_INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Knowledge synchronization endpoints
// ---------------------------------------------------------------------------
app.post(
  '/api/sync',
  validateAuth,
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    console.log('[SYNC] Sync request received');

    try {
      const result = await syncKnowledge(false);

      const duration = Date.now() - startTime;
      console.log(`[SYNC] Completed in ${duration}ms`);

      res.json(result);
    } catch (error: any) {
      if (error instanceof AIError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.code,
          message: error.message,
        });
      }

      console.error('[SYNC] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: 'AI_INTERNAL_ERROR',
        message: 'Synchronization failed',
      });
    }
  }
);

app.get(
  '/api/sync/status',
  validateAuth,
  (req: Request, res: Response) => {
    const status = getSyncStatus();
    res.json(status);
  }
);

// ---------------------------------------------------------------------------
// Error handling & 404
// ---------------------------------------------------------------------------

interface ErrorResponse {
  success: boolean;
  error: string;
  message?: string;
}

function sendError(res: Response, status: number, body: ErrorResponse): void {
  res.status(status).json(body);
}

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[EXPRESS] Unhandled error:', err);

  sendError(res, 500, {
    success: false,
    error: 'AI_INTERNAL_ERROR',
    message: isProduction ? 'Internal server error' : err.message,
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function startServer() {
  if (!isMockMode && looksLikePlaceholder(config.GEMINI_API_KEY)) {
    console.warn(
      '[ENV] ⚠️ GEMINI_API_KEY tampak seperti placeholder (berisi "xxxx"/"your_"): ' +
      'chat ke Gemini asli akan gagal. Isi key valid di .env lalu jalankan "node scripts/check-gemini.mjs".'
    );
  }

  try {
    const files = await loadKnowledgeBase();
    console.log(
      `[KNOWLEDGE] Loaded ${files.length} knowledge file(s) from ${getDatasetDirectory()}`
    );
  } catch (error) {
    // A missing/unreadable dataset should not prevent the server from booting.
    console.error('[KNOWLEDGE] Failed to load knowledge base on startup:', error);
  }

  if (config.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`🚀 Academic AI Assistant running on port ${PORT}`);
      console.log(`   Mock mode: ${process.env.AI_MOCK_MODE === 'true'}`);
      console.log(`   Environment: ${config.NODE_ENV}`);
      console.log(`   Knowledge base: ${getDatasetDirectory()}`);
    });
  }
}

startServer();

export default app;