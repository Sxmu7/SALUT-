"use client";

import { useMemo } from "react";

/**
 * Ersatz für das native <input type="date"> beim Geburtstag.
 *
 * Warum: der native Date-Input zeigt Format/Reihenfolge (Tag/Monat/Jahr vs.
 * Monat/Tag/Jahr) je nach Betriebssystem-Spracheinstellung des Geräts an –
 * nicht nach der Sprache der App. Ein Nutzer mit englischsprachigem Handy
 * sieht "mm/dd/yyyy", tippt aber intuitiv im deutschen Format ein und
 * landet z.B. bei "13. Monat" oder einem falschen Tag, ohne dass die App
 * das irgendwie klarstellt. Drei separate, klar beschriftete Felder (Tag /
 * Monat / Jahr) sind komplett eindeutig, unabhängig vom Gerät, und öffnen
 * auf dem Handy trotzdem das gewohnte native Auswahlrad – kein Rückschritt
 * bei der Bedienung, nur bei der Verständlichkeit.
 */

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function BirthdayPicker({
  value,
  onChange,
  className = "",
}: {
  /** "YYYY-MM-DD" oder "" (kein Datum gewählt). */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const y = parts ? Number(parts[1]) : undefined;
  const m = parts ? Number(parts[2]) : undefined;
  const d = parts ? Number(parts[3]) : undefined;

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let yr = currentYear; yr >= currentYear - 100; yr--) arr.push(yr);
    return arr;
  }, [currentYear]);

  const days = useMemo(() => {
    const max = m && y ? daysInMonth(m, y) : 31;
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [m, y]);

  function update(part: "d" | "m" | "y", raw: string) {
    const n = Number(raw);
    const nd = part === "d" ? n : d ?? 1;
    const nm = part === "m" ? n : m ?? 1;
    const ny = part === "y" ? n : y ?? currentYear - 20;
    const clampedDay = Math.min(nd, daysInMonth(nm, ny));
    const pad = (v: number) => String(v).padStart(2, "0");
    onChange(`${ny}-${pad(nm)}-${pad(clampedDay)}`);
  }

  const selectClass =
    "w-full card-surface rounded-xl px-2 py-3 text-center font-medium text-sm appearance-none";

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <div>
        <label className="text-[10px] font-semibold text-muted uppercase block mb-1 text-center">
          Tag
        </label>
        <select
          value={d ?? ""}
          onChange={(e) => update("d", e.target.value)}
          className={selectClass}
        >
          <option value="" disabled>
            –
          </option>
          {days.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted uppercase block mb-1 text-center">
          Monat
        </label>
        <select
          value={m ?? ""}
          onChange={(e) => update("m", e.target.value)}
          className={selectClass}
        >
          <option value="" disabled>
            –
          </option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted uppercase block mb-1 text-center">
          Jahr
        </label>
        <select
          value={y ?? ""}
          onChange={(e) => update("y", e.target.value)}
          className={selectClass}
        >
          <option value="" disabled>
            –
          </option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
