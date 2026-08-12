import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadKnowledgeBase,
  resetKnowledgeBase,
  retrieveRelevantContext,
  getKnowledgeFiles,
  getKnowledgeVersion,
  isKnowledgeLoaded,
  getDatasetDirectory,
} from '../src/services/knowledgeBase.js';

describe('Knowledge Base Service (local dataset)', () => {
  beforeEach(async () => {
    resetKnowledgeBase();
    await loadKnowledgeBase();
  });

  it('should load files from the local dataset directory', () => {
    expect(isKnowledgeLoaded()).toBe(true);
    expect(getKnowledgeVersion()).toBeGreaterThan(0);
    expect(getKnowledgeFiles().length).toBeGreaterThan(0);
  });

  it('should load every expected dataset file with non-empty content', () => {
    const files = getKnowledgeFiles();
    const paths = files.map(f => f.path);

    for (const expected of [
      'academic/calendar.md',
      'academic/cuti.md',
      'academic/krs.md',
      'academic/presensi.md',
      'academic/ujian.md',
      'academic/wisuda.md',
      'campus/profile.md',
      'seminar/requirements.md',
      'seminar/procedure.md',
      'regulations/rules.md',
    ]) {
      expect(paths).toContain(expected);
    }

    expect(files.every(f => f.content.trim().length > 0)).toBe(true);
  });

  it('should group files by their top-level folder as category', () => {
    const krs = getKnowledgeFiles().find(f => f.path === 'academic/krs.md');
    expect(krs?.category).toBe('academic');

    const profile = getKnowledgeFiles().find(f => f.path === 'campus/profile.md');
    expect(profile?.category).toBe('campus');
  });

  it('should resolve the dataset directory to an absolute path', () => {
    const dir = getDatasetDirectory();
    expect(dir.endsWith(`${process.platform === 'win32' ? '\\' : '/'}dataset`)).toBe(true);
  });

  describe('retrieval', () => {
    it('should retrieve KRS knowledge for KRS questions', () => {
      const result = retrieveRelevantContext('Bagaimana cara mengisi KRS?', 3);
      expect(result).not.toBeNull();
      expect(result!.context).toContain('academic/krs.md');
      expect(result!.sources.some(s => s.path === 'academic/krs.md')).toBe(true);
    });

    it('should retrieve seminar knowledge for seminar questions', () => {
      const result = retrieveRelevantContext('Apa syarat mengikuti seminar proposal?', 3);
      expect(result).not.toBeNull();
      expect(result!.context).toContain('seminar/requirements.md');
    });

    it('should retrieve wisuda knowledge for wisuda questions', () => {
      const result = retrieveRelevantContext('Kapan pendaftaran wisuda tahun ini?', 3);
      expect(result).not.toBeNull();
      expect(result!.context).toContain('academic/wisuda.md');
    });

    it('should include category metadata in the returned sources', () => {
      const result = retrieveRelevantContext('aturan kehadiran minimal presensi', 3);
      expect(result).not.toBeNull();
      for (const source of result!.sources) {
        expect(source.category).toBeDefined();
      }
    });

    it('should return null when no knowledge matches the query', () => {
      const result = retrieveRelevantContext('zzzzxq notarealterm qqqq', 3);
      expect(result).toBeNull();
    });

    it('should cap the number of returned files', () => {
      const result = retrieveRelevantContext('akademik semester kuliah ujian presensi', 2);
      expect(result).not.toBeNull();
      expect(result!.sources.length).toBeLessThanOrEqual(2);
    });
  });
});