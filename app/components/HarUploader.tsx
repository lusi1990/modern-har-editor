'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { useHarStore } from '../store/useHarStore';
import { cn } from '../utils';

export const HarUploader: React.FC = () => {
  const { clear, setFileName, setLoading, setMetadata, addEntries } = useHarStore();

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    
    clear();
    setFileName(file.name);
    setLoading(true);

    // Create a new worker
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
        alert(`Error parsing HAR: ${data}`);
        setLoading(false);
        worker.terminate();
      }
    };

    worker.postMessage({ file });
  }, [clear, setFileName, setLoading, setMetadata, addEntries]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFile(acceptedFiles[0]);
    }
  }, [handleFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/json': ['.har', '.json'],
    },
    multiple: false
  });

  return (
    <div 
      {...getRootProps()}
      className={cn(
        "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all cursor-pointer outline-none",
        isDragActive 
          ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/20" 
          : "border-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "p-4 rounded-full bg-white shadow-sm dark:bg-zinc-900 transition-transform",
          isDragActive && "scale-110"
        )}>
          <Upload className={cn(
            "w-8 h-8 transition-colors",
            isDragActive ? "text-blue-500" : "text-zinc-400"
          )} />
        </div>
        <div className="text-center px-8">
          <p className="text-lg font-medium">
            {isDragActive ? "Drop the HAR file here" : "Click or drag & drop a HAR file"}
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            Supports large files via streaming (.har, .json)
          </p>
        </div>
      </div>
    </div>
  );
};
