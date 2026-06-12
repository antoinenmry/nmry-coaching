"use client";

import { useRef, useState, useEffect } from "react";
import { useData } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";
import type { Challenge, UnlockedBadge } from "@/lib/types";

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
  const { state, update, loading, me, activeUserId, library } = useData();
  const p = state.profile;
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // --- Badges épinglés ---
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(0);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  const challenges: Challenge[] = library.challenges ?? [];
  const unlockedBadges: UnlockedBadge[] = state.badges ?? [];
  const pinnedIds: (string | null)[] = [
    state.profileBadges?.[0] ?? null,
    state.profileBadges?.[1] ?? null,
    state.profileBadges?.[2] ?? null,
  ];
  const unlockedChallenges = challenges.filter((ch) =>
    unlockedBadges.some((b) => b.challengeId === ch.id)
  );

  useEffect(() => {
    if (activeTooltip === null) return;
    const close = () => setActiveTooltip(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [activeTooltip]);

  function setPinned(slot: number, id: string | null) {
    update((d) => {
      const pins: (string | undefined)[] = [
        d.profileBadges?.[0],
        d.profileBadges?.[1],
        d.profileBadges?.[2],
      ];
      if (id) {
        for (let i = 0; i < 3; i++) {
          if (pins[i] === id) pins[i] = undefined;
        }
      }
      pins[slot] = id ?? undefined;
      d.profileBadges = pins as string[];
    });
  }

  function openPicker(slot: number) {
    setActiveTooltip(null);
    setPickerSlot(slot);
    setPickerOpen(true);
  }

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

  // Photo de profil : compressée (max 512px, JPEG 0.72) puis stockée dans
  // Supabase Storage (bucket `avatars`). Seule l'URL est conservée dans
  // app_state → le blob reste léger (avant : base64 de ~20-40 Ko embarqué).
  // Repli base64 si l'upload échoue (mode local hors-ligne, réseau).
  const MAX_DIM = 512;

  // Extrait le chemin interne au bucket depuis une URL publique Storage.
  // (ex: …/object/public/avatars/<uid>/<ts>.jpg → "<uid>/<ts>.jpg")
  const avatarPath = (url: string): string | null =>
    url.includes("/avatars/") ? url.split("/avatars/")[1] : null;

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!file) return;

    setPhotoBusy(true);
    try {
      // 1) Compression côté client (orientation EXIF respectée)
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setPhotoBusy(false); return; }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.72));
      if (!blob) { setPhotoBusy(false); return; }

      const previous = p.photo;
      const userId = activeUserId ?? me?.id ?? null;

      // 2) Upload direct vers Storage (URL en base, pas de base64 dans le blob)
      let storedUrl: string | null = null;
      if (userId) {
        const supabase = createClient();
        const path = `${userId}/${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("avatars")
          // cacheControl 1 an : le nom de fichier est horodaté (cache-busting au
          // changement), donc on peut mettre en cache longtemps → ↓ egress sur les revisionnages.
          .upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
        if (!error) {
          storedUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
          // Nettoyage de l'ancien fichier Storage (si c'en était un)
          const old = avatarPath(previous);
          if (old) supabase.storage.from("avatars").remove([old]).catch(() => {});
        }
      }

      // 3) Écrit l'URL ; repli base64 si l'upload n'a pas abouti
      if (storedUrl) {
        update((d) => { d.profile.photo = storedUrl!; });
      } else {
        update((d) => { d.profile.photo = canvas.toDataURL("image/jpeg", 0.72); });
      }
    } catch {
      // Décodage impossible : on conserve la photo actuelle.
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = () => {
    const old = p.photo;
    update((d) => { d.profile.photo = ""; });
    const path = avatarPath(old);
    if (path) createClient().storage.from("avatars").remove([path]).catch(() => {});
  };

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
              disabled={photoBusy}
              className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-line bg-surface2 transition hover:border-accent disabled:opacity-60"
              title="Changer la photo"
            >
              {photoBusy ? (
                <span className="text-xl animate-pulse">⏳</span>
              ) : p.photo ? (
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
            <div className="flex items-center overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface2)]">
              <span className="shrink-0 select-none pl-3 text-base text-dim" aria-hidden="true">@</span>
              <input
                value={(p.instagram ?? "").replace(/^@/, "")}
                onChange={e => update(d => { d.profile.instagram = e.target.value ? `@${e.target.value.replace(/^@/, "")}` : ""; })}
                placeholder="username"
                style={{ border: "none", background: "transparent", borderRadius: 0, paddingLeft: 4, boxShadow: "none", width: "100%" }}
              />
              {p.instagram && (
                <a
                  href={`https://instagram.com/${(p.instagram ?? "").replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 pr-3 text-dim transition-opacity hover:opacity-70"
                  title="Voir le profil Instagram"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 6v2H5v11h11v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6zm11-3v7h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z"/>
                  </svg>
                </a>
              )}
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
            {/* Consentement carte communauté */}
            <button
              type="button"
              onClick={() => update((d) => { d.profile.mapConsent = !d.profile.mapConsent; })}
              className="mt-2 flex w-fit items-center gap-2 rounded-lg border border-line bg-surface2 px-3 py-2 text-left transition hover:border-accent/40"
            >
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 text-[12px] font-bold transition ${p.mapConsent ? "border-accent bg-accent text-[#1a1500]" : "border-dim text-transparent"}`}>
                ✓
              </span>
              <span className="text-[13px] font-semibold text-ink">Visible</span>
            </button>
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

      {/* Badges épinglés — visible si des défis existent */}
      {challenges.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-4 text-xl font-bold">Mes badges</h2>

          <div className="flex justify-center gap-6">
            {[0, 1, 2].map((slot) => {
              const id = pinnedIds[slot];
              const ch = id ? challenges.find((c) => c.id === id) : null;
              const ub = id ? unlockedBadges.find((b) => b.challengeId === id) : null;
              const color = ch?.color ?? "#a855f7";
              const showTooltip = activeTooltip === slot;

              return (
                <div key={slot} className="relative flex flex-col items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (ch) {
                        setActiveTooltip(showTooltip ? null : slot);
                      } else {
                        openPicker(slot);
                      }
                    }}
                    style={ch ? { borderColor: `${color}90` } : {}}
                    className={`flex h-[72px] w-[72px] items-center justify-center rounded-full transition ${
                      ch
                        ? "border-2 bg-surface2"
                        : "border-2 border-dashed border-line bg-surface2 hover:border-accent/60"
                    }`}
                  >
                    {ch ? (
                      ch.badgeImage ? (
                        <img src={ch.badgeImage} alt={ch.title} className="h-14 w-14 rounded-full object-cover" />
                      ) : (
                        <span style={{ fontSize: 30 }}>{ch.icon}</span>
                      )
                    ) : (
                      <span className="text-[28px] text-dim opacity-30">+</span>
                    )}
                  </button>

                  <p className="max-w-[80px] text-center text-[11px] leading-tight text-dim">
                    {ch ? ch.title : <span className="opacity-40">Choisir</span>}
                  </p>

                  {/* Tooltip (tap/hover) */}
                  {showTooltip && ch && ub && (
                    <div
                      className="absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-xl border border-line bg-surface p-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="mb-1 text-[13px] font-bold" style={{ color }}>{ch.title}</p>
                      <p className="mb-1.5 text-[11px] text-dim">
                        Débloqué le{" "}
                        {new Date(ub.unlockedAt + "T12:00:00").toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="mb-3 text-[12px] text-ink">{ch.description}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openPicker(slot)}
                          className="flex-1 rounded-lg border border-line py-1.5 text-[12px] text-dim hover:text-ink"
                        >
                          Changer
                        </button>
                        <button
                          onClick={() => { setPinned(slot, null); setActiveTooltip(null); }}
                          className="flex-1 rounded-lg border border-line py-1.5 text-[12px] text-danger"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {unlockedChallenges.length === 0 && (
            <p className="mt-4 text-center text-[12px] text-dim">
              Débloquez des badges dans l&apos;onglet Défis de la bibliothèque.
            </p>
          )}
        </section>
      )}

      {/* Picker modal */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-bold">Choisir un badge</h3>
            {unlockedChallenges.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-dim">
                Aucun badge débloqué pour l&apos;instant.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {unlockedChallenges.map((ch) => {
                  const color = ch.color ?? "#a855f7";
                  const isSelected = pinnedIds[pickerSlot] === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => { setPinned(pickerSlot, ch.id); setPickerOpen(false); }}
                      className="flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition"
                      style={{
                        borderColor: isSelected ? `${color}80` : undefined,
                        background: isSelected ? `${color}15` : undefined,
                      }}
                    >
                      {ch.badgeImage ? (
                        <img src={ch.badgeImage} alt={ch.title} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <span style={{ fontSize: 28 }}>{ch.icon}</span>
                      )}
                      <p className="line-clamp-2 text-center text-[11px] leading-tight">{ch.title}</p>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setPickerOpen(false)}
              className="mt-4 w-full rounded-xl border border-line py-2.5 text-[13px] text-dim"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-dim">Les modifications sont enregistrées automatiquement.</p>
    </div>
  );
}
