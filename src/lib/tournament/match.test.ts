import { describe, expect, it } from "vitest";
import { generateBracket } from "./bracket";
import { TournamentError } from "./errors";
import {
  LATE_VOTE_MESSAGE,
  adminDecide,
  advanceWinner,
  castVote,
  propagate,
  tournamentResult,
  undoResult,
} from "./match";
import { players, seededRandomInt } from "./test-helpers";
import type { Match } from "./types";

const T0 = "2026-10-03T12:00:00.000Z";
const T1 = "2026-10-03T13:00:00.000Z";

function baseMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "r1-m0",
    round: 1,
    position: 0,
    slotA: { pid: "a", nickname: "Ana" },
    slotB: { pid: "b", nickname: "Beto" },
    status: "pendente",
    votes: {},
    winnerPid: null,
    score: null,
    decidedBy: null,
    deadlineOverride: null,
    nextMatchId: "r2-m0",
    nextSlot: "A",
    loserNextMatchId: null,
    loserNextSlot: null,
    isThirdPlace: false,
    finishedAt: null,
    updatedAt: T0,
    ...overrides,
  };
}

function nextMatch(overrides: Partial<Match> = {}): Match {
  return baseMatch({
    id: "r2-m0",
    round: 2,
    slotA: null,
    slotB: null,
    status: "aguardando",
    nextMatchId: null,
    nextSlot: null,
    ...overrides,
  });
}

describe("castVote", () => {
  it("primeiro voto deixa aguardando o adversário", () => {
    const { match, outcome } = castVote(baseMatch(), "a", { winnerPid: "a" }, T1);
    expect(outcome).toBe("aguardando_adversario");
    expect(match.status).toBe("pendente");
    expect(match.votes.a.winnerPid).toBe("a");
    expect(match.winnerPid).toBeNull();
  });

  it("dois votos iguais finalizam por consenso", () => {
    const first = castVote(baseMatch(), "a", { winnerPid: "b", scoreA: 1, scoreB: 3 }, T0).match;
    const r = castVote(first, "b", { winnerPid: "b", scoreA: 1, scoreB: 3 }, T1);
    expect(r.outcome).toBe("finalizada");
    expect(r.match.status).toBe("finalizada");
    expect(r.match.winnerPid).toBe("b");
    expect(r.match.decidedBy).toBe("consenso");
    expect(r.match.score).toEqual({ a: 1, b: 3 });
    expect(r.match.finishedAt).toBe(T1);
  });

  it("votos divergentes geram disputa e revoto resolve", () => {
    const m = castVote(baseMatch(), "a", { winnerPid: "a" }, T0).match;
    const r = castVote(m, "b", { winnerPid: "b" }, T0);
    expect(r.outcome).toBe("em_disputa");
    expect(r.match.status).toBe("em_disputa");
    const fix = castVote(r.match, "a", { winnerPid: "b" }, T1);
    expect(fix.outcome).toBe("finalizada");
    expect(fix.match.winnerPid).toBe("b");
  });

  it("mesmo vencedor com placares diferentes também é disputa", () => {
    const m = castVote(baseMatch(), "a", { winnerPid: "a", scoreA: 3, scoreB: 1 }, T0).match;
    const r = castVote(m, "b", { winnerPid: "a", scoreA: 3, scoreB: 2 }, T0);
    expect(r.outcome).toBe("em_disputa");
  });

  it("se só um informou placar, usa esse placar", () => {
    const m = castVote(baseMatch(), "a", { winnerPid: "a", scoreA: 3, scoreB: 0 }, T0).match;
    const r = castVote(m, "b", { winnerPid: "a" }, T1);
    expect(r.outcome).toBe("finalizada");
    expect(r.match.score).toEqual({ a: 3, b: 0 });
  });

  it("revoto idêntico não muda nada", () => {
    const m = castVote(baseMatch(), "a", { winnerPid: "a" }, T0).match;
    const r = castVote(m, "a", { winnerPid: "a" }, T1);
    expect(r.outcome).toBe("sem_mudanca");
    expect(r.match).toBe(m);
  });

  it("jogador pode trocar o voto antes do adversário votar", () => {
    const m = castVote(baseMatch(), "a", { winnerPid: "a" }, T0).match;
    const r = castVote(m, "a", { winnerPid: "b" }, T1);
    expect(r.outcome).toBe("aguardando_adversario");
    expect(r.match.votes.a.winnerPid).toBe("b");
  });

  it("bloqueia quem não joga a partida", () => {
    expect(() => castVote(baseMatch(), "intruso", { winnerPid: "a" }, T0)).toThrow(/Só os jogadores/);
  });

  it("bloqueia vencedor que não está na partida", () => {
    expect(() => castVote(baseMatch(), "a", { winnerPid: "zzz" }, T0)).toThrow(/vencedor precisa/);
  });

  it("bloqueia voto em partida finalizada ou sem os dois jogadores", () => {
    const one = castVote(baseMatch(), "a", { winnerPid: "a" }, T0).match;
    const done = castVote(one, "b", { winnerPid: "a" }, T0).match;
    expect(() => castVote(done, "a", { winnerPid: "b" }, T1)).toThrow(TournamentError);
    expect(() => castVote(baseMatch({ slotB: null, status: "aguardando" }), "a", { winnerPid: "a" }, T0)).toThrow(
      /dois jogadores/,
    );
  });

  it("valida placar", () => {
    const m = baseMatch();
    expect(() => castVote(m, "a", { winnerPid: "a", scoreA: 1, scoreB: 3 }, T0)).toThrow(/não bate/);
    expect(() => castVote(m, "a", { winnerPid: "a", scoreA: 2, scoreB: 2 }, T0)).toThrow(/empatado/);
    expect(() => castVote(m, "a", { winnerPid: "a", scoreA: 2 }, T0)).toThrow(/dois jogadores/);
    expect(() => castVote(m, "a", { winnerPid: "a", scoreA: 2.5, scoreB: 1 }, T0)).toThrow(/inteiro/);
    expect(() => castVote(m, "a", { winnerPid: "a", scoreA: -1, scoreB: -3 }, T0)).toThrow(/inteiro/);
  });
});

