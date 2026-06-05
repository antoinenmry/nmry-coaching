"use client";

import { useRef } from "react";
import { useData } from "@/components/DataProvider";

const SPORTS = [
  "Strongman", "Hybrid", "Powerlifting", "Running",
  "Hyrox", "Trail", "Pilates", "Musculation",
  "Powerbuilding", "Préparation physique",
];

export default function ProfilePage() {
  const { state, update, loading } = useData();
  const p = state.profile;
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof p) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const v = e.target.value;
    update((d) => { (d.profile as unknown as Record<string, string>)[key] = v; });
  };

  const setGender = (v: string) =>
    update((d) => { d.profile.gender = d.profile.gender === v ? "" : v; });

  const toggleSport = (sport: string) =>
    update((d) => {
      const sports = d.profile.sports ?? [];
      d.profile.sports = sports.includes(sport)
        ? sports.filter((s) => s !== sport)
        : [...sports, sport];
    });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      update((d) => { d.profile.photo = reader.result as string; });
    reader.readAsDataURL(file);
  };

  const removePhoto = () => update((d) => { d.profile.photo = ""; });

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  const sports = p.sports ?? [];

  return (
    <div className="space-y-3.5">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-4 text-xl font-bold">Informations</h2>

        {/* Nom + Photo */}
        <div className="mb-4 flex items-center gap-4">
          <label className="min-w-0 flex-1 block">
            <span className="mb-1.5 block text-[13px] text-dim">Nom Prénom</span>
            <input value={p.name} onChange={set("name")} placeholder="Prénom Nom" />
          </label>

          {/* Photo */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-line bg-surface2 transition hover:border-accent"
              title="Changer la photo"
            >
              {p.photo ? (
                <img src={p.photo} alt="photo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">📷</span>
              )}
            </button>
            {p.photo ? (
              <button onClick={removePhoto} className="text-[11px] text-dim">Retirer</button>
            ) : (
              <span className="text-[11px] text-dim">Photo</span>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
        </div>

        {/* Date de naissance + Genre */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Date de naissance</span>
            <input
              type="date"
              value={p.birthDate ?? ""}
              onChange={set("birthDate")}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Genre</span>
            <select value={p.gender ?? ""} onChange={set("gender")}>
              <option value="">—</option>
              <option value="homme">Homme</option>
              <option value="femme">Femme</option>
            </select>
          </label>
        </div>

        {/* Taille + Poids */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Taille (cm)</span>
            <input type="number" value={p.height} onChange={set("height")} placeholder="cm" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Poids (kg)</span>
            <input type="number" value={p.weight} onChange={set("weight")} placeholder="kg" />
          </label>
        </div>

        {/* Sports */}
        <div>
          <span className="mb-2 block text-[13px] text-dim">
            Sport{sports.length > 0 ? ` (${sports.length} sélectionné${sports.length > 1 ? "s" : ""})` : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((sport) => {
              const active = sports.includes(sport);
              return (
                <button
                  key={sport}
                  onClick={() => toggleSport(sport)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                    active
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-line bg-surface2 text-dim"
                  }`}
                >
                  {sport}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-4 text-xl font-bold">Diète à suivre</h2>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-dim">
            Plan alimentaire (modifiable coach ou sportif)
          </span>
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
