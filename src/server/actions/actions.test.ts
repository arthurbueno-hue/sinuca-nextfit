/**
 * Testes de ponta a ponta das server actions, com o banco em memória e a
 * sessão simulada (o login do Google é mockado; todo o resto é o código real).
 * Simulam usuários normais, ADM e gente tentando burlar o sistema.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; isAdmin: boolean } } }));
vi.mock("@/auth", () => ({ auth: async () => session.current, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import type { ActionResult, TournamentView } from "@/lib/dto";
import { resetMemoryStore } from "../store/memory";
import { getTournamentView } from "../queries";
import {
  createTournamentAction,
  drawAction,
  setRoundDeadlineAction,
  updateTournamentAction,
} from "./admin";
import { adminDecideAction, adminUndoAction, setMatchDeadlineAction, voteAction } from "./match";
import { registerAction, removeParticipantAction, unregisterAction, updateNicknameAction } from "./registration";

const T = "teste";
const ADMIN = { id: "google-sub-ADMIN-0001", isAdmin: true };
const user = (i: number) => ({ id: `google-sub-USER-${1000 + i}`, isAdmin: false });

function as(u: { id: string; isAdmin: boolean } | null) {
  session.current = u ? { user: u } : null;
}
function ok(r: ActionResult) {
  if (!r.ok) throw new Error(`esperava ok, veio erro: ${r.error}`);
  return r.message;
}
function err(r: ActionResult) {
  if (r.ok) throw new Error(`esperava erro, veio ok: ${r.message}`);
  return r.error;
}
async function viewAs(u: { id: string; isAdmin: boolean }): Promise<TournamentView> {
  return (await getTournamentView(T, { uid: u.id, isAdmin: u.isAdmin }))!;
}

async function createTournament() {
  as(ADMIN);
  ok(
    await createTournamentAction({
      name: "Campeonato Teste",
      slug: T,
      registrationDeadline: "2099-12-31T23:59",
      startDate: "2099-12-31T09:00",
    }),
  );
}

async function setup(n: number) {
  await createTournament();
  for (let i = 0; i < n; i++) {
    as(user(i));
    ok(await registerAction({ tournamentId: T, nickname: `Jogador ${i}` }));
  }
  as(ADMIN);
  ok(await drawAction({ tournamentId: T }));
}

/** Resolve uma partida com os dois jogadores votando no slot A. */
async function playByVotes(matchId: string) {
  const v = await viewAs(ADMIN);
  const m = v.matches.find((x) => x.id === matchId)!;
  const uidOf = (pid: string) => {
    const nick = v.participants.find((p) => p.id === pid)!.nickname;
    return user(Number(nick.split(" ")[1]));
  };
  for (const s of [m.slotA!, m.slotB!]) {
    as(uidOf(s.pid));
    ok(await voteAction({ tournamentId: T, matchId, winnerPid: m.slotA!.pid }));
  }
}

beforeEach(() => {
  resetMemoryStore();
  session.current = null;
});

describe("sem login", () => {
  it("toda ação exige sessão", async () => {
    await createTournament();
    as(null);
    for (const r of [
      await registerAction({ tournamentId: T, nickname: "Hacker" }),
      await voteAction({ tournamentId: T, matchId: "r1-m0", winnerPid: "x" }),
      await drawAction({ tournamentId: T }),
      await adminDecideAction({ tournamentId: T, matchId: "r1-m0", winnerPid: "x", kind: "wo" }),
    ]) {
      expect(err(r)).toMatch(/sessão expirou/);
    }
  });
});

