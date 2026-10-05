"use client";

import { useRef, useState, useEffect } from "react";
import { useData } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";
import type { Challenge, UnlockedBadge } from "@/lib/types";
import { conditionText, computeChallengeProgress } from "@/lib/challenges";

const SPORTS = [
  "Strongman", "Hybrid", "Powerlifting", "Running",
  "Hyrox", "Trail", "Pilates", "Musculation",
  "Powerbuilding", "Préparation physique",
];

// ─── Styles partagés (même esthétique que /plan : dégradés légers, pilules) ───
const CARD =
  "rounded-[20px] border border-line p-4 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(255,179,0,0.09),transparent_60%),var(--color-surface)]";
const LABEL = "mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.12em] text-dim";
const PILL_ON =
  "border-transparent bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500] shadow-[0_6px_18px_-8px_rgba(255,170,0,0.7)]";
const PILL_OFF =
  "border-line bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-surface2)_100%,white_4%),var(--color-surface2))] text-dim";

// Tuiles en verre : s'adaptent au thème (encre à 8 % sur le fond, bord à 20 %).
const GLASS =
  "rounded-[18px] border border-[color-mix(in_srgb,var(--color-ink)_20%,transparent)] bg-[color-mix(in_srgb,var(--color-ink)_8%,transparent)] backdrop-blur-[14px]";
const TILE_LABEL = "flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.12em] text-dim";
// Champs sans cadre à l'intérieur des tuiles.
const BARE: React.CSSProperties = { border: "none", background: "transparent", padding: 0, boxShadow: "none", borderRadius: 0, width: "100%" };

const ICONS: Record<string, string> = {
  cal: "M3.5 8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3zM8 3v4M16 3v4M3.5 10h17",
  usr: "M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4.5 20c.8-4 3.7-6 7.5-6s6.7 2 7.5 6",
  at: "M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM9.5 9.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  grp: "M5.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M2.5 19c.6-3.4 3-5 6.5-5s5.9 1.6 6.5 5M15 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M17.5 14c2.4 0 3.6 1.3 4 4",
  cam: "M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM8.5 13a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0",
  ok: "m5 12.5 4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  Strongman: "M9 9V7a3 3 0 0 1 6 0v2M6 15a6 6 0 1 0 12 0a6 6 0 1 0-12 0",
  Hybrid: "M4 9h13l-3-3M20 15H7l3 3",
  Powerlifting: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M12 3v3M12 18v3M3 12h3M18 12h3",
  Running: "M12.5 4.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 21l3-6-3-3 2-4 4 2 3 3M11 15l3 2v4",
  Hyrox: "M3 18h14l4-3M6 18v-5h8v5M8 13V9h4",
  Trail: "m2 20 7-13 4 7 3-4 6 10z",
  Pilates: "M9.8 6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M4 19c3-1 5-4 8-4s5 3 8 4M12 9v6",
  Musculation: "M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12",
  Powerbuilding: "M4 20V11M10 20V4M16 20v-7M2 20h20",
  "Préparation physique": "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z",
};

function Ico({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg aria-hidden width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d={ICONS[name]} />
    </svg>
  );
}

