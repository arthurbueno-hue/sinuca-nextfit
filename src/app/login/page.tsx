import { redirect } from "next/navigation";
import { EightBall, Icon } from "@/components/Icon";
import { devSignInAction, googleSignInAction } from "@/server/actions/auth";
import { ALLOWED_DOMAIN, localTestLoginEnabled } from "@/server/config";
import { getViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

const RETRY = "Não deu para concluir o login. Toque em \"Entrar com Google\" de novo, neste mesmo aparelho.";
const ERRORS: Record<string, string> = {
  AccessDenied: `Acesso negado. Só contas Google @${ALLOWED_DOMAIN} podem entrar.`,
  Configuration: `${RETRY} Se continuar, avise a organização.`,
  Verification: RETRY,
  OAuthCallbackError: RETRY,
  OAuthSignin: RETRY,
  CallbackRouteError: RETRY,
  CredentialsSignin: "Usuário de teste inválido: use só minúsculas, números, ponto ou hífen, sem espaço (ex.: joao).",
};

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getViewer()) redirect("/");
  const { error } = await searchParams;
  const errorText = error ? (ERRORS[error] ?? "Não foi possível entrar. Tenta de novo.") : null;

  return (
    <main className="login-wrap">
      <div className="card login-card">
        <EightBall size={72} />
        <h1>
          Campeonato de <span className="hl">Sinuca</span>
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Entre com sua conta Google <strong>@{ALLOWED_DOMAIN}</strong> para se inscrever e acompanhar a chave.
        </p>

        {errorText && (
          <div className="alert alert-error" role="alert" style={{ margin: "18px 0", textAlign: "left" }}>
            <Icon name="alert" />
            <span>{errorText}</span>
          </div>
        )}

        <form action={googleSignInAction} style={{ marginTop: 22 }}>
          <button type="submit" className="btn btn-lg btn-block google-btn">
            <GoogleLogo /> Entrar com Google
          </button>
        </form>

        {localTestLoginEnabled() && (
          <form action={devSignInAction} className="stack" style={{ marginTop: 22, gap: 8, textAlign: "left" }}>
            <div className="alert alert-warn small">
              <Icon name="alert" />
              <span>
                Teste local: este campo só aparece no <code>npm run dev</code> da sua máquina. No site publicado não
                existe.
              </span>
            </div>
            <div className="row">
              <input
                name="user"
                className="input"
                placeholder="ex.: arthur.bueno ou joao"
                style={{ flex: 1, minWidth: 0 }}
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
              <button type="submit" className="btn btn-purple">
                Entrar
              </button>
            </div>
          </form>
        )}

        <p className="small faint" style={{ marginTop: 24, marginBottom: 0 }}>
          <Icon name="shield" size={14} /> Seu e-mail não é exibido para ninguém. Na chave aparece só o seu apelido.
        </p>
      </div>
    </main>
  );
}
