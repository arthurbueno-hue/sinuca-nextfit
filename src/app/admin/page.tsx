import Link from "next/link";
import { CreateTournamentForm } from "@/components/admin/CreateTournamentForm";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { DEFAULT_TOURNAMENT } from "@/lib/defaults";
import { formatDate } from "@/lib/time";
import { listTournaments } from "@/server/queries";
import { requireAdminPage } from "@/server/viewer";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  inscricoes: "Inscrições",
  em_andamento: "Em andamento",
  finalizado: "Finalizado",
};

export default async function AdminPage() {
  await requireAdminPage();
  const tournaments = await listTournaments();
  const year = new Date().getFullYear();
  const defaults =
    tournaments.length === 0
      ? DEFAULT_TOURNAMENT
      : {
          name: `${tournaments.length + 1}º Campeonato de Sinuca Next Fit`,
          slug: `sinuca-${year}-${tournaments.length + 1}`,
          registrationDeadline: "",
          startDate: "",
        };

  return (
    <>
      <SiteHeader isAdmin />
      <main className="container stack" style={{ marginTop: 24 }}>
        <h1 style={{ fontWeight: 900, textTransform: "uppercase" }}>Painel da organização</h1>
        <div className="grid-2" style={{ alignItems: "start" }}>
          <section className="card">
            <h2>Campeonatos</h2>
            {tournaments.length === 0 ? (
              <p className="muted">Nenhum ainda. Crie o primeiro no formulário “Novo campeonato”.</p>
            ) : (
              <ul className="rule-list">
                {tournaments.map((t) => (
                  <li key={t.id}>
                    <span>
                      {t.name}
                      <br />
                      <span className="small muted">
                        {STATUS[t.status]} · início {formatDate(t.startDate)}
                      </span>
                    </span>
                    <span className="row">
                      <Link href={`/t/${t.slug}`} className="btn btn-ghost btn-sm">
                        Ver
                      </Link>
                      <Link href={`/admin/${t.slug}`} className="btn btn-purple btn-sm">
                        Gerenciar
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h2>Novo campeonato</h2>
            <CreateTournamentForm defaults={defaults} />
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
