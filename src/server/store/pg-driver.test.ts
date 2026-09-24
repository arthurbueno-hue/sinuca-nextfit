/**
 * Testa a camada Postgres com o driver `pg` de verdade (o mesmo da Railway),
 * falando pela rede com um servidor PostgreSQL local (PGlite + socket).
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgresStore } from "./postgres";
import type { Store } from "./types";

const PORT = 54000 + Math.floor(Math.random() * 1000);
let db: PGlite;
let server: PGLiteSocketServer;
let pool: Pool;
let store: Store;

beforeAll(async () => {
  db = await PGlite.create();
  server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
  await server.start();
  // PGlite atende uma sessão por vez; na Railway o pool usa várias conexões.
  pool = new Pool({ connectionString: `postgres://postgres@127.0.0.1:${PORT}/postgres`, max: 1 });
  store = postgresStore(pool);
});

afterAll(async () => {
  await pool?.end();
  await server?.stop();
  await db?.close();
});

describe("driver pg + PostgreSQL", () => {
  it("cria a tabela sozinho e faz set/get/list/update/delete", async () => {
    await store.transaction(async (tx) => {
      tx.set("tournaments/t1", { id: "ignorado", name: "Copa", rounds: [{ index: 1, deadline: null }], n: 1 });
      tx.set("tournaments/t1/matches/r1-m0", { votes: { p1: { winnerPid: "p1", scoreA: 3, scoreB: 1 } } });
      tx.set("tournaments/t1/matches/r1-m1", { votes: {} });
    });
    const t = await store.get<{ name: string; rounds: unknown[]; n: number }>("tournaments/t1");
    expect(t).toEqual({ id: "t1", name: "Copa", rounds: [{ index: 1, deadline: null }], n: 1 });
    const matches = await store.list<{ votes: Record<string, unknown> }>("tournaments/t1/matches");
    expect(matches.map((m) => m.id).sort()).toEqual(["r1-m0", "r1-m1"]);
    expect(matches.find((m) => m.id === "r1-m0")!.votes).toEqual({ p1: { winnerPid: "p1", scoreA: 3, scoreB: 1 } });
    // subcoleção não aparece na lista da coleção pai
    expect((await store.list("tournaments")).map((x) => x.id)).toEqual(["t1"]);

    await store.transaction(async (tx) => {
      tx.update("tournaments/t1", { n: 2, status: "ok" });
      tx.delete("tournaments/t1/matches/r1-m1");
    });
    expect(await store.get("tournaments/t1")).toMatchObject({ name: "Copa", n: 2, status: "ok" });
    expect(await store.get("tournaments/t1/matches/r1-m1")).toBeNull();
  });

  it("erro no meio da transação desfaz tudo", async () => {
    await expect(
      store.transaction(async (tx) => {
        tx.set("tournaments/t2", { name: "Não deveria existir" });
        tx.update("tournaments/nao-existe", { x: 1 });
      }),
    ).rejects.toThrow(/não existe/);
    expect(await store.get("tournaments/t2")).toBeNull();
  });

  it("leitura depois de escrita é bloqueada (mesma regra do Firestore)", async () => {
    await expect(
      store.transaction(async (tx) => {
        tx.set("x/1", { a: 1 });
        await tx.get("x/1");
      }),
    ).rejects.toThrow(/leitura depois de escrita/);
  });

  it("transações simultâneas não perdem escrita", async () => {
    await store.transaction(async (tx) => tx.set("contador/c", { v: 0 }));
    await Promise.all(
      Array.from({ length: 10 }, () =>
        store.transaction(async (tx) => {
          const cur = await tx.get<{ v: number }>("contador/c");
          tx.update("contador/c", { v: cur!.v + 1 });
        }),
      ),
    );
    expect(await store.get("contador/c")).toMatchObject({ v: 10 });
  });

  it("textos com acento, aspas e emoji voltam iguais", async () => {
    const nick = `Zé "Chapéu" d'Ávila 🎱`;
    await store.transaction(async (tx) => tx.set("u/1", { nick }));
    expect(await store.get("u/1")).toMatchObject({ nick });
  });
});
