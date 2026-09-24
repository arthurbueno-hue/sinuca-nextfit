import "server-only";
import { randomUUID } from "node:crypto";
import type { Store, Tx, WithId } from "./types";

/**
 * Banco PostgreSQL (ex.: Railway). Guarda cada "documento" numa tabela
 * única `docs(path, parent, data jsonb)` — o mesmo modelo que o resto do
 * código já usa (tournaments/{id}/matches/{id}...).
 *
 * Transações: BEGIN + advisory lock global => uma escrita por vez no
 * campeonato inteiro, mesmo com várias instâncias do servidor. Para o
 * volume de um campeonato interno isso é instantâneo e elimina qualquer
 * condição de corrida (ex.: os dois jogadores votando ao mesmo tempo).
 */

export interface SqlClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
  release(): void;
}
export interface SqlPool {
  connect(): Promise<SqlClient>;
}

const LOCK_KEY = 7_345_901; // qualquer número fixo
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS docs (
    path   TEXT PRIMARY KEY,
    parent TEXT NOT NULL,
    data   JSONB NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS docs_parent_idx ON docs (parent)",
];

function parentOf(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

function idOf(path: string): string {
  return path.split("/").at(-1)!;
}

function strip(data: object): string {
  const { id: _id, ...rest } = data as Record<string, unknown>;
  return JSON.stringify(rest);
}

function toDoc<T>(path: string, data: unknown): WithId<T> {
  const obj = typeof data === "string" ? JSON.parse(data) : data;
  return { ...(obj as T), id: idOf(path) };
}

export function postgresStore(pool: SqlPool, opts: { singleConnection?: boolean } = {}): Store {
  let schemaReady: Promise<void> | null = null;
  // Com uma conexão só (testes), tudo precisa ir em fila.
  let queue: Promise<unknown> = Promise.resolve();

  function serialized<R>(fn: () => Promise<R>): Promise<R> {
    if (!opts.singleConnection) return fn();
    const run = queue.then(fn);
    queue = run.catch(() => undefined);
    return run;
  }

  /** Cria a tabela na primeira vez (idempotente). Se falhar, tenta de novo na próxima. */
  function ensureSchema(c: SqlClient): Promise<void> {
    schemaReady ??= (async () => {
      for (const stmt of SCHEMA) await c.query(stmt);
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
    return schemaReady;
  }

  async function withClient<R>(fn: (c: SqlClient) => Promise<R>): Promise<R> {
    const client = await pool.connect();
    try {
      await ensureSchema(client);
      return await fn(client);
    } finally {
      client.release();
    }
  }

  async function getDoc<T>(c: SqlClient, path: string): Promise<WithId<T> | null> {
    const { rows } = await c.query("SELECT data FROM docs WHERE path = $1", [path]);
    return rows[0] ? toDoc<T>(path, rows[0].data) : null;
  }

  async function listDocs<T>(c: SqlClient, col: string): Promise<WithId<T>[]> {
    const { rows } = await c.query("SELECT path, data FROM docs WHERE parent = $1", [col]);
    return rows.map((r) => toDoc<T>(String(r.path), r.data));
  }

  return {
    get: (path) => serialized(() => withClient((c) => getDoc(c, path))),
    list: (col) => serialized(() => withClient((c) => listDocs(c, col))),
    newId: () => randomUUID().replaceAll("-", "").slice(0, 20),

    transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
      return serialized(() =>
        withClient(async (c) => {
          await c.query("BEGIN");
          try {
            await c.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
            const writes: { sql: string; params: unknown[]; mustExist?: string }[] = [];
            const noReadAfterWrite = () => {
              if (writes.length) throw new Error("Transação: leitura depois de escrita.");
            };
            const tx: Tx = {
              get: async (path) => (noReadAfterWrite(), getDoc(c, path)),
              list: async (col) => (noReadAfterWrite(), listDocs(c, col)),
              set: (path, data) =>
                writes.push({
                  sql: `INSERT INTO docs (path, parent, data) VALUES ($1, $2, $3::jsonb)
                        ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data`,
                  params: [path, parentOf(path), strip(data)],
                }),
              update: (path, data) =>
                writes.push({
                  sql: "UPDATE docs SET data = data || $2::jsonb WHERE path = $1",
                  params: [path, strip(data)],
                  mustExist: path,
                }),
              delete: (path) => writes.push({ sql: "DELETE FROM docs WHERE path = $1", params: [path] }),
            };

            const result = await fn(tx);
            for (const w of writes) {
              const r = await c.query(w.sql, w.params);
              if (w.mustExist && !r.rowCount) throw new Error(`Documento não existe: ${w.mustExist}`);
            }
            await c.query("COMMIT");
            return result;
          } catch (e) {
            await c.query("ROLLBACK").catch(() => undefined);
            throw e;
          }
        }),
      );
    },
  };
}
