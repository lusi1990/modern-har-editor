import { JSONParser } from '@streamparser/json';
import { HarEntry, HarMetadata } from '../types/har';

// Use a self-referencing interface for the worker
interface WorkerContext {
  postMessage: (message: unknown) => void;
  onmessage: (event: MessageEvent) => void;
}

const ctx: WorkerContext = self as unknown as WorkerContext;

ctx.onmessage = async (e: MessageEvent) => {
  const { file } = e.data;
  if (!file) return;

  const parser = new JSONParser({
    stringBufferSize: 64 * 1024,
    separator: '',
  });

  const metadata: Record<string, unknown> = {};
  let currentBatch: HarEntry[] = [];
  const BATCH_SIZE = 100;

  parser.onValue = ({ value, key, stack }) => {
    // Collect metadata (everything in 'log' except 'entries')
    if (stack.length === 1 && stack[0].key === 'log' && key !== 'entries' && key !== undefined) {
      metadata[key] = value;
    }

    // Collect entries
    if (stack.length === 2 && stack[0].key === 'log' && stack[1].key === 'entries') {
      const entry: HarEntry = {
        ...(value as Omit<HarEntry, '_id'>),
        _id: crypto.randomUUID()
      };
      currentBatch.push(entry);

      if (currentBatch.length >= BATCH_SIZE) {
        ctx.postMessage({ type: 'entries', data: currentBatch });
        currentBatch = [];
      }
    }
  };

  parser.onEnd = () => {
    if (currentBatch.length > 0) {
      ctx.postMessage({ type: 'entries', data: currentBatch });
    }
    ctx.postMessage({ type: 'metadata', data: metadata as unknown as HarMetadata });
    ctx.postMessage({ type: 'done' });
  };

  parser.onError = (err) => {
    ctx.postMessage({ type: 'error', data: err.message });
  };

  // Read file as stream
  const reader = (file as File).stream().getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.write(value as Uint8Array);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'error', data: message });
  }
};
