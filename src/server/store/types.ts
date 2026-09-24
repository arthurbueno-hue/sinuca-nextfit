export type WithId<T> = T & { id: string };

export interface Reader {
  get<T>(path: string): Promise<WithId<T> | null>;
  list<T>(collectionPath: string): Promise<WithId<T>[]>;
}

/**
 * Transação no estilo Firestore: todas as leituras ANTES das escritas.
 * O backend em memória também impõe essa regra, para pegar bug localmente.
 */
export interface Tx extends Reader {
  set(path: string, data: object): void;
  /** Merge raso: campos de topo são substituídos inteiros. */
  update(path: string, data: object): void;
  delete(path: string): void;
}

export interface Store extends Reader {
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
  newId(): string;
}

export const paths = {
  user: (uid: string) => `users/${uid}`,
  tournaments: () => "tournaments",
  tournament: (tid: string) => `tournaments/${tid}`,
  participants: (tid: string) => `tournaments/${tid}/participants`,
  participant: (tid: string, pid: string) => `tournaments/${tid}/participants/${pid}`,
  /** Índice uid -> pid (garante 1 inscrição por pessoa). */
  uidIndex: (tid: string, uid: string) => `tournaments/${tid}/uidIndex/${uid}`,
  /** Índice apelido -> pid (garante apelido único). */
  nickIndex: (tid: string, keyHash: string) => `tournaments/${tid}/nickIndex/${keyHash}`,
  matches: (tid: string) => `tournaments/${tid}/matches`,
  match: (tid: string, mid: string) => `tournaments/${tid}/matches/${mid}`,
  audit: (tid: string) => `tournaments/${tid}/audit`,
  auditEntry: (tid: string, id: string) => `tournaments/${tid}/audit/${id}`,
};

/** Evita path traversal / ids malformados vindos do cliente. */
export function assertSafeId(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error(`id inválido: ${id}`);
  return id;
}
