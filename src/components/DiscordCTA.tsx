function DiscordLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 .0 13.5.3 18a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4a12.9 12.9 0 0 1-2 1l1.3 2.1a19.9 19.9 0 0 0 6-3c.4-5.2-.8-9.6-3.4-13.6ZM8.7 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm6.6 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}

export function DiscordCTA({ url }: { url: string }) {
  if (!url) return null;
  return (
    <section className="discord-cta" aria-label="Discord">
      <span className="discord-icon">
        <DiscordLogo />
      </span>
      <div className="discord-text">
        <strong>Quer entrar no nosso Discord?</strong>
        <span>Marque horário com o adversário, acompanhe a chave e participe da resenha.</span>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn discord-btn">
        Entrar no Discord
      </a>
    </section>
  );
}
