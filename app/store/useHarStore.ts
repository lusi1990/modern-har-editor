import { create } from 'zustand';
import { HarEntry, HarMetadata } from '../types/har';

interface HarState {
  entries: HarEntry[];
  metadata: HarMetadata | null;
  isLoading: boolean;
  fileName: string | null;
  selectedEntryId: string | null;
  
  // Actions
  setLoading: (isLoading: boolean) => void;
  setMetadata: (metadata: HarMetadata) => void;
  setFileName: (name: string) => void;
  addEntries: (entries: HarEntry[]) => void;
  removeEntry: (id: string) => void;
  setSelectedEntry: (id: string | null) => void;
  sanitizeAllEntries: () => void;
  clear: () => void;
  
  // Export
  getHarJson: () => string;
}

const SENSITIVE_HEADER_REGEX = /^(authorization|cookie|set-cookie|x-auth-token|x-api-key|proxy-authorization)$/i;
const SENSITIVE_KEY_REGEX = /(password|token|secret|credential|auth|sid|session|key)/i;

const scrubObject = (obj: unknown): unknown => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(scrubObject);
  }
  
  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      scrubbed[key] = '******';
    } else {
      scrubbed[key] = scrubObject(value);
    }
  }
  return scrubbed;
};

export const useHarStore = create<HarState>((set, get) => ({
  entries: [],
  metadata: null,
  isLoading: false,
  fileName: null,
  selectedEntryId: null,

  setLoading: (isLoading) => {
    console.log('[Store] setLoading:', isLoading);
    set({ isLoading });
  },
  setMetadata: (metadata) => {
    console.log('[Store] setMetadata:', metadata);
    set({ metadata });
  },
  setFileName: (fileName) => set({ fileName }),
  
  addEntries: (newEntries) => {
    console.log('[Store] Adding entries batch:', newEntries.length);
    set((state) => ({ 
      entries: [...state.entries, ...newEntries] 
    }));
  },
  
  removeEntry: (id) => set((state) => ({
    entries: state.entries.filter((e) => e._id !== id),
    selectedEntryId: state.selectedEntryId === id ? null : state.selectedEntryId
  })),

  setSelectedEntry: (id) => set({ selectedEntryId: id }),

  sanitizeAllEntries: () => set((state) => ({
    entries: state.entries.map((entry) => {
      // Create a deep copy for modification
      const newEntry = JSON.parse(JSON.stringify(entry)) as HarEntry;
      
      // Sanitize Headers
      newEntry.request.headers = newEntry.request.headers.map((h) => 
        SENSITIVE_HEADER_REGEX.test(h.name) ? { ...h, value: '******' } : h
      );
      newEntry.response.headers = newEntry.response.headers.map((h) => 
        SENSITIVE_HEADER_REGEX.test(h.name) ? { ...h, value: '******' } : h
      );

      // Sanitize Cookies
      if (newEntry.request.cookies) {
        newEntry.request.cookies = newEntry.request.cookies.map(() => ({ name: 'omitted', value: '******' }));
      }
      if (newEntry.response.cookies) {
        newEntry.response.cookies = newEntry.response.cookies.map(() => ({ name: 'omitted', value: '******' }));
      }

      // Sanitize Payload
      if (newEntry.request.postData?.text) {
        try {
          const json = JSON.parse(newEntry.request.postData.text);
          const scrubbed = scrubObject(json);
          newEntry.request.postData.text = JSON.stringify(scrubbed, null, 2);
        } catch {
          // Ignore non-JSON
        }
      }

      return newEntry;
    })
  })),

  clear: () => set({ 
    entries: [], 
    metadata: null, 
    fileName: null, 
    selectedEntryId: null 
  }),

  getHarJson: () => {
    const { entries, metadata } = get();
    if (!metadata) return '';
    
    // Remove internal _id before export
    const cleanEntries = entries.map((entry) => {
      const rest = { ...entry };
      delete (rest as Partial<HarEntry>)._id;
      return rest;
    });
    
    const har = {
      log: {
        ...metadata,
        entries: cleanEntries
      }
    };
    
    return JSON.stringify(har, null, 2);
  }
}));
