#!/usr/bin/env node
/**
 * Cek validitas API key + model Gemini secara langsung (tanpa server).
 *
 * Penggunaan:
 *   node scripts/check-gemini.mjs
 *
 * Membaca GEMINI_API_KEY dan GEMINI_MODEL dari .env, lalu memanggil Gemini
 * sekali. Tidak menampilkan isi key.
 */
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const key = process.env.GEMINI_API_KEY || '';
const models = [
  process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];

console.log('GEMINI_API_KEY :', key ? `${key.slice(0, 4)}...${key.slice(-4)}` : '(kosong)');
console.log('GEMINI_MODEL   :', process.env.GEMINI_MODEL || '(tidak diset -> default gemini-2.0-flash)');
console.log('');

if (!key || key === 'your_gemini_api_key') {
  console.error('❌ GEMINI_API_KEY belum diisi. Dapatkan key gratis di: https://aistudio.google.com/apikey');
  process.exit(1);
}

for (const model of models) {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const m = genAI.getGenerativeModel({ model });
    const result = await m.generateContent('Balas hanya satu kata: OK');
    const text = (await result.response.text()).trim();
    console.log(`✅ MODEL ${model}: SUKSES -> "${text}"`);
    process.exit(0);
  } catch (e) {
    console.log(`❌ MODEL ${model}: GAGAL -> ${e.status || ''} ${(e.message || e).split('\n')[0]}`);
  }
}

process.exit(1);