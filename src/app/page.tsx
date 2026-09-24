import Link from "next/link";
import { redirect } from "next/navigation";
import { EightBall } from "@/components/Icon";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getActiveTournamentSlug } from "@/server/queries";
import { requireViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await requireViewer();
  const slug = await getActiveTournamentSlug();
  if (slug) redirect(`/t/${slug}`);

  return (
    <>
      <SiteHeader isAdmin={viewer.isAdmin} />
      <main className="container">
        <div className="card empty-state" style={{ marginTop: 40 }}>
          <EightBall size={64} className="ball" />
          <h2>Nenhum campeonato aberto ainda</h2>
          <p className="muted">Fica de olho, logo a organização abre as inscrições.</p>
          {viewer.isAdmin && (
            <Link href="/admin" className="btn btn-primary">
              Criar campeonato
            </Link>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
