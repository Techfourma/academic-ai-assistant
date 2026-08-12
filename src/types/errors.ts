export type ErrorCode =
  | 'AI_INVALID_REQUEST'
  | 'AI_UNAUTHORIZED'
  | 'AI_BUSY'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_OUT_OF_SCOPE'
  | 'AI_KNOWLEDGE_NOT_FOUND'
  | 'AI_PROVIDER_ERROR'
  | 'AI_INTERNAL_ERROR'
  | 'SYNC_IN_PROGRESS';

export class AIError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// Pre-defined error instances for convenience
export const errors = {
  invalidRequest: (message = 'Invalid request') =>
    new AIError('AI_INVALID_REQUEST', message, 400),

  unauthorized: (message = 'Unauthorized') =>
    new AIError('AI_UNAUTHORIZED', message, 401),

  busy: (message = 'AI service is busy, please try again later') =>
    new AIError('AI_BUSY', message, 503),

  rateLimited: (message = 'Rate limit exceeded') =>
    new AIError('AI_RATE_LIMITED', message, 429),

  timeout: (message = 'Request timeout') =>
    new AIError('AI_TIMEOUT', message, 504),

  outOfScope: (message = 'Request is out of scope') =>
    new AIError('AI_OUT_OF_SCOPE', message, 400),

  knowledgeNotFound: (message = 'Information not found in academic knowledge base') =>
    new AIError('AI_KNOWLEDGE_NOT_FOUND', message, 404),

  providerError: (message = 'AI provider error') =>
    new AIError('AI_PROVIDER_ERROR', message, 502),

  internalError: (message = 'Internal server error') =>
    new AIError('AI_INTERNAL_ERROR', message, 500),

  syncInProgress: (message = 'Synchronization already in progress') =>
    new AIError('SYNC_IN_PROGRESS', message, 409),
};