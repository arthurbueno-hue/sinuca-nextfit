import "server-only";
import { randomUUID } from "node:crypto";
import type { Store, Tx, WithId } from "./types";

/** Banco em memória para desenvolvimento local (DATA_BACKEND=memory). */
type Data = Map<string, Record<string, unknown>>;

const g = globalThis as unknown as { __sinucaMemory?: { data: Data; lock: Promise<unknown> } };
const state = (g.__sinucaMemory ??= { data: new Map(), lock: Promise.resolve() });

function strip(data: object): Record<string, unknown> {
  const { id: _id, ...rest } = structuredClone(data) as Record<string, unknown>;
  return rest;
}

function read<T>(path: string): WithId<T> | null {
  const doc = state.data.get(path);
  if (!doc) return null;
  return { ...(structuredClone(doc) as T), id: path.split("/").at(-1)! };
}

function list<T>(col: string): WithId<T>[] {
  const depth = col.split("/").length + 1;
  return [...state.data.keys()]
    .filter((k) => k.startsWith(`${col}/`) && k.split("/").length === depth)
    .map((k) => read<T>(k)!);
}

export function memoryStore(): Store {
  return {
    get: async (path) => read(path),
    list: async (col) => list(col),
    newId: () => randomUUID().replaceAll("-", "").slice(0, 20),
    transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
      const run = state.lock.then(async () => {
        const ops: (() => void)[] = [];
        const noReadAfterWrite = () => {
          if (ops.length) throw new Error("Transação: leitura depois de escrita (o Firestore não permite).");
        };
        const tx: Tx = {
          get: async (path) => (noReadAfterWrite(), read(path)),
          list: async (col) => (noReadAfterWrite(), list(col)),
          set: (path, data) => ops.push(() => state.data.set(path, strip(data))),
          update: (path, data) =>
            ops.push(() => {
              const cur = state.data.get(path);
              if (!cur) throw new Error(`Documento não existe: ${path}`);
              state.data.set(path, { ...cur, ...strip(data) });
            }),
          delete: (path) => ops.push(() => state.data.delete(path)),
        };
        const result = await fn(tx);
        // aplica tudo ou nada
        const snapshot = new Map(state.data);
        try {
          ops.forEach((op) => op());
        } catch (e) {
          state.data.clear();
          snapshot.forEach((v, k) => state.data.set(k, v));
          throw e;
        }
        return result;
      });
      state.lock = run.catch(() => undefined);
      return run;
    },
  };
}

/** Só para testes automatizados. */
export function resetMemoryStore(): void {
  if (process.env.NODE_ENV === "production") return;
  state.data.clear();
}
