import "server-only";
import { Pool } from "pg";
import { memoryStore } from "./memory";
import { postgresStore } from "./postgres";
import type { Store } from "./types";

let store: Store | null = null;

/**
 * Qual banco usar (variável DATA_BACKEND):
 * - "postgres" → PostgreSQL (Railway). Usa DATABASE_URL.
 * - "memory"   → só para testar local; some ao reiniciar.
 * Sem DATA_BACKEND: Postgres se houver DATABASE_URL, senão erro.
 */
export function getStore(): Store {
  if (store) return store;
  const backend = process.env.DATA_BACKEND ?? (process.env.DATABASE_URL ? "postgres" : undefined);

  if (backend === "memory") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATA_BACKEND=memory só pode ser usado em desenvolvimento.");
    }
    store = memoryStore();
  } else if (backend === "postgres") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    const pool = new Pool({
      connectionString: url,
      max: 5,
      // Rede interna da Railway não usa SSL; URL pública (proxy) pode precisar: DATABASE_SSL=true
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
    store = postgresStore(pool);
  } else {
    throw new Error(`DATA_BACKEND inválido: ${backend}`);
  }
  return store;
}

/** Só para testes automatizados. */
export function setStoreForTests(s: Store | null): void {
  if (process.env.NODE_ENV === "production") return;
  store = s;
}

export { paths, assertSafeId } from "./types";
export type { Store, Tx, WithId } from "./types";
