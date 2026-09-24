"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/dto";
import { effectiveDeadline } from "@/lib/tournament/deadline";
import { TournamentError } from "@/lib/tournament/errors";
import { adminDecide, castVote, loserSlot, propagate, tournamentResult, undoResult } from "@/lib/tournament/match";
import type { Match, Tournament } from "@/lib/tournament/types";
import { localInputToIso } from "@/lib/time";
import { ID_RE, actorLabel, audit, loadTournament, parse, run } from "../action-utils";
import { getStore, paths, type Tx, type WithId } from "../store";
import { actionViewer } from "../viewer";

const score = z.number().int().min(0).max(99).nullable().optional();
const resultSchema = z.object({
  tournamentId: z.string().regex(ID_RE),
  matchId: z.string().regex(ID_RE),
  winnerPid: z.string().regex(ID_RE),
  scoreA: score,
  scoreB: score,
});
const decideSchema = resultSchema.extend({ kind: z.enum(["admin", "wo"]) });
const matchRef = z.object({ tournamentId: z.string().regex(ID_RE), matchId: z.string().regex(ID_RE) });
const deadlineSchema = matchRef.extend({ deadline: z.string().max(20).nullable() });

function assertRunning(t: Tournament) {
  if (t.status !== "em_andamento") throw new TournamentError("O campeonato não está em andamento.");
}

function nick(m: Match, pid: string | null): string {
  if (!pid) return "?";
  return m.slotA?.pid === pid ? m.slotA.nickname : m.slotB?.pid === pid ? m.slotB.nickname : "?";
}

function scoreText(m: Match): string {
  return m.score ? ` (${m.score.a} x ${m.score.b})` : "";
}

function label(m: Match): string {
  return m.isThirdPlace ? "3º lugar" : m.id;
}

/** Lê TODAS as partidas (poucas) — permite checar fim do campeonato na mesma transação. */
async function loadBoard(tx: Tx, tid: string, mid: string) {
  const all = new Map((await tx.list<Match>(paths.matches(tid))).map((m) => [m.id, m as Match]));
  const match = all.get(mid);
  if (!match) throw new TournamentError("Partida não encontrada.");
  return { all, match };
}

/**
 * Grava a partida finalizada, leva vencedor/perdedor adiante e, se todas as
 * partidas acabaram (final + 3º lugar), encerra o campeonato.
 */
function commitFinished(tx: Tx, t: WithId<Tournament>, all: Map<string, Match>, finished: Match, now: string) {
  const next = finished.nextMatchId ? (all.get(finished.nextMatchId) ?? null) : null;
  const loserNext = finished.loserNextMatchId ? (all.get(finished.loserNextMatchId) ?? null) : null;
  const effect = propagate(finished, next, loserNext, now);
  for (const m of [finished, effect.next, effect.loserNext]) {
    if (!m) continue;
    all.set(m.id, m);
    tx.set(paths.match(t.id, m.id), m);
  }
  const result = tournamentResult([...all.values()]);
  if (result.complete) {
    tx.update(paths.tournament(t.id), { championPid: result.championPid, status: "finalizado", updatedAt: now });
  }
  return result;
}

function finishedMessage(m: Match, complete: boolean, championName: string | null): string {
  const winner = nick(m, m.winnerPid);
  const loser = loserSlot(m)?.nickname;
  if (complete) return `Resultado confirmado! Campeonato encerrado: ${championName} é o CAMPEÃO! 🏆`;
  if (m.isThirdPlace) return `Resultado confirmado! ${winner} fica com o 3º lugar 🥉`;
  if (!m.nextMatchId) return `Resultado confirmado! ${winner} é o CAMPEÃO! 🏆 Falta só a disputa de 3º lugar.`;
  if (m.loserNextMatchId) return `Resultado confirmado! ${winner} vai pra final e ${loser} disputa o 3º lugar.`;
  return `Resultado confirmado! ${winner} avança.`;
}

function championName(all: Map<string, Match>, pid: string | null): string | null {
  if (!pid) return null;
  for (const m of all.values()) {
    if (m.slotA?.pid === pid) return m.slotA.nickname;
    if (m.slotB?.pid === pid) return m.slotB.nickname;
  }
  return null;
}

