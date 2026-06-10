'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { Trash2 } from 'lucide-react';
import { useHarStore } from '../store/useHarStore';
import { cn } from '../utils';

const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-amber-600 dark:text-amber-400';
  if (status >= 400) return 'text-red-600 dark:text-red-400';
  return 'text-zinc-500';
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const HarTable: React.FC = () => {
  const { entries, removeEntry, selectedEntryId, setSelectedEntry } = useHarStore();
  const [filter, setFilter] = useState('');
  const [urlWidth, setUrlWidth] = useState(400);
  const isResizing = useRef(false);
  const stopResizingRef = useRef<() => void>(() => {});

  const filteredEntries = useMemo(() => {
    if (!filter) return entries;
    const lowerFilter = filter.toLowerCase();
    return entries.filter(e => 
      e.request.url.toLowerCase().includes(lowerFilter) ||
      e.request.method.toLowerCase().includes(lowerFilter)
    );
  }, [entries, filter]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const minWidth = 100;
    const maxWidth = 1200;
    setUrlWidth((prev) => {
      const newWidth = prev + e.movementX;
      return Math.max(minWidth, Math.min(newWidth, maxWidth));
    });
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizingRef.current);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  useEffect(() => {
    stopResizingRef.current = stopResizing;
  }, [stopResizing]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizingRef.current);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [handleMouseMove]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizingRef.current);
    };
  }, [handleMouseMove]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-zinc-950 border rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-4">
        <input 
          type="text" 
          placeholder="Filter requests..." 
          className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-900 border rounded-md text-sm outline-none focus:ring-2 focus:ring-zinc-500/20"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="text-xs text-zinc-500 font-medium">
          {filteredEntries.length} requests
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <TableVirtuoso
          data={filteredEntries}
          totalCount={filteredEntries.length}
          style={{ width: '100%' }}
          fixedHeaderContent={() => (
            <tr className="bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-500 uppercase tracking-wider select-none">
              <th className="px-4 py-2 text-left w-20">Method</th>
              <th className="px-4 py-2 text-left w-16">Status</th>
              <th 
                className="px-4 py-2 text-left relative group"
                style={{ width: urlWidth }}
              >
                URL
                <div 
                  onMouseDown={startResizing}
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors bg-zinc-200 dark:bg-zinc-800"
                />
              </th>
              <th className="px-4 py-2 text-left w-24">Type</th>
              <th className="px-4 py-2 text-right w-20">Size</th>
              <th className="px-4 py-2 text-right w-20">Time</th>
              <th className="px-4 py-2 text-center w-12"></th>
            </tr>
          )}
          itemContent={(index, entry) => (
            <>
              <td className="px-4 py-2 text-sm font-mono whitespace-nowrap w-20">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                  entry.request.method === 'GET' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                  entry.request.method === 'POST' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                )}>
                  {entry.request.method}
                </span>
              </td>
              <td className={cn("px-4 py-2 text-sm font-medium tabular-nums w-16", getStatusColor(entry.response.status))}>
                {entry.response.status}
              </td>
              <td 
                className="px-4 py-2 text-sm truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                style={{ width: urlWidth, maxWidth: urlWidth }}
                onClick={() => setSelectedEntry(entry._id)}
              >
                {entry.request.url}
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500 truncate w-24">
                {entry.response.content.mimeType?.split(';')[0] || 'unknown'}
              </td>
              <td className="px-4 py-2 text-xs text-right text-zinc-500 tabular-nums w-20">
                {formatSize(entry.response.content.size || entry.response.bodySize || 0)}
              </td>
              <td className="px-4 py-2 text-xs text-right text-zinc-500 tabular-nums w-20">
                {Math.round(entry.time || 0)}ms
              </td>
              <td className="px-4 py-2 text-center w-12">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEntry(entry._id);
                  }}
                  className="p-1 hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </>
          )}
          components={{
            Table: (props) => <table {...props} style={{ ...props.style, tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }} />,
            TableRow: ({ item, ...props }) => (
              <tr 
                {...props} 
                className={cn(
                  "border-b last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors",
                  selectedEntryId === item?._id && "bg-blue-50/50 dark:bg-blue-900/20"
                )}
              />
            )
          }}
        />
      </div>
    </div>
  );
};
