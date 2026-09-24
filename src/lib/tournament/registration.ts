import type { Tournament } from "./types";

type RegistrationFields = Pick<Tournament, "status" | "registrationClosed" | "registrationDeadline">;

export function registrationState(t: RegistrationFields, now: Date): { open: boolean; reason: string | null } {
  if (t.status !== "inscricoes") return { open: false, reason: "As inscrições estão encerradas: a chave já foi sorteada." };
  if (t.registrationClosed) return { open: false, reason: "As inscrições foram encerradas pela organização." };
  if (now.getTime() > new Date(t.registrationDeadline).getTime()) {
    return { open: false, reason: "O prazo de inscrição acabou." };
  }
  return { open: true, reason: null };
}
