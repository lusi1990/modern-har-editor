'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Plus, Trash2, Check, Copy, AlertTriangle, Save, Loader2, Info } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useHarStore } from '../store/useHarStore';
import { copyToClipboard } from '../utils';
import { HarEntry } from '../types/har';

interface HarReplayProps {
  entry: HarEntry;
}

type ReqConfigTab = 'params' | 'headers' | 'body';
type ResTab = 'body' | 'headers';
type BodyType = 'none' | 'application/json' | 'application/x-www-form-urlencoded' | 'text/plain';

interface HeaderRow {
  name: string;
  value: string;
  enabled: boolean;
}

interface ParamRow {
  name: string;
  value: string;
  enabled: boolean;
}

const getMethodColor = (method: string) => {
  const m = method.toUpperCase();
  if (m === 'GET') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  if (m === 'POST') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  if (m === 'PUT') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  if (m === 'DELETE') return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
  if (m === 'PATCH') return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20';
  return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
};

const getStatusColorClass = (status: number) => {
  if (status >= 200 && status < 300) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  if (status >= 300 && status < 400) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  if (status >= 400) return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
  return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const HarReplay: React.FC<HarReplayProps> = ({ entry }) => {
  const { updateEntry } = useHarStore();

  // Request state
  const [method, setMethod] = useState(entry.request.method);
  const [url, setUrl] = useState(entry.request.url);
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [queryParams, setQueryParams] = useState<ParamRow[]>([]);
  const [bodyType, setBodyType] = useState<BodyType>('none');
  const [bodyValue, setBodyValue] = useState('');
  const [sendCredentials, setSendCredentials] = useState(false);

  // Active Tabs
  const [reqConfigTab, setReqConfigTab] = useState<ReqConfigTab>('params');
  const [resTab, setResTab] = useState<ResTab>('body');

  // Execution state
  const [isSending, setIsSending] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    time: number;
    size: number;
    headers: { name: string; value: string }[];
    body: string;
    mimeType: string;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  // Initial load / Sync when entry changes
  useEffect(() => {
    setMethod(entry.request.method);
    setUrl(entry.request.url);
    setError(null);
    setResponse(null);
    setIsSending(false);

    // Load Headers
    const mappedHeaders = entry.request.headers.map(h => ({
      name: h.name,
      value: h.value,
      enabled: true
    }));
    setHeaders(mappedHeaders);

    // Detect body type and value
    const postData = entry.request.postData;
    if (postData && postData.text) {
      setBodyValue(postData.text);
      const mime = postData.mimeType.toLowerCase();
      if (mime.includes('json')) {
        setBodyType('application/json');
      } else if (mime.includes('x-www-form-urlencoded')) {
        setBodyType('application/x-www-form-urlencoded');
      } else {
        setBodyType('text/plain');
      }
    } else {
      setBodyValue('');
      setBodyType('none');
    }

    // Load URL params
    isSyncingRef.current = true;
    const initialParams = parseParamsFromUrl(entry.request.url);
    setQueryParams(initialParams);
    isSyncingRef.current = false;
  }, [entry]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Helper: Parse Query Parameters from URL
  const parseParamsFromUrl = (urlStr: string): ParamRow[] => {
    try {
      const dummyOrigin = 'http://dummy.com';
      const hasScheme = urlStr.includes('://') || urlStr.startsWith('//');
      const absoluteUrlStr = hasScheme ? urlStr : dummyOrigin + (urlStr.startsWith('/') ? '' : '/') + urlStr;
      const parsed = new URL(absoluteUrlStr);

      const params: ParamRow[] = [];
      parsed.searchParams.forEach((value, name) => {
        params.push({ name, value, enabled: true });
      });
      return params;
    } catch {
      return [];
    }
  };

  // Helper: Rebuild URL based on Base and queryParams
  const rebuildUrlWithParams = (currentUrl: string, paramsList: ParamRow[]): string => {
    try {
      const questionMarkIndex = currentUrl.indexOf('?');
      const baseUrl = questionMarkIndex !== -1 ? currentUrl.substring(0, questionMarkIndex) : currentUrl;

      const searchParams = new URLSearchParams();
      paramsList.forEach(p => {
        if (p.enabled && p.name.trim() !== '') {
          searchParams.append(p.name, p.value);
        }
      });

      const searchStr = searchParams.toString();
      return searchStr ? `${baseUrl}?${searchStr}` : baseUrl;
    } catch {
      return currentUrl;
    }
  };

  // Handler: URL Change
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const parsedParams = parseParamsFromUrl(newUrl);
    setQueryParams(parsedParams);
    isSyncingRef.current = false;
  };

  // Handler: Param Row Updates
  const handleParamChange = (index: number, field: keyof ParamRow, val: any) => {
    const updated = queryParams.map((p, i) => (i === index ? { ...p, [field]: val } : p));
    setQueryParams(updated);

    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const newUrl = rebuildUrlWithParams(url, updated);
    setUrl(newUrl);
    isSyncingRef.current = false;
  };

  const addParam = () => {
    const updated = [...queryParams, { name: '', value: '', enabled: true }];
    setQueryParams(updated);
  };

  const removeParam = (index: number) => {
    const updated = queryParams.filter((_, i) => i !== index);
    setQueryParams(updated);

    isSyncingRef.current = true;
    const newUrl = rebuildUrlWithParams(url, updated);
    setUrl(newUrl);
    isSyncingRef.current = false;
  };

  // Handler: Header Row Updates
  const handleHeaderChange = (index: number, field: keyof HeaderRow, val: any) => {
    const updated = headers.map((h, i) => (i === index ? { ...h, [field]: val } : h));
    setHeaders(updated);
  };

  const addHeader = () => {
    setHeaders([...headers, { name: '', value: '', enabled: true }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  // Handler: Body type syncs with Content-Type header
  const handleBodyTypeChange = (type: BodyType) => {
    setBodyType(type);
    if (type === 'none') return;

    // Sync Content-Type header
    const ctIndex = headers.findIndex(h => h.name.toLowerCase() === 'content-type');
    if (ctIndex !== -1) {
      handleHeaderChange(ctIndex, 'value', type);
      handleHeaderChange(ctIndex, 'enabled', true);
    } else {
      setHeaders([...headers, { name: 'Content-Type', value: type, enabled: true }]);
    }
  };

  // Handler: Replay Request
  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    setResponse(null);
    setElapsedTime(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 50);

    try {
      // 1. Headers compilation
      const reqHeaders = new Headers();
      headers.forEach(h => {
        if (h.enabled && h.name.trim() !== '') {
          reqHeaders.append(h.name.trim(), h.value);
        }
      });

      // 2. Body preparation
      let reqBody: BodyInit | null = null;
      const requiresBody = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
      if (requiresBody && bodyType !== 'none' && bodyValue.trim() !== '') {
        reqBody = bodyValue;
      }

      // 3. Send Fetch request
      const fetchResponse = await fetch(url, {
        method: method,
        headers: reqHeaders,
        body: reqBody,
        signal: controller.signal,
        credentials: sendCredentials ? 'include' : 'same-origin',
      });

      if (timerRef.current) clearInterval(timerRef.current);
      const totalTime = Date.now() - startTime;
      setElapsedTime(totalTime);

      // 4. Response reading
      const mimeType = fetchResponse.headers.get('content-type') || 'text/plain';
      const responseText = await fetchResponse.text();
      const bytesSize = new Blob([responseText]).size;

      // 5. Response headers
      const resHeadersList: { name: string; value: string }[] = [];
      fetchResponse.headers.forEach((value, name) => {
        resHeadersList.push({ name, value });
      });

      setResponse({
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        time: totalTime,
        size: bytesSize,
        headers: resHeadersList,
        body: responseText,
        mimeType: mimeType
      });
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (err.name === 'AbortError') {
        setError('Request cancelled by user.');
      } else {
        console.error('Fetch error:', err);
        setError(err.message || 'Network request failed. This is likely due to CORS policy or the destination server being offline.');
      }
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  // Handler: Abort Request
  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Handler: Save changes back into the HAR entry inside the store
  const handleSaveToEntry = () => {
    const updatedRequest = {
      ...entry.request,
      method: method,
      url: url,
      headers: headers.filter(h => h.name.trim() !== '').map(h => ({ name: h.name, value: h.value })),
      postData: bodyType !== 'none' && bodyValue.trim() !== '' ? {
        mimeType: bodyType,
        text: bodyValue
      } : undefined
    };

    const updatedResponse = response ? {
      ...entry.response,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      content: {
        ...entry.response.content,
        size: response.size,
        mimeType: response.mimeType,
        text: response.body
      }
    } : entry.response;

    updateEntry(entry._id, {
      request: updatedRequest,
      response: updatedResponse
    });

    // Flash a temporary success confirmation
    setCopiedSection('save-success');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyText = async (text: string, section: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const formatPayload = (text: string) => {
    if (!text) return '';
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* 1. Address Bar & Send Panel */}
      <div className="p-4 border-b bg-zinc-50/50 dark:bg-zinc-900/20 flex items-center gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className={`px-3 py-2 border rounded-md font-bold uppercase outline-none focus:ring-1 focus:ring-zinc-400 ${getMethodColor(method)}`}
        >
          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].map(m => (
            <option key={m} value={m} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
              {m}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Enter request URL..."
          className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border rounded-md outline-none font-mono focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-100"
        />

        {isSending ? (
          <button
            onClick={handleAbort}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Cancel
          </button>
        ) : (
          <button
            onClick={handleSend}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Send
          </button>
        )}
      </div>

      {/* Settings / Options Panel */}
      <div className="px-4 py-1.5 border-b bg-zinc-50/20 dark:bg-zinc-900/10 flex items-center justify-between">
        <label className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={sendCredentials}
            onChange={(e) => setSendCredentials(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500/20"
          />
          <span>Include cookies/credentials in request</span>
        </label>
        <span className="text-zinc-400 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Supports local & remote endpoints (CORS restrictions apply)
        </span>
      </div>

      {/* 2. Main Config Workspace */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="flex border-b bg-zinc-50/30 dark:bg-zinc-900/10 sticky top-0 z-10 font-sans">
          {(['params', 'headers', 'body'] as ReqConfigTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setReqConfigTab(tab)}
              className={`px-4 py-2.5 font-medium border-b-2 capitalize transition-colors ${
                reqConfigTab === tab
                  ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab === 'params' ? `Params (${queryParams.filter(p => p.enabled && p.name).length})` : 
               tab === 'headers' ? `Headers (${headers.filter(h => h.enabled && h.name).length})` : 
               `Body (${bodyType !== 'none' ? 'Active' : 'None'})`}
            </button>
          ))}
        </div>

        <div className="p-4 flex-1 min-h-[200px]">
          {/* Params Panel */}
          {reqConfigTab === 'params' && (
            <div className="space-y-3 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Query Parameters</span>
                <button
                  onClick={addParam}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Param
                </button>
              </div>

              <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b text-[10px] uppercase tracking-wider text-zinc-400 font-bold select-none">
                      <th className="px-3 py-2 w-8 text-center"></th>
                      <th className="px-3 py-2 border-r">Key</th>
                      <th className="px-3 py-2 border-r">Value</th>
                      <th className="px-3 py-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {queryParams.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-zinc-400 italic font-sans">
                          No query parameters present. URL parameters will sync here automatically.
                        </td>
                      </tr>
                    ) : (
                      queryParams.map((param, index) => (
                        <tr key={index} className="border-b last:border-0 hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10">
                          <td className="px-3 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={param.enabled}
                              onChange={(e) => handleParamChange(index, 'enabled', e.target.checked)}
                              className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600"
                            />
                          </td>
                          <td className="px-3 py-1 border-r">
                            <input
                              type="text"
                              value={param.name}
                              onChange={(e) => handleParamChange(index, 'name', e.target.value)}
                              placeholder="Parameter name"
                              className="w-full bg-transparent border-0 outline-none font-mono py-1 focus:ring-0 text-zinc-700 dark:text-zinc-300"
                            />
                          </td>
                          <td className="px-3 py-1 border-r">
                            <input
                              type="text"
                              value={param.value}
                              onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                              placeholder="Value"
                              className="w-full bg-transparent border-0 outline-none font-mono py-1 focus:ring-0 text-zinc-700 dark:text-zinc-300"
                            />
                          </td>
                          <td className="px-3 py-1 text-center">
                            <button
                              onClick={() => removeParam(index)}
                              className="p-1 text-zinc-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Headers Panel */}
          {reqConfigTab === 'headers' && (
            <div className="space-y-3 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Request Headers</span>
                <button
                  onClick={addHeader}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Header
                </button>
              </div>

              <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-950 font-mono">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b text-[10px] uppercase tracking-wider text-zinc-400 font-bold select-none font-sans">
                      <th className="px-3 py-2 w-8 text-center"></th>
                      <th className="px-3 py-2 border-r">Header Key</th>
                      <th className="px-3 py-2 border-r">Value</th>
                      <th className="px-3 py-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-zinc-400 italic font-sans">
                          No headers configured.
                        </td>
                      </tr>
                    ) : (
                      headers.map((header, index) => (
                        <tr key={index} className="border-b last:border-0 hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10">
                          <td className="px-3 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={header.enabled}
                              onChange={(e) => handleHeaderChange(index, 'enabled', e.target.checked)}
                              className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600"
                            />
                          </td>
                          <td className="px-3 py-1 border-r">
                            <input
                              type="text"
                              value={header.name}
                              onChange={(e) => handleHeaderChange(index, 'name', e.target.value)}
                              placeholder="e.g. Content-Type"
                              className="w-full bg-transparent border-0 outline-none font-mono py-1 focus:ring-0 text-zinc-700 dark:text-zinc-300 font-semibold"
                            />
                          </td>
                          <td className="px-3 py-1 border-r">
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                              placeholder="Value"
                              className="w-full bg-transparent border-0 outline-none font-mono py-1 focus:ring-0 text-zinc-700 dark:text-zinc-300 font-normal"
                            />
                          </td>
                          <td className="px-3 py-1 text-center">
                            <button
                              onClick={() => removeHeader(index)}
                              className="p-1 text-zinc-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Body Panel */}
          {reqConfigTab === 'body' && (
            <div className="space-y-3 h-full flex flex-col font-sans">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Request Body Mode</span>
                <select
                  value={bodyType}
                  onChange={(e) => handleBodyTypeChange(e.target.value as BodyType)}
                  className="px-2 py-1 bg-white dark:bg-zinc-900 border rounded text-xs outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
                >
                  <option value="none">None (No payload)</option>
                  <option value="application/json">JSON (application/json)</option>
                  <option value="application/x-www-form-urlencoded">Form URL-Encoded</option>
                  <option value="text/plain">Text (text/plain)</option>
                </select>
              </div>

              {bodyType === 'none' ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed rounded-lg py-12 px-4 text-center bg-zinc-50/30 dark:bg-zinc-900/5 select-none">
                  <span className="text-zinc-400 font-medium mb-1">No body configured</span>
                  <span className="text-zinc-400 text-[11px]">Select a Body mode above to configure payload values.</span>
                </div>
              ) : (
                <div className="flex-1 min-h-[200px] border rounded-lg overflow-hidden flex flex-col">
                  <div className="flex-1">
                    <Editor
                      height="200px"
                      language={bodyType.includes('json') ? 'json' : 'text'}
                      value={bodyValue}
                      theme="vs-dark"
                      onChange={(val) => setBodyValue(val || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 8, bottom: 8 }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Response Console Section */}
        <div className="border-t bg-zinc-50/10 dark:bg-zinc-900/5 flex flex-col">
          {/* Response Status Header */}
          <div className="p-4 border-b flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/20 font-sans">
            <span className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-[10px]">Response</span>

            {/* If response loaded, show metadata */}
            {response && (
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded font-bold border uppercase text-[10px] ${getStatusColorClass(response.status)}`}>
                  {response.status} {response.statusText}
                </span>
                <span className="px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 font-mono">
                  {response.time} ms
                </span>
                <span className="px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 font-mono">
                  {formatBytes(response.size)}
                </span>
                <button
                  onClick={handleSaveToEntry}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors shadow-sm cursor-pointer ml-2"
                  title="Overwrite this HAR entry with these changes"
                >
                  <Save className="w-3 h-3" />
                  {copiedSection === 'save-success' ? 'Saved!' : 'Save to Entry'}
                </button>
              </div>
            )}
          </div>

          {/* Loading, Error, or Response Contents */}
          <div className="p-4 min-h-[150px] flex-1 bg-white dark:bg-zinc-950">
            {isSending && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-zinc-400 font-sans">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <div className="flex flex-col items-center">
                  <span className="font-medium animate-pulse">Request in progress...</span>
                  <span className="text-[10px] text-zinc-500 font-mono mt-1">Elapsed: {(elapsedTime / 1000).toFixed(2)}s</span>
                </div>
              </div>
            )}

            {!isSending && error && (
              <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-4 space-y-3 font-sans">
                <div className="flex gap-2 text-red-600 dark:text-red-400 font-semibold items-center">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Request Failed</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 font-mono text-[11px] break-all bg-black/5 dark:bg-black/40 p-2 rounded">
                  {error}
                </p>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="font-semibold block mb-0.5 text-zinc-600 dark:text-zinc-300">💡 Common issues:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    <li><strong>CORS Restriction:</strong> The target server doesn't accept requests from this host. Workaround: enable a CORS proxy extension or test locally.</li>
                    <li><strong>Server Offline:</strong> Ensure the service is running at <span className="font-mono">{url.substring(0, 45)}...</span>.</li>
                    <li><strong>Invalid URL:</strong> Make sure the protocol (http/https) is correct.</li>
                  </ul>
                </div>
              </div>
            )}

            {!isSending && !error && !response && (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 select-none font-sans">
                <Play className="w-8 h-8 opacity-20 mb-2" />
                <span className="text-zinc-500 font-medium text-center">Click "Send" above to replay and test the request.</span>
                <span className="text-zinc-400 text-[10px] max-w-xs text-center mt-1">
                  Replays are performed live from your browser context. Edit details to perform joint debugging.
                </span>
              </div>
            )}

            {!isSending && !error && response && (
              <div className="space-y-4 flex flex-col h-full">
                {/* Tabs */}
                <div className="flex border-b bg-zinc-50/10 dark:bg-zinc-900/5 font-sans">
                  {(['body', 'headers'] as ResTab[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setResTab(tab)}
                      className={`px-3 py-1.5 font-medium border-b-2 capitalize transition-colors ${
                        resTab === tab
                          ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                          : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Sub panels */}
                <div className="flex-1 min-h-[150px]">
                  {resTab === 'body' && (
                    <div className="space-y-2 flex flex-col h-full font-sans">
                      <div className="flex justify-between items-center text-[10px] text-zinc-400">
                        <span>Content Type: <span className="font-mono text-zinc-600 dark:text-zinc-300">{response.mimeType}</span></span>
                        <button
                          onClick={() => handleCopyText(response.body, 'resBody')}
                          className="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                        >
                          {copiedSection === 'resBody' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy Body
                        </button>
                      </div>
                      <div className="border rounded-lg overflow-hidden bg-zinc-950">
                        <Editor
                          height="200px"
                          language={response.mimeType.toLowerCase().includes('json') ? 'json' :
                                    response.mimeType.toLowerCase().includes('html') ? 'html' :
                                    response.mimeType.toLowerCase().includes('xml') ? 'xml' : 'text'}
                          value={formatPayload(response.body)}
                          theme="vs-dark"
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 11,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            padding: { top: 8, bottom: 8 }
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {resTab === 'headers' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-sans">
                        <span>Response Headers ({response.headers.length})</span>
                        <button
                          onClick={() => handleCopyText(JSON.stringify(response.headers, null, 2), 'resHeaders')}
                          className="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                        >
                          {copiedSection === 'resHeaders' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy JSON
                        </button>
                      </div>
                      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-950 font-mono text-[11px]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b text-[10px] uppercase tracking-wider text-zinc-400 font-bold select-none font-sans">
                              <th className="px-3 py-2 w-1/3 border-r font-sans">Header Key</th>
                              <th className="px-3 py-2 font-sans">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {response.headers.map((h, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10">
                                <td className="px-3 py-1.5 border-r font-semibold text-zinc-600 dark:text-zinc-400 break-all">{h.name}</td>
                                <td className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300 break-all font-normal">{h.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
