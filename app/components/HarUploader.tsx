'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileCode } from 'lucide-react';
import { useHarStore } from '../store/useHarStore';
import { cn } from '../utils';

export const HarUploader: React.FC = () => {
  const { clear, setFileName, setLoading, setMetadata, addEntries } = useHarStore();

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    
    console.log('Processing file:', file.name, file.size, file.type);
    
    clear();
    setFileName(file.name);
    setLoading(true);

    try {
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

      worker.onerror = (err) => {
        console.error('Worker initialization error:', err);
        alert('Failed to start the background parser.');
        setLoading(false);
      };

      worker.postMessage({ file });
    } catch (err) {
      console.error('Failed to create worker:', err);
      alert('Your browser might not support Web Workers or there was a build error.');
      setLoading(true);
    }
  }, [clear, setFileName, setLoading, setMetadata, addEntries]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('Files dropped:', acceptedFiles);
    if (acceptedFiles.length > 0) {
      handleFile(acceptedFiles[0]);
    }
  }, [handleFile]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ 
    onDrop,
    noClick: false,
    noKeyboard: false,
    multiple: false
  });

  return (
    <div className="w-full max-w-xl mx-auto">
      <div 
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center w-full h-80 border-2 border-dashed rounded-2xl transition-all duration-200 outline-none",
          isDragActive 
            ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/20 scale-[1.02]" 
            : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-6 p-8 pointer-events-none">
          <div className={cn(
            "p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 shadow-inner transition-transform duration-300",
            isDragActive && "scale-110 rotate-3"
          )}>
            {isDragActive ? (
              <FileCode className="w-12 h-12 text-blue-500" />
            ) : (
              <Upload className="w-12 h-12 text-zinc-400" />
            )}
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">
              {isDragActive ? "Release to upload" : "Select or drag HAR file"}
            </h3>
            <p className="text-sm text-zinc-500 max-w-xs">
              Upload your .har or .json file to start editing. All processing happens locally in your browser.
            </p>
          </div>
        </div>

        {/* Fallback button for some browsers where div click is weird */}
        {!isDragActive && (
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="mt-2 px-6 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Browse Files
          </button>
        )}
      </div>
      
      <div className="mt-6 grid grid-cols-2 gap-4 text-[11px] text-zinc-400 text-center uppercase tracking-widest font-bold">
        <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg">No Servers Involved</div>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg">Secure & Private</div>
      </div>
    </div>
  );
};
