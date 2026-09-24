import type { TournamentView } from "@/lib/dto";

/** Pódio: 1º, 2º e 3º. Mostra "?" enquanto não definido. */
export function Podium({ view, compact = false }: { view: TournamentView; compact?: boolean }) {
  const { podium, participants } = view;
  const name = (pid: string | null) => (pid ? (participants.find((p) => p.id === pid)?.nickname ?? "?") : "?");
  const places = [
    { cls: "p2", medal: "🥈", label: "2º lugar", pid: podium.runnerUpPid },
    { cls: "p1", medal: "🏆", label: "Campeão", pid: podium.championPid },
    { cls: "p3", medal: "🥉", label: "3º lugar", pid: podium.thirdPid },
  ];
  return (
    <div className={`podium${compact ? " compact" : ""}`} aria-label="Pódio">
      {places.map((p) => (
        <div key={p.cls} className={`podium-step ${p.cls}${p.pid ? "" : " empty"}`}>
          <span className="podium-medal" aria-hidden="true">
            {p.medal}
          </span>
          <strong className="podium-name">{name(p.pid)}</strong>
          <span className="podium-label">{p.label}</span>
          <span className="podium-base" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
