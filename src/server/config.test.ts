import { describe, expect, it } from "vitest";
import { isAllowedGoogleProfile, localTestLoginEnabled, publicSession } from "./config";

// ALLOWED_DOMAIN=nextfit.com.br e ADMIN_EMAILS=adm@nextfit.com.br (vitest.config.mts)
const good = { sub: "123", email: "fulano@nextfit.com.br", email_verified: true, hd: "nextfit.com.br" };

describe("quem pode entrar", () => {
  it("conta do Workspace Next Fit entra", () => {
    expect(isAllowedGoogleProfile(good)).toBe(true);
    expect(isAllowedGoogleProfile({ ...good, email: "Fulano@NextFit.com.br" })).toBe(true);
  });

  it("gmail, outro domínio, e-mail não verificado ou sem hd: barrado", () => {
    expect(isAllowedGoogleProfile({ ...good, email: "fulano@gmail.com", hd: undefined })).toBe(false);
    expect(isAllowedGoogleProfile({ ...good, email: "fulano@outra.com.br", hd: "outra.com.br" })).toBe(false);
    expect(isAllowedGoogleProfile({ ...good, email_verified: false })).toBe(false);
    expect(isAllowedGoogleProfile({ ...good, hd: undefined })).toBe(false);
    // truques com o domínio no e-mail
    expect(isAllowedGoogleProfile({ ...good, email: "x@nextfit.com.br.evil.com", hd: "nextfit.com.br" })).toBe(false);
    expect(isAllowedGoogleProfile({ ...good, email: "x@evil.com", hd: "nextfit.com.br" })).toBe(false);
    expect(isAllowedGoogleProfile({ ...good, hd: "nextfit.com.br.evil.com" })).toBe(false);
    expect(isAllowedGoogleProfile({ ...good, sub: undefined })).toBe(false);
    expect(isAllowedGoogleProfile(null)).toBe(false);
  });
});

describe("sessão visível no navegador", () => {
  it("não expõe e-mail; ADM vem da lista do servidor", () => {
    const s = publicSession({ sub: "123", email: "adm@nextfit.com.br" });
    expect(s).toEqual({ id: "123", isAdmin: true });
    expect(JSON.stringify(s)).not.toMatch(/@/);
    expect(publicSession({ sub: "9", email: "fulano@nextfit.com.br" }).isAdmin).toBe(false);
  });
});

describe("login de teste local", () => {
  const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
  it("só liga no npm run dev com DEV_LOGIN=1", () => {
    expect(localTestLoginEnabled(env({ NODE_ENV: "development", DEV_LOGIN: "1" }))).toBe(true);
    expect(localTestLoginEnabled(env({ NODE_ENV: "development" }))).toBe(false);
  });
  it("nunca liga em produção nem na Vercel, mesmo com DEV_LOGIN=1", () => {
    expect(localTestLoginEnabled(env({ NODE_ENV: "production", DEV_LOGIN: "1" }))).toBe(false);
    expect(localTestLoginEnabled(env({ NODE_ENV: "development", DEV_LOGIN: "1", VERCEL: "1" }))).toBe(false);
    expect(localTestLoginEnabled(env({ NODE_ENV: "test", DEV_LOGIN: "1" }))).toBe(false);
  });
});
