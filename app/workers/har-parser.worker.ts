import { JSONParser } from '@streamparser/json';
import { HarEntry, HarMetadata } from '../types/har';

// Use a self-referencing interface for the worker
interface WorkerContext {
  postMessage: (message: unknown) => void;
  onmessage: (event: MessageEvent) => void;
}

const ctx: WorkerContext = self as unknown as WorkerContext;

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
};

ctx.onmessage = async (e: MessageEvent) => {
  const { file } = e.data;
  if (!file) return;

  console.log('[Worker] Start parsing:', file.name, '(', file.size, 'bytes )');
  
  const parser = new JSONParser({
    stringBufferSize: 64 * 1024,
  });

  const metadata: Record<string, unknown> = {};
  let currentBatch: HarEntry[] = [];
  const BATCH_SIZE = 500;
  let totalEntries = 0;
  let isDone = false;

  const finish = () => {
    if (isDone) return;
    isDone = true;
    
    if (currentBatch.length > 0) {
      ctx.postMessage({ type: 'entries', data: currentBatch });
    }
    
    // Ensure essential metadata
    const finalMetadata: HarMetadata = {
      version: (metadata.version as string) || '1.2',
      creator: (metadata.creator as { name: string; version: string }) || { name: 'Unknown', version: '0.0' },
      browser: (metadata.browser as { name: string; version: string } | undefined),
      pages: (metadata.pages as unknown[] | undefined),
      comment: (metadata.comment as string | undefined)
    };

    console.log('[Worker] Finished. Total entries found:', totalEntries);
    ctx.postMessage({ type: 'metadata', data: finalMetadata });
    ctx.postMessage({ type: 'done' });
  };

  parser.onValue = ({ value, key, stack }) => {
    // Check if we are inside 'log'
    const isInsideLog = stack.length > 0 && stack[0] === 'log';
    
    if (isInsideLog) {
      if (stack.length === 1) {
        if (key !== 'entries' && key !== undefined) {
          metadata[key as string] = value;
        }
      }
      
      if (stack.length === 2 && stack[1] === 'entries') {
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
    }
  };

  parser.onEnd = () => {
    console.log('[Worker] onEnd event triggered');
    finish();
  };

  parser.onError = (err) => {
    console.error('[Worker] Parser error:', err);
    ctx.postMessage({ type: 'error', data: `JSON Parser Error: ${err.message}` });
  };

  try {
    const reader = (file as File).stream().getReader();
    let bytesRead = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[Worker] Stream done. Total bytes read:', bytesRead);
        break;
      }
      bytesRead += value.length;
      parser.write(value as Uint8Array);
    }
    
    setTimeout(() => {
      if (!isDone) {
        console.warn('[Worker] Forcing completion after stream end');
        finish();
      }
    }, 200);

  } catch (err: unknown) {
    console.error('[Worker] Stream Error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'error', data: `Stream Error: ${msg}` });
  }
};
