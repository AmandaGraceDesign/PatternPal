'use client';

import { useEffect, useState } from 'react';
import {
  completeCurrentIOSSaveTask,
  IOSSaveTask,
  subscribeIOSSaveQueue,
} from '@/lib/utils/iosSaveQueue';

// Mounted once at app root. When a task is queued, renders a sheet whose
// "Save" button calls navigator.share synchronously — required by iOS to
// preserve the user-activation token. If share fails or isn't available,
// falls back to anchor-download.

function anchorDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export default function IOSSaveSheet() {
  const [task, setTask] = useState<IOSSaveTask | null>(null);
  const [status, setStatus] = useState<'idle' | 'sharing' | 'error'>('idle');

  useEffect(() => subscribeIOSSaveQueue((t) => {
    setTask(t);
    setStatus('idle');
  }), []);

  if (!task) return null;

  const handleShare = async () => {
    setStatus('sharing');
    try {
      const file = new File([task.blob], task.filename, { type: task.mimeType });
      // canShare may not exist on older iOS — proceed and let share() decide.
      if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
        throw new Error('canShare returned false');
      }
      await navigator.share({ files: [file], title: task.filename });
      completeCurrentIOSSaveTask();
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        // User cancelled the share sheet deliberately — don't fallback.
        completeCurrentIOSSaveTask();
        return;
      }
      // Any other failure → download to Files. Surface briefly so user knows.
      anchorDownload(task.blob, task.filename);
      setStatus('error');
      setTimeout(() => completeCurrentIOSSaveTask(), 900);
    }
  };

  const handleFallback = () => {
    anchorDownload(task.blob, task.filename);
    completeCurrentIOSSaveTask();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50"
      onClick={(e) => {
        // Tap-outside = fallback download (don't lose their work)
        if (e.target === e.currentTarget) handleFallback();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-lg font-bold text-[#294051]">Ready to save</h3>
          <p className="text-xs text-gray-500 mt-1 truncate" title={task.filename}>
            {task.filename}
          </p>
        </div>

        <div className="px-6 pt-3 pb-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={status === 'sharing'}
            className="w-full py-3 rounded-xl bg-[#4caf50] text-white font-semibold text-base disabled:opacity-60"
          >
            {status === 'sharing' ? 'Opening…' : status === 'error' ? 'Downloaded to Files' : 'Save to Photos or Files'}
          </button>
          <button
            type="button"
            onClick={handleFallback}
            className="w-full py-2 text-sm text-gray-500"
          >
            Download to Files instead
          </button>
        </div>
      </div>
    </div>
  );
}
