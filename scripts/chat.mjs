#!/usr/bin/env node
/**
 * Chat helper — tes endpoint /api/assistant dengan mudah.
 *
 * Penggunaan:
 *   node scripts/chat.mjs "Apa syarat seminar proposal?"
 *   node scripts/chat.mjs "Berapa minimal kehadiran agar bisa ikut ujian?"
 *
 * Mode default memakai MOCK (tanpa token Gemini). Ganti MOCK=0 untuk
 * memakai Gemini sungguhan (pastikan GEMINI_API_KEY terisi di .env).
 */
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

// Override so the .env value always wins over any stale env var exported in
// ~/.bashrc that would otherwise make the API key invalid.
dotenv.config({ override: true });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SECRET = process.env.AI_ASSISTANT_SECRET || 'your_internal_secret';

const message = process.argv.slice(2).join(' ') || 'Apa syarat mengikuti seminar proposal?';

// Satu conversationId agar history percakapan konsisten dalam satu run
const conversationId = randomUUID();

async function chat(text) {
  const res = await fetch(`${BASE_URL}/api/assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({
      requestId: randomUUID(),
      conversationId,
      message: text,
    }),
  });

  const data = await res.json();

  console.log(`\n👤 Anda: ${text}`);
  if (data.success) {
    console.log(`🤖 Asisten: ${data.answer}`);
    if (data.sources?.length) {
      console.log('📚 Sumber dari dataset:');
      for (const s of data.sources) {
        console.log(`   - ${s.path}`);
      }
    }
  } else {
    console.log(`⚠️  Error: ${data.error} — ${data.message || ''}`);
  }
}

await chat(message);
