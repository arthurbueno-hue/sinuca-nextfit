import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Bracket } from "@/components/Bracket";
import { DiscordCTA } from "@/components/DiscordCTA";
import { Hero } from "@/components/Hero";
import { Icon, type IconName } from "@/components/Icon";
import { Registration } from "@/components/Registration";
import { RulesSection } from "@/components/RulesSection";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getTournamentView } from "@/server/queries";
import { requireViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: "inscricao", label: "Inscrição", icon: "users" },
  { id: "chave", label: "Chaveamento", icon: "bracket" },
  { id: "regras", label: "Regras", icon: "book" },
];

export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const viewer = await requireViewer();
  const { slug } = await params;
  const { aba } = await searchParams;
  const view = await getTournamentView(slug, viewer);
  if (!view) notFound();

  const fallback = view.tournament.status === "inscricoes" ? "inscricao" : "chave";
  const tab = TABS.some((t) => t.id === aba) ? aba! : fallback;

  return (
    <>
      <SiteHeader isAdmin={viewer.isAdmin} homeHref={`/t/${slug}`} />
      <main className="container">
        <Hero view={view} />
        <nav className="tabs" aria-label="Seções">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/t/${slug}?aba=${t.id}`}
              className="tab"
              aria-current={tab === t.id ? "page" : undefined}
              scroll={false}
            >
              <Icon name={t.icon} size={16} /> {t.label}
            </Link>
          ))}
        </nav>
        {tab === "inscricao" && <Registration view={view} />}
        {tab === "chave" && <Bracket view={view} />}
        {tab === "regras" && <RulesSection view={view} />}
        <DiscordCTA url={view.tournament.discordUrl} />
        {viewer.isAdmin && (
          <p className="small" style={{ marginTop: 20 }}>
            <Link href={`/admin/${slug}`}>
              <Icon name="shield" size={14} /> Gerenciar este campeonato
            </Link>
          </p>
        )}
      </main>
      <SiteFooter />
      <AutoRefresh />
    </>
  );
}
