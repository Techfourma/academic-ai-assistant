import { errors, AIError } from '../types/errors.js';
import { SyncResponse } from '../types/api.js';
import {
  loadKnowledgeBase,
  getDatasetDirectory,
} from './knowledgeBase.js';

// ---------------------------------------------------------------------------
// Knowledge synchronization service.
//
// Reads academic knowledge from the LOCAL dataset directory
// (default: <project root>/dataset) and rebuilds the in-memory index used for
// retrieval. No external sources (such as GitHub) are involved.
// ---------------------------------------------------------------------------

let isSyncing = false;
let lastSyncTime: number | null = null;

const SUPPORTED_EXTENSIONS = ['.md', '.txt'];

/** File is indexable only when it has a supported extension. */
function isSupportedFile(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

/**
 * (Re)scan the local dataset directory and rebuild the knowledge index.
 * `force=true` overrides the "already syncing" guard (used to rescan).
 */
export async function syncKnowledge(force: boolean = false): Promise<SyncResponse> {
  if (isSyncing && !force) {
    throw errors.syncInProgress('Synchronization already in progress');
  }

  isSyncing = true;
  const startTime = Date.now();

  const response: SyncResponse = {
    success: false,
    filesProcessed: 0,
    filesSkipped: 0,
    errors: [],
  };

  try {
    console.log(`[SYNC] Loading knowledge base from local dataset: ${getDatasetDirectory()}`);

    // Force a fresh scan of the local dataset directory
    const files = await loadKnowledgeBase(true);

    const validFiles = files.filter(file => isSupportedFile(file.name));
    const skippedCount = files.length - validFiles.length;

    console.log(
      `[SYNC] Found ${files.length} file(s), ${validFiles.length} indexed, ${skippedCount} skipped`
    );

    response.success = true;
    response.filesProcessed = validFiles.length;
    response.filesSkipped = skippedCount;

    lastSyncTime = Date.now();

    console.log(`[SYNC] Synchronization completed in ${Date.now() - startTime}ms`);
  } catch (error: any) {
    console.error('[SYNC] Synchronization failed:', error);

    response.errors.push(error.message || 'Unknown error during sync');

    if (error instanceof AIError) {
      throw error;
    }
  } finally {
    isSyncing = false;
  }

  return response;
}

/**
 * Get sync status
 */
export function getSyncStatus(): {
  isSyncing: boolean;
  lastSyncTime: number | null;
} {
  return {
    isSyncing,
    lastSyncTime,
  };
}

/**
 * Reset sync state (for testing)
 */
export function resetSyncState() {
  isSyncing = false;
  lastSyncTime = null;
}