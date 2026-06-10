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
  clear: () => void;
  
  // Export
  getHarJson: () => string;
}

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
