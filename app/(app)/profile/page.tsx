"use client";

import { useData } from "@/components/DataProvider";
import type { UserProfileData } from "@/lib/types";

export default function ProfilePage() {
  const { state, update, loading } = useData();
  const p = state.profile;

  const set = (key: keyof UserProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    update((d) => {
      d.profile[key] = v;
    });
  };

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div className="space-y-3.5">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-4 text-xl font-bold">Informations</h2>
        <label className="mb-3.5 block">
          <span className="mb-1.5 block text-[13px] text-dim">Nom</span>
          <input value={p.name} onChange={set("name")} placeholder="Prénom Nom" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Âge" value={p.age} onChange={set("age")} type="number" suffix="ans" />
          <Field label="Taille (cm)" value={p.height} onChange={set("height")} type="number" suffix="cm" />
          <Field label="Poids actuel (kg)" value={p.weight} onChange={set("weight")} type="number" suffix="kg" />
          <Field label="Poids objectif (kg)" value={p.goalWeight} onChange={set("goalWeight")} type="number" suffix="kg" />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-4 text-xl font-bold">Diète à suivre</h2>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-dim">Plan alimentaire (renseigné par le coach)</span>
          <textarea
            value={p.diet}
            onChange={set("diet")}
            placeholder="Petit-déj, déjeuner, collation, dîner, macros..."
          />
        </label>
      </section>

      <p className="text-center text-xs text-dim">Les modifications sont enregistrées automatiquement.</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  suffix,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-dim">{label}</span>
      <input type={type} value={value} onChange={onChange} placeholder={suffix} />
    </label>
  );
}