describe("prazo", () => {
  const past = "2026-10-03T12:30:00.000Z";
  it("depois do prazo jogador não vota mais", () => {
    expect(() => castVote(baseMatch(), "a", { winnerPid: "a" }, T1, { deadline: past })).toThrow(LATE_VOTE_MESSAGE);
  });
  it("antes do prazo vota normal", () => {
    expect(castVote(baseMatch(), "a", { winnerPid: "a" }, T0, { deadline: past }).outcome).toBe(
      "aguardando_adversario",
    );
  });
  it("disputa que passou do prazo também trava", () => {
    let m = castVote(baseMatch(), "a", { winnerPid: "a" }, T0).match;
    m = castVote(m, "b", { winnerPid: "b" }, T0).match;
    expect(() => castVote(m, "b", { winnerPid: "a" }, T1, { deadline: past })).toThrow(LATE_VOTE_MESSAGE);
  });
  it("ADM decide mesmo atrasado", () => {
    expect(adminDecide(baseMatch(), { winnerPid: "a" }, "wo", T1).status).toBe("finalizada");
  });
});

describe("adminDecide", () => {
  it("resolve disputa", () => {
    let m = castVote(baseMatch(), "a", { winnerPid: "a" }, T0).match;
    m = castVote(m, "b", { winnerPid: "b" }, T0).match;
    const d = adminDecide(m, { winnerPid: "b", scoreA: 0, scoreB: 2 }, "admin", T1);
    expect(d.status).toBe("finalizada");
    expect(d.decidedBy).toBe("admin");
    expect(d.score).toEqual({ a: 0, b: 2 });
  });

  it("W.O. ignora placar", () => {
    const d = adminDecide(baseMatch(), { winnerPid: "a", scoreA: 0, scoreB: 9 }, "wo", T1);
    expect(d.decidedBy).toBe("wo");
    expect(d.score).toBeNull();
  });
});

