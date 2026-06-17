// Module-level queue for iOS save tasks. The save sheet (IOSSaveSheet.tsx)
// subscribes to this queue and renders a modal whose "Save" button calls
// navigator.share synchronously inside the click handler — preserving the
// user-activation token that iOS Safari requires.
//
// A task carries one OR MANY files: a single image shares straight to Photos;
// multiple images share as a batch so iOS offers "Save N Images" to Photos
// (the alternative — zipping — can only land in Files). All other downloadBlob
// callers continue to use anchor-download.

export interface IOSSaveFile {
  blob: Blob;
  filename: string;
  mimeType: string;
}

export interface IOSSaveTask {
  files: IOSSaveFile[];
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

function enqueue(files: IOSSaveFile[]): Promise<void> {
  return new Promise((resolve) => {
    const task: IOSSaveTask = { files, resolve };
    if (currentTask) {
      queue.push(task);
    } else {
      currentTask = task;
      notify();
    }
  });
}

/** Queue a single file for the iOS save sheet. */
export function pushIOSSaveTask(
  blob: Blob,
  filename: string,
  mimeType: string,
): Promise<void> {
  return enqueue([{ blob, filename, mimeType }]);
}

/** Queue several files as one batch — iOS shares them together so the user can
 *  save all of them to Photos in a single gesture. */
export function pushIOSSaveTaskMulti(files: IOSSaveFile[]): Promise<void> {
  return enqueue(files);
}

// Called by the save sheet after the user finishes (share / cancel / fallback).
export function completeCurrentIOSSaveTask() {
  const finished = currentTask;
  currentTask = queue.shift() ?? null;
  finished?.resolve();
  notify();
}
