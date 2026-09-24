"use client";

import { useEffect, useState } from "react";

/**
 * true só depois que o JavaScript da página carregou. Usado para travar
 * botões de envio: num celular com internet lenta, tocar antes disso faria
 * um envio "cru" do formulário, fora do fluxo normal.
 */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
