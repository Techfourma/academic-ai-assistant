import { Request, Response, NextFunction } from 'express';
import { errors } from '../types/errors.js';

// Out-of-scope patterns (Indonesian context for academic assistant)
const outOfScopePatterns = [
  // Game/entertainment requests
  /buat(kan)?\s+game/i,
  /main\s+game/i,
  /cerita(kan)?\s+film/i,
  /nonton\s+film/i,
  /lagu\s+.+/i,
  /musik\s+.+/i,

  // General knowledge outside academic scope
  /siapa\s+(presiden|menteri|artis|penyanyi|aktor)/i,
  /berapa\s+(harga\s+parkir|umur|tinggi\s+badan)/i,
  /cuaca\s+.*/i,
  /berita\s+.*/i,

  // Code generation for non-academic purposes
  /buat(kan)?\s+(kode\s+)?(malware|virus|hack)/i,
  /cara\s+(hack|crack|bypass)/i,

  // Personal advice
  /jodoh\s+.*/i,
  /ramalan\s+.*/i,
  /zodiak\s+.*/i,

  // Shopping/commerce
  /beli\s+.*/i,
  /jual\s+.*/i,
  /harga\s+produk/i,

  // Social media
  /instagram\s+.*/i,
  /tiktok\s+.*/i,
  /facebook\s+.*/i,
  /whatsapp\s+.*/i,
];

// Academic-related keywords that are allowed
const allowedKeywords = [
  /seminar/i,
  /skripsi/i,
  /tesis/i,
  /disertasi/i,
  /ujian/i,
  /nilai/i,
  /krs/i,
  /ips/i,
  /ipk/i,
  /prasyarat/i,
  /persyaratan/i,
  /jadwal/i,
  /kuliah/i,
  /dosen/i,
  /prodi/i,
  /jurusan/i,
  /fakultas/i,
  /universitas/i,
  /akademik/i,
  /kurikulum/i,
  /mata\s+kuliah/i,
  /sks/i,
  /wisuda/i,
  /yudisium/i,
];

/**
 * Check if request is out of scope
 */
function isOutOfScope(message: string): boolean {
  const trimmedMessage = message.trim();

  // First check if it matches allowed academic keywords
  for (const pattern of allowedKeywords) {
    if (pattern.test(trimmedMessage)) {
      return false; // Allowed
    }
  }

  // Then check if it matches out-of-scope patterns
  for (const pattern of outOfScopePatterns) {
    if (pattern.test(trimmedMessage)) {
      return true; // Out of scope
    }
  }

  // Check if message is too short or generic
  if (trimmedMessage.length < 5) {
    return true; // Too vague
  }

  // Check for common greetings that aren't questions
  const greetings = ['hi', 'hello', 'halo', 'pagi', 'siang', 'malam'];
  const lowerMessage = trimmedMessage.toLowerCase();
  if (greetings.some(g => lowerMessage === g || lowerMessage.startsWith(g + ' '))) {
    // Greetings alone without a question are out of scope
    if (!lowerMessage.includes('?') && lowerMessage.length < 20) {
      return true;
    }
  }

  return false; // Default to allowing
}

/**
 * Scope guard middleware
 */
export function scopeGuard(req: Request, res: Response, next: NextFunction) {
  const body = req.validatedBody || req.body;
  const message = body.message || '';

  if (isOutOfScope(message)) {
    console.log(`[SCOPE] Out-of-scope request detected: "${message.substring(0, 50)}..."`);
    return res.status(400).json({
      success: false,
      error: 'AI_OUT_OF_SCOPE',
      message: 'Request is out of scope. This assistant only answers academic-related questions.',
    });
  }

  next();
}

/**
 * Export for testing
 */
export function testOutOfScope(message: string): boolean {
  return isOutOfScope(message);
}