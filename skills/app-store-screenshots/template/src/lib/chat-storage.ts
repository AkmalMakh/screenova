"use client";

import type { DesignConversationMessage, DesignReference } from "./design";

const CHAT_KEY = "app-store-screenshots:design-chat:v1";
const DB_NAME = "app-store-screenshots-design";
const DB_VERSION = 1;
const STORE_NAME = "references";
const MAX_MESSAGES = 50;

export function loadDesignMessages(): DesignConversationMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHAT_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (message): message is DesignConversationMessage =>
          !!message &&
          typeof message === "object" &&
          typeof (message as DesignConversationMessage).id === "string" &&
          ((message as DesignConversationMessage).role === "user" ||
            (message as DesignConversationMessage).role === "assistant") &&
          typeof (message as DesignConversationMessage).text === "string",
      )
      .slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export function saveDesignMessages(messages: DesignConversationMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch {
    // Chat is a convenience cache. Project persistence must remain independent.
  }
}

export async function saveDesignReferences(references: DesignReference[]) {
  if (!references.length || typeof indexedDB === "undefined") return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const reference of references) store.put(reference);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadDesignReference(id: string): Promise<DesignReference | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDatabase();
  const result = await new Promise<DesignReference | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as DesignReference | undefined) || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
