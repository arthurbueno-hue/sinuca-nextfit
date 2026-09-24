"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { DEFAULT_CONTACT, DEFAULT_DISCORD, DEFAULT_NOTES, DEFAULT_RULES } from "@/lib/defaults";
import type { ActionResult } from "@/lib/dto";
import { generateBracket } from "@/lib/tournament/bracket";
import { TournamentError } from "@/lib/tournament/errors";
import { hasRealActivity } from "@/lib/tournament/match";
import { nicknameKey } from "@/lib/tournament/nickname";
import type { Match, Participant, RuleItem, Tournament } from "@/lib/tournament/types";
import { localInputToIso } from "@/lib/time";
import { devToolsEnabled } from "../config";
import { ID_RE, actorLabel, audit, hashKey, loadTournament, parse, run } from "../action-utils";
import { getStore, paths } from "../store";
import { actionViewer } from "../viewer";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const localDate = z.string().max(20);

const createSchema = z.object({
  name: z.string().trim().min(3).max(80),
  slug: z.string().min(3).max(60).regex(SLUG_RE),
  registrationDeadline: localDate,
  startDate: localDate,
});
const updateSchema = z.object({
  tournamentId: z.string().regex(ID_RE),
  name: z.string().trim().min(3).max(80),
  registrationDeadline: localDate,
  startDate: localDate,
  registrationClosed: z.boolean(),
  notesText: z.string().max(5000),
  rulesText: z.string().max(5000),
  contactName: z.string().trim().min(2).max(60),
  discordUrl: z
    .string()
    .trim()
    .max(200)
    .regex(/^(https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,40})?$/),
});
const roundDeadlineSchema = z.object({
  tournamentId: z.string().regex(ID_RE),
  round: z.number().int().min(1).max(10),
  deadline: z.string().max(20).nullable(),
});
const tournamentOnly = z.object({ tournamentId: z.string().regex(ID_RE) });
const fakeSchema = z.object({ tournamentId: z.string().regex(ID_RE), count: z.number().int().min(1).max(40) });

function toIso(local: string, label: string): string {
  const iso = localInputToIso(local);
  if (!iso) throw new TournamentError(`${label}: data inválida.`);
  return iso;
}

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((l) => l.slice(0, 300));
}

/** Cada linha: "situação => penalidade". */
function parseRules(text: string): RuleItem[] {
  return parseLines(text).map((line) => {
    const [situation, ...rest] = line.split("=>");
    return { situation: situation.trim(), penalty: rest.join("=>").trim() };
  });
}

export async function createTournamentAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer({ admin: true });
    const input = parse(createSchema, raw);
    const registrationDeadline = toIso(input.registrationDeadline, "Fim das inscrições");
    const startDate = toIso(input.startDate, "Início");
    const now = new Date().toISOString();

    return getStore().transaction(async (tx) => {
      const existing = await tx.get(paths.tournament(input.slug));
      if (existing) throw new TournamentError("Já existe um campeonato com esse identificador.");
      // Reaproveita regras do último campeonato (2ª edição já nasce configurada).
      const all = await tx.list<Tournament>(paths.tournaments());
      const last = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const t: Omit<Tournament, "id"> = {
        name: input.name,
        slug: input.slug,
        status: "inscricoes",
        registrationDeadline,
        startDate,
        registrationClosed: false,
        notes: last?.notes ?? DEFAULT_NOTES,
        rules: last?.rules ?? DEFAULT_RULES,
        contactName: last?.contactName ?? DEFAULT_CONTACT,
        discordUrl: last?.discordUrl ?? DEFAULT_DISCORD,
        rounds: [],
        championPid: null,
        drawnAt: null,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(paths.tournament(input.slug), t);
      audit(tx, input.slug, viewer.isAdmin ? "ADM" : "?", "criacao", `Campeonato "${input.name}" criado.`);
      return "Campeonato criado!";
    });
  });
}