describe("inscrição", () => {
  it("apelido é único ignorando maiúsculas, acentos, espaços e pontuação", async () => {
    await createTournament();
    as(user(1));
    ok(await registerAction({ tournamentId: T, nickname: "Rui Chapéu" }));
    const variants = ["rui chapeu", "RUI CHAPÉU", "Rui chapeu", "rui-chapeu", "Rui.Chapéu", "RuiChapeu", " rui  chapéu "];
    for (const [i, nickname] of variants.entries()) {
      as(user(10 + i));
      expect(err(await registerAction({ tournamentId: T, nickname }))).toMatch(/já está em uso/);
    }
    as(user(30));
    ok(await registerAction({ tournamentId: T, nickname: "Rui Chapéu 2" }));
  });

  it("mesma pessoa não se inscreve duas vezes", async () => {
    await createTournament();
    as(user(1));
    ok(await registerAction({ tournamentId: T, nickname: "Primeiro" }));
    expect(err(await registerAction({ tournamentId: T, nickname: "Segundo" }))).toMatch(/já está inscrito/);
  });

  it("trocar apelido também respeita a unicidade e libera o antigo", async () => {
    await createTournament();
    as(user(1));
    ok(await registerAction({ tournamentId: T, nickname: "Ana" + "lu" }));
    as(user(2));
    ok(await registerAction({ tournamentId: T, nickname: "Beto" }));
    expect(err(await updateNicknameAction({ tournamentId: T, nickname: "ANALU" }))).toMatch(/já está em uso/);
    as(user(1));
    ok(await updateNicknameAction({ tournamentId: T, nickname: "Aninha" }));
    as(user(3));
    ok(await registerAction({ tournamentId: T, nickname: "Analu" }));
  });

  it("depois do prazo ou do sorteio não inscreve nem cancela", async () => {
    await setup(4);
    as(user(99));
    expect(err(await registerAction({ tournamentId: T, nickname: "Atrasado" }))).toMatch(/encerradas/);
    as(user(0));
    expect(err(await unregisterAction({ tournamentId: T }))).toMatch(/já foi sorteada/);
  });
});

describe("permissões", () => {
  it("jogador comum não consegue usar nenhuma ação de ADM", async () => {
    await setup(4);
    as(user(0));
    const results = [
      await drawAction({ tournamentId: T }),
      await adminDecideAction({ tournamentId: T, matchId: "r1-m0", winnerPid: "x", kind: "wo" }),
      await adminUndoAction({ tournamentId: T, matchId: "r1-m0" }),
      await setRoundDeadlineAction({ tournamentId: T, round: 1, deadline: "2099-01-01T23:59" }),
      await setMatchDeadlineAction({ tournamentId: T, matchId: "r1-m0", deadline: null }),
      await removeParticipantAction({ tournamentId: T, participantId: "abc" }),
      await createTournamentAction({ name: "Fake", slug: "fake", registrationDeadline: "2099-01-01T23:59", startDate: "2099-01-01T23:59" }),
      await updateTournamentAction({
        tournamentId: T,
        name: "Hackeado",
        registrationDeadline: "2099-01-01T23:59",
        startDate: "2099-01-01T23:59",
        registrationClosed: false,
        notesText: "",
        rulesText: "",
        contactName: "Eu",
        discordUrl: "",
      }),
    ];
    for (const r of results) expect(err(r)).toMatch(/Só a organização/);
  });

  it("quem não joga a partida não vota nela", async () => {
    await setup(4);
    const v = await viewAs(ADMIN);
    const m0 = v.matches.find((m) => m.id === "r1-m0")!;
    const m1 = v.matches.find((m) => m.id === "r1-m1")!;
    const outsider = v.participants.find((p) => p.id === m1.slotA!.pid)!;
    as(user(Number(outsider.nickname.split(" ")[1])));
    expect(err(await voteAction({ tournamentId: T, matchId: m0.id, winnerPid: m0.slotA!.pid }))).toMatch(
      /Só os jogadores/,
    );
    // e não pode votar num vencedor de outra partida
    const insider = v.participants.find((p) => p.id === m0.slotA!.pid)!;
    as(user(Number(insider.nickname.split(" ")[1])));
    expect(err(await voteAction({ tournamentId: T, matchId: m0.id, winnerPid: m1.slotA!.pid }))).toMatch(
      /vencedor precisa/,
    );
  });

  it("usuário logado mas não inscrito não vota", async () => {
    await setup(4);
    as(user(77));
    const v = await viewAs(ADMIN);
    const m0 = v.matches.find((m) => m.id === "r1-m0")!;
    expect(err(await voteAction({ tournamentId: T, matchId: "r1-m0", winnerPid: m0.slotA!.pid }))).toMatch(
      /não está inscrito/,
    );
  });
});

