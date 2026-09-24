"use client";

import { useMemo, useState } from "react";
import type { MatchDTO, TournamentView } from "@/lib/dto";
import { STATUS_LABEL, deadlineStateOf, isLocked } from "@/lib/labels";
import { formatShort } from "@/lib/time";
import type { Slot } from "@/lib/tournament/types";
import { EightBall, Icon } from "./Icon";
import { MatchModal } from "./MatchModal";
import { Podium } from "./Podium";

function PlayerRow({ m, slot, me }: { m: MatchDTO; slot: Slot | null; me: string | null }) {
  if (!slot) {
    return (
      <div className="mrow empty">
        <span className="nm">
          {m.round === 1 && !m.isThirdPlace ? "BYE" : m.isThirdPlace ? "Perdedor da semi" : "A definir"}
        </span>
      </div>
    );
  }
  const won = m.status === "finalizada" && m.winnerPid === slot.pid;
  const lost = m.status === "finalizada" && m.winnerPid !== slot.pid;
  const score = m.score ? (m.slotA?.pid === slot.pid ? m.score.a : m.score.b) : null;
  return (
    <div className={`mrow${won ? " win" : ""}${lost ? " lose" : ""}${slot.pid === me ? " me" : ""}`}>
      <span className="nm" title={slot.nickname}>
        {slot.nickname}
      </span>
      <span className="sc">{score ?? (won ? <Icon name="check" size={14} /> : "")}</span>
    </div>
  );
}

function MatchCard({ m, me, now, onOpen }: { m: MatchDTO; me: string | null; now: number; onOpen: () => void }) {
  const ds = deadlineStateOf(m, now);
  const late = ds === "atrasado";
  const mine = !!me && (m.slotA?.pid === me || m.slotB?.pid === me);
  const label = late
    ? "Atrasado · só ADM"
    : m.status === "pendente" && m.votedPids.length === 1
      ? "1 de 2 votos"
      : STATUS_LABEL[m.status];
  return (
    <button
      type="button"
      className={`mcard st-${m.status}${late ? " late" : ""}${mine ? " mine" : ""}${m.isThirdPlace ? " third" : ""}`}
      onClick={onOpen}
      aria-label={`Partida ${m.slotA?.nickname ?? "a definir"} contra ${m.slotB?.nickname ?? "a definir"}: ${
        late ? "atrasada" : STATUS_LABEL[m.status]
      }`}
    >
      {m.isThirdPlace && <div className="mtag">🥉 Disputa de 3º lugar</div>}
      <PlayerRow m={m} slot={m.slotA} me={me} />
      <PlayerRow m={m} slot={m.slotB} me={me} />
      <div className="mfoot">
        <span>
          <span className={`dot st-${m.status}${late ? " late" : ""}`} />
          {label}
        </span>
        {m.deadline && m.status !== "finalizada" && (
          <span className={late ? "late-text" : ds === "proximo" ? "soon-text" : ""}>até {formatShort(m.deadline)}</span>
        )}
      </div>
    </button>
  );
}

