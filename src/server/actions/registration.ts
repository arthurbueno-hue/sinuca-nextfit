"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/dto";
import { TournamentError } from "@/lib/tournament/errors";
import { nicknameKey, validateNickname } from "@/lib/tournament/nickname";
import { registrationState } from "@/lib/tournament/registration";
import type { Participant, Tournament } from "@/lib/tournament/types";
import { ID_RE, actorLabel, audit, hashKey, loadTournament, parse, run } from "../action-utils";
import { getStore, paths } from "../store";
import { actionViewer } from "../viewer";

const nicknameSchema = z.object({
  tournamentId: z.string().regex(ID_RE),
  nickname: z.string().max(60),
});
const tournamentOnly = z.object({ tournamentId: z.string().regex(ID_RE) });
const removeSchema = z.object({ tournamentId: z.string().regex(ID_RE), participantId: z.string().regex(ID_RE) });

function assertBeforeDraw(t: Tournament) {
  if (t.status !== "inscricoes" || t.drawnAt) {
    throw new TournamentError("A chave já foi sorteada: não dá mais para mexer nas inscrições.");
  }
}

export async function registerAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer();
    const input = parse(nicknameSchema, raw);
    const nickname = validateNickname(input.nickname);
    const key = nicknameKey(nickname);
    const now = new Date().toISOString();

    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      const state = registrationState(t, new Date(now));
      if (!state.open) throw new TournamentError(state.reason ?? "Inscrições encerradas.");
      const already = await tx.get(paths.uidIndex(t.id, viewer.uid));
      if (already) throw new TournamentError("Você já está inscrito neste campeonato.");
      const taken = await tx.get(paths.nickIndex(t.id, hashKey(key)));
      if (taken) throw new TournamentError("Esse apelido já está em uso. Escolhe outro!");
      const user = await tx.get<Record<string, unknown>>(paths.user(viewer.uid));

      const pid = getStore().newId();
      const participant: Omit<Participant, "id"> = { uid: viewer.uid, nickname, nicknameKey: key, joinedAt: now };
      tx.set(paths.participant(t.id, pid), participant);
      tx.set(paths.uidIndex(t.id, viewer.uid), { pid, nickname });
      tx.set(paths.nickIndex(t.id, hashKey(key)), { pid });
      if (user) tx.update(paths.user(viewer.uid), { lastNickname: nickname });
      audit(tx, t.id, nickname, "inscricao", `${nickname} se inscreveu.`);
      return `Inscrição confirmada! Você está no campeonato como "${nickname}".`;
    });
  });
}

export async function updateNicknameAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer();
    const input = parse(nicknameSchema, raw);
    const nickname = validateNickname(input.nickname);
    const key = nicknameKey(nickname);

    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      assertBeforeDraw(t);
      const idx = await tx.get<{ pid: string }>(paths.uidIndex(t.id, viewer.uid));
      if (!idx) throw new TournamentError("Você não está inscrito.");
      const p = await tx.get<Participant>(paths.participant(t.id, idx.pid));
      if (!p) throw new TournamentError("Inscrição não encontrada.");
      if (p.nickname === nickname) return "Nada mudou.";
      const newHash = hashKey(key);
      if (p.nicknameKey !== key) {
        const taken = await tx.get(paths.nickIndex(t.id, newHash));
        if (taken) throw new TournamentError("Esse apelido já está em uso. Escolhe outro!");
      }
      const user = await tx.get(paths.user(viewer.uid));

      if (p.nicknameKey !== key) {
        tx.delete(paths.nickIndex(t.id, hashKey(p.nicknameKey)));
        tx.set(paths.nickIndex(t.id, newHash), { pid: p.id });
      }
      tx.update(paths.participant(t.id, p.id), { nickname, nicknameKey: key });
      tx.set(paths.uidIndex(t.id, viewer.uid), { pid: p.id, nickname });
      if (user) tx.update(paths.user(viewer.uid), { lastNickname: nickname });
      audit(tx, t.id, nickname, "apelido", `${p.nickname} mudou o apelido para ${nickname}.`);
      return "Apelido atualizado.";
    });
  });
}

export async function unregisterAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer();
    const input = parse(tournamentOnly, raw);
    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      assertBeforeDraw(t);
      const idx = await tx.get<{ pid: string }>(paths.uidIndex(t.id, viewer.uid));
      if (!idx) throw new TournamentError("Você não está inscrito.");
      const p = await tx.get<Participant>(paths.participant(t.id, idx.pid));
      if (p) {
        tx.delete(paths.participant(t.id, p.id));
        tx.delete(paths.nickIndex(t.id, hashKey(p.nicknameKey)));
      }
      tx.delete(paths.uidIndex(t.id, viewer.uid));
      audit(tx, t.id, p?.nickname ?? "?", "cancelamento", `${p?.nickname ?? "?"} cancelou a inscrição.`);
      return "Inscrição cancelada.";
    });
  });
}

export async function removeParticipantAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const viewer = await actionViewer({ admin: true });
    const input = parse(removeSchema, raw);
    return getStore().transaction(async (tx) => {
      const t = await loadTournament(tx, input.tournamentId);
      assertBeforeDraw(t);
      const p = await tx.get<Participant>(paths.participant(t.id, input.participantId));
      if (!p) throw new TournamentError("Inscrito não encontrado.");
      const actor = await actorLabel(tx, t.id, viewer.uid, true);
      tx.delete(paths.participant(t.id, p.id));
      tx.delete(paths.uidIndex(t.id, p.uid));
      tx.delete(paths.nickIndex(t.id, hashKey(p.nicknameKey)));
      audit(tx, t.id, actor, "remocao", `${p.nickname} foi removido da lista.`);
      return `${p.nickname} removido.`;
    });
  });
}
