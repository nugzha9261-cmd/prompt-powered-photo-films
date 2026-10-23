import type { UIMessage } from "ai";

// AI Director chats are kept on this device only (browser / phone storage).

export type DirectorThread = { id: string; title: string; updatedAt: number; messages: UIMessage[] };

const KEY = "lumiere:director-threads";
const EVENT = "lumiere:director-threads-changed";
export const NEW_CHAT_TITLE = "New chat";
const EMPTY: DirectorThread[] = [];

let cache: DirectorThread[] | null = null;

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function read(): DirectorThread[] {
  if (cache) return cache;
  const raw = storage()?.getItem(KEY);
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  cache = Array.isArray(parsed) ? (parsed as DirectorThread[]) : [];
  return cache;
}

function write(threads: DirectorThread[]) {
  cache = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
  try {
    storage()?.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("Could not save AI Director chats", e);
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function listThreads(): DirectorThread[] {
  return typeof window === "undefined" ? EMPTY : read();
}

export function getThread(id: string): DirectorThread | undefined {
  return read().find((t) => t.id === id);
}

/** Title from the first thing the user said. */
export function titleFor(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return NEW_CHAT_TITLE;
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}

/** Opens a new chat, reusing an untouched one so repeated clicks don't pile up blanks. */
export function startThread(now = Date.now()): DirectorThread {
  const threads = read();
  const blank = threads.find((t) => t.messages.length === 0);
  if (blank) return blank;
  const thread: DirectorThread = { id: crypto.randomUUID(), title: NEW_CHAT_TITLE, updatedAt: now, messages: [] };
  write([thread, ...threads]);
  return thread;
}

/** The chat to open at /director: the latest one, or a fresh one when there are none. */
export function latestOrNewThread(): DirectorThread {
  return read()[0] ?? startThread();
}

export function saveMessages(id: string, messages: UIMessage[]) {
  const threads = read();
  const existing = threads.find((t) => t.id === id);
  if (
    existing &&
    existing.messages.length === messages.length &&
    JSON.stringify(existing.messages.at(-1)) === JSON.stringify(messages.at(-1))
  ) {
    return;
  }
  const next: DirectorThread = {
    id,
    title: titleFor(messages),
    updatedAt: messages.length === 0 && existing ? existing.updatedAt : Date.now(),
    messages,
  };
  write(existing ? threads.map((t) => (t.id === id ? next : t)) : [next, ...threads]);
}

export function deleteThread(id: string) {
  write(read().filter((t) => t.id !== id));
}

export function subscribeThreads(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      callback();
    }
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Test helper: forget the in-memory copy. */
export function resetThreadCache() {
  cache = null;
}
