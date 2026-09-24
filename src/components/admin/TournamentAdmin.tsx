"use client";

import { useState } from "react";
import type { TournamentView } from "@/lib/dto";
import { isoToLocalInput } from "@/lib/time";
import {
  devAddFakePlayersAction,
  drawAction,
  setRoundDeadlineAction,
  updateTournamentAction,
} from "@/server/actions/admin";
import { DeadlinePicker } from "./DeadlinePicker";
import { MsgBox } from "./MsgBox";
import { useHydrated } from "../useHydrated";
import { useAction } from "./useAction";

function DrawPanel({ view }: { view: TournamentView }) {
  const { tournament: t, participants, matches } = view;
  const { pending, msg, exec } = useAction();
  const hasActivity = matches.some(
    (m) => (m.status === "finalizada" && m.decidedBy !== "bye") || m.votedPids.length > 0,
  );
  const canDraw = t.status !== "finalizado" && !hasActivity && participants.length >= 2;

  return (
    <section className="card">
      <h2>Sorteio da chave</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {t.drawnAt
          ? "A chave já foi sorteada. Dá para sortear de novo só enquanto nenhum jogo tiver voto ou resultado."
          : `${participants.length} inscritos. O sorteio é aleatório e fecha as inscrições automaticamente.`}
      </p>
      {hasActivity && (
        <div className="alert alert-warn" style={{ marginBottom: 12 }}>
          <span>Já existem votos/resultados, então não dá para sortear de novo.</span>
        </div>
      )}
      <button
        type="button"
        className="btn btn-purple"
        disabled={pending || !canDraw}
        onClick={() => {
          const txt = t.drawnAt
            ? "Sortear a chave DE NOVO? Os confrontos atuais serão substituídos."
            : `Sortear a chave com ${participants.length} inscritos? As inscrições serão fechadas.`;
          if (window.confirm(txt)) exec(() => drawAction({ tournamentId: t.id }));
        }}
      >
        {t.drawnAt ? "Sortear novamente" : "Sortear chave"}
      </button>
      <div style={{ marginTop: 12 }}>
        <MsgBox msg={msg} />
      </div>
    </section>
  );
}

function RoundDeadlines({ view }: { view: TournamentView }) {
  const { tournament: t } = view;
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(t.rounds.map((r) => [r.index, isoToLocalInput(r.deadline)])),
  );
  const { pending, msg, exec } = useAction();

  return (
    <section className="card">
      <h2>Prazos por rodada</h2>
      {t.rounds.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          As rodadas aparecem depois do sorteio.
        </p>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {t.rounds.map((r) => (
            <div key={r.index} className="field">
              <span>{r.name}</span>
              <div className="row">
                <div style={{ flex: 1, minWidth: 220 }}>
                  <DeadlinePicker
                    label={r.name}
                    value={values[r.index] ?? ""}
                    onChange={(val) => setValues((v) => ({ ...v, [r.index]: val }))}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={pending}
                  onClick={() =>
                    exec(() =>
                      setRoundDeadlineAction({ tournamentId: t.id, round: r.index, deadline: values[r.index] || null }),
                    )
                  }
                >
                  Salvar
                </button>
              </div>
            </div>
          ))}
          <p className="small faint" style={{ margin: 0 }}>
            Escolha só o dia: a hora já vem 23:59 (dá para mudar). Limpe o dia e salve para voltar a “a definir”. A
            disputa de 3º lugar usa o prazo da Final. Dá para ajustar um jogo específico direto no card da partida.
          </p>
          <MsgBox msg={msg} />
        </div>
      )}
    </section>
  );
}

function InfoForm({ view }: { view: TournamentView }) {
  const { tournament: t } = view;
  const [name, setName] = useState(t.name);
  const [reg, setReg] = useState(isoToLocalInput(t.registrationDeadline));
  const [start, setStart] = useState(isoToLocalInput(t.startDate));
  const [closed, setClosed] = useState(t.registrationClosed);
  const [notes, setNotes] = useState(t.notes.join("\n"));
  const [contact, setContact] = useState(t.contactName);
  const [discord, setDiscord] = useState(t.discordUrl);
  const [rules, setRules] = useState(t.rules.map((r) => (r.penalty ? `${r.situation} => ${r.penalty}` : r.situation)).join("\n"));
  const { pending, msg, exec } = useAction();
  const hydrated = useHydrated();

  return (
    <section className="card">
      <h2>Dados e regras</h2>
      <form
        className="stack"
        method="post"
        onSubmit={(e) => {
          e.preventDefault();
          exec(() =>
            updateTournamentAction({
              tournamentId: t.id,
              name,
              registrationDeadline: reg,
              startDate: start,
              registrationClosed: closed,
              notesText: notes,
              rulesText: rules,
              contactName: contact,
              discordUrl: discord,
            }),
          );
        }}
      >
        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </label>
        <div className="grid-2">
          <div className="field">
            <span>Fim das inscrições (padrão 23:59)</span>
            <DeadlinePicker label="Fim das inscrições" value={reg} onChange={setReg} />
          </div>
          <div className="field">
            <span>Início</span>
            <DeadlinePicker label="Início" value={start} onChange={setStart} defaultTime="09:00" />
          </div>
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Contato em caso de atraso (ADM)</span>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={60} required />
          </label>
          <label className="field">
            <span>Link do Discord (convite)</span>
            <input
              className="input"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              placeholder="https://discord.gg/..."
              inputMode="url"
            />
          </label>
        </div>
        {t.status === "inscricoes" && (
          <label className="checkbox">
            <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
            Fechar inscrições agora (antes do prazo)
          </label>
        )}
        <label className="field">
          <span>Como funciona (uma informação por linha)</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="field">
          <span>Regras (uma por linha, no formato: situação =&gt; penalidade)</span>
          <textarea className="textarea" value={rules} onChange={(e) => setRules(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending || !hydrated} style={{ alignSelf: "flex-start" }}>
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <MsgBox msg={msg} />
      </form>
    </section>
  );
}

function DevTools({ view }: { view: TournamentView }) {
  const { pending, msg, exec } = useAction();
  const [count, setCount] = useState(7);
  if (view.tournament.status !== "inscricoes") return null;
  return (
    <section className="card" style={{ borderStyle: "dashed" }}>
      <h2>Dev: inscritos falsos</h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        Só aparece com DATA_BACKEND=memory no <code>next dev</code>.
      </p>
      <div className="row">
        <input
          type="number"
          className="input"
          style={{ width: 100 }}
          min={1}
          max={40}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
        <button
          type="button"
          className="btn btn-sm"
          disabled={pending}
          onClick={() => exec(() => devAddFakePlayersAction({ tournamentId: view.tournament.id, count }))}
        >
          Adicionar
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <MsgBox msg={msg} />
      </div>
    </section>
  );
}

export function TournamentAdmin({ view, devTools }: { view: TournamentView; devTools: boolean }) {
  return (
    <div className="stack">
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack">
          <DrawPanel view={view} />
          <RoundDeadlines key={view.tournament.rounds.length} view={view} />
          {devTools && <DevTools view={view} />}
        </div>
        <InfoForm view={view} />
      </div>
    </div>
  );
}
