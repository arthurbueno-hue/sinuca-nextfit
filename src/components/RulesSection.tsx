import type { TournamentView } from "@/lib/dto";
import { formatDate, formatDateTime } from "@/lib/time";
import { Icon } from "./Icon";

export function RulesSection({ view }: { view: TournamentView }) {
  const { tournament: t } = view;
  return (
    <div className="stack">
      <section className="card">
        <h2>Datas</h2>
        <div className="date-cards">
          <div className="date-card">
            <span>Inscrições até</span>
            <strong>{formatDateTime(t.registrationDeadline)}</strong>
          </div>
          <div className="date-card">
            <span>Início</span>
            <strong>{formatDate(t.startDate)}</strong>
          </div>
          <div className="date-card">
            <span>Formato</span>
            <strong>Mata-mata simples</strong>
          </div>
        </div>
        <h3 style={{ marginTop: 20 }}>Prazos das rodadas</h3>
        {t.rounds.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            As rodadas saem depois do sorteio. Os prazos de cada rodada ainda serão definidos.
          </p>
        ) : (
          <ul className="rule-list">
            {t.rounds.map((r) => (
              <li key={r.index}>
                <span>{r.name}</span>
                <span className="penalty">{r.deadline ? `até ${formatDateTime(r.deadline)}` : "a definir"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {t.notes.length > 0 && (
        <section className="card">
          <h2>Como funciona</h2>
          <ul className="notes">
            {t.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>
          <Icon name="book" /> Regras e penalidades
        </h2>
        <ul className="rule-list">
          {t.rules.map((r, i) => (
            <li key={i}>
              <span>{r.situation}</span>
              {r.penalty && <span className="penalty">{r.penalty}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
