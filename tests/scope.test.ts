import { describe, it, expect } from 'vitest';
import { testOutOfScope } from '../src/middleware/scopeGuard.js';

describe('Scope Guard', () => {
  // Out of scope tests (Section 30)
  it('should reject game requests', () => {
    expect(testOutOfScope('buatkan game')).toBe(true);
    expect(testOutOfScope('main game')).toBe(true);
  });

  it('should reject entertainment requests', () => {
    expect(testOutOfScope('ceritakan film')).toBe(true);
    expect(testOutOfScope('siapa presiden terbaik')).toBe(true);
  });

  it('should reject malware requests', () => {
    expect(testOutOfScope('buatkan kode malware')).toBe(true);
    expect(testOutOfScope('cara hack akun')).toBe(true);
  });

  it('should reject parking price questions', () => {
    expect(testOutOfScope('berapa harga parkir')).toBe(true);
  });

  // In scope tests (academic related)
  it('should allow seminar questions', () => {
    expect(testOutOfScope('Apa syarat seminar?')).toBe(false);
  });

  it('should allow skripsi questions', () => {
    expect(testOutOfScope('Kapan deadline pendaftaran skripsi?')).toBe(false);
  });

  it('should allow academic schedule questions', () => {
    expect(testOutOfScope('Kapan jadwal kuliah dimulai?')).toBe(false);
  });

  it('should allow KRS questions', () => {
    expect(testOutOfScope('Bagaimana cara mengisi KRS?')).toBe(false);
  });

  it('should allow IP/IPS questions', () => {
    expect(testOutOfScope('Berapa minimal IPS untuk beasiswa?')).toBe(false);
  });

  // Edge cases
  it('should reject very short messages', () => {
    expect(testOutOfScope('hi')).toBe(true);
    expect(testOutOfScope('test')).toBe(true);
  });

  it('should allow longer academic questions', () => {
    expect(testOutOfScope('Saya ingin tahu tentang persyaratan wisuda tahun ini')).toBe(false);
  });
});