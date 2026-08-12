import { describe, it, expect, beforeEach } from 'vitest';
import { assistantRequestSchema } from '../src/types/api.js';

describe('Request Validation', () => {
  const validRequest = {
    requestId: '123e4567-e89b-12d3-a456-426614174000',
    conversationId: '123e4567-e89b-12d3-a456-426614174001',
    message: 'Apa syarat seminar?',
    context: {
      memory: [],
      recentMessages: [],
    },
  };

  it('should accept valid request', () => {
    const result = assistantRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID requestId', () => {
    const invalidRequest = { ...validRequest, requestId: 'invalid-uuid' };
    const result = assistantRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('should reject empty message', () => {
    const invalidRequest = { ...validRequest, message: '' };
    const result = assistantRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('should reject system role in recentMessages', () => {
    const invalidRequest = {
      ...validRequest,
      context: {
        ...validRequest.context,
        recentMessages: [
          { role: 'system' as any, content: 'test' },
        ],
      },
    };
    const result = assistantRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('should accept only user and assistant roles', () => {
    const validContextRequest = {
      ...validRequest,
      context: {
        ...validRequest.context,
        recentMessages: [
          { role: 'user' as const, content: 'Hello' },
          { role: 'assistant' as const, content: 'Hi there' },
        ],
      },
    };
    const result = assistantRequestSchema.safeParse(validContextRequest);
    expect(result.success).toBe(true);
  });

  it('should default context to empty if not provided', () => {
    const minimalRequest = {
      requestId: validRequest.requestId,
      conversationId: validRequest.conversationId,
      message: validRequest.message,
    };
    const result = assistantRequestSchema.safeParse(minimalRequest);
    expect(result.success).toBe(true);
  });
});