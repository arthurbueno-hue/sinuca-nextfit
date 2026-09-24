"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ActionResult, MatchDTO, TournamentView } from "@/lib/dto";
import { DECIDED_LABEL, STATUS_LABEL, deadlineStateOf, isLocked, matchTitle, statusBadgeClass } from "@/lib/labels";
import { formatDateTime, isoToLocalInput } from "@/lib/time";
import { adminDecideAction, adminUndoAction, setMatchDeadlineAction, voteAction } from "@/server/actions/match";
import { DeadlinePicker } from "./admin/DeadlinePicker";
import { Icon } from "./Icon";

type Msg = { kind: "ok" | "error"; text: string } | null;

function toScore(v: string): number | null {
  const s = v.trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function ScoreInputs({
  m,
  a,
  b,
  setA,
  setB,
  idPrefix,
}: {
  m: MatchDTO;
  a: string;
  b: string;
  setA: (v: string) => void;
  setB: (v: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="score-row">
      <label htmlFor={`${idPrefix}-a`}>
        <span className="score-name">{m.slotA?.nickname}</span>
        <input
          id={`${idPrefix}-a`}
          className="input input-score"
          inputMode="numeric"
          pattern="[0-9]*"
          type="number"
          min={0}
          max={99}
          value={a}
          onChange={(e) => setA(e.target.value)}
          placeholder="–"
        />
      </label>
      <strong className="muted">x</strong>
      <label htmlFor={`${idPrefix}-b`}>
        <span className="score-name">{m.slotB?.nickname}</span>
        <input
          id={`${idPrefix}-b`}
          className="input input-score"
          inputMode="numeric"
          pattern="[0-9]*"
          type="number"
          min={0}
          max={99}
          value={b}
          onChange={(e) => setB(e.target.value)}
          placeholder="–"
        />
      </label>
    </div>
  );
}

export function MatchModal({ match: m, view, onClose }: { match: MatchDTO; view: TournamentView; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  const { tournament: t, me, isAdmin } = view;
  const now = new Date(view.now).getTime();
  const isPlayer = !!me.pid && (m.slotA?.pid === me.pid || m.slotB?.pid === me.pid);
  const open = (m.status === "pendente" || m.status === "em_disputa") && t.status === "em_andamento";
  const locked = open && isLocked(m, now);
  const myVote = m.votes?.find((v) => v.pid === me.pid) ?? null;
  const ds = deadlineStateOf(m, now);
  const nameOf = (pid: string | null) =>
    pid === m.slotA?.pid ? m.slotA?.nickname : pid === m.slotB?.pid ? m.slotB?.nickname : "?";
  const loserName = m.winnerPid ? nameOf(m.winnerPid === m.slotA?.pid ? (m.slotB?.pid ?? null) : (m.slotA?.pid ?? null)) : "";

  const [winner, setWinner] = useState<string | null>(myVote?.winnerPid ?? null);
  const [scoreA, setScoreA] = useState(myVote?.scoreA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(myVote?.scoreB?.toString() ?? "");

  const [admWinner, setAdmWinner] = useState<string | null>(null);
  const [admKind, setAdmKind] = useState<"admin" | "wo">("admin");
  const [admA, setAdmA] = useState("");
  const [admB, setAdmB] = useState("");
  const [deadline, setDeadline] = useState(isoToLocalInput(m.deadlineOverride ?? m.deadline));

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    const handle = () => onClose();
    d?.addEventListener("close", handle);
    return () => d?.removeEventListener("close", handle);
  }, [onClose]);

  function exec(fn: () => Promise<ActionResult>) {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await fn();
        setMsg(r.ok ? { kind: "ok", text: r.message } : { kind: "error", text: r.error });
      } catch {
        setMsg({ kind: "error", text: "Sem conexão ou o servidor não respondeu. Confere a internet e tenta de novo." });
      }
    });
  }

  function submitVote() {
    if (!winner) return setMsg({ kind: "error", text: "Toca em quem venceu antes de confirmar." });
    exec(() =>
      voteAction({ tournamentId: t.id, matchId: m.id, winnerPid: winner, scoreA: toScore(scoreA), scoreB: toScore(scoreB) }),
    );
  }

  function submitAdmin() {
    if (!admWinner) return setMsg({ kind: "error", text: "Escolhe o vencedor." });
    const what = admKind === "wo" ? "W.O." : "resultado";
    if (!window.confirm(`Confirmar ${what}: ${nameOf(admWinner)} vence?`)) return;
    exec(() =>
      adminDecideAction({
        tournamentId: t.id,
        matchId: m.id,
        winnerPid: admWinner,
        kind: admKind,
        scoreA: admKind === "wo" ? null : toScore(admA),
        scoreB: admKind === "wo" ? null : toScore(admB),
      }),
    );
  }

  function undo() {
    if (!window.confirm("Desfazer o resultado dessa partida? O vencedor sai da próxima fase.")) return;
    exec(() => adminUndoAction({ tournamentId: t.id, matchId: m.id }));
  }

  const winnerSlotA = m.status === "finalizada" && m.winnerPid === m.slotA?.pid;
  const winnerSlotB = m.status === "finalizada" && m.winnerPid === m.slotB?.pid;
  const emptyName = m.isThirdPlace ? "Perdedor da semi" : m.round === 1 ? "BYE" : "A definir";

  let finishedText = "";
  if (m.status === "finalizada" && m.decidedBy) {
    const w = nameOf(m.winnerPid);
    finishedText = m.isThirdPlace
      ? `${w} fica com o 3º lugar! 🥉`
      : !m.nextMatchId
        ? `${w} é o CAMPEÃO! 🏆`
        : m.feedsThirdPlace
          ? `${w} vai pra final e ${loserName} disputa o 3º lugar.`
          : `${w} avança para a próxima fase.`;
  }

  return (
    <dialog ref={dialogRef} className="modal" aria-labelledby="match-title">
      <div className="modal-head">
        <div className="row" style={{ gap: 8 }}>
          <strong id="match-title">{matchTitle(m, t.rounds)}</strong>
          <span className={statusBadgeClass(m.status, locked)}>{locked ? "Atrasado" : STATUS_LABEL[m.status]}</span>
        </div>
        <button type="button" className="icon-btn" onClick={() => dialogRef.current?.close()} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>

      <div className="modal-body">
        <div className="versus">
          <div className={`player${winnerSlotA ? " win" : ""}`}>
            {winnerSlotA && <small>VENCEDOR</small>}
            {m.slotA?.nickname ?? emptyName}
          </div>
          <div>
            <div className="vs">VS</div>
            {m.score && (
              <span className="final-score">
                {m.score.a} x {m.score.b}
              </span>
            )}
          </div>
          <div className={`player${winnerSlotB ? " win" : ""}`}>
            {winnerSlotB && <small>VENCEDOR</small>}
            {m.slotB?.nickname ?? emptyName}
          </div>
        </div>

        {finishedText && m.decidedBy && (
          <div className="alert alert-ok">
            <Icon name="check" />
            <span>
              {DECIDED_LABEL[m.decidedBy]} · {finishedText}
            </span>
          </div>
        )}

        {locked && (
          <div className="alert alert-error" role="alert">
            <Icon name="alert" />
            <span>
              <strong style={{ display: "block" }}>Jogo em atraso!</strong>O prazo acabou e o resultado ficou travado.
              Para ajustar a chave, entre em contato com o ADM: <strong>{t.contactName}</strong>.
              {isAdmin && <span className="small"> (Você é ADM: decida na área da organização abaixo.)</span>}
            </span>
          </div>
        )}

        {!locked && m.status === "em_disputa" && (
          <div className="alert alert-dispute" role="alert">
            <span>
              <strong>Cara, tá errado isso aí, corrige! 😅</strong>
              Vocês votaram em resultados diferentes. Conversem, e quem errou muda o voto aqui embaixo. Se não chegarem
              num acordo, chamem a organização ({t.contactName}).
            </span>
          </div>
        )}

        {m.status === "aguardando" && (
          <div className="alert">
            <Icon name="clock" />
            <span>
              {m.isThirdPlace
                ? "A disputa de 3º lugar espera os perdedores das semifinais."
                : "Essa partida espera o vencedor da fase anterior."}
            </span>
          </div>
        )}

        {m.status !== "finalizada" && (
          <div>
            <div className="section-title">Data limite</div>
            <div className={`deadline-box${ds === "atrasado" ? " late" : ds === "proximo" ? " soon" : ""}`}>
              {m.deadline ? (
                <>
                  Jogar até {formatDateTime(m.deadline)}
                  {ds === "proximo" && <div className="small">Menos de 24h! Bora jogar e informar o resultado.</div>}
                </>
              ) : (
                "Prazo ainda não definido pela organização."
              )}
            </div>
          </div>
        )}

        {m.votes && m.status !== "finalizada" && m.slotA && m.slotB && (
          <div>
            <div className="section-title">Votos</div>
            <ul className="votes-list">
              {[m.slotA, m.slotB].map((s) => {
                const v = m.votes!.find((x) => x.pid === s.pid);
                return (
                  <li key={s.pid}>
                    <span>{s.pid === me.pid ? "Você" : s.nickname}</span>
                    <span className={v ? "" : "faint"}>
                      {v
                        ? `votou em ${nameOf(v.winnerPid)}${v.scoreA !== null ? ` (${v.scoreA} x ${v.scoreB})` : ""}`
                        : "ainda não votou"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!m.votes && m.status === "pendente" && m.votedPids.length > 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            {m.votedPids.length} de 2 jogadores já informaram o resultado.
          </p>
        )}

        {isPlayer && open && !locked && m.slotA && m.slotB && (
          <div className="stack vote-box" style={{ gap: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              {myVote ? "Mudar seu voto" : "Quem venceu?"}
            </div>
            <div className="pick" role="group" aria-label="Vencedor">
              {[m.slotA, m.slotB].map((s) => (
                <button
                  key={s.pid}
                  type="button"
                  className="pick-btn"
                  aria-pressed={winner === s.pid}
                  onClick={() => setWinner(s.pid)}
                >
                  {s.pid === me.pid ? `${s.nickname} (eu)` : s.nickname}
                </button>
              ))}
            </div>
            <div>
              <div className="small muted" style={{ textAlign: "center", marginBottom: 6 }}>
                Placar (opcional, ex.: 3 x 1 numa melhor de 5)
              </div>
              <ScoreInputs m={m} a={scoreA} b={scoreB} setA={setScoreA} setB={setScoreB} idPrefix="vote" />
            </div>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={submitVote} disabled={pending}>
              {pending ? "Enviando..." : "Confirmar resultado"}
            </button>
            <p className="small faint" style={{ margin: 0, textAlign: "center" }}>
              O resultado só vale quando os dois jogadores confirmam o mesmo vencedor.
            </p>
          </div>
        )}

        {!isPlayer && !isAdmin && open && !locked && (
          <p className="small muted" style={{ margin: 0 }}>
            Só os dois jogadores dessa partida (ou a organização) podem informar o resultado.
          </p>
        )}

        {msg && (
          <div className={`alert ${msg.kind === "ok" ? "alert-ok" : "alert-error"}`} role="status">
            <Icon name={msg.kind === "ok" ? "check" : "alert"} />
            <span>{msg.text}</span>
          </div>
        )}

        {isAdmin && t.status !== "inscricoes" && m.decidedBy !== "bye" && (
          <details className="admin-zone" open={m.status === "em_disputa" || locked}>
            <summary>Área da organização</summary>
            <div className="stack" style={{ gap: 14 }}>
              {open && m.slotA && m.slotB && (
                <>
                  <div className="segmented" role="group" aria-label="Tipo de decisão">
                    <button type="button" aria-pressed={admKind === "admin"} onClick={() => setAdmKind("admin")}>
                      Definir resultado
                    </button>
                    <button type="button" aria-pressed={admKind === "wo"} onClick={() => setAdmKind("wo")}>
                      W.O.
                    </button>
                  </div>
                  <div className="pick" role="group" aria-label="Vencedor (organização)">
                    {[m.slotA, m.slotB].map((s) => (
                      <button
                        key={s.pid}
                        type="button"
                        className="pick-btn"
                        aria-pressed={admWinner === s.pid}
                        onClick={() => setAdmWinner(s.pid)}
                      >
                        {s.nickname}
                      </button>
                    ))}
                  </div>
                  {admKind === "admin" && (
                    <ScoreInputs m={m} a={admA} b={admB} setA={setAdmA} setB={setAdmB} idPrefix="adm" />
                  )}
                  <button type="button" className="btn btn-purple btn-block" onClick={submitAdmin} disabled={pending}>
                    {admKind === "wo" ? "Aplicar W.O." : "Decidir resultado"}
                  </button>
                </>
              )}

              {m.status === "finalizada" && (
                <button type="button" className="btn btn-danger btn-block" onClick={undo} disabled={pending}>
                  Desfazer resultado
                </button>
              )}

              {m.status !== "finalizada" && (
                <div className="field">
                  <span>Prazo deste jogo (horário de Brasília, padrão 23:59)</span>
                  <DeadlinePicker value={deadline} onChange={setDeadline} label="Prazo do jogo" />
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={pending || !deadline}
                      onClick={() => exec(() => setMatchDeadlineAction({ tournamentId: t.id, matchId: m.id, deadline }))}
                    >
                      Salvar prazo
                    </button>
                    {m.deadlineOverride && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={pending}
                        onClick={() =>
                          exec(() => setMatchDeadlineAction({ tournamentId: t.id, matchId: m.id, deadline: null }))
                        }
                      >
                        Usar prazo da rodada
                      </button>
                    )}
                  </div>
                  {locked && (
                    <span className="small faint">Dica: dar um prazo novo destrava a votação dos jogadores.</span>
                  )}
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </dialog>
  );
}
