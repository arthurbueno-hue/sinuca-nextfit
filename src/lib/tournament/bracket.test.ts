import { describe, expect, it } from "vitest";
import { generateBracket, shuffle } from "./bracket";
import { TournamentError } from "./errors";
import { matchId, seedOrder } from "./rounds";
import { players, seededRandomInt } from "./test-helpers";

const NOW = "2026-10-02T12:00:00.000Z";

describe("seedOrder", () => {
  it("gera a ordem padrão", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("shuffle", () => {
  it("é uma permutação e não muta a entrada", () => {
    const input = players(20);
    const out = shuffle(input, seededRandomInt(42));
    expect(out).toHaveLength(20);
    expect(new Set(out.map((p) => p.pid))).toEqual(new Set(input.map((p) => p.pid)));
    expect(input[0].pid).toBe("p1");
  });
});

describe("generateBracket", () => {
  it.each([2, 3, 5, 6, 7, 8, 9, 13, 16, 17, 32])("monta chave válida com %i jogadores", (n) => {
    for (let seed = 1; seed <= 20; seed++) {
      const { rounds, matches, order } = generateBracket(players(n), seededRandomInt(seed), NOW);
      let size = 1;
      while (size < n) size *= 2;
      const byId = new Map(matches.map((m) => [m.id, m]));

      expect(rounds).toHaveLength(Math.log2(size));
      expect(rounds.at(-1)!.name).toBe("Final");
      expect(matches).toHaveLength(size - 1 + (n >= 4 ? 1 : 0));
      const third = matches.find((m) => m.isThirdPlace);
      if (n >= 4) {
        expect(third?.id).toBe("terceiro");
        const semis = matches.filter((m) => m.round === rounds.length - 1);
        expect(semis.map((m) => [m.loserNextMatchId, m.loserNextSlot])).toEqual([
          ["terceiro", "A"],
          ["terceiro", "B"],
        ]);
        expect(semis.every((m) => m.decidedBy !== "bye")).toBe(true);
      } else {
        expect(third).toBeUndefined();
      }
      expect(order).toHaveLength(n);

      const r1 = matches.filter((m) => m.round === 1);
      const seen = r1.flatMap((m) => [m.slotA?.pid, m.slotB?.pid]).filter(Boolean);
      expect(seen.sort()).toEqual(players(n).map((p) => p.pid).sort());

      for (const m of r1) {
        expect(m.slotA || m.slotB).toBeTruthy(); // nunca BYE x BYE
        if (m.slotA && m.slotB) expect(m.status).toBe("pendente");
        else {
          expect(m.status).toBe("finalizada");
          expect(m.decidedBy).toBe("bye");
        }
      }
      expect(r1.filter((m) => m.decidedBy === "bye")).toHaveLength(size - n);

      for (const m of matches) {
        if (m.nextMatchId) {
          const next = byId.get(m.nextMatchId)!;
          expect(next.round).toBe(m.round + 1);
          expect(next.id).toBe(matchId(m.round + 1, Math.floor(m.position / 2)));
        } else {
          expect(m.round).toBe(rounds.length);
        }
        if (m.decidedBy === "bye") {
          const next = byId.get(m.nextMatchId!)!;
          const slot = m.nextSlot === "A" ? next.slotA : next.slotB;
          expect(slot?.pid).toBe(m.winnerPid);
        }
      }
      for (const m of matches.filter((x) => x.round > 1)) {
        if (m.status === "pendente") expect(m.slotA && m.slotB).toBeTruthy();
        else expect(m.status).toBe("aguardando");
      }
    }
  });

  it("nomeia as rodadas", () => {
    const { rounds } = generateBracket(players(16), seededRandomInt(1), NOW);
    expect(rounds.map((r) => r.name)).toEqual(["Oitavas de final", "Quartas de final", "Semifinal", "Final"]);
    const big = generateBracket(players(20), seededRandomInt(1), NOW);
    expect(big.rounds[0].name).toBe("Rodada de 32");
  });

  it("mantém prazos de rodadas definidos antes de um novo sorteio", () => {
    const prev = [{ index: 1, name: "x", deadline: "2026-10-10T23:00:00.000Z" }];
    const { rounds } = generateBracket(players(4), seededRandomInt(1), NOW, prev);
    expect(rounds[0].deadline).toBe("2026-10-10T23:00:00.000Z");
    expect(rounds[1].deadline).toBeNull();
  });

  it("recusa menos de 2 jogadores e duplicados", () => {
    expect(() => generateBracket(players(1), seededRandomInt(1), NOW)).toThrow(TournamentError);
    const dup = [...players(2), players(1)[0]];
    expect(() => generateBracket(dup, seededRandomInt(1), NOW)).toThrow(/duplicados/);
  });
});
