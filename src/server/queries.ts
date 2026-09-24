import "server-only";
import { DEFAULT_CONTACT, DEFAULT_DISCORD } from "@/lib/defaults";
import type { AuditDTO, MatchDTO, TournamentDTO, TournamentView } from "@/lib/dto";
import { effectiveDeadline } from "@/lib/tournament/deadline";
import { tournamentResult } from "@/lib/tournament/match";
import { registrationState } from "@/lib/tournament/registration";
import type { Match, Participant, Tournament } from "@/lib/tournament/types";
import { ID_RE } from "./action-utils";
import { getStore, paths } from "./store";
import type { Viewer } from "./viewer";

function toTournamentDTO(t: Tournament): TournamentDTO {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    registrationDeadline: t.registrationDeadline,
    startDate: t.startDate,
    registrationClosed: t.registrationClosed,
    notes: t.notes ?? [],
    rules: t.rules ?? [],
    rounds: t.rounds ?? [],
    contactName: t.contactName || DEFAULT_CONTACT,
    discordUrl: t.discordUrl ?? DEFAULT_DISCORD,
    championPid: t.championPid ?? null,
    drawnAt: t.drawnAt ?? null,
  };
}

function toMatchDTO(m: Match, t: Tournament, canSeeVotes: (m: Match) => boolean): MatchDTO {
  const votes = m.votes ?? {};
  return {
    id: m.id,
    round: m.round,
    position: m.position,
    slotA: m.slotA,
    slotB: m.slotB,
    status: m.status,
    winnerPid: m.winnerPid,
    score: m.score,
    decidedBy: m.decidedBy,
    deadline: effectiveDeadline(m, t.rounds ?? []),
    deadlineOverride: m.deadlineOverride,
    votedPids: Object.keys(votes),
    votes: canSeeVotes(m)
      ? Object.entries(votes).map(([pid, v]) => ({ pid, winnerPid: v.winnerPid, scoreA: v.scoreA, scoreB: v.scoreB, at: v.at }))
      : null,
    nextMatchId: m.nextMatchId,
    isThirdPlace: m.isThirdPlace === true,
    feedsThirdPlace: !!m.loserNextMatchId,
  };
}

export async function listTournaments(): Promise<TournamentDTO[]> {
  const all = await getStore().list<Tournament>(paths.tournaments());
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toTournamentDTO);
}

/** Campeonato "da vez": o mais recente não finalizado, senão o mais recente. */
export async function getActiveTournamentSlug(): Promise<string | null> {
  const all = await listTournaments();
  return (all.find((t) => t.status !== "finalizado") ?? all[0])?.slug ?? null;
}

export async function getTournamentView(slug: string, viewer: Viewer): Promise<TournamentView | null> {
  if (!ID_RE.test(slug)) return null;
  const store = getStore();
  const [t, participants, matches, idx, user] = await Promise.all([
    store.get<Tournament>(paths.tournament(slug)),
    store.list<Participant>(paths.participants(slug)),
    store.list<Match>(paths.matches(slug)),
    store.get<{ pid: string }>(paths.uidIndex(slug, viewer.uid)),
    store.get<{ lastNickname?: string }>(paths.user(viewer.uid)),
  ]);
  if (!t) return null;

  const myPid = idx?.pid ?? null;
  const me = participants.find((p) => p.id === myPid) ?? null;
  const canSeeVotes = (m: Match) => viewer.isAdmin || (!!myPid && (m.slotA?.pid === myPid || m.slotB?.pid === myPid));
  const now = new Date();

  return {
    tournament: toTournamentDTO(t),
    participants: participants
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((p) => ({ id: p.id, nickname: p.nickname, joinedAt: p.joinedAt })),
    matches: matches.sort((a, b) => a.round - b.round || a.position - b.position).map((m) => toMatchDTO(m, t, canSeeVotes)),
    podium: tournamentResult(matches),
    me: { pid: me?.id ?? null, nickname: me?.nickname ?? null },
    isAdmin: viewer.isAdmin,
    registration: registrationState(t, now),
    suggestedNickname: user?.lastNickname ?? null,
    now: now.toISOString(),
  };
}

export async function getAuditLog(slug: string, limit = 150): Promise<AuditDTO[]> {
  if (!ID_RE.test(slug)) return [];
  const entries = await getStore().list<{ at: string; actor: string; summary: string }>(paths.audit(slug));
  return entries
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map((e) => ({ id: e.id, at: e.at, actor: e.actor, summary: e.summary }));
}
