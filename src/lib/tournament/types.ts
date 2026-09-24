export type TournamentStatus = "inscricoes" | "em_andamento" | "finalizado";
export type MatchStatus = "aguardando" | "pendente" | "em_disputa" | "finalizada";
export type DecidedBy = "consenso" | "admin" | "wo" | "bye";
export type SlotKey = "A" | "B";

export interface RuleItem {
  situation: string;
  penalty: string;
}

export interface Round {
  index: number;
  name: string;
  /** ISO (UTC) ou null quando ainda não definido. */
  deadline: string | null;
}

export interface Tournament {
  /** Igual ao slug. */
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
  /** Quem os jogadores devem procurar em caso de atraso/problema. */
  contactName: string;
  /** Convite do Discord (vazio = sem botão). */
  discordUrl: string;
  championPid: string | null;
  drawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  /** Google `sub`. Nunca sai do servidor. */
  uid: string;
  nickname: string;
  nicknameKey: string;
  joinedAt: string;
}

export interface Slot {
  pid: string;
  nickname: string;
}

export interface Vote {
  winnerPid: string;
  scoreA: number | null;
  scoreB: number | null;
  at: string;
}

export interface Score {
  a: number;
  b: number;
}

export interface Match {
  id: string;
  round: number;
  position: number;
  slotA: Slot | null;
  slotB: Slot | null;
  status: MatchStatus;
  votes: Record<string, Vote>;
  winnerPid: string | null;
  score: Score | null;
  decidedBy: DecidedBy | null;
  deadlineOverride: string | null;
  nextMatchId: string | null;
  nextSlot: SlotKey | null;
  /** Para onde vai o PERDEDOR (semifinal -> disputa de 3º lugar). */
  loserNextMatchId: string | null;
  loserNextSlot: SlotKey | null;
  isThirdPlace: boolean;
  finishedAt: string | null;
  updatedAt: string;
}