describe("avanço e desfazer", () => {
  it("vencedor vai para o slot certo e a próxima abre quando completa", () => {
    const m = adminDecide(baseMatch(), { winnerPid: "a" }, "admin", T1);
    let next = advanceWinner(m, nextMatch(), T1);
    expect(next.slotA?.pid).toBe("a");
    expect(next.status).toBe("aguardando");
    const other = adminDecide(
      baseMatch({
        id: "r1-m1",
        position: 1,
        nextSlot: "B",
        slotA: { pid: "c", nickname: "Caio" },
        slotB: { pid: "d", nickname: "Duda" },
      }),
      { winnerPid: "d" },
      "admin",
      T1,
    );
    next = advanceWinner(other, next, T1);
    expect(next.slotB?.pid).toBe("d");
    expect(next.status).toBe("pendente");
  });

  it("final define campeão e vice", () => {
    const final = adminDecide(baseMatch({ nextMatchId: null, nextSlot: null }), { winnerPid: "b" }, "admin", T1);
    expect(propagate(final, null, null, T1)).toEqual({ next: null, loserNext: null });
    expect(tournamentResult([final])).toEqual({ complete: true, championPid: "b", runnerUpPid: "a", thirdPid: null });
  });

  it("perdedor da semi vai para a disputa de 3º lugar", () => {
    const semi = adminDecide(
      baseMatch({ loserNextMatchId: "terceiro", loserNextSlot: "B" }),
      { winnerPid: "a" },
      "admin",
      T1,
    );
    const third = nextMatch({ id: "terceiro", isThirdPlace: true, position: 1 });
    const eff = propagate(semi, nextMatch(), third, T1);
    expect(eff.next!.slotA?.pid).toBe("a");
    expect(eff.loserNext!.slotB?.pid).toBe("b");
    expect(eff.loserNext!.slotA).toBeNull();
  });

  it("desfazer semi é bloqueado se o 3º lugar já terminou", () => {
    const semi = adminDecide(
      baseMatch({ loserNextMatchId: "terceiro", loserNextSlot: "A" }),
      { winnerPid: "a" },
      "admin",
      T1,
    );
    const thirdDone = nextMatch({ id: "terceiro", isThirdPlace: true, status: "finalizada", winnerPid: "b" });
    expect(() => undoResult(semi, nextMatch(), thirdDone, T1)).toThrow(/3º lugar/);
    const u = undoResult(
      semi,
      nextMatch({ slotA: { pid: "a", nickname: "Ana" } }),
      nextMatch({ id: "terceiro", slotA: { pid: "b", nickname: "Beto" } }),
      T1,
    );
    expect(u.next!.slotA).toBeNull();
    expect(u.loserNext!.slotA).toBeNull();
  });

  it("desfazer limpa o resultado e a vaga na próxima", () => {
    const m = adminDecide(baseMatch(), { winnerPid: "a" }, "admin", T1);
    const next = advanceWinner(m, nextMatch({ slotB: { pid: "d", nickname: "Duda" } }), T1);
    expect(next.status).toBe("pendente");
    const withVote = castVote(next, "d", { winnerPid: "d" }, T1).match;
    const u = undoResult(m, withVote, null, T1);
    expect(u.match.status).toBe("pendente");
    expect(u.match.winnerPid).toBeNull();
    expect(u.match.votes).toEqual({});
    expect(u.next!.slotA).toBeNull();
    expect(u.next!.slotB?.pid).toBe("d");
    expect(u.next!.status).toBe("aguardando");
    expect(u.next!.votes).toEqual({});
  });

  it("não desfaz se a próxima já terminou, se foi BYE ou se não tem resultado", () => {
    const m = adminDecide(baseMatch(), { winnerPid: "a" }, "admin", T1);
    expect(() => undoResult(m, nextMatch({ status: "finalizada", winnerPid: "a" }), null, T1)).toThrow(
      /Desfaça aquela primeiro/,
    );
    expect(() => undoResult({ ...m, decidedBy: "bye" }, nextMatch(), null, T1)).toThrow(/BYE/);
    expect(() => undoResult(baseMatch(), nextMatch(), null, T1)).toThrow(/não tem resultado/);
  });
});

