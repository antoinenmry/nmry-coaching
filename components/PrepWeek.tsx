"use client";

/** Pastille « S3 » : numéro de la semaine de préparation d'une séance. */
export function PrepWeekBadge({ n, className = "" }: { n?: number | null; className?: string }) {
  if (!n || n < 1) return null;
  return (
    <span
      className={`shrink-0 rounded-md bg-accent/20 px-1.5 py-px text-[0.7em] font-black leading-tight tracking-wide text-accent ${className}`}
      title={`Semaine ${n} de la préparation`}
    >
      S{n}
    </span>
  );
}

/** Saisie du numéro de semaine de prépa : − / valeur / + et « Aucune » pour retirer le compteur. */
export function PrepWeekField({
  value,
  onChange,
  label = "Semaine de prépa",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] text-dim">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(value && value > 1 ? value - 1 : value)}
          disabled={!value || value <= 1}
          aria-label="Semaine précédente"
          className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-lg disabled:opacity-40"
        >−</button>
        <label className="flex h-8 items-center rounded-lg border border-line bg-surface2 pl-2.5 text-sm font-black">
          S
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            value={value ?? ""}
            placeholder="–"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              onChange(Number.isFinite(n) && n >= 1 ? Math.min(99, n) : null);
            }}
            aria-label={label}
            className="!w-11 !border-0 !bg-transparent !px-1 !py-0 text-center text-sm font-black"
          />
        </label>
        <button
          type="button"
          onClick={() => onChange(Math.min(99, (value ?? 0) + 1))}
          aria-label="Semaine suivante"
          className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-lg"
        >+</button>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={value == null}
          className="h-8 rounded-lg px-2 text-[12px] font-semibold text-dim disabled:opacity-40"
        >Aucune</button>
      </div>
    </div>
  );
}
