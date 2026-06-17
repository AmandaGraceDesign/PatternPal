'use client';

import { useEffect, useState } from 'react';
import {
  completeCurrentIOSSaveTask,
  IOSSaveTask,
  subscribeIOSSaveQueue,
} from '@/lib/utils/iosSaveQueue';

// Mounted once at app root. When a task is queued, renders a sheet whose
// "Save" button calls navigator.share synchronously — required by iOS to
// preserve the user-activation token. A task may carry one file (shares to
// Photos) or many (shares as a batch so iOS offers "Save N Images"). If share
// fails or isn't available, falls back to anchor-download of each file.

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

function anchorDownloadAll(task: IOSSaveTask) {
  for (const f of task.files) anchorDownload(f.blob, f.filename);
}

export default function IOSSaveSheet() {
  const [task, setTask] = useState<IOSSaveTask | null>(null);
  const [status, setStatus] = useState<'idle' | 'sharing' | 'error'>('idle');

  useEffect(() => subscribeIOSSaveQueue((t) => {
    setTask(t);
    setStatus('idle');
  }), []);

  if (!task) return null;

  const count = task.files.length;
  const isMulti = count > 1;
  const heading = isMulti ? `Ready to save ${count} files` : 'Ready to save';
  const subtitle = isMulti ? `${count} images` : task.files[0]?.filename ?? '';
  const saveLabel = status === 'sharing'
    ? 'Opening…'
    : status === 'error'
      ? 'Downloaded to Files'
      : isMulti
        ? `Save ${count} images to Photos or Files`
        : 'Save to Photos or Files';

  const handleShare = async () => {
    setStatus('sharing');
    try {
      const files = task.files.map((f) => new File([f.blob], f.filename, { type: f.mimeType }));
      // canShare may not exist on older iOS — proceed and let share() decide.
      if (typeof navigator.canShare === 'function' && !navigator.canShare({ files })) {
        throw new Error('canShare returned false');
      }
      await navigator.share({ files, title: isMulti ? `${count} images` : task.files[0].filename });
      completeCurrentIOSSaveTask();
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        // User cancelled the share sheet deliberately — don't fallback.
        completeCurrentIOSSaveTask();
        return;
      }
      // Any other failure → download to Files. Surface briefly so user knows.
      anchorDownloadAll(task);
      setStatus('error');
      setTimeout(() => completeCurrentIOSSaveTask(), 900);
    }
  };

  const handleFallback = () => {
    anchorDownloadAll(task);
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
          <h3 className="text-lg font-bold text-[#294051]">{heading}</h3>
          <p className="text-xs text-gray-500 mt-1 truncate" title={subtitle}>
            {subtitle}
          </p>
        </div>

        <div className="px-6 pt-3 pb-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={status === 'sharing'}
            className="w-full py-3 rounded-xl bg-[#4caf50] text-white font-semibold text-base disabled:opacity-60"
          >
            {saveLabel}
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