export async function updateTournamentAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer({ admin: true });
    const input = parse(updateSchema, raw);
    const registrationDeadline = toIso(input.registrationDeadline, "Fim das inscrições");
    const startDate = toIso(input.startDate, "Início");
    const rules = parseRules(input.rulesText);
    if (rules.some((r) => !r.situation)) throw new TournamentError("Toda regra precisa ter a situação antes do =>.");

    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      const actor = await actorLabel(tx, t.id, viewer.uid, true);
      tx.update(paths.tournament(t.id), {
        name: input.name,
        registrationDeadline,
        startDate,
        registrationClosed: input.registrationClosed,
        notes: parseLines(input.notesText),
        rules,
        contactName: input.contactName,
        discordUrl: input.discordUrl,
        updatedAt: new Date().toISOString(),
      });
      audit(tx, t.id, actor, "edicao", "Dados/regras do campeonato atualizados.");
      return "Campeonato atualizado.";
    });
  });
}

export async function setRoundDeadlineAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer({ admin: true });
    const input = parse(roundDeadlineSchema, raw);
    const deadline = input.deadline ? toIso(input.deadline, "Prazo") : null;

    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      const actor = await actorLabel(tx, t.id, viewer.uid, true);
      const round = t.rounds.find((r) => r.index === input.round);
      if (!round) throw new TournamentError("Rodada não encontrada (sorteie a chave primeiro).");
      const rounds = t.rounds.map((r) => (r.index === input.round ? { ...r, deadline } : r));
      tx.update(paths.tournament(t.id), { rounds, updatedAt: new Date().toISOString() });
      audit(tx, t.id, actor, "prazo", `Prazo de ${round.name}: ${input.deadline ?? "a definir"}.`);
      return `Prazo de ${round.name} salvo.`;
    });
  });
}

export async function drawAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer({ admin: true });
    const input = parse(tournamentOnly, raw);
    const now = new Date().toISOString();

    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      if (t.status === "finalizado") throw new TournamentError("Esse campeonato já terminou.");
      const actor = await actorLabel(tx, t.id, viewer.uid, true);
      const participants = await tx.list<Participant>(paths.participants(t.id));
      const existing = await tx.list<Match>(paths.matches(t.id));
      if (existing.some(hasRealActivity)) {
        throw new TournamentError("Já existem votos ou resultados. Não dá para sortear de novo.");
      }

      const draw = generateBracket(
        participants.map((p) => ({ pid: p.id, nickname: p.nickname })),
        (max) => randomInt(max),
        now,
        t.rounds,
      );
      const newIds = new Set(draw.matches.map((m) => m.id));
      existing.filter((m) => !newIds.has(m.id)).forEach((m) => tx.delete(paths.match(t.id, m.id)));
      draw.matches.forEach((m) => tx.set(paths.match(t.id, m.id), m));
      tx.update(paths.tournament(t.id), {
        status: "em_andamento",
        rounds: draw.rounds,
        drawnAt: now,
        registrationClosed: true,
        championPid: null,
        updatedAt: now,
      });
      audit(
        tx,
        t.id,
        actor,
        "sorteio",
        `Chave ${existing.length ? "sorteada novamente" : "sorteada"} com ${participants.length} inscritos. Ordem: ${draw.order
          .map((s) => s.nickname)
          .join(", ")}.`,
      );
      return `Chave sorteada com ${participants.length} jogadores!`;
    });
  });
}

/** Só em desenvolvimento: cria inscritos falsos para testar a chave. */
export async function devAddFakePlayersAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    if (!devToolsEnabled()) throw new TournamentError("Indisponível.");
    await actionViewer({ admin: true });
    const input = parse(fakeSchema, raw);
    const now = new Date().toISOString();
    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      if (t.status !== "inscricoes") throw new TournamentError("A chave já foi sorteada.");
      const current = await tx.list<Participant>(paths.participants(t.id));
      const base = current.length;
      for (let i = 1; i <= input.count; i++) {
        const nickname = `Fake ${base + i}`;
        const key = nicknameKey(nickname);
        const pid = getStore().newId();
        const uid = `fake-${pid}`;
        tx.set(paths.participant(t.id, pid), { uid, nickname, nicknameKey: key, joinedAt: now });
        tx.set(paths.uidIndex(t.id, uid), { pid, nickname });
        tx.set(paths.nickIndex(t.id, hashKey(key)), { pid });
      }
      return `${input.count} inscritos falsos adicionados.`;
    });
  });
}
