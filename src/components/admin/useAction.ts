"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/dto";

export type Msg = { kind: "ok" | "error"; text: string } | null;

export function useAction() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  function exec(fn: () => Promise<ActionResult>, after?: () => void) {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await fn();
        setMsg(r.ok ? { kind: "ok", text: r.message } : { kind: "error", text: r.error });
        if (r.ok) after?.();
      } catch {
        setMsg({ kind: "error", text: "Falha de conexão. Tenta de novo." });
      }
    });
  }
  return { pending, msg, exec };
}
