import Link from "next/link";
import { signOutAction } from "@/server/actions/auth";
import { EightBall, Icon } from "./Icon";

export function SiteHeader({ isAdmin, homeHref = "/" }: { isAdmin: boolean; homeHref?: string }) {
  return (
    <header className="site-header">
      <div className="container">
        <Link href={homeHref} className="brand" aria-label="Início">
          <EightBall size={32} />
          <span>
            Sinuca <b>Next</b>
          </span>
        </Link>
        <nav className="header-actions">
          {isAdmin && (
            <Link href="/admin" className="btn btn-ghost btn-sm">
              <Icon name="shield" size={16} /> ADM
            </Link>
          )}
          <form action={signOutAction}>
            <button type="submit" className="btn btn-ghost btn-sm">
              <Icon name="logout" size={16} /> Sair
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      Campeonato interno de sinuca · acesso restrito a contas @nextfit.com.br
    </footer>
  );
}
