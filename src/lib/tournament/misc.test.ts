import { describe, expect, it } from "vitest";
import { isoToLocalInput, localInputToIso } from "../time";
import { deadlineState, effectiveDeadline } from "./deadline";
import { nicknameKey, validateNickname } from "./nickname";
import { registrationState } from "./registration";

const rounds = [{ index: 1, name: "Quartas", deadline: "2026-10-10T23:00:00.000Z" }];

describe("prazos", () => {
  it("ajuste do jogo vence o prazo da rodada", () => {
    expect(effectiveDeadline({ round: 1, deadlineOverride: null }, rounds)).toBe("2026-10-10T23:00:00.000Z");
    expect(effectiveDeadline({ round: 1, deadlineOverride: "2026-10-12T23:00:00.000Z" }, rounds)).toBe(
      "2026-10-12T23:00:00.000Z",
    );
    expect(effectiveDeadline({ round: 2, deadlineOverride: null }, rounds)).toBeNull();
  });

  it("estados", () => {
    const m = { round: 1, deadlineOverride: null, status: "pendente" as const };
    expect(deadlineState(m, rounds, new Date("2026-10-05T00:00:00Z"))).toBe("ok");
    expect(deadlineState(m, rounds, new Date("2026-10-10T10:00:00Z"))).toBe("proximo");
    expect(deadlineState(m, rounds, new Date("2026-10-11T00:00:00Z"))).toBe("atrasado");
    expect(deadlineState({ ...m, status: "finalizada" }, rounds, new Date("2026-10-11T00:00:00Z"))).toBe("encerrado");
    expect(deadlineState({ ...m, round: 2 }, rounds, new Date())).toBe("sem_prazo");
  });
});

describe("apelido", () => {
  it("normaliza e valida", () => {
    expect(validateNickname("  Zé   da  Sinuca ")).toBe("Zé da Sinuca");
    expect(() => validateNickname("ab")).toThrow(/entre 3 e 20/);
    expect(() => validateNickname("x".repeat(21))).toThrow(/entre 3 e 20/);
    expect(() => validateNickname("<script>")).toThrow(/Use só/);
    expect(() => validateNickname("BYE")).toThrow(/reservado/);
    expect(() => validateNickname(123)).toThrow(/inválido/);
  });

  it("chave ignora acento, caixa, espaço e pontuação", () => {
    expect(nicknameKey("José")).toBe(nicknameKey("JOSE"));
    const base = nicknameKey("Rui Chapéu");
    for (const v of ["rui chapeu", "RUI CHAPÉU", "rui-chapeu", "Rui.Chapéu", "  rui   chapeu ", "RuiChapeu", "rui_chapéu"]) {
      expect(nicknameKey(v)).toBe(base);
    }
    expect(nicknameKey("Rui Chapéu 2")).not.toBe(base);
    expect(() => validateNickname("...")).toThrow(/letras ou números/);
  });
});

describe("inscrição", () => {
  const t = {
    status: "inscricoes" as const,
    registrationClosed: false,
    registrationDeadline: "2026-09-30T02:59:00.000Z",
  };
  it("aberta até o prazo", () => {
    expect(registrationState(t, new Date("2026-09-29T20:00:00Z")).open).toBe(true);
    expect(registrationState(t, new Date("2026-09-30T03:00:00Z")).open).toBe(false);
    expect(registrationState({ ...t, registrationClosed: true }, new Date("2026-09-20T00:00:00Z")).open).toBe(false);
    expect(registrationState({ ...t, status: "em_andamento" }, new Date("2026-09-20T00:00:00Z")).open).toBe(false);
  });
});

describe("fuso horário", () => {
  it("converte horário de Brasília ida e volta", () => {
    const iso = localInputToIso("2026-09-29T23:59");
    expect(iso).toBe("2026-09-30T02:59:00.000Z");
    expect(isoToLocalInput(iso)).toBe("2026-09-29T23:59");
    expect(localInputToIso("lixo")).toBeNull();
  });
});
