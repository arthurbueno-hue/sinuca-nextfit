import Link from "next/link";
import { notFound } from "next/navigation";
import { TournamentAdmin } from "@/components/admin/TournamentAdmin";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { formatShort } from "@/lib/time";
import { devToolsEnabled } from "@/server/config";
import { getAuditLog, getTournamentView } from "@/server/queries";
import { requireAdminPage } from "@/server/viewer";

export const dynamic = "force-dynamic";

export default async function AdminTournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireAdminPage();
  const { slug } = await params;
  const [view, auditLog] = await Promise.all([getTournamentView(slug, viewer), getAuditLog(slug)]);
  if (!view) notFound();

  return (
    <>
      <SiteHeader isAdmin />
      <main className="container stack" style={{ marginTop: 24 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <Link href="/admin" className="small">
              ← Painel
            </Link>
            <h1 style={{ fontWeight: 900, textTransform: "uppercase" }}>{view.tournament.name}</h1>
          </div>
          <Link href={`/t/${slug}?aba=chave`} className="btn btn-ghost">
            Ver chave
          </Link>
        </div>

        <TournamentAdmin view={view} devTools={devToolsEnabled()} />

        <section className="card">
          <h2>Histórico</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Tudo o que acontece fica registrado aqui (votos, disputas, decisões, sorteio). Use para tirar dúvidas.
          </p>
          {auditLog.length === 0 ? (
            <p className="muted">Nada ainda.</p>
          ) : (
            <ul className="audit">
              {auditLog.map((a) => (
                <li key={a.id}>
                  <span className="faint nowrap">{formatShort(a.at)}</span>
                  <strong>{a.actor}</strong>
                  <span>{a.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
