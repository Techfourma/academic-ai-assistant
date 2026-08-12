import { Request, Response, NextFunction } from 'express';
import { assistantRequestSchema, AssistantRequest } from '../types/api.js';
import { errors } from '../types/errors.js';
import { config, limits } from '../config/env.js';

/**
 * Validate authentication header
 */
export function validateAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  const token = authHeader.substring(7);

  if (token !== config.AI_ASSISTANT_SECRET) {
    // Log failed auth attempt (without exposing the token)
    console.log(`[AUTH] Failed authentication attempt for request: ${req.body?.requestId || 'unknown'}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  next();
}

/**
 * Validate request schema and input limits
 */
export function validateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // Parse and validate schema
    const result = assistantRequestSchema.safeParse(req.body);

    if (!result.success) {
      console.log(`[VALIDATION] Schema validation failed: ${result.error.issues[0]?.message}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
      });
    }

    const data = result.data as AssistantRequest;

    // Validate input length (Section 6)
    if (data.message.length > limits.maxInputChars) {
      console.log(`[VALIDATION] Input too long: ${data.message.length} chars (max: ${limits.maxInputChars})`);
      return res.status(400).json({
        success: false,
        error: `Message exceeds maximum length of ${limits.maxInputChars} characters`,
      });
    }

    // Validate context limits (Section 7)
    if (data.context) {
      // Cap memory at maxMemoriesInContext
      if (data.context.memory && data.context.memory.length > limits.maxMemoriesInContext) {
        data.context.memory = data.context.memory.slice(-limits.maxMemoriesInContext);
      }

      // Cap recentMessages at maxHistoryMessages
      if (data.context.recentMessages && data.context.recentMessages.length > limits.maxHistoryMessages) {
        data.context.recentMessages = data.context.recentMessages.slice(-limits.maxHistoryMessages);
      }

      // Sanitize message roles (Section 8) - remove any 'system' roles
      if (data.context.recentMessages) {
        data.context.recentMessages = data.context.recentMessages.filter(
          msg => msg.role === 'user' || msg.role === 'assistant'
        );
      }
    }

    // Attach validated data to request
    req.validatedBody = data;

    next();
  } catch (error) {
    console.error('[VALIDATION] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal validation error',
    });
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      validatedBody?: AssistantRequest;
    }
  }
}