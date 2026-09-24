import "server-only";
import { firestoreStore } from "./firestore";
import { memoryStore } from "./memory";
import type { Store } from "./types";

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  if (process.env.DATA_BACKEND === "memory") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATA_BACKEND=memory só pode ser usado em desenvolvimento.");
    }
    store = memoryStore();
  } else {
    store = firestoreStore();
  }
  return store;
}

export { paths, assertSafeId } from "./types";
export type { Store, Tx, WithId } from "./types";