export function Bracket({ view }: { view: TournamentView }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [forceTree, setForceTree] = useState(false);
  const now = new Date(view.now).getTime();
  const { tournament: t, matches, me, podium } = view;

  const mainMatches = useMemo(() => matches.filter((m) => !m.isThirdPlace), [matches]);
  const thirdPlace = matches.find((m) => m.isThirdPlace) ?? null;
  const byRound = useMemo(() => {
    const map = new Map<number, MatchDTO[]>();
    for (const m of mainMatches) map.set(m.round, [...(map.get(m.round) ?? []), m]);
    map.forEach((list) => list.sort((a, b) => a.position - b.position));
    return map;
  }, [mainMatches]);

  const myMatch = me.pid
    ? matches.find(
        (m) => (m.slotA?.pid === me.pid || m.slotB?.pid === me.pid) && (m.status === "pendente" || m.status === "em_disputa"),
      )
    : null;

  // Rodada que aparece primeiro no celular: a do meu jogo, senão a rodada em andamento.
  const activeRound =
    myMatch?.round ??
    t.rounds.find((r) => matches.some((m) => m.round === r.index && (m.status === "pendente" || m.status === "em_disputa")))
      ?.index ??
    t.rounds.at(-1)?.index ??
    1;
  const [selectedRound, setSelectedRound] = useState<number>(activeRound);

  const open = openId ? (matches.find((m) => m.id === openId) ?? null) : null;
  const finalRound = t.rounds.length;
  const hasPodium = !!(podium.championPid || podium.thirdPid);

  if (matches.length === 0) {
    return (
      <div className="card empty-state">
        <EightBall size={56} className="ball" />
        <h2>A chave ainda não foi sorteada</h2>
        <p className="muted">
          Assim que as inscrições fecharem, a organização sorteia os confrontos. Ninguém escolhe adversário.
        </p>
      </div>
    );
  }

  const opponent = myMatch ? (myMatch.slotA?.pid === me.pid ? myMatch.slotB : myMatch.slotA) : null;
  const myVoted = myMatch && me.pid ? myMatch.votedPids.includes(me.pid) : false;
  const opponentVoted = myMatch && opponent ? myMatch.votedPids.includes(opponent.pid) : false;
  const myLocked = myMatch ? isLocked(myMatch, now) : false;

  const listMatches =
    selectedRound === finalRound
      ? [...(byRound.get(finalRound) ?? []), ...(thirdPlace ? [thirdPlace] : [])]
      : (byRound.get(selectedRound) ?? []);
  const selectedMeta = t.rounds.find((r) => r.index === selectedRound);

  return (
    <div className={`stack bracket-board${forceTree ? " force-tree" : ""}`}>
      {myMatch && (
        <div className={`my-match${myLocked ? " locked" : ""}`}>
          <div>
            <div className="section-title">{myMatch.isThirdPlace ? "Sua disputa de 3º lugar" : "Seu próximo jogo"}</div>
            <div className="vs-line">
              Você<em>VS</em>
              {opponent?.nickname}
            </div>
            <div className="small muted">
              {myLocked
                ? `Prazo encerrado: resultado travado. Fale com o ADM: ${t.contactName}.`
                : myMatch.status === "em_disputa"
                  ? "Os votos não bateram: corrija o resultado!"
                  : myVoted
                    ? "Você já votou. Aguardando o adversário confirmar."
                    : opponentVoted
                      ? `${opponent?.nickname} já informou o resultado. Confirme você também!`
                      : myMatch.deadline
                        ? `Jogue até ${formatShort(myMatch.deadline)} e informe o resultado.`
                        : "Combine o horário com seu adversário."}
            </div>
          </div>
          <button
            type="button"
            className={`btn ${myLocked ? "btn-ghost" : "btn-primary"}`}
            onClick={() => setOpenId(myMatch.id)}
          >
            {myLocked ? "Ver partida" : myMatch.status === "em_disputa" ? "Resolver disputa" : "Informar resultado"}
          </button>
        </div>
      )}

      {hasPodium && (
        <section className="card">
          <h2>{podium.complete ? "Pódio final" : "Pódio"}</h2>
          <Podium view={view} />
        </section>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="legend" aria-label="Legenda">
          <span>
            <span className="dot st-pendente" />
            Pendente
          </span>
          <span>
            <span className="dot st-em_disputa" />
            Em disputa
          </span>
          <span>
            <span className="dot late" />
            Atrasado
          </span>
          <span>
            <span className="dot st-finalizada" />
            Finalizada
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm mobile-only" onClick={() => setForceTree((v) => !v)}>
          <Icon name="bracket" size={15} /> {forceTree ? "Ver por rodada" : "Ver árvore completa"}
        </button>
      </div>

      {/* Celular: uma rodada por vez */}
      <div className="bracket-list">
        <div className="round-chips" role="tablist" aria-label="Rodadas">
          {t.rounds.map((r) => (
            <button
              key={r.index}
              type="button"
              role="tab"
              aria-selected={selectedRound === r.index}
              className="round-chip"
              onClick={() => setSelectedRound(r.index)}
            >
              {r.name}
              {r.index === finalRound && thirdPlace ? " + 3º" : ""}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: "4px 2px 10px" }}>
          {selectedMeta?.deadline ? `Prazo da rodada: até ${formatShort(selectedMeta.deadline)}` : "Prazo da rodada: a definir"}
        </p>
        <div className="list-matches">
          {listMatches.map((m) => (
            <MatchCard key={m.id} m={m} me={me.pid} now={now} onOpen={() => setOpenId(m.id)} />
          ))}
        </div>
      </div>

      {/* Computador (ou "ver árvore"): chave completa */}
      <div className="bracket-tree">
        <div className="card" style={{ padding: "18px 12px" }}>
          <div className="bracket-scroll">
            <div className="bracket">
              {t.rounds.map((r) => {
                const list = byRound.get(r.index) ?? [];
                return (
                  <div key={r.index} className={`b-round${r.index === finalRound ? " is-final" : ""}`}>
                    <div className="b-round-head">
                      <strong>{r.name}</strong>
                      <span>{r.deadline ? `até ${formatShort(r.deadline)}` : "prazo a definir"}</span>
                    </div>
                    <div className="b-round-body">
                      {list.map((m) => (
                        <div key={m.id} className="b-slot">
                          <MatchCard m={m} me={me.pid} now={now} onOpen={() => setOpenId(m.id)} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="b-round b-champion is-final">
                <div className="b-round-head">
                  <strong>Campeão</strong>
                  <span>&nbsp;</span>
                </div>
                <div className="b-round-body">
                  <div className="b-slot">
                    <div className={`champion-card mcard${podium.championPid ? "" : " empty"}`}>
                      <Icon name="trophy" size={34} className="trophy" />
                      <strong>
                        {podium.championPid
                          ? (view.participants.find((p) => p.id === podium.championPid)?.nickname ?? "?")
                          : "?"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {thirdPlace && (
            <div className="third-row">
              <div className="section-title">🥉 Disputa de 3º lugar · perdedores das semifinais</div>
              <div style={{ maxWidth: 260 }}>
                <MatchCard m={thirdPlace} me={me.pid} now={now} onOpen={() => setOpenId(thirdPlace.id)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {open && <MatchModal key={open.id} match={open} view={view} onClose={() => setOpenId(null)} />}
    </div>
  );
}
