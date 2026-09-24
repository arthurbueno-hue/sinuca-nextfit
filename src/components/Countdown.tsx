"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Contagem regressiva. Renderiza no servidor com o `now` dele, e atualiza no cliente. */
export function Countdown({ target, serverNow }: { target: string; serverNow: string }) {
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return <span className="hl">É agora!</span>;
  const { d, h, m, s } = parts(diff);
  return (
    <span className="hl" suppressHydrationWarning>
      {d > 0 ? `${d}d ` : ""}
      {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m {d === 0 ? `${String(s).padStart(2, "0")}s` : ""}
    </span>
  );
}
