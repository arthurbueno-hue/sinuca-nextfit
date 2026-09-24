"use client";

/**
 * Data + hora separadas. O ADM escolhe só o dia e a hora já vem no padrão
 * (23:59 para prazos). Se quiser, muda a hora.
 * Valor no formato "YYYY-MM-DDTHH:mm" (horário de Brasília), ou "" se vazio.
 */
export function DeadlinePicker({
  value,
  onChange,
  defaultTime = "23:59",
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  defaultTime?: string;
  label?: string;
}) {
  const [date = "", time = ""] = value ? value.split("T") : [];
  const effectiveTime = time || defaultTime;
  return (
    <div className="dt-picker" role="group" aria-label={label}>
      <input
        type="date"
        className="input"
        aria-label={label ? `${label}: dia` : "Dia"}
        value={date}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}T${effectiveTime}` : "")}
      />
      <input
        type="time"
        className="input dt-time"
        aria-label={label ? `${label}: hora` : "Hora"}
        value={date ? effectiveTime : ""}
        disabled={!date}
        onChange={(e) => onChange(date ? `${date}T${e.target.value || defaultTime}` : "")}
      />
    </div>
  );
}
