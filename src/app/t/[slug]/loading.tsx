/** Esqueleto enquanto carrega (internet do celular às vezes é lenta). */
export default function Loading() {
  return (
    <main className="container" aria-busy="true" aria-label="Carregando">
      <div className="skeleton" style={{ height: 68, margin: "0 -16px", borderRadius: 0 }} />
      <div className="skeleton" style={{ height: 200, marginTop: 24 }} />
      <div className="skeleton" style={{ height: 46, width: 240, marginTop: 20, borderRadius: 999 }} />
      <div className="skeleton" style={{ height: 320, marginTop: 20 }} />
    </main>
  );
}