describe("entradas maliciosas", () => {
  it("ids com caminho, tipos errados e valores absurdos são recusados", async () => {
    await setup(4);
    as(user(0));
    const bad: unknown[] = [
      { tournamentId: "../users/x", matchId: "r1-m0", winnerPid: "a" },
      { tournamentId: T, matchId: "r1-m0/../../x", winnerPid: "a" },
      { tournamentId: T, matchId: "r1-m0", winnerPid: { $gt: "" } },
      { tournamentId: T, matchId: "r1-m0", winnerPid: "a", scoreA: 1e9, scoreB: 0 },
      { tournamentId: T, matchId: "r1-m0", winnerPid: "a", scoreA: "3", scoreB: 1 },
      null,
      "texto",
      [],
    ];
    for (const b of bad) expect(err(await voteAction(b))).toBe("Dados inválidos.");
    expect(err(await registerAction({ tournamentId: T, nickname: "<img src=x onerror=alert(1)>" }))).toBeTruthy();
  });
});

describe("prazo", () => {
  it("passou do prazo: jogador não vota, ADM decide; prazo novo destrava", async () => {
    await setup(4);
    as(ADMIN);
    ok(await setRoundDeadlineAction({ tournamentId: T, round: 1, deadline: "2020-01-01T23:59" }));
    const v = await viewAs(ADMIN);
    const m0 = v.matches.find((m) => m.id === "r1-m0")!;
    expect(new Date(m0.deadline!).toISOString()).toBe("2020-01-02T02:59:00.000Z"); // 23:59 de Brasília
    const nickA = v.participants.find((p) => p.id === m0.slotA!.pid)!.nickname;
    as(user(Number(nickA.split(" ")[1])));
    expect(err(await voteAction({ tournamentId: T, matchId: "r1-m0", winnerPid: m0.slotA!.pid }))).toMatch(
      /Prazo encerrado/,
    );

    // ADM dá um prazo novo só para esse jogo: destrava
    as(ADMIN);
    ok(await setMatchDeadlineAction({ tournamentId: T, matchId: "r1-m0", deadline: "2099-01-01T23:59" }));
    as(user(Number(nickA.split(" ")[1])));
    ok(await voteAction({ tournamentId: T, matchId: "r1-m0", winnerPid: m0.slotA!.pid }));

    // o outro jogo continua travado e o ADM decide por W.O.
    const m1 = v.matches.find((m) => m.id === "r1-m1")!;
    as(ADMIN);
    ok(await adminDecideAction({ tournamentId: T, matchId: "r1-m1", winnerPid: m1.slotB!.pid, kind: "wo" }));
    const after = await viewAs(ADMIN);
    expect(after.matches.find((m) => m.id === "r1-m1")!.decidedBy).toBe("wo");
  });
});

