"use client";

import { useState } from "react";
import { createTournamentAction } from "@/server/actions/admin";
import { DeadlinePicker } from "./DeadlinePicker";
import { MsgBox } from "./MsgBox";
import { useHydrated } from "../useHydrated";
import { useAction } from "./useAction";

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CreateTournamentForm({
  defaults,
}: {
  defaults: { name: string; slug: string; registrationDeadline: string; startDate: string };
}) {
  const [name, setName] = useState(defaults.name);
  const [slug, setSlug] = useState(defaults.slug);
  const [slugTouched, setSlugTouched] = useState(false);
  const [reg, setReg] = useState(defaults.registrationDeadline);
  const [start, setStart] = useState(defaults.startDate);
  const { pending, msg, exec } = useAction();
  const hydrated = useHydrated();

  return (
    <form
      className="stack"
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => createTournamentAction({ name, slug, registrationDeadline: reg, startDate: start }));
      }}
    >
      <label className="field">
        <span>Nome</span>
        <input
          className="input"
          value={name}
          maxLength={80}
          required
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </label>
      <label className="field">
        <span>Identificador na URL (não muda depois)</span>
        <input
          className="input"
          value={slug}
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
      </label>
      <div className="grid-2">
        <div className="field">
          <span>Fim das inscrições (padrão 23:59)</span>
          <DeadlinePicker label="Fim das inscrições" value={reg} onChange={setReg} />
        </div>
        <div className="field">
          <span>Início</span>
          <DeadlinePicker label="Início" value={start} onChange={setStart} defaultTime="09:00" />
        </div>
      </div>
      <p className="small faint" style={{ margin: 0 }}>
        As regras são copiadas do último campeonato (ou as padrão, no primeiro). Dá para editar depois.
      </p>
      <button type="submit" className="btn btn-primary" disabled={pending || !hydrated} style={{ alignSelf: "flex-start" }}>
        {pending ? "Criando..." : "Criar campeonato"}
      </button>
      <MsgBox msg={msg} />
    </form>
  );
}
