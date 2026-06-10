import { JSONParser } from '@streamparser/json';
import { HarEntry, HarMetadata } from '../types/har';

// Use a self-referencing interface for the worker
interface WorkerContext {
  postMessage: (message: unknown) => void;
  onmessage: (event: MessageEvent) => void;
}

const ctx: WorkerContext = self as unknown as WorkerContext;

// Fallback for crypto.randomUUID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

ctx.onmessage = async (e: MessageEvent) => {
  const { file } = e.data;
  if (!file) return;

  console.log('[Worker] Starting parse for file:', file.name, 'size:', file.size);
  console.time('har-parse');

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
    console.timeEnd('har-parse');
    console.log('[Worker] Finishing parse. Total entries:', totalEntries);
    
    if (currentBatch.length > 0) {
      ctx.postMessage({ type: 'entries', data: currentBatch });
    }
    
    // Ensure metadata has required fields for our app to function
    if (!metadata.version) metadata.version = '1.2';
    if (!metadata.creator) metadata.creator = { name: 'Unknown', version: '0.0' };

    ctx.postMessage({ type: 'metadata', data: metadata as unknown as HarMetadata });
    ctx.postMessage({ type: 'done' });
  };

  parser.onValue = ({ value, key, stack }) => {
    // Collect metadata (everything in 'log' except 'entries')
    // @streamparser/json stack entries can be string keys or numeric indices
    
    // HAR structure is {"log": {"version": "1.2", "entries": [...]}}
    // So stack[0] should be "log"
    if (stack.length === 1 && stack[0] === 'log') {
      if (key !== 'entries' && key !== undefined) {
        metadata[key as string] = value;
      }
    }

    // Collect entries
    // Path: log.entries[i]
    // stack will be ['log', 'entries', 0], ['log', 'entries', 1], etc.
    if (stack.length === 2 && stack[0] === 'log' && stack[1] === 'entries') {
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
  };

  parser.onEnd = () => {
    console.log('[Worker] Parser onEnd triggered');
    finish();
  };

  parser.onError = (err) => {
    console.error('[Worker] Parser error:', err);
    ctx.postMessage({ type: 'error', data: err.message });
  };

  // Read file as stream
  try {
    const stream = (file as File).stream();
    const reader = stream.getReader();
    let bytesRead = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[Worker] File stream reading complete. Bytes read:', bytesRead);
        break;
      }
      bytesRead += value.length;
      parser.write(value);
    }
    
    // The parser should trigger onEnd when the JSON is fully parsed.
    // If it doesn't, we force finish after the stream ends.
    // We give it a tiny bit of time to process the last chunk.
    setTimeout(() => finish(), 100);

  } catch (err: unknown) {
    console.error('[Worker] Stream read error:', err);
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'error', data: message });
  }
};
