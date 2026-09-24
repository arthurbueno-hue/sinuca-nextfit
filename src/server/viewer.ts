import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { TournamentError } from "@/lib/tournament/errors";

export interface Viewer {
  uid: string;
  isAdmin: boolean;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return null;
  return { uid, isAdmin: session.user.isAdmin === true };
});

/** Para páginas: manda para o login. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Para páginas de ADM: quem não é ADM vê 404. */
export async function requireAdminPage(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) notFound();
  return viewer;
}

/** Para server actions: erro amigável em vez de redirect. */
export async function actionViewer(opts: { admin?: boolean } = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new TournamentError("Sua sessão expirou. Entre de novo.");
  if (opts.admin && !viewer.isAdmin) throw new TournamentError("Só a organização pode fazer isso.");
  return viewer;
}
