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
  updateEntry: (id: string, updatedFields: Partial<HarEntry>) => void;
  sanitizeAllEntries: () => void;
  clear: () => void;
  
  // Export
  getHarJson: () => string;
}

const SENSITIVE_HEADER_REGEX = /^(authorization|x-auth-token|x-api-key|proxy-authorization)$/i;
const SENSITIVE_KEY_REGEX = /(password|token|secret|credential|auth|sid|session|key|jwt)/i;

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

const sanitizeCookieString = (cookieStr: string): string => {
  return cookieStr.split(';').map(part => {
    const trimmed = part.trim();
    if (!trimmed) return part;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return part;
    const name = trimmed.substring(0, eqIndex);
    if (SENSITIVE_KEY_REGEX.test(name)) {
      return `${name}=******`;
    }
    return part;
  }).join('; ');
};

const sanitizeSetCookieString = (setCookieStr: string): string => {
  const parts = setCookieStr.split(';');
  const firstPart = parts[0];
  const eqIndex = firstPart.indexOf('=');
  if (eqIndex !== -1) {
    const name = firstPart.substring(0, eqIndex).trim();
    if (SENSITIVE_KEY_REGEX.test(name)) {
      parts[0] = `${name}=******`;
    }
  }
  return parts.join(';');
};

const sanitizeFormString = (formStr: string): string => {
  try {
    const params = new URLSearchParams(formStr);
    const newParams = new URLSearchParams();
    for (const [key, value] of params.entries()) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        newParams.set(key, '******');
      } else {
        newParams.set(key, value);
      }
    }
    return newParams.toString();
  } catch {
    return formStr;
  }
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
    set((state) => ({ 
      entries: [...state.entries, ...newEntries] 
    }));
  },
  
  removeEntry: (id) => set((state) => ({
    entries: state.entries.filter((e) => e._id !== id),
    selectedEntryId: state.selectedEntryId === id ? null : state.selectedEntryId
  })),

  setSelectedEntry: (id) => set({ selectedEntryId: id }),

  updateEntry: (id, updatedFields) => set((state) => ({
    entries: state.entries.map((e) => (e._id === id ? { ...e, ...updatedFields } : e))
  })),

  sanitizeAllEntries: () => set((state) => ({
    entries: state.entries.map((entry) => {
      const newEntry = JSON.parse(JSON.stringify(entry)) as HarEntry;
      
      // 1. Sanitize Headers
      newEntry.request.headers = newEntry.request.headers.map((h) => {
        if (SENSITIVE_HEADER_REGEX.test(h.name)) return { ...h, value: '******' };
        if (h.name.toLowerCase() === 'cookie') return { ...h, value: sanitizeCookieString(h.value) };
        return h;
      });

      newEntry.response.headers = newEntry.response.headers.map((h) => {
        if (SENSITIVE_HEADER_REGEX.test(h.name)) return { ...h, value: '******' };
        if (h.name.toLowerCase() === 'set-cookie') return { ...h, value: sanitizeSetCookieString(h.value) };
        return h;
      });

      // 2. Sanitize HAR Cookie Arrays
      if (newEntry.request.cookies) {
        newEntry.request.cookies = newEntry.request.cookies.map((c) => {
          const cookie = c as { name: string; value: string };
          return SENSITIVE_KEY_REGEX.test(cookie.name) ? { ...cookie, value: '******' } : cookie;
        });
      }
      if (newEntry.response.cookies) {
        newEntry.response.cookies = newEntry.response.cookies.map((c) => {
          const cookie = c as { name: string; value: string };
          return SENSITIVE_KEY_REGEX.test(cookie.name) ? { ...cookie, value: '******' } : cookie;
        });
      }

      // 3. Sanitize Payload
      const postData = newEntry.request.postData;
      if (postData) {
        const mimeType = postData.mimeType.toLowerCase();
        
        // Handle JSON
        if (postData.text && (mimeType.includes('json') || postData.text.trim().startsWith('{'))) {
          try {
            const json = JSON.parse(postData.text);
            const scrubbed = scrubObject(json);
            postData.text = JSON.stringify(scrubbed, null, 2);
          } catch {
            // Skip
          }
        }
        
        // Handle Form URLEncoded
        if (postData.text && mimeType.includes('x-www-form-urlencoded')) {
          postData.text = sanitizeFormString(postData.text);
        }

        // Handle HAR params array
        if (postData.params) {
          postData.params = postData.params.map((p) => {
            const param = p as { name: string; value: string };
            if (SENSITIVE_KEY_REGEX.test(param.name)) {
              return { ...param, value: '******' };
            }
            return param;
          });
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
      const rest = JSON.parse(JSON.stringify(entry));
      delete rest._id;
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