export async function voteAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer();
    const input = parse(resultSchema, raw);
    const now = new Date().toISOString();

    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      assertRunning(t);
      const idx = await tx.get<{ pid: string }>(paths.uidIndex(t.id, viewer.uid));
      if (!idx) throw new TournamentError("Você não está inscrito neste campeonato.");
      const { all, match } = await loadBoard(tx, t.id, input.matchId);

      const { match: updated, outcome } = castVote(match, idx.pid, input, now, {
        deadline: effectiveDeadline(match, t.rounds),
      });
      if (outcome === "sem_mudanca") return "Seu voto já estava registrado.";

      const voter = nick(match, idx.pid);
      audit(
        tx,
        t.id,
        voter,
        "voto",
        `${voter} votou em ${nick(match, input.winnerPid)} como vencedor${
          input.scoreA != null ? ` (${input.scoreA} x ${input.scoreB})` : ""
        } em ${label(match)}.`,
      );

      if (outcome !== "finalizada") {
        tx.set(paths.match(t.id, updated.id), updated);
        if (outcome === "aguardando_adversario") return "Voto registrado! Agora falta seu adversário confirmar.";
        audit(tx, t.id, "sistema", "disputa", `${label(match)} entrou em disputa: votos diferentes.`);
        return "Os votos não bateram. Conversem e corrijam o voto (ou chamem a organização).";
      }

      const result = commitFinished(tx, t, all, updated, now);
      audit(tx, t.id, "sistema", "resultado", `${label(match)}: ${nick(updated, updated.winnerPid)} venceu por consenso${scoreText(updated)}.`);
      return finishedMessage(updated, result.complete, championName(all, result.championPid));
    });
  });
}

export async function adminDecideAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer({ admin: true });
    const input = parse(decideSchema, raw);
    const now = new Date().toISOString();

    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      assertRunning(t);
      const actor = await actorLabel(tx, t.id, viewer.uid, true);
      const { all, match } = await loadBoard(tx, t.id, input.matchId);

      const decided = adminDecide(match, input, input.kind, now);
      const result = commitFinished(tx, t, all, decided, now);
      const how = input.kind === "wo" ? "por W.O." : `pela organização${scoreText(decided)}`;
      audit(tx, t.id, actor, input.kind, `${label(match)}: ${nick(decided, decided.winnerPid)} venceu ${how}.`);
      return finishedMessage(decided, result.complete, championName(all, result.championPid));
    });
  });
}

export async function adminUndoAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer({ admin: true });
    const input = parse(matchRef, raw);
    const now = new Date().toISOString();

    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      if (t.status === "inscricoes") throw new TournamentError("A chave ainda não foi sorteada.");
      const actor = await actorLabel(tx, t.id, viewer.uid, true);
      const { all, match } = await loadBoard(tx, t.id, input.matchId);
      const next = match.nextMatchId ? (all.get(match.nextMatchId) ?? null) : null;
      const loserNext = match.loserNextMatchId ? (all.get(match.loserNextMatchId) ?? null) : null;

      const undone = undoResult(match, next, loserNext, now);
      for (const m of [undone.match, undone.next, undone.loserNext]) {
        if (m) tx.set(paths.match(t.id, m.id), m);
      }
      if (t.status === "finalizado") {
        tx.update(paths.tournament(t.id), { championPid: null, status: "em_andamento", updatedAt: now });
      }
      audit(tx, t.id, actor, "desfazer", `${label(match)}: resultado (${nick(match, match.winnerPid)}) desfeito.`);
      return "Resultado desfeito. A partida voltou para pendente.";
    });
  });
}

export async function setMatchDeadlineAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer({ admin: true });
    const input = parse(deadlineSchema, raw);
    const deadline = input.deadline ? localInputToIso(input.deadline) : null;
    if (input.deadline && !deadline) throw new TournamentError("Data inválida.");

    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      const actor = await actorLabel(tx, t.id, viewer.uid, true);
      const match = await tx.get<Match>(paths.match(t.id, input.matchId));
      if (!match) throw new TournamentError("Partida não encontrada.");
      tx.update(paths.match(t.id, match.id), { deadlineOverride: deadline, updatedAt: new Date().toISOString() });
      audit(
        tx,
        t.id,
        actor,
        "prazo",
        `${label(match)}: prazo ${deadline ? `ajustado para ${input.deadline}` : "volta a seguir a rodada"}.`,
      );
      return deadline ? "Prazo do jogo atualizado." : "O jogo voltou a usar o prazo da rodada.";
    });
  });
}
