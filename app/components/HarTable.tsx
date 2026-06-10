'use client';

import React, { useMemo, useState } from 'react';
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

  const filteredEntries = useMemo(() => {
    if (!filter) return entries;
    const lowerFilter = filter.toLowerCase();
    return entries.filter(e => 
      e.request.url.toLowerCase().includes(lowerFilter) ||
      e.request.method.toLowerCase().includes(lowerFilter)
    );
  }, [entries, filter]);

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
          fixedHeaderContent={() => (
            <tr className="bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-2 text-left w-16">Method</th>
              <th className="px-4 py-2 text-left w-16">Status</th>
              <th className="px-4 py-2 text-left">URL</th>
              <th className="px-4 py-2 text-left w-24">Type</th>
              <th className="px-4 py-2 text-right w-20">Size</th>
              <th className="px-4 py-2 text-right w-20">Time</th>
              <th className="px-4 py-2 text-center w-12"></th>
            </tr>
          )}
          itemContent={(index, entry) => (
            <>
              <td className="px-4 py-2 text-sm font-mono whitespace-nowrap">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                  entry.request.method === 'GET' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                  entry.request.method === 'POST' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                )}>
                  {entry.request.method}
                </span>
              </td>
              <td className={cn("px-4 py-2 text-sm font-medium tabular-nums", getStatusColor(entry.response.status))}>
                {entry.response.status}
              </td>
              <td 
                className="px-4 py-2 text-sm truncate max-w-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => setSelectedEntry(entry._id)}
              >
                {entry.request.url}
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500 truncate">
                {entry.response.content.mimeType.split(';')[0]}
              </td>
              <td className="px-4 py-2 text-xs text-right text-zinc-500 tabular-nums">
                {formatSize(entry.response.content.size || entry.response.bodySize || 0)}
              </td>
              <td className="px-4 py-2 text-xs text-right text-zinc-500 tabular-nums">
                {Math.round(entry.time)}ms
              </td>
              <td className="px-4 py-2 text-center">
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
