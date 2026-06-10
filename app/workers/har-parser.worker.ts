import { JSONParser } from '@streamparser/json';
import { HarEntry, HarMetadata } from '../types/har';

interface WorkerContext {
  postMessage: (message: unknown) => void;
  onmessage: (event: MessageEvent) => void;
}

const ctx: WorkerContext = self as unknown as WorkerContext;

const generateId = () => {
  try { return crypto.randomUUID(); } 
  catch { return Math.random().toString(36).substring(2) + Date.now().toString(36); }
};

ctx.onmessage = async (e: MessageEvent) => {
  const { file } = e.data;
  if (!file) return;

  console.log('[Worker] Advanced parsing started for:', file.name);
  
  const parser = new JSONParser({ stringBufferSize: 64 * 1024 });

  const metadata: Record<string, unknown> = {};
  let currentBatch: HarEntry[] = [];
  const BATCH_SIZE = 200;
  let totalEntries = 0;
  let isDone = false;

  const finish = () => {
    if (isDone) return;
    isDone = true;
    
    if (currentBatch.length > 0) {
      ctx.postMessage({ type: 'entries', data: currentBatch });
    }
    
    // Fallback metadata if not found
    const finalMetadata: HarMetadata = {
      version: (metadata.version as string) || '1.2',
      creator: (metadata.creator as { name: string; version: string }) || { name: 'Firefox-Compatible', version: '1.0' },
      browser: (metadata.browser as { name: string; version: string } | undefined),
      pages: (metadata.pages as unknown[] | undefined),
      comment: (metadata.comment as string | undefined)
    };

    console.log('[Worker] Detection finished. Found entries:', totalEntries);
    ctx.postMessage({ type: 'metadata', data: finalMetadata });
    ctx.postMessage({ type: 'done' });
  };

  parser.onValue = ({ value, key, stack }) => {
    // Strategy: Look for ANY object that is an element of an array named 'entries'
    // Regardless of where that 'entries' array is located in the JSON.
    
    const path = stack.join('.');
    
    // If we find metadata-like fields anywhere in the first few levels, grab them
    if (stack.length <= 2 && typeof value !== 'object') {
      if (key && ['version', 'title', 'name'].includes(key as string)) {
        metadata[key as string] = value;
      }
    }

    // Capture entry: path will look like "log.entries.0", "entries.5", etc.
    // We check if 'entries' is the second-to-last element in the stack
    const entriesIndex = stack.indexOf('entries');
    if (entriesIndex !== -1 && stack.length === entriesIndex + 2) {
      if (typeof value === 'object' && value !== null) {
        const entry: HarEntry = {
          ...(value as Omit<HarEntry, '_id'>),
          _id: generateId()
        };
        currentBatch.push(entry);
        totalEntries++;

        if (currentBatch.length >= BATCH_SIZE) {
          ctx.postMessage({ type: 'entries', data: currentBatch });
          currentBatch = [];
        }
      }
    }
    
    // Also try to capture creator/browser if they appear
    if (key === 'creator' || key === 'browser') {
      metadata[key as string] = value;
    }
  };

  parser.onEnd = () => {
    console.log('[Worker] JSON end reached');
    finish();
  };

  parser.onError = (err) => {
    console.error('[Worker] JSON Error:', err);
    ctx.postMessage({ type: 'error', data: err.message });
  };

  try {
    const reader = (file as File).stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.write(value as Uint8Array);
    }
    // Final flush
    setTimeout(finish, 150);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'error', data: msg });
  }
};
