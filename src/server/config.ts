import "server-only";

export const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN ?? "nextfit.com.br").trim().toLowerCase();

export function isAllowedEmail(email: unknown): email is string {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export function isAdminEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export interface GoogleProfile {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  hd?: string;
}

/**
 * Só entra conta Google do Workspace da empresa: e-mail verificado,
 * `hd` (domínio hospedado, assinado pelo Google no id_token) igual ao
 * domínio e e-mail terminando em @domínio. Gmail pessoal não tem `hd`.
 */
export function isAllowedGoogleProfile(profile: GoogleProfile | null | undefined): boolean {
  if (!profile?.sub) return false;
  return profile.email_verified === true && profile.hd === ALLOWED_DOMAIN && isAllowedEmail(profile.email);
}

/** O que o navegador pode ver da sessão: id opaco e se é ADM. Nunca e-mail. */
export function publicSession(token: { sub?: unknown; email?: unknown }) {
  return { id: String(token.sub ?? ""), isAdmin: isAdminEmail(token.email) };
}

/**
 * Login de TESTE, só na máquina de quem desenvolve (`npm run dev` + DEV_LOGIN=1).
 * Em produção (build da Vercel) é impossível: NODE_ENV=production e VERCEL=1.
 */
export function localTestLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "development" && env.DEV_LOGIN === "1" && !env.VERCEL;
}

/** Ferramentas de teste local (inscritos falsos). Só com banco em memória no `next dev`. */
export function devToolsEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DATA_BACKEND === "memory";
}
