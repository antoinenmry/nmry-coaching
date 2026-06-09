"use client";

import { useRef, useState, useEffect } from "react";
import { useData } from "@/components/DataProvider";

const SPORTS = [
  "Strongman", "Hybrid", "Powerlifting", "Running",
  "Hyrox", "Trail", "Pilates", "Musculation",
  "Powerbuilding", "Préparation physique",
];

// ─── Localisation (Nominatim / OpenStreetMap) ─────────────────────────────────
interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

function LocationPicker({
  value,
  onChange,
}: {
  value?: { label: string; lat: number; lng: number };
  onChange: (loc: GeoResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
          { headers: { "Accept-Language": "fr", "Referer": "https://nmry-coaching.vercel.app" } }
        );
        const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json();
        setResults(
          data.map(r => ({
            label: r.display_name.split(",").slice(0, 3).join(", "),
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          }))
        );
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2.5">
        <span className="flex-1 text-sm">📍 {value.label}</span>
        <button onClick={() => onChange(null)} className="shrink-0 text-dim hover:text-danger">✕</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(false); }}
          placeholder="Paris, Lyon, Bordeaux…"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-dim">…</span>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                onChange(r);
                setQuery("");
                setOpen(false);
                setResults([]);
              }}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-surface2 border-b border-line/50 last:border-0"
            >
              📍 {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page profil ──────────────────────────────────────────────────────────────
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

  // Compresse la photo à l'upload : redimensionne (max 512px) + JPEG qualité 0.72.
  // Une photo passe ainsi de ~1-3 Mo à ~20-40 Ko → app_state léger + chat rapide.
  const MAX_DIM = 512;
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { update((d) => { d.profile.photo = dataUrl; }); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.72);
        // Garde le plus petit des deux (sécurité si la compression n'aide pas).
        const best = compressed.length < dataUrl.length ? compressed : dataUrl;
        update((d) => { d.profile.photo = best; });
      };
      img.onerror = () => { update((d) => { d.profile.photo = dataUrl; }); };
      img.src = dataUrl;
    };
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
            <span className="mb-1.5 block text-[13px] text-dim">Prénom Nom</span>
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
        <div className="mb-4 flex flex-col gap-3">
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

        {/* Instagram + Localisation */}
        <div className="mb-4 flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">📸 Instagram</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim text-sm font-semibold">@</span>
              <input
                value={(p.instagram ?? "").replace(/^@/, "")}
                onChange={e => update(d => { d.profile.instagram = e.target.value ? `@${e.target.value.replace(/^@/, "")}` : ""; })}
                placeholder="username"
                className="pl-7"
              />
            </div>
          </label>
          <div>
            <span className="mb-1.5 block text-[13px] text-dim">📍 Localisation</span>
            <LocationPicker
              value={p.location}
              onChange={loc =>
                update(d => { d.profile.location = loc ?? undefined; })
              }
            />
            {p.location && (
              <p className="mt-1 text-[11px] text-dim">
                {p.location.lat.toFixed(4)}, {p.location.lng.toFixed(4)}
              </p>
            )}
          </div>
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

      <p className="text-center text-xs text-dim">Les modifications sont enregistrées automatiquement.</p>
    </div>
  );
}
