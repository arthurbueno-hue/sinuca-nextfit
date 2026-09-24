import "server-only";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { ActionResult } from "@/lib/dto";
import { TournamentError } from "@/lib/tournament/errors";
import type { Match, Tournament } from "@/lib/tournament/types";
import { getStore, paths, type Tx, type WithId } from "./store";

export const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    const message = await fn();
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (err) {
    if (err instanceof TournamentError) return { ok: false, error: err.message };
    console.error("[action] erro inesperado", err);
    return { ok: false, error: "Algo deu errado. Tenta de novo em instantes." };
  }
}

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new TournamentError("Dados inválidos.");
  return result.data;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 40);
}

export function audit(tx: Tx, tid: string, actor: string, action: string, summary: string): void {
  tx.set(paths.auditEntry(tid, getStore().newId()), { at: new Date().toISOString(), actor, action, summary });
}

export async function loadTournament(tx: Tx, tid: string): Promise<WithId<Tournament>> {
  const t = await tx.get<Tournament>(paths.tournament(tid));
  if (!t) throw new TournamentError("Campeonato não encontrado.");
  return t;
}

export async function loadMatch(tx: Tx, tid: string, mid: string): Promise<WithId<Match>> {
  const m = await tx.get<Match>(paths.match(tid, mid));
  if (!m) throw new TournamentError("Partida não encontrada.");
  return m;
}

/** Apelido de quem está agindo, para o histórico. */
export async function actorLabel(tx: Tx, tid: string, uid: string, isAdmin: boolean): Promise<string> {
  const idx = await tx.get<{ pid: string; nickname?: string }>(paths.uidIndex(tid, uid));
  if (!idx?.nickname) return isAdmin ? "ADM" : "sem inscrição";
  return isAdmin ? `${idx.nickname} (ADM)` : idx.nickname;
}
