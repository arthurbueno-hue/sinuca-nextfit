"use client";

import { useState, useTransition } from "react";
import type { ActionResult, TournamentView } from "@/lib/dto";
import { formatDateTime, formatShort } from "@/lib/time";
import {
  registerAction,
  removeParticipantAction,
  unregisterAction,
  updateNicknameAction,
} from "@/server/actions/registration";
import { Icon } from "./Icon";
import { useHydrated } from "./useHydrated";

type Msg = { kind: "ok" | "error"; text: string } | null;

export function Registration({ view }: { view: TournamentView }) {
  const { tournament: t, me, participants, isAdmin, registration } = view;
  const beforeDraw = t.status === "inscricoes" && !t.drawnAt;
  const [nickname, setNickname] = useState(me.nickname ?? view.suggestedNickname ?? "");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();

  function exec(fn: () => Promise<ActionResult>, after?: () => void) {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await fn();
        setMsg(r.ok ? { kind: "ok", text: r.message } : { kind: "error", text: r.error });
        if (r.ok) after?.();
      } catch {
        setMsg({ kind: "error", text: "Falha de conexão. Tenta de novo." });
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (me.pid) exec(() => updateNicknameAction({ tournamentId: t.id, nickname }), () => setEditing(false));
    else exec(() => registerAction({ tournamentId: t.id, nickname }));
  }

  const showForm = (!me.pid && registration.open) || (me.pid && editing && beforeDraw);

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <section className="card">
        <h2>Inscrição</h2>

        {me.pid && !editing && (
          <div className="stack">
            <div className="alert alert-ok">
              <Icon name="check" />
              <span>
                Você está inscrito como <strong>{me.nickname}</strong>. É esse apelido que aparece na chave.
              </span>
            </div>
            {beforeDraw && (
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={() => setEditing(true)} disabled={pending}>
                  <Icon name="edit" size={15} /> Mudar apelido
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Cancelar sua inscrição no campeonato?")) {
                      exec(() => unregisterAction({ tournamentId: t.id }), () => setNickname(""));
                    }
                  }}
                >
                  Cancelar inscrição
                </button>
              </div>
            )}
          </div>
        )}

        {showForm && (
          <form className="stack" method="post" onSubmit={onSubmit}>
            <label className="field">
              <span>Nome do competidor (apelido)</span>
              <input
                className="input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                minLength={3}
                required
                autoComplete="nickname"
                placeholder="Ex.: Rui Chapéu"
              />
            </label>
            <div className="row">
              <button type="submit" className="btn btn-primary" disabled={pending || !hydrated}>
                {pending ? "Salvando..." : me.pid ? "Salvar apelido" : "Adicionar"}
              </button>
              {me.pid && (
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              )}
            </div>
            <p className="small faint" style={{ margin: 0 }}>
              <Icon name="shield" size={14} /> Seu e-mail fica só com a organização. Na chave, os outros veem só o
              apelido.
            </p>
          </form>
        )}

        {!me.pid && !registration.open && (
          <div className="alert alert-warn">
            <Icon name="alert" />
            <span>{registration.reason}</span>
          </div>
        )}

        {msg && (
          <div className={`alert ${msg.kind === "ok" ? "alert-ok" : "alert-error"}`} role="status" style={{ marginTop: 14 }}>
            <Icon name={msg.kind === "ok" ? "check" : "alert"} />
            <span>{msg.text}</span>
          </div>
        )}

        <p className="small muted" style={{ marginBottom: 0, marginTop: 16 }}>
          Inscrições até <strong>{formatDateTime(t.registrationDeadline)}</strong>. Depois disso a chave é sorteada.
        </p>
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Inscritos</h2>
          <span className="badge">{participants.length} jogadores</span>
        </div>
        {participants.length === 0 ? (
          <p className="muted">Ninguém inscrito ainda. Seja o primeiro!</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Apelido</th>
                  <th>Inscrito em</th>
                  {isAdmin && beforeDraw && <th aria-label="Ações" />}
                </tr>
              </thead>
              <tbody>
                {participants.map((p, i) => (
                  <tr key={p.id} className={p.id === me.pid ? "me" : ""}>
                    <td className="num">{i + 1}</td>
                    <td className="nick">
                      {p.nickname} {p.id === me.pid && <span className="badge badge-you">você</span>}
                    </td>
                    <td className="muted small nowrap">{formatShort(p.joinedAt)}</td>
                    {isAdmin && beforeDraw && (
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`Remover ${p.nickname} do campeonato?`)) {
                              exec(() => removeParticipantAction({ tournamentId: t.id, participantId: p.id }));
                            }
                          }}
                        >
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
