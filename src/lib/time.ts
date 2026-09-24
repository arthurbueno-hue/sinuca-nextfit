/** Brasília não tem horário de verão desde 2019: offset fixo. */
export const TIMEZONE = "America/Sao_Paulo";
const OFFSET = "-03:00";

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso)).replace(",", " às");
}

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatShort(iso: string): string {
  return shortFmt.format(new Date(iso)).replace(",", "");
}

/** "2026-10-25T20:00" (horário de Brasília) -> ISO UTC. */
export function localInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO UTC -> valor para <input type="datetime-local"> em horário de Brasília. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
