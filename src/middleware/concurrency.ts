import { Request, Response, NextFunction } from 'express';
import { errors } from '../types/errors.js';
import { limits } from '../config/env.js';

// Track active requests per conversation
const activeRequests = new Map<string, number>();

// Small bounded queue for overflow (Section 15)
interface QueuedRequest {
  requestId: string;
  resolve: () => void;
  reject: (error: Error) => void;
  timestamp: number;
}

const queuedRequests = new Map<string, QueuedRequest[]>();

// Cleanup interval
const CLEANUP_INTERVAL = 10 * 1000; // Every 10 seconds

setInterval(() => {
  const now = Date.now();
  const timeout = limits.requestTimeoutMs;

  // Clean up stale queued requests
  for (const [key, queue] of queuedRequests.entries()) {
    const validQueue = queue.filter(item => now - item.timestamp < timeout);

    // Reject expired items
    const expired = queue.filter(item => now - item.timestamp >= timeout);
    expired.forEach(item => {
      item.reject(new Error('Queue timeout'));
    });

    if (validQueue.length === 0) {
      queuedRequests.delete(key);
    } else {
      queuedRequests.set(key, validQueue);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Get concurrency key based on conversation
 */
function getConcurrencyKey(req: Request): string {
  const body = req.validatedBody || req.body;
  return `concurrency:${body.conversationId || 'unknown'}`;
}

/**
 * Concurrency guard middleware
 */
export function concurrencyGuard(req: Request, res: Response, next: NextFunction) {
  const key = getConcurrencyKey(req);
  const body = req.validatedBody || req.body;
  const requestId = body.requestId || 'unknown';

  const activeCount = activeRequests.get(key) || 0;
  const queue = queuedRequests.get(key) || [];

  // Check if we can process immediately
  if (activeCount < 1 && queue.length === 0) {
    // Mark as active
    activeRequests.set(key, 1);

    // Set up cleanup on response finish
    res.on('finish', () => {
      const count = activeRequests.get(key) || 0;
      if (count > 0) {
        activeRequests.set(key, count - 1);
      }

      // Process next in queue if available
      const q = queuedRequests.get(key);
      if (q && q.length > 0) {
        const nextItem = q.shift();
        if (nextItem) {
          nextItem.resolve();
          queuedRequests.set(key, q);
        }
      }
    });

    return next();
  }

  // Check if queue has room (Section 15: MAX_SERVER_QUEUE=2)
  if (queue.length >= limits.maxServerQueue) {
    console.log(`[CONCURRENCY] Queue full for ${key}, rejecting request ${requestId}`);
    return res.status(503).json({
      success: false,
      error: 'AI_BUSY',
      message: 'AI service is busy, please try again later',
    });
  }

  // Add to queue with timeout
  return new Promise<void>((resolve, reject) => {
    const queueItem: QueuedRequest = {
      requestId,
      resolve,
      reject: (error: Error) => {
        reject(error);
        res.status(503).json({
          success: false,
          error: 'AI_BUSY',
          message: 'Request queued but timed out',
        });
      },
      timestamp: Date.now(),
    };

    queuedRequests.set(key, [...queue, queueItem]);

    console.log(`[CONCURRENCY] Request ${requestId} queued for ${key} (position: ${queue.length + 1})`);

    // Set timeout
    const timeoutId = setTimeout(() => {
      const q = queuedRequests.get(key);
      if (q) {
        const index = q.findIndex(item => item.requestId === requestId);
        if (index !== -1) {
          q.splice(index, 1);
          queuedRequests.set(key, q);
        }
      }
      reject(new Error('Queue timeout'));
    }, limits.requestTimeoutMs);

    // When it's our turn
    queueItem.resolve = () => {
      clearTimeout(timeoutId);
      activeRequests.set(key, (activeRequests.get(key) || 0) + 1);

      res.on('finish', () => {
        const count = activeRequests.get(key) || 0;
        if (count > 0) {
          activeRequests.set(key, count - 1);
        }

        // Process next in queue
        const q = queuedRequests.get(key);
        if (q && q.length > 0) {
          const nextItem = q.shift();
          if (nextItem) {
            nextItem.resolve();
            queuedRequests.set(key, q);
          }
        }
      });

      next();
    };
  }).catch(error => {
    // Already handled in reject
  });
}

/**
 * Export for testing
 */
export function clearConcurrencyState() {
  activeRequests.clear();
  queuedRequests.clear();
}

export function getActiveRequests(key: string): number {
  return activeRequests.get(key) || 0;
}

export function getQueuedCount(key: string): number {
  return (queuedRequests.get(key) || []).length;
}