import Link from "next/link";
import { EightBall } from "@/components/Icon";

export default function NotFound() {
  return (
    <main className="login-wrap">
      <div className="card login-card">
        <EightBall size={64} />
        <h1>
          Bola <span className="hl">fora</span>
        </h1>
        <p className="muted">Essa página não existe (ou você não tem acesso a ela).</p>
        <Link href="/" className="btn btn-primary">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
