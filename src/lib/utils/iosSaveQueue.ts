// Module-level queue for iOS save tasks. The save sheet (IOSSaveSheet.tsx)
// subscribes to this queue and renders a modal whose "Save" button calls
// navigator.share synchronously inside the click handler — preserving the
// user-activation token that iOS Safari requires.
//
// All other downloadBlob callers continue to use anchor-download.

export interface IOSSaveTask {
  blob: Blob;
  filename: string;
  mimeType: string;
  // Resolved when the user has either shared, dismissed, or fallen back.
  resolve: () => void;
}

type Listener = (task: IOSSaveTask | null) => void;

let currentTask: IOSSaveTask | null = null;
const queue: IOSSaveTask[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn(currentTask);
}

export function subscribeIOSSaveQueue(fn: Listener): () => void {
  listeners.add(fn);
  fn(currentTask);
  return () => listeners.delete(fn);
}

export function pushIOSSaveTask(
  blob: Blob,
  filename: string,
  mimeType: string,
): Promise<void> {
  return new Promise((resolve) => {
    const task: IOSSaveTask = { blob, filename, mimeType, resolve };
    if (currentTask) {
      queue.push(task);
    } else {
      currentTask = task;
      notify();
    }
  });
}

// Called by the save sheet after the user finishes (share / cancel / fallback).
export function completeCurrentIOSSaveTask() {
  const finished = currentTask;
  currentTask = queue.shift() ?? null;
  finished?.resolve();
  notify();
}
