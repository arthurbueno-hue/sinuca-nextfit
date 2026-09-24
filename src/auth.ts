import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import {
  ALLOWED_DOMAIN,
  isAllowedEmail,
  isAllowedGoogleProfile,
  localTestLoginEnabled,
  publicSession,
  type GoogleProfile,
} from "@/server/config";
import { getStore, paths } from "@/server/store";

async function rememberUser(uid: string, email: string) {
  try {
    await getStore().transaction(async (tx) => {
      const existing = await tx.get<{ createdAt?: string }>(paths.user(uid));
      const now = new Date().toISOString();
      tx.set(paths.user(uid), {
        ...(existing ?? {}),
        email,
        createdAt: existing?.createdAt ?? now,
        lastLoginAt: now,
      });
    });
  } catch (err) {
    console.error("[auth] falha ao registrar usuário", err instanceof Error ? err.message : err);
  }
}

const providers: NextAuthConfig["providers"] = [
  // Em produção, o ÚNICO jeito de entrar é o botão do Google.
  Google({
    // PKCE + state + nonce: o login só termina no MESMO navegador que clicou no botão.
    // Copiar o link do Google para outro aparelho não funciona.
    checks: ["pkce", "state", "nonce"],
    authorization: { params: { hd: ALLOWED_DOMAIN, prompt: "select_account" } },
  }),
];

// Login de teste: só existe no `npm run dev` local com DEV_LOGIN=1 (nunca na Vercel).
if (localTestLoginEnabled()) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Teste local",
      credentials: { user: { label: "Usuário" } },
      authorize(credentials) {
        const u = String(credentials?.user ?? "").toLowerCase().trim();
        if (!/^[a-z0-9._-]{2,30}$/.test(u)) return null;
        return { id: `local-${u}`, email: `${u}@${ALLOWED_DOMAIN}` };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    signIn({ account, profile, user }) {
      if (account?.provider === "google") return isAllowedGoogleProfile(profile as GoogleProfile);
      if (account?.provider === "dev-login") return localTestLoginEnabled() && isAllowedEmail(user?.email);
      return false;
    },
    async jwt({ token, account, profile, user }) {
      if (account) {
        // Primeiro login: o token (criptografado, em cookie httpOnly) guarda só o mínimo.
        const google = account.provider === "google";
        const uid = google ? (profile as GoogleProfile).sub! : user!.id!;
        const email = String((google ? (profile as GoogleProfile).email : user?.email) ?? "").toLowerCase();
        await rememberUser(uid, email);
        return { sub: uid, email };
      }
      return token;
    },
    session({ session, token }) {
      // O que volta daqui é visível no navegador (/api/auth/session): nada de e-mail.
      return { expires: session.expires, user: publicSession(token) } as typeof session;
    },
  },
});
