import { Request, Response, NextFunction } from 'express';
import { errors } from '../types/errors.js';
import { limits } from '../config/env.js';

// In-memory rate limit storage (ephemeral, per serverless instance)
interface RateLimitData {
  minuteTimestamp: number;
  minuteCount: number;
  hourTimestamp: number;
  hourCount: number;
}

// Map: identity -> rate limit data
const rateLimitMap = new Map<string, RateLimitData>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  for (const [key, data] of rateLimitMap.entries()) {
    if (data.hourTimestamp < oneHourAgo) {
      rateLimitMap.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Generate a rate limit key based on request identity
 * For V1, we use conversationId as the identity
 */
function getRateLimitKey(req: Request): string {
  const body = req.validatedBody || req.body;
  return `ratelimit:${body.conversationId || 'unknown'}`;
}

/**
 * Rate limiting middleware
 */
export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = getRateLimitKey(req);
  const now = Date.now();

  let data = rateLimitMap.get(key);

  // Initialize if not exists
  if (!data) {
    data = {
      minuteTimestamp: now,
      minuteCount: 0,
      hourTimestamp: now,
      hourCount: 0,
    };
    rateLimitMap.set(key, data);
  }

  // Reset minute counter if expired
  if (now - data.minuteTimestamp > 60 * 1000) {
    data.minuteTimestamp = now;
    data.minuteCount = 0;
  }

  // Reset hour counter if expired
  if (now - data.hourTimestamp > 60 * 60 * 1000) {
    data.hourTimestamp = now;
    data.hourCount = 0;
  }

  // Check minute limit
  if (data.minuteCount >= limits.maxRequestsPerMinute) {
    console.log(`[RATELIMIT] Minute limit exceeded for ${key}`);
    return res.status(429).json({
      success: false,
      error: 'AI_RATE_LIMITED',
      message: 'Too many requests per minute',
    });
  }

  // Check hour limit
  if (data.hourCount >= limits.maxRequestsPerHour) {
    console.log(`[RATELIMIT] Hour limit exceeded for ${key}`);
    return res.status(429).json({
      success: false,
      error: 'AI_RATE_LIMITED',
      message: 'Too many requests per hour',
    });
  }

  // Increment counters
  data.minuteCount++;
  data.hourCount++;
  rateLimitMap.set(key, data);

  // Attach remaining limits to headers
  res.setHeader('X-RateLimit-Remaining-Minute', limits.maxRequestsPerMinute - data.minuteCount);
  res.setHeader('X-RateLimit-Remaining-Hour', limits.maxRequestsPerHour - data.hourCount);

  next();
}

/**
 * Export for testing
 */
export function clearRateLimits() {
  rateLimitMap.clear();
}

export function getRateLimitData(key: string): RateLimitData | undefined {
  return rateLimitMap.get(key);
}