'use client';

import React from 'react';
import { Download, Trash2, ShieldAlert } from 'lucide-react';
import { useHarStore } from '../store/useHarStore';

export const HarToolbar: React.FC = () => {
  const { entries, fileName, clear, getHarJson, sanitizeAllEntries } = useHarStore();

  const handleExport = () => {
    const json = getHarJson();
    if (!json) return;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ? `edited-${fileName}` : 'edited.har';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSanitize = () => {
    if (confirm('This will permanently mask sensitive data (Auth, Cookies, Passwords) in ALL entries. Are you sure?')) {
      sanitizeAllEntries();
    }
  };

  if (entries.length === 0) return null;

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-950 border-b">
      <div className="flex items-center gap-3">
        <h1 className="font-semibold text-lg">{fileName || 'HAR Editor'}</h1>
        <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-[10px] font-bold text-zinc-500 uppercase">
          {entries.length} Entries
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={handleSanitize}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 rounded-md transition-colors"
          title="Mask sensitive data in all entries"
        >
          <ShieldAlert className="w-4 h-4" />
          Sanitize
        </button>
        <button 
          onClick={clear}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-red-600 hover:bg-red-50 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-md transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export HAR
        </button>
      </div>
    </div>
  );
};
