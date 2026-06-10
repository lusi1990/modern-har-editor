'use client';

import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useHarStore } from '../store/useHarStore';
import { copyToClipboard } from '../utils';

export const HarDetail: React.FC = () => {
  const { entries, selectedEntryId, setSelectedEntry } = useHarStore();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  const entry = entries.find(e => e._id === selectedEntryId);

  if (!selectedEntryId) return null;
  if (!entry) return null;

  const handleCopy = async (text: string, section: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const formatPayload = (text?: string) => {
    if (!text) return null;
    try {
      // Try to format JSON for better readability
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  return (
    <div className="w-1/3 flex flex-col bg-white dark:bg-zinc-950 border-l shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold truncate flex-1 pr-4">Request Details</h2>
        <button 
          onClick={() => setSelectedEntry(null)}
          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* General */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">General</h3>
            <button 
              onClick={() => handleCopy(`${entry.request.method} ${entry.request.url}`, 'general')}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
              title="Copy method and URL"
            >
              {copiedSection === 'general' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex gap-2">
              <span className="text-zinc-500 w-24 flex-shrink-0">Request URL:</span>
              <span className="break-all font-mono">{entry.request.url}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-24 flex-shrink-0">Request Method:</span>
              <span className="font-mono">{entry.request.method}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-24 flex-shrink-0">Status Code:</span>
              <span className="font-mono">{entry.response.status} {entry.response.statusText}</span>
            </div>
          </div>
        </section>

        {/* Request Payload (POST Data) */}
        {entry.request.postData?.text && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Request Body ({entry.request.postData.mimeType})</h3>
              <button 
                onClick={() => handleCopy(entry.request.postData?.text || '', 'requestBody')}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
              >
                {copiedSection === 'requestBody' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <pre className="text-[11px] bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300 p-3 rounded overflow-x-auto font-mono max-h-64 border">
              {formatPayload(entry.request.postData.text)}
            </pre>
          </section>
        )}

        {/* Request Headers */}
        <section>
          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Request Headers</h3>
          <div className="space-y-1 text-xs bg-zinc-50 dark:bg-zinc-900 p-2 rounded border">
            {entry.request.headers.map((h, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-500 font-medium whitespace-nowrap">{h.name}:</span>
                <span className="break-all text-zinc-700 dark:text-zinc-300 font-mono">{h.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Response Headers */}
        <section>
          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Response Headers</h3>
          <div className="space-y-1 text-xs bg-zinc-50 dark:bg-zinc-900 p-2 rounded border">
            {entry.response.headers.map((h, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-500 font-medium whitespace-nowrap">{h.name}:</span>
                <span className="break-all text-zinc-700 dark:text-zinc-300 font-mono">{h.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Response Body (Preview) */}
        {entry.response.content.text && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Response Body</h3>
              <button 
                onClick={() => handleCopy(entry.response.content.text || '', 'responseBody')}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
              >
                {copiedSection === 'responseBody' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <pre className="text-[11px] bg-zinc-950 text-zinc-300 p-3 rounded overflow-x-auto font-mono max-h-96">
              {entry.response.content.text}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
};
