// Formatos que chegam ao navegador. Nada de e-mail ou uid do Google aqui.
import type { DecidedBy, MatchStatus, Round, RuleItem, Score, Slot, TournamentStatus } from "./tournament/types";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export interface TournamentDTO {
  id: string;
  name: string;
  slug: string;
  status: TournamentStatus;
  registrationDeadline: string;
  startDate: string;
  registrationClosed: boolean;
  notes: string[];
  rules: RuleItem[];
  rounds: Round[];
  contactName: string;
  discordUrl: string;
  championPid: string | null;
  drawnAt: string | null;
}

export interface PodiumDTO {
  complete: boolean;
  championPid: string | null;
  runnerUpPid: string | null;
  thirdPid: string | null;
}

export interface ParticipantDTO {
  id: string;
  nickname: string;
  joinedAt: string;
}

export interface VoteDTO {
  pid: string;
  winnerPid: string;
  scoreA: number | null;
  scoreB: number | null;
  at: string;
}

export interface MatchDTO {
  id: string;
  round: number;
  position: number;
  slotA: Slot | null;
  slotB: Slot | null;
  status: MatchStatus;
  winnerPid: string | null;
  score: Score | null;
  decidedBy: DecidedBy | null;
  /** Prazo efetivo (ajuste do jogo ou da rodada). */
  deadline: string | null;
  deadlineOverride: string | null;
  /** Quem já votou (todo mundo vê). */
  votedPids: string[];
  /** Detalhe dos votos: só para os 2 jogadores e ADMs. */
  votes: VoteDTO[] | null;
  nextMatchId: string | null;
  isThirdPlace: boolean;
  /** Semifinal: o perdedor vai para a disputa de 3º. */
  feedsThirdPlace: boolean;
}

export interface TournamentView {
  tournament: TournamentDTO;
  participants: ParticipantDTO[];
  matches: MatchDTO[];
  podium: PodiumDTO;
  me: { pid: string | null; nickname: string | null };
  isAdmin: boolean;
  registration: { open: boolean; reason: string | null };
  suggestedNickname: string | null;
  now: string;
}

export interface AuditDTO {
  id: string;
  at: string;
  actor: string;
  summary: string;
}
