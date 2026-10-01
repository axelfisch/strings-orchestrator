import { validateFragmentIndex } from "./schemas";
import type { FragmentIndex } from "./types";

const DB = "cso-style-v2";
const STORE = "indexes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "indexId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFragmentIndex(index: FragmentIndex): Promise<void> {
  const errors = validateFragmentIndex(index);
  if (errors.length) throw new Error(`Index Style V2 invalide : ${errors.join(", ")}`);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(index);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadFragmentIndex(indexId: string): Promise<FragmentIndex | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(indexId);
    request.onsuccess = () => resolve((request.result as FragmentIndex | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFragmentIndex(indexId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(indexId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
