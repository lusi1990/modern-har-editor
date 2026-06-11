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

  console.log('[Worker] Parsing file:', file.name, '(', Math.round(file.size / 1024), 'KB)');
  
  const parser = new JSONParser({ 
    stringBufferSize: 64 * 1024,
  });

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
    
    const finalMetadata: HarMetadata = {
      version: (metadata.version as string) || '1.2',
      creator: (metadata.creator as { name: string; version: string }) || { name: 'Unknown', version: '1.0' },
      browser: (metadata.browser as { name: string; version: string } | undefined),
      pages: (metadata.pages as unknown[] | undefined),
      comment: (metadata.comment as string | undefined)
    };

    console.log('[Worker] Finished. Total entries found:', totalEntries);
    ctx.postMessage({ type: 'metadata', data: finalMetadata });
    ctx.postMessage({ type: 'done' });
  };

  parser.onValue = ({ value, key, stack }) => {
    if (stack.length === 1 && (stack[0] as any) === 'log') {
      if (key !== 'entries' && key !== undefined) {
        metadata[key as string] = value;
      }
    }

    const isEntryArray = (stack[stack.length - 1] as any) === 'entries';
    const isArrayElement = typeof key === 'number';

    if (isEntryArray && isArrayElement) {
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

    // Structural fallback: check if it has request/response but isn't in 'entries'
    if (!isEntryArray && isArrayElement && stack.length > 0) {
       const v = value as Record<string, unknown>;
       if (v && typeof v === 'object' && v.request && v.response) {
         const entry: HarEntry = {
          ...(value as Omit<HarEntry, '_id'>),
          _id: generateId()
        };
        currentBatch.push(entry);
        totalEntries++;
       }
    }
  };

  parser.onEnd = () => {
    finish();
  };

  parser.onError = (err) => {
    console.error('[Worker] Parser Error:', err);
    ctx.postMessage({ type: 'error', data: err.message });
  };

  try {
    const reader = (file as File).stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.write(value as Uint8Array);
    }
    setTimeout(finish, 100);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'error', data: msg });
  }
};
