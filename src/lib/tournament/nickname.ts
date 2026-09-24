import { TournamentError } from "./errors";

const NICK_RE = /^[\p{L}\p{N} _.\-]+$/u;
const RESERVED = new Set(["bye", "adm", "admin", "adefinir", "organizacao"]);

export function normalizeNickname(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Chave para comparar apelidos: ignora maiúsculas, acentos, espaços e
 * pontuação. "Rui Chapéu", "rui chapeu", "RUI-CHAPÉU" e "Rui.Chapeu"
 * são o MESMO apelido.
 */
export function nicknameKey(nickname: string): string {
  return normalizeNickname(nickname)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
}

export function validateNickname(raw: unknown): string {
  if (typeof raw !== "string") throw new TournamentError("Apelido inválido.");
  const nick = normalizeNickname(raw);
  if (nick.length < 3 || nick.length > 20) {
    throw new TournamentError("O apelido precisa ter entre 3 e 20 caracteres.");
  }
  if (!NICK_RE.test(nick)) {
    throw new TournamentError("Use só letras, números, espaço, ponto, hífen ou _.");
  }
  if (nicknameKey(nick).length < 2) {
    throw new TournamentError("O apelido precisa ter letras ou números.");
  }
  if (RESERVED.has(nicknameKey(nick))) {
    throw new TournamentError("Esse apelido é reservado, escolha outro.");
  }
  return nick;
}