function ageOf(birth?: string): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
}

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

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
      <div
        className="relative h-[78px] overflow-hidden rounded-xl"
        style={{
          background:
            "radial-gradient(circle at 72% 45%, rgba(255,179,0,0.4), transparent 55%), repeating-linear-gradient(35deg, color-mix(in srgb, var(--color-ink) 7%, transparent) 0 2px, transparent 2px 20px), color-mix(in srgb, var(--color-bg) 40%, transparent)",
        }}
      >
        <span aria-hidden className="absolute right-[26%] top-[34%] h-3.5 w-3.5 rounded-full bg-accent shadow-[0_0_0_5px_rgba(255,179,0,0.28),0_0_0_12px_rgba(255,179,0,0.1)]" />
        <span className="absolute bottom-2 left-3 right-12 truncate text-[14px] font-black">{value.label}</span>
        <button onClick={() => onChange(null)} aria-label="Retirer la localisation" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/35 text-dim hover:text-danger">
          <Ico name="x" className="text-[14px]" />
        </button>
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
              className="flex w-full items-center gap-2 border-b border-line/50 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-surface2"
            >
              <PinIcon className="shrink-0 text-dim" />
              {r.label}
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
      <section className="relative overflow-hidden rounded-[20px] border border-line bg-surface">
        {/* Ambiance : la photo floutée baigne toute la carte */}
        <div aria-hidden className="absolute inset-[-30px] bg-cover bg-center opacity-70 blur-[30px] saturate-150" style={{ backgroundImage: "url(/tiles/profile.jpg)" }} />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(255,110,20,0.28),transparent_55%),linear-gradient(180deg,transparent_35%,color-mix(in_srgb,var(--color-bg)_55%,transparent)),color-mix(in_srgb,var(--color-bg)_45%,transparent)]" />

        <div className="relative">
          {/* Couverture */}
          <div
            aria-hidden
            className="h-[190px] bg-cover"
            style={{
              backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.2), rgba(255,106,26,0.16)), url(/tiles/profile.jpg)",
              backgroundPosition: "center 38%",
              WebkitMaskImage: "linear-gradient(180deg, #000 55%, transparent 100%)",
              maskImage: "linear-gradient(180deg, #000 55%, transparent 100%)",
            }}
          />
          <h2 className="absolute left-[18px] top-4 text-[12px] font-black uppercase tracking-[0.14em] text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            Informations
          </h2>
          {p.photo && (
            <button onClick={removePhoto} className="absolute right-3.5 top-3.5 rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
              Retirer la photo
            </button>
          )}

          {/* Avatar + nom + puces */}
          <div className="relative -mt-[58px] px-4">
            <div className="relative h-[104px] w-[104px] rounded-full bg-[conic-gradient(from_200deg,#ffc53d,#ff6a1a,#ffc53d)] p-1 shadow-[0_10px_34px_-8px_rgba(255,140,0,0.9)]">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
                title="Changer la photo"
                className="grid h-full w-full place-items-center overflow-hidden rounded-full border-4 border-[#0d0f15] bg-surface2 transition active:scale-95 disabled:opacity-60"
              >
                {photoBusy ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : p.photo ? (
                  <img src={p.photo} alt="photo" className="h-full w-full object-cover" />
                ) : (
                  <Ico name="cam" className="text-[28px] text-accent" />
                )}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                aria-label="Changer la photo"
                className="absolute bottom-1 right-[-2px] grid h-[30px] w-[30px] place-items-center rounded-full border-[3px] border-[#0d0f15] bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[15px] text-[#1a1500]"
              >
                <Ico name="cam" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </div>

            <input
              value={p.name}
              onChange={set("name")}
              placeholder="Prénom Nom"
              aria-label="Prénom Nom"
              className="mt-2.5 !text-[28px] font-black tracking-tight"
              style={{ ...BARE, borderBottom: "1.5px solid color-mix(in srgb, var(--color-ink) 18%, transparent)", paddingBottom: 6, fontSize: 28 }}
            />
            {(ageOf(p.birthDate) !== null || p.location || p.instagram) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ageOf(p.birthDate) !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1.5 text-[12.5px] font-black text-accent"><Ico name="cal" />{ageOf(p.birthDate)} ans</span>
                )}
                {p.location && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1.5 text-[12.5px] font-black text-accent"><Ico name="pin" />{p.location.label.split(",")[0]}</span>
                )}
                {p.instagram && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1.5 text-[12.5px] font-black text-accent"><Ico name="at" />{p.instagram.replace(/^@/, "")}</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-5 p-3.5 pt-4">
            {/* Tuiles d'information */}
            <div className="grid grid-cols-2 gap-[9px]">
              <label className={`${GLASS} block p-3`}>
                <span className={TILE_LABEL}><Ico name="cal" className="text-[14px] text-accent" />Naissance</span>
                <input
                  type="date"
                  value={p.birthDate ?? ""}
                  onChange={set("birthDate")}
                  className="mt-2 block text-[16px] font-black"
                  style={{ ...BARE, height: 26 }}
                />
              </label>
              <div className={`${GLASS} p-3`}>
                <span className={TILE_LABEL}><Ico name="usr" className="text-[14px] text-accent" />Genre</span>
                <div className="mt-[7px] grid grid-cols-2 gap-0.5 rounded-full border border-line bg-black/25 p-[3px]">
                  {(["homme", "femme"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`rounded-full border py-[5px] text-[13px] font-black transition ${p.gender === g ? PILL_ON : "border-transparent text-dim"}`}
                    >
                      {g === "homme" ? "Homme" : "Femme"}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${GLASS} col-span-2 p-3`}>
                <span className={TILE_LABEL}><Ico name="at" className="text-[14px] text-accent" />Instagram</span>
                <div className="mt-2 flex items-center">
                  <span className="shrink-0 select-none pr-1 text-base text-dim" aria-hidden="true">@</span>
                  <input
                    value={(p.instagram ?? "").replace(/^@/, "")}
                    onChange={e => update(d => { d.profile.instagram = e.target.value ? `@${e.target.value.replace(/^@/, "")}` : ""; })}
                    placeholder="username"
                    className="text-[16px] font-black"
                    style={BARE}
                  />
                  {p.instagram && (
                    <a
                      href={`https://instagram.com/${(p.instagram ?? "").replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 pl-2 text-dim transition-opacity hover:opacity-70"
                      title="Voir le profil Instagram"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 6v2H5v11h11v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6zm11-3v7h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>

              <div className={`${GLASS} col-span-2 p-3`}>
                <span className={`${TILE_LABEL} mb-2`}><Ico name="pin" className="text-[14px] text-accent" />Localisation</span>
                <LocationPicker
                  value={p.location}
                  onChange={loc =>
                    update(d => { d.profile.location = loc ?? undefined; })
                  }
                />
              </div>

              {([
                { icon: "map", title: "Visible sur la carte", sub: "Carte de la communauté", on: !!p.mapConsent, toggle: () => update((d) => { d.profile.mapConsent = !d.profile.mapConsent; }) },
                { icon: "grp", title: "Partager avec le groupe", sub: "Anniversaire et records, visibles par ton coach et les autres sportifs", on: !!p.shareWins, toggle: () => update((d) => { d.profile.shareWins = !d.profile.shareWins; }) },
              ]).map((t) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={t.toggle}
                  role="switch"
                  aria-checked={t.on}
                  className={`${GLASS} col-span-2 flex items-center gap-3 p-3 text-left`}
                >
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-accent/20 text-[19px] text-accent"><Ico name={t.icon} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-black">{t.title}</span>
                    <span className="mt-px block text-[12px] leading-snug text-dim">{t.sub}</span>
                  </span>
                  <span className={`relative h-[30px] w-[50px] shrink-0 rounded-full border transition ${t.on ? "border-transparent bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] shadow-[0_0_16px_-2px_rgba(255,170,0,0.7)]" : "border-line bg-line/60"}`}>
                    <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${t.on ? "left-[23px]" : "left-[3px]"}`} />
                  </span>
                </button>
              ))}
            </div>

            {/* Sports */}
            <div>
              <span className="mb-2.5 flex items-center gap-2 px-0.5 text-[11px] font-black uppercase tracking-[0.14em] text-dim">
                Mes sports
                {sports.length > 0 && (
                  <span className="rounded-full bg-accent/20 px-2 text-[11px] tracking-normal text-accent">{sports.length}</span>
                )}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {SPORTS.map((sport, i) => {
                  const active = sports.includes(sport);
                  const wide = i === SPORTS.length - 1;
                  return (
                    <button
                      key={sport}
                      onClick={() => toggleSport(sport)}
                      aria-pressed={active}
                      className={`relative overflow-hidden rounded-2xl border p-[11px] text-[12.5px] font-black transition active:scale-[0.97] ${
                        wide ? "col-span-3 flex items-center gap-2.5 text-left" : "flex aspect-[1/1.05] flex-col justify-between text-left"
                      } ${
                        active
                          ? "border-transparent bg-gradient-to-br from-[#ffc53d] to-[#ff7a00] text-[#1a1100] shadow-[0_10px_26px_-10px_rgba(255,140,0,0.9)]"
                          : "border-[color-mix(in_srgb,var(--color-ink)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-ink)_7%,transparent)]"
                      }`}
                    >
                      {active && <span aria-hidden className="pointer-events-none absolute -right-[18px] -top-[18px] h-[60px] w-[60px] rounded-full bg-white/25" />}
                      <Ico name={sport} className={`text-[22px] ${active ? "text-[#1a1100]" : "text-dim"}`} />
                      <span className="leading-tight">{sport}</span>
                      <span
                        aria-hidden
                        className={`absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full border-[1.5px] text-[12px] ${
                          active ? "border-[#1a1100] bg-[#1a1100] text-[#ffc53d]" : "border-[color-mix(in_srgb,var(--color-ink)_30%,transparent)]"
                        } ${wide ? "!static ml-auto" : ""}`}
                      >
                        {active && <Ico name="ok" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Badges épinglés — visible si des défis existent */}
      {challenges.length > 0 && (
        <section className={CARD}>
          <h2 className="mb-4 text-xl font-black">Mes badges</h2>

          <div className="flex justify-center gap-6">
            {[0, 1, 2].map((slot) => {
              const id = pinnedIds[slot];
              const ch = id ? challenges.find((c) => c.id === id) : null;
              const color = ch?.color ?? "#a855f7";

              return (
                <div key={slot} className="relative flex flex-col items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (ch) {
                        setActiveTooltip(slot); // ouvre le modal détail du badge
                      } else {
                        openPicker(slot);
                      }
                    }}
                    style={
                      ch
                        ? {
                            background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${color} 45%, var(--color-surface2)), var(--color-surface2) 70%)`,
                            borderColor: `color-mix(in srgb, ${color} 60%, transparent)`,
                            boxShadow: `0 8px 22px -10px ${color}`,
                          }
                        : {}
                    }
                    className={`flex h-[76px] w-[76px] items-center justify-center rounded-full border-2 transition active:scale-95 ${
                      ch ? "" : "border-line bg-surface2 hover:border-accent/60"
                    }`}
                  >
                    {ch ? (
                      ch.badgeImage ? (
                        <img src={ch.badgeImage} alt={ch.title} className="h-14 w-14 rounded-full object-contain" />
                      ) : (
                        <span style={{ fontSize: 30 }}>{ch.icon}</span>
                      )
                    ) : (
                      <span className="text-[28px] font-black text-accent/60">+</span>
                    )}
                  </button>

                  <p className="max-w-[84px] text-center text-[11px] font-bold leading-tight text-dim">
                    {ch ? ch.title : <span className="opacity-60">Choisir</span>}
                  </p>
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

      {/* Modal détail d'un badge épinglé (grande image + condition + date de déblocage) */}
      {activeTooltip !== null && (() => {
        const slot = activeTooltip;
        const id = pinnedIds[slot];
        const ch = id ? challenges.find((c) => c.id === id) : null;
        if (!ch) return null;
        const ub = unlockedBadges.find((b) => b.challengeId === ch.id);
        const color = ch.color ?? "#a855f7";
        const prog = computeChallengeProgress(ch, state);
        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
            onClick={() => setActiveTooltip(null)}
          >
            <div
              className="w-full max-w-sm overflow-hidden rounded-t-3xl border-t border-line bg-surface sm:rounded-3xl sm:border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* En-tête coloré + grande image/icône */}
              <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center" style={{ background: `linear-gradient(160deg, ${color}, ${color}cc)` }}>
                <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full text-6xl shadow-lg" style={{ background: "rgba(255,255,255,0.22)" }}>
                  {ch.badgeImage ? (
                    <img src={ch.badgeImage} alt={ch.title} className="h-full w-full object-contain" />
                  ) : ch.icon}
                </div>
                <h3 className="mt-4 text-xl font-bold text-white">{ch.title}</h3>
                {ch.description && <p className="mt-1 text-[13px] text-white/80">{ch.description}</p>}
              </div>

              {/* Corps : comment / quand */}
              <div className="space-y-3 p-5">
                <div className="rounded-xl bg-surface2 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-dim">Comment l&apos;obtenir</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">{conditionText(ch, library.exercises)}</p>
                </div>
                <div className="rounded-xl bg-surface2 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-dim">Débloqué</p>
                  <p className="mt-0.5 text-sm font-semibold" style={{ color }}>
                    {ub
                      ? `le ${new Date(ub.unlockedAt + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
                      : `Pas encore (${prog.current}/${prog.target})`}
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openPicker(slot)}
                    className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-semibold text-dim hover:text-ink"
                  >
                    Changer
                  </button>
                  <button
                    onClick={() => { setPinned(slot, null); setActiveTooltip(null); }}
                    className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-semibold text-danger"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                        <img src={ch.badgeImage} alt={ch.title} className="h-12 w-12 rounded-full object-contain" />
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
