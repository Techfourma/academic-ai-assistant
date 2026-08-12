import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { limits } from '../config/env.js';

// Track in-flight requests by fingerprint
interface InFlightRequest {
  requestId: string;
  timestamp: number;
  promise?: Promise<any>;
}

const inFlightRequests = new Map<string, InFlightRequest>();

// Cleanup interval
const CLEANUP_INTERVAL = 30 * 1000; // Every 30 seconds

setInterval(() => {
  const now = Date.now();
  const timeout = limits.requestTimeoutMs;

  for (const [fingerprint, request] of inFlightRequests.entries()) {
    if (now - request.timestamp > timeout) {
      inFlightRequests.delete(fingerprint);
    }
  }
}, CLEANUP_INTERVAL);

function normalizeMessage(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function generateFingerprint(req: Request): string {
  const body = req.validatedBody || req.body;
  const identity = body.conversationId || 'unknown';
  const normalizedMessage = normalizeMessage(body.message || '');

  const fingerprintData = `${identity}:${normalizedMessage}`;
  return crypto.createHash('sha256').update(fingerprintData).digest('hex');
}

/**
 * Deduplication middleware
 */
export function deduplicate(req: Request, res: Response, next: NextFunction) {
  const fingerprint = generateFingerprint(req);
  const body = req.validatedBody || req.body;
  const requestId = body.requestId || 'unknown';
  const now = Date.now();

  const existing = inFlightRequests.get(fingerprint);

  if (existing) {
    // Check if still in flight
    if (now - existing.timestamp < limits.requestTimeoutMs) {
      console.log(`[DEDUPE] Duplicate request detected: ${requestId} matches ${existing.requestId}`);

      // Return AI_BUSY for duplicate in-flight requests
      return res.status(503).json({
        success: false,
        error: 'AI_BUSY',
        message: 'Duplicate request detected, please wait for previous response',
      });
    } else {
      // Expired, remove it
      inFlightRequests.delete(fingerprint);
    }
  }

  // Register this request as in-flight
  inFlightRequests.set(fingerprint, {
    requestId,
    timestamp: now,
  });

  // Set up cleanup on response finish
  res.on('finish', () => {
    const current = inFlightRequests.get(fingerprint);
    if (current && current.requestId === requestId) {
      inFlightRequests.delete(fingerprint);
    }
  });

  // Attach fingerprint to request for downstream use
  req.fingerprint = fingerprint;

  next();
}

/**
 * Export for testing
 */
export function clearInFlightRequests() {
  inFlightRequests.clear();
}

export function getInFlightCount(): number {
  return inFlightRequests.size;
}

export function getNormalizedMessage(message: string): string {
  return normalizeMessage(message);
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      fingerprint?: string;
    }
  }
}