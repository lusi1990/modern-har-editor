'use client';

import { useEffect } from 'react';
import { HarUploader } from './components/HarUploader';
import { HarTable } from './components/HarTable';
import { HarDetail } from './components/HarDetail';
import { HarToolbar } from './components/HarToolbar';
import { useHarStore } from './store/useHarStore';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { entries, isLoading } = useHarStore();

  // Global drag/drop prevention
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('dragover', preventDefault, false);
    window.addEventListener('drop', preventDefault, false);

    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans">
      <HarToolbar />
      
      <main className="flex-1 flex overflow-hidden p-4">
        {entries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-zinc-400 animate-spin" />
                <p className="text-zinc-500 animate-pulse">Parsing HAR file...</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold tracking-tight mb-3">Modern HAR Editor</h1>
                  <p className="text-zinc-500 text-lg">
                    Inspect, filter, and modify your HTTP Archives with ease.
                  </p>
                </div>
                <HarUploader />
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex gap-4 min-w-0">
            <HarTable />
            <HarDetail />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 border-t bg-white dark:bg-zinc-950 text-center text-xs text-zinc-500">
        Built with Next.js, Web Workers, and Virtual Scrolling.
      </footer>
    </div>
  );
}
