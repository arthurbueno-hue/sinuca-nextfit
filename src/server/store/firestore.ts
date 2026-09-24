import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import {
  getFirestore,
  type Firestore,
  type QueryDocumentSnapshot,
  type Transaction,
} from "firebase-admin/firestore";
import type { Reader, Store, Tx, WithId } from "./types";

let cached: Firestore | null = null;

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT não configurada.");
  const json = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  return initializeApp({ credential: cert(json) });
}

function db(): Firestore {
  if (!cached) {
    cached = getFirestore(app());
    cached.settings({ ignoreUndefinedProperties: true });
  }
  return cached;
}

function strip(data: object): object {
  const { id: _id, ...rest } = data as { id?: unknown };
  return rest;
}

function reader(getDoc: Reader["get"], listCol: Reader["list"]): Reader {
  return { get: getDoc, list: listCol };
}

export function firestoreStore(): Store {
  const base = reader(
    async <T,>(path: string) => {
      const snap = await db().doc(path).get();
      return snap.exists ? ({ ...(snap.data() as T), id: snap.id } as WithId<T>) : null;
    },
    async <T,>(col: string) => {
      const snap = await db().collection(col).get();
      return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...(d.data() as T), id: d.id }) as WithId<T>);
    },
  );

  return {
    ...base,
    newId: () => db().collection("_ids").doc().id,
    transaction: <R,>(fn: (tx: Tx) => Promise<R>) =>
      db().runTransaction(async (t: Transaction) => {
        const tx: Tx = {
          async get<T>(path: string) {
            const snap = await t.get(db().doc(path));
            return snap.exists ? ({ ...(snap.data() as T), id: snap.id } as WithId<T>) : null;
          },
          async list<T>(col: string) {
            const snap = await t.get(db().collection(col));
            return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...(d.data() as T), id: d.id }) as WithId<T>);
          },
          set: (path, data) => void t.set(db().doc(path), strip(data)),
          update: (path, data) => void t.update(db().doc(path), strip(data) as Record<string, unknown>),
          delete: (path) => void t.delete(db().doc(path)),
        };
        return fn(tx);
      }),
  };
}
