"use client";

import { VALUE_TYPE_LABEL } from "@/lib/exerciseUnit";
import type { ExerciseValueType } from "@/lib/types";

/** Liste déroulante « Valeur attendue » : kg/RPE/% (défaut), min/km ou km/h. */
export default function ValueTypeSelect({
  value,
  onChange,
}: {
  value: ExerciseValueType;
  onChange: (v: ExerciseValueType) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-wide text-dim">Valeur attendue</p>
      <select value={value} onChange={(e) => onChange(e.target.value as ExerciseValueType)} className="w-full text-sm">
        {(Object.keys(VALUE_TYPE_LABEL) as ExerciseValueType[]).map((t) => (
          <option key={t} value={t}>{VALUE_TYPE_LABEL[t]}</option>
        ))}
      </select>
    </div>
  );
}
