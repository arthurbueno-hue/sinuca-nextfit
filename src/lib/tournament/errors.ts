/** Erro de regra de negócio: a mensagem é segura para mostrar ao usuário. */
export class TournamentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentError";
  }
}
