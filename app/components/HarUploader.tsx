'use client';

import React from 'react';
import { Upload } from 'lucide-react';
import { useHarStore } from '../store/useHarStore';
import { cn } from '../utils';

export const HarUploader: React.FC = () => {
  const { clear, setFileName, setLoading, setMetadata, addEntries } = useHarStore();

  const handleFile = (file: File) => {
    if (!file) return;
    
    clear();
    setFileName(file.name);
    setLoading(true);

    const worker = new Worker(new URL('../workers/har-parser.worker.ts', import.meta.url));
    
    worker.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'metadata') {
        setMetadata(data);
      } else if (type === 'entries') {
        addEntries(data);
      } else if (type === 'done') {
        setLoading(false);
        worker.terminate();
      } else if (type === 'error') {
        console.error('Worker error:', data);
        setLoading(false);
        worker.terminate();
      }
    };

    worker.postMessage({ file });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.har')) {
      handleFile(file);
    }
  };

  return (
    <div 
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-colors cursor-pointer",
        "border-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      )}
      onClick={() => document.getElementById('har-upload')?.click()}
    >
      <input 
        id="har-upload"
        type="file" 
        accept=".har,application/json" 
        className="hidden" 
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-white shadow-sm dark:bg-zinc-900">
          <Upload className="w-8 h-8 text-zinc-500" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium">Click or drag & drop a HAR file</p>
          <p className="text-sm text-zinc-500">Supports large files via streaming</p>
        </div>
      </div>
    </div>
  );
};
