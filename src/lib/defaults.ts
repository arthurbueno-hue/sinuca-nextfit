import type { RuleItem } from "./tournament/types";

export const DEFAULT_TOURNAMENT = {
  name: "1º Campeonato de Sinuca Next Fit",
  slug: "sinuca-2026",
  /** Horário de Brasília (datetime-local). */
  registrationDeadline: "2026-09-29T23:59",
  startDate: "2026-10-02T09:00",
};

export const DEFAULT_CONTACT = "Felipe Feijó";
export const DEFAULT_DISCORD = "https://discord.gg/xVtfVmKEw";

export const DEFAULT_NOTES: string[] = [
  "Formato mata-mata: perdeu, tá fora. Os confrontos são sorteados, ninguém escolhe adversário.",
  "Os horários devem ser combinados entre os adversários, respeitando o prazo final de cada rodada.",
  "Depois do jogo, os dois jogadores informam o vencedor aqui no site. Se os dois concordarem, o resultado é confirmado na hora.",
  "Se os votos não baterem, a partida fica em disputa até vocês se acertarem (ou a organização decidir).",
  "Os perdedores das semifinais disputam o 3º lugar (também tem troféu!).",
  "Passou do prazo do jogo, o resultado trava: só a organização (Felipe Feijó) pode ajustar a chave, inclusive por W.O.",
];

export const DEFAULT_RULES: RuleItem[] = [
  { situation: "Matar a bola do adversário", penalty: "Pagar 1 bola" },
  { situation: "Bola branca bater direto na bola do adversário", penalty: "Pagar 2 bolas" },
  { situation: "Tocar na bola do adversário", penalty: "Pagar 1 bola" },
  { situation: "Bola \"pulou\" a caçapa e caiu fora da mesa", penalty: "Volta colada no canto da mesa e passa a vez" },
];
