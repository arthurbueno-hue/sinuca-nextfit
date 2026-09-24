import type { TournamentView } from "@/lib/dto";
import { formatDate, formatDateTime } from "@/lib/time";
import { Countdown } from "./Countdown";
import { EightBall, Icon } from "./Icon";

/** Parte o nome para destacar o final em amarelo, no estilo das campanhas Next Fit. */
function splitTitle(name: string): [string, string] {
  const i = name.toLowerCase().lastIndexOf("sinuca");
  if (i > 0) return [name.slice(0, i), name.slice(i)];
  const words = name.split(" ");
  return [words.slice(0, -1).join(" ") + " ", words.at(-1) ?? ""];
}

export function Hero({ view }: { view: TournamentView }) {
  const { tournament: t, participants, now, matches } = view;
  const [first, highlight] = splitTitle(t.name);
  const nameOf = (pid: string | null) => (pid ? participants.find((p) => p.id === pid)?.nickname : null);
  const champion = view.podium.championPid ? { nickname: nameOf(view.podium.championPid) } : null;
  const beforeStart = new Date(now) < new Date(t.startDate);
  const currentRound = t.rounds.find((r) =>
    matches.some((m) => m.round === r.index && (m.status === "pendente" || m.status === "em_disputa")),
  );
  const myOpen = view.me.pid
    ? matches.find(
        (m) =>
          (m.slotA?.pid === view.me.pid || m.slotB?.pid === view.me.pid) &&
          (m.status === "pendente" || m.status === "em_disputa"),
      )
    : null;

  return (
    <>
      <section className="hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-kicker">
            <EightBall size={22} /> Campeonato interno Next Fit
          </div>
          <h1>
            {first}
            <span className="hl">{highlight}</span>
          </h1>
          <ul className="hero-bullets">
            <li>Inscrições até {formatDateTime(t.registrationDeadline)}</li>
            <li>Início {formatDate(t.startDate)}</li>
            <li>Mata-mata + disputa de 3º</li>
          </ul>
        </div>
        <div className="hero-side">
          {champion ? (
            <>
              <div className="countdown-label">Campeão</div>
              <div className="champion-banner">
                <Icon name="trophy" size={34} /> {champion.nickname}
              </div>
              {(view.podium.runnerUpPid || view.podium.thirdPid) && (
                <div className="podium-line">
                  {view.podium.runnerUpPid && <span>🥈 {nameOf(view.podium.runnerUpPid)}</span>}
                  {view.podium.thirdPid && <span>🥉 {nameOf(view.podium.thirdPid)}</span>}
                </div>
              )}
            </>
          ) : t.status === "inscricoes" && view.registration.open ? (
            <>
              <div className="countdown-label">Inscrições encerram em</div>
              <div className="countdown">
                <Countdown target={t.registrationDeadline} serverNow={now} />
              </div>
            </>
          ) : beforeStart ? (
            <>
              <div className="countdown-label">Começa em</div>
              <div className="countdown">
                <Countdown target={t.startDate} serverNow={now} />
              </div>
            </>
          ) : (
            <>
              <div className="countdown-label">Rolando agora</div>
              <div className="countdown">
                <span className="hl">{currentRound?.name ?? (t.status === "inscricoes" ? "Sorteio em breve" : "Em andamento")}</span>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="pills">
        <div className="pill">
          <span className="pill-icon">
            <Icon name="users" size={18} />
          </span>
          {participants.length} <span className="light">inscritos</span>
        </div>
        <div className="pill">
          <span className="pill-icon">
            <Icon name="user" size={18} />
          </span>
          {view.me.nickname ? (
            <>
              <span className="light">Você:</span> {view.me.nickname}
            </>
          ) : (
            <span className="light">Você não está inscrito</span>
          )}
        </div>
        {myOpen && (
          <div className="pill">
            <span className="pill-icon">
              <Icon name="clock" size={18} />
            </span>
            <span className="light">Seu jogo:</span>{" "}
            {myOpen.deadline ? `até ${formatDateTime(myOpen.deadline)}` : "prazo a definir"}
          </div>
        )}
      </div>
    </>
  );
}
