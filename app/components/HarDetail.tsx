'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Edit3, Save, RotateCcw, Eye, Zap } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useHarStore } from '../store/useHarStore';
import { copyToClipboard, cn } from '../utils';
import { HarReplay } from './HarReplay';

type EditSection = 'requestHeaders' | 'responseHeaders' | 'requestBody' | 'responseBody' | null;

export const HarDetail: React.FC = () => {
  const { entries, selectedEntryId, setSelectedEntry, updateEntry } = useHarStore();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<EditSection>(null);
  const [editValue, setEditValue] = useState('');
  const [activeTab, setActiveTab] = useState<'inspect' | 'replay'>('inspect');
  
  // Track previous ID to reset editing state when selection changes
  const [prevId, setPrevId] = useState<string | null>(null);
  if (selectedEntryId !== prevId) {
    setPrevId(selectedEntryId);
    setEditingSection(null);
    setActiveTab('inspect');
  }

  const entry = entries.find(e => e._id === selectedEntryId);

  if (!selectedEntryId || !entry) return null;

  const handleCopy = async (text: string, section: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const formatPayload = (text?: string) => {
    if (!text) return '';
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  const startEditing = (section: EditSection) => {
    setEditingSection(section);
    if (section === 'requestHeaders') {
      setEditValue(JSON.stringify(entry.request.headers, null, 2));
    } else if (section === 'responseHeaders') {
      setEditValue(JSON.stringify(entry.response.headers, null, 2));
    } else if (section === 'requestBody') {
      setEditValue(entry.request.postData?.text || '');
    } else if (section === 'responseBody') {
      setEditValue(entry.response.content.text || '');
    }
  };

  const saveEdit = () => {
    if (!editingSection) return;

    try {
      if (editingSection === 'requestHeaders') {
        const headers = JSON.parse(editValue);
        updateEntry(entry._id, { request: { ...entry.request, headers } });
      } else if (editingSection === 'responseHeaders') {
        const headers = JSON.parse(editValue);
        updateEntry(entry._id, { response: { ...entry.response, headers } });
      } else if (editingSection === 'requestBody') {
        updateEntry(entry._id, { 
          request: { 
            ...entry.request, 
            postData: { ...entry.request.postData!, text: editValue, mimeType: entry.request.postData?.mimeType || 'text/plain' } 
          } 
        });
      } else if (editingSection === 'responseBody') {
        updateEntry(entry._id, { 
          response: { 
            ...entry.response, 
            content: { ...entry.response.content, text: editValue } 
          } 
        });
      }
      setEditingSection(null);
    } catch (err) {
      alert('Invalid format. Please check your input.');
      console.error(err);
    }
  };

  const renderEditor = (language: string = 'json') => (
    <div className="border rounded-lg overflow-hidden mt-2">
      <Editor
        height="300px"
        language={language}
        value={editValue}
        theme="vs-dark"
        onChange={(val) => setEditValue(val || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 8, bottom: 8 }
        }}
      />
      <div className="flex justify-end gap-2 p-2 bg-zinc-50 dark:bg-zinc-900 border-t">
        <button 
          onClick={() => setEditingSection(null)}
          className="px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Cancel
        </button>
        <button 
          onClick={saveEdit}
          className="px-3 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center gap-1"
        >
          <Save className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-1/2 flex flex-col bg-white dark:bg-zinc-950 border-l shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold truncate flex-1 pr-4">Request Details</h2>
        <button 
          onClick={() => setSelectedEntry(null)}
          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-zinc-50/50 dark:bg-zinc-900/40 p-1 gap-1">
        <button
          onClick={() => setActiveTab('inspect')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
            activeTab === 'inspect'
              ? "bg-white dark:bg-zinc-900 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          Inspector
        </button>
        <button
          onClick={() => setActiveTab('replay')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
            activeTab === 'replay'
              ? "bg-white dark:bg-zinc-900 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          )}
        >
          <Zap className="w-3.5 h-3.5" />
          Replay & Joint Debug
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'inspect' ? (
          <div className="h-full overflow-y-auto p-4 space-y-6">
        {/* General */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">General</h3>
            <button 
              onClick={() => handleCopy(`${entry.request.method} ${entry.request.url}`, 'general')}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
            >
              {copiedSection === 'general' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex gap-2">
              <span className="text-zinc-500 w-24 flex-shrink-0">URL:</span>
              <span className="break-all font-mono">{entry.request.url}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-24 flex-shrink-0">Method:</span>
              <span className="font-mono">{entry.request.method}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-24 flex-shrink-0">Status:</span>
              <span className="font-mono">{entry.response.status} {entry.response.statusText}</span>
            </div>
          </div>
        </section>

        {/* Request Headers */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Request Headers</h3>
            <button 
              onClick={() => startEditing('requestHeaders')}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
          {editingSection === 'requestHeaders' ? renderEditor() : (
            <div className="space-y-1 text-xs bg-zinc-50 dark:bg-zinc-900 p-2 rounded border">
              {entry.request.headers.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-zinc-500 font-medium whitespace-nowrap">{h.name}:</span>
                  <span className="break-all text-zinc-700 dark:text-zinc-300 font-mono">{h.value}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Request Body */}
        {entry.request.postData?.text && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Request Body</h3>
              <div className="flex gap-1">
                <button 
                  onClick={() => handleCopy(entry.request.postData?.text || '', 'requestBody')}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
                >
                  {copiedSection === 'requestBody' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
                <button 
                  onClick={() => startEditing('requestBody')}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {editingSection === 'requestBody' ? renderEditor(entry.request.postData.mimeType.includes('json') ? 'json' : 'text') : (
              <pre className="text-[11px] bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300 p-3 rounded overflow-x-auto font-mono max-h-64 border">
                {formatPayload(entry.request.postData.text)}
              </pre>
            )}
          </section>
        )}

        {/* Response Headers */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Response Headers</h3>
            <button 
              onClick={() => startEditing('responseHeaders')}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
          {editingSection === 'responseHeaders' ? renderEditor() : (
            <div className="space-y-1 text-xs bg-zinc-50 dark:bg-zinc-900 p-2 rounded border">
              {entry.response.headers.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-zinc-500 font-medium whitespace-nowrap">{h.name}:</span>
                  <span className="break-all text-zinc-700 dark:text-zinc-300 font-mono">{h.value}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Response Body */}
        {entry.response.content.text && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Response Body</h3>
              <div className="flex gap-1">
                <button 
                  onClick={() => handleCopy(entry.response.content.text || '', 'responseBody')}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
                >
                  {copiedSection === 'responseBody' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
                <button 
                  onClick={() => startEditing('responseBody')}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {editingSection === 'responseBody' ? renderEditor(entry.response.content.mimeType.includes('json') ? 'json' : 'text') : (
              <pre className="text-[11px] bg-zinc-950 text-zinc-300 p-3 rounded overflow-x-auto font-mono max-h-96">
                {formatPayload(entry.response.content.text)}
              </pre>
            )}
          </section>
        )}
          </div>
        ) : (
          <HarReplay entry={entry} />
        )}
      </div>
    </div>
  );
};