describe("campeonato completo", () => {
  it("6 jogadores: disputa, correção, 3º lugar e pódio", async () => {
    await setup(6);
    let v = await viewAs(ADMIN);
    expect(v.matches.some((m) => m.isThirdPlace)).toBe(true);

    // primeira partida real: votos divergentes e depois correção
    const first = v.matches.find((m) => m.status === "pendente")!;
    const uidOf = (pid: string) => user(Number(v.participants.find((p) => p.id === pid)!.nickname.split(" ")[1]));
    as(uidOf(first.slotA!.pid));
    ok(await voteAction({ tournamentId: T, matchId: first.id, winnerPid: first.slotA!.pid, scoreA: 3, scoreB: 1 }));
    as(uidOf(first.slotB!.pid));
    expect(ok(await voteAction({ tournamentId: T, matchId: first.id, winnerPid: first.slotB!.pid }))).toMatch(
      /não bateram/,
    );
    v = await viewAs(ADMIN);
    expect(v.matches.find((m) => m.id === first.id)!.status).toBe("em_disputa");
    ok(await voteAction({ tournamentId: T, matchId: first.id, winnerPid: first.slotA!.pid }));
    v = await viewAs(ADMIN);
    expect(v.matches.find((m) => m.id === first.id)!.score).toEqual({ a: 3, b: 1 });

    // joga o resto por votos até o fim
    for (let guard = 0; guard < 20; guard++) {
      v = await viewAs(ADMIN);
      const open = v.matches.find((m) => m.status === "pendente");
      if (!open) break;
      await playByVotes(open.id);
    }
    v = await viewAs(ADMIN);
    expect(v.matches.every((m) => m.status === "finalizada")).toBe(true);
    expect(v.tournament.status).toBe("finalizado");
    const { championPid, runnerUpPid, thirdPid } = v.podium;
    expect(new Set([championPid, runnerUpPid, thirdPid]).size).toBe(3);
    const third = v.matches.find((m) => m.isThirdPlace)!;
    expect(third.winnerPid).toBe(thirdPid);
    expect(v.tournament.championPid).toBe(championPid);

    // desfazer a semi agora é bloqueado (final e 3º já terminaram)
    const semi = v.matches.find((m) => m.feedsThirdPlace)!;
    as(ADMIN);
    expect(err(await adminUndoAction({ tournamentId: T, matchId: semi.id }))).toMatch(/Desfaça aquela primeiro/);
    // desfazer o 3º lugar reabre o campeonato
    ok(await adminUndoAction({ tournamentId: T, matchId: "terceiro" }));
    v = await viewAs(ADMIN);
    expect(v.tournament.status).toBe("em_andamento");
    expect(v.podium.thirdPid).toBeNull();
  });

  it("final sozinha não encerra: falta o 3º lugar", async () => {
    await setup(4);
    as(ADMIN);
    for (const id of ["r1-m0", "r1-m1", "r2-m0"]) {
      const v = await viewAs(ADMIN);
      const m = v.matches.find((x) => x.id === id)!;
      ok(await adminDecideAction({ tournamentId: T, matchId: id, winnerPid: m.slotA!.pid, kind: "admin" }));
    }
    const v = await viewAs(ADMIN);
    expect(v.tournament.status).toBe("em_andamento");
    expect(v.podium.championPid).toBeTruthy();
    expect(v.matches.find((m) => m.isThirdPlace)!.status).toBe("pendente");
  });
});

describe("concorrência e privacidade", () => {
  it("os dois votando ao mesmo tempo dá um resultado só", async () => {
    await setup(2);
    const v = await viewAs(ADMIN);
    const m = v.matches[0];
    const uidOf = (pid: string) => user(Number(v.participants.find((p) => p.id === pid)!.nickname.split(" ")[1]));
    const [ra, rb] = await Promise.all([
      (async () => {
        as(uidOf(m.slotA!.pid));
        return voteAction({ tournamentId: T, matchId: m.id, winnerPid: m.slotB!.pid });
      })(),
      (async () => {
        as(uidOf(m.slotB!.pid));
        return voteAction({ tournamentId: T, matchId: m.id, winnerPid: m.slotB!.pid });
      })(),
    ]);
    // pelo menos um dos dois foi aceito e o estado final é consistente
    expect(ra.ok || rb.ok).toBe(true);
    const after = await viewAs(ADMIN);
    expect(["pendente", "finalizada"]).toContain(after.matches[0].status);
  });

  it("dados enviados ao navegador não têm uid do Google nem e-mail", async () => {
    await setup(4);
    const json = JSON.stringify(await viewAs(user(0)));
    expect(json).not.toMatch(/google-sub/);
    expect(json).not.toMatch(/@nextfit/);
    // quem não é da partida não vê o detalhe dos votos
    const v = await viewAs(user(0));
    const notMine = v.matches.find(
      (m) => m.slotA && m.slotB && m.slotA.pid !== v.me.pid && m.slotB.pid !== v.me.pid,
    );
    if (notMine) expect(notMine.votes).toBeNull();
  });
});
