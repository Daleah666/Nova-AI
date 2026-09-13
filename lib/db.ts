import { SEED_CHARACTER, SEED_CHARACTER_ID } from "./seed";
import type { Character, ChatMessage, ChatThread } from "./types";

const DB_NAME = "character-companion";
const DB_VERSION = 1;
const CHAR_STORE = "characters";
const CHAT_STORE = "chats";
const META_STORE = "meta";

function requireWindow() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }
}

function openDb(): Promise<IDBDatabase> {
  requireWindow();
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Failed to open database"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHAR_STORE)) {
        db.createObjectStore(CHAR_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        db.createObjectStore(CHAT_STORE, { keyPath: "characterId" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

async function ensureSeed() {
  const db = await openDb();
  try {
    const seeded = await requestToPromise<string | undefined>(
      db.transaction(META_STORE, "readonly").objectStore(META_STORE).get("seeded"),
    );
    if (seeded) return;

    const existing = await requestToPromise<Character | undefined>(
      db
        .transaction(CHAR_STORE, "readonly")
        .objectStore(CHAR_STORE)
        .get(SEED_CHARACTER_ID),
    );

    const tx = db.transaction([CHAR_STORE, META_STORE], "readwrite");
    if (!existing) {
      const now = Date.now();
      tx.objectStore(CHAR_STORE).put({
        ...SEED_CHARACTER,
        createdAt: now,
        updatedAt: now,
      });
    }
    tx.objectStore(META_STORE).put("1", "seeded");
    await txDone(tx);
  } finally {
    db.close();
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function listCharacters(): Promise<Character[]> {
  await ensureSeed();
  const db = await openDb();
  const tx = db.transaction(CHAR_STORE, "readonly");
  const rows = await requestToPromise<Character[]>(tx.objectStore(CHAR_STORE).getAll());
  db.close();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCharacter(id: string): Promise<Character | null> {
  await ensureSeed();
  const db = await openDb();
  const row = await requestToPromise<Character | undefined>(
    db.transaction(CHAR_STORE, "readonly").objectStore(CHAR_STORE).get(id),
  );
  db.close();
  return row ?? null;
}

export async function saveCharacter(character: Character): Promise<void> {
  await ensureSeed();
  const db = await openDb();
  const tx = db.transaction(CHAR_STORE, "readwrite");
  tx.objectStore(CHAR_STORE).put(character);
  await txDone(tx);
  db.close();
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([CHAR_STORE, CHAT_STORE], "readwrite");
  tx.objectStore(CHAR_STORE).delete(id);
  tx.objectStore(CHAT_STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function getChat(characterId: string): Promise<ChatThread> {
  const db = await openDb();
  const row = await requestToPromise<ChatThread | undefined>(
    db.transaction(CHAT_STORE, "readonly").objectStore(CHAT_STORE).get(characterId),
  );
  db.close();
  return (
    row ?? {
      characterId,
      messages: [],
      updatedAt: 0,
    }
  );
}

export async function saveChat(thread: ChatThread): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CHAT_STORE, "readwrite");
  tx.objectStore(CHAT_STORE).put(thread);
  await txDone(tx);
  db.close();
}

export async function clearChat(characterId: string): Promise<void> {
  await saveChat({ characterId, messages: [], updatedAt: Date.now() });
}

export function newId(): string {
  return crypto.randomUUID();
}

export function createGreetingMessages(
  firstMes: string,
): ChatMessage[] {
  const trimmed = firstMes.trim();
  if (!trimmed) return [];
  return [
    {
      id: newId(),
      role: "assistant",
      content: trimmed,
      createdAt: Date.now(),
    },
  ];
}