describe("simulação completa", () => {
  function playAll(byId: Map<string, Match>, decide: (m: Match) => Match) {
    let guard = 0;
    while (guard++ < 500) {
      const open = [...byId.values()].find((m) => m.status === "pendente");
      if (!open) break;
      const m = decide(open);
      byId.set(m.id, m);
      const eff = propagate(
        m,
        m.nextMatchId ? byId.get(m.nextMatchId)! : null,
        m.loserNextMatchId ? byId.get(m.loserNextMatchId)! : null,
        T1,
      );
      if (eff.next) byId.set(eff.next.id, eff.next);
      if (eff.loserNext) byId.set(eff.loserNext.id, eff.loserNext);
    }
  }

  it.each([2, 3, 4, 5, 8, 11, 16])("joga um torneio de %i até o pódio", (n) => {
    const { matches } = generateBracket(players(n), seededRandomInt(n * 7), T0);
    const byId = new Map(matches.map((m) => [m.id, m]));
    playAll(byId, (open) => {
      const winner = open.slotA!.pid;
      // A vota certo, B vota errado (disputa), B corrige
      let m = castVote(open, open.slotA!.pid, { winnerPid: winner }, T1).match;
      m = castVote(m, open.slotB!.pid, { winnerPid: open.slotB!.pid }, T1).match;
      expect(m.status).toBe("em_disputa");
      m = castVote(m, open.slotB!.pid, { winnerPid: winner }, T1).match;
      expect(m.status).toBe("finalizada");
      return m;
    });

    const all = [...byId.values()];
    expect(all.every((m) => m.status === "finalizada")).toBe(true);
    const res = tournamentResult(all);
    const final = all.find((m) => !m.nextMatchId && !m.isThirdPlace)!;
    expect(res.complete).toBe(true);
    expect(res.championPid).toBe(final.winnerPid);
    expect(res.runnerUpPid).toBeTruthy();
    expect(res.runnerUpPid).not.toBe(res.championPid);
    if (n >= 3) {
      expect(res.thirdPid).toBeTruthy();
      expect([res.championPid, res.runnerUpPid]).not.toContain(res.thirdPid);
    } else {
      expect(res.thirdPid).toBeNull();
    }
  });

  it("campeonato só termina quando final E 3º lugar acabam", () => {
    const { matches } = generateBracket(players(4), seededRandomInt(3), T0);
    const byId = new Map(matches.map((m) => [m.id, m]));
    const decide = (m: Match) => adminDecide(m, { winnerPid: m.slotA!.pid }, "admin", T1);
    // joga só as semis e a final
    for (const id of ["r1-m0", "r1-m1", "r2-m0"]) {
      const m = decide(byId.get(id)!);
      byId.set(id, m);
      const eff = propagate(m, m.nextMatchId ? byId.get(m.nextMatchId)! : null, m.loserNextMatchId ? byId.get(m.loserNextMatchId)! : null, T1);
      if (eff.next) byId.set(eff.next.id, eff.next);
      if (eff.loserNext) byId.set(eff.loserNext.id, eff.loserNext);
    }
    expect(byId.get("terceiro")!.status).toBe("pendente");
    expect(tournamentResult([...byId.values()]).complete).toBe(false);
    playAll(byId, decide);
    const res = tournamentResult([...byId.values()]);
    expect(res.complete).toBe(true);
    expect(res.thirdPid).toBe(byId.get("terceiro")!.winnerPid);
  });
});
