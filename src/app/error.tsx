"use client";

import { EightBall } from "@/components/Icon";

/** Erro inesperado no servidor: mensagem amigável, sem detalhes técnicos. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="login-wrap">
      <div className="card login-card">
        <EightBall size={64} />
        <h1>
          Deu <span className="hl">ruim</span>
        </h1>
        <p className="muted">Algo falhou ao carregar. Pode ser a internet ou o servidor. Tenta de novo em instantes.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Tentar de novo
          </button>
          <a href="/" className="btn btn-ghost">
            Início
          </a>
        </div>
      </div>
    </main>
  );
}
