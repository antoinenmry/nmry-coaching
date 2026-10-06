"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";
import type { MerchItem } from "@/lib/types";

const GOLD = "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]";
const LABEL = "mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.12em] text-dim";
const MAX_PHOTOS = 8;
const BUCKET = "badges"; // lecture publique ; écriture réservée aux coachs/admin (dossier merch/)

const priceNum = (s: string) => {
  const n = parseFloat(s.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
export const formatPrice = (s: string) => {
  const n = priceNum(s);
  return n === null ? s : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};
const photosOf = (m: MerchItem) => (m.images?.length ? m.images : m.image ? [m.image] : []);

function Svg({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg aria-hidden width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d={d} />
    </svg>
  );
}
const I = {
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  bag: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
  img: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9.5a.5.5 0 1 0 1 0a.5.5 0 1 0-1 0",
  up: "M12 19V5M6 11l6-6 6 6",
};

/** Carrousel de photos : défilement tactile avec points. */
function PhotoCarousel({ photos, name, ratio, onTap }: { photos: string[]; name: string; ratio?: string; onTap?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  // Cadrage : la tuile prend la proportion de la 1re photo (bornée), les photos ne sont jamais recadrées.
  const [r, setR] = useState<number | null>(null);
  const box = ratio ?? "";
  const boxStyle = ratio ? undefined : { aspectRatio: String(r ?? 0.8) };
  if (photos.length === 0) {
    return (
      <button onClick={onTap} style={boxStyle} className={`${box} grid w-full place-items-center bg-surface2 text-[#9aa3b2]`}>
        <Svg d={I.img} className="text-4xl" />
      </button>
    );
  }
  return (
    <div style={boxStyle} className={`relative ${box} w-full overflow-hidden bg-surface2`}>
      <div
        ref={ref}
        onScroll={() => { const el = ref.current; if (el) setI(Math.round(el.scrollLeft / el.clientWidth)); }}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((src, k) => (
          // Photo entière (jamais recadrée) ; si les formats diffèrent, le fond reprend la photo floutée.
          <div key={src + k} className="relative h-full w-full shrink-0 snap-center overflow-hidden" onClick={onTap}>
            <div aria-hidden className="absolute inset-[-12px] bg-cover bg-center opacity-90 blur-xl" style={{ backgroundImage: `url(${src})` }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${name} ${k + 1}`} loading="lazy" draggable={false}
              onLoad={k === 0 ? (e) => { const t = e.currentTarget; if (t.naturalHeight) setR(Math.min(1.6, Math.max(0.5, t.naturalWidth / t.naturalHeight))); } : undefined}
              className="relative h-full w-full object-contain" />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {photos.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.45)] transition-all ${k === i ? "w-4 bg-white" : "w-1.5 bg-white/55"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Compresse une photo (max 1400 px, JPEG 0.82) puis l'envoie dans Storage ; renvoie l'URL publique. */
async function uploadPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
  if (!blob) throw new Error("Photo illisible");
  const supabase = createClient();
  const path = `merch/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error("Envoi impossible : " + error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ProductForm({ initial, onSave, onDelete, onClose }: {
  initial: MerchItem | null; onSave: (m: MerchItem) => void; onDelete?: () => void; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [desc, setDesc] = useState(initial?.comment ?? "");
  const [photos, setPhotos] = useState<string[]>(initial ? photosOf(initial) : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, room)) urls.push(await uploadPhoto(f));
      setPhotos((p) => [...p, ...urls]);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  const canSave = !!name.trim() && !!price.trim() && !busy;
  const save = () => {
    if (!canSave) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(), price: price.trim(),
      image: photos[0] ?? "", images: photos,
      url: initial?.url ?? "", comment: desc.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <Sheet onClose={onClose}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
        <h2 className="text-lg font-black">{initial ? "Modifier le produit" : "Nouveau produit"}</h2>
        <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><Svg d={I.x} /></button>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <span className={LABEL}>Photos {photos.length > 0 && `· ${photos.length}/${MAX_PHOTOS}`}</span>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {photos.map((src, k) => (
              <div key={src} className="relative h-24 w-[76px] shrink-0 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                {k === 0 && <span className={`absolute left-1 top-1 rounded-full px-1.5 text-[9px] font-black ${GOLD}`}>Couverture</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 px-1 py-0.5">
                  {k > 0 ? (
                    <button type="button" aria-label="Mettre en premier" onClick={() => setPhotos((p) => [p[k], ...p.filter((_, j) => j !== k)])} className="text-white"><Svg d={I.up} /></button>
                  ) : <span />}
                  <button type="button" aria-label="Retirer la photo" onClick={() => setPhotos((p) => p.filter((_, j) => j !== k))} className="text-white"><Svg d={I.x} /></button>
                </div>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                className="grid h-24 w-[76px] shrink-0 place-items-center rounded-xl border border-line bg-surface2 text-dim disabled:opacity-60">
                {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /> : <span className="flex flex-col items-center gap-1 text-[11px] font-black"><Svg d={I.plus} className="text-2xl text-accent" />Ajouter</span>}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
        </div>

        <label className="block">
          <span className={LABEL}>Titre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="T-shirt NMRY - Noir" maxLength={80} />
        </label>
        <label className="block">
          <span className={LABEL}>Prix (€)</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="40" maxLength={12} />
        </label>
        <label className="block">
          <span className={LABEL}>Description (facultatif)</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Coton, coupe regular, tailles S à XXL…" className="w-full resize-none" />
        </label>

        <button onClick={save} disabled={!canSave} className={`w-full rounded-full py-3 text-[14px] font-black disabled:opacity-40 ${GOLD}`}>
          {initial ? "Enregistrer" : "Ajouter à la boutique"}
        </button>
        {onDelete && (
          confirmDelete ? (
            <div className="flex gap-2">
              <button onClick={onDelete} className="flex-1 rounded-full bg-danger py-2.5 text-[13px] font-black text-white">Supprimer définitivement</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-full border border-line px-4 text-[13px] font-black text-dim">Annuler</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-[13px] font-black text-danger"><Svg d={I.trash} />Supprimer le produit</button>
          )
        )}
      </div>
    </Sheet>
  );
}

function ProductDetail({ item, isCoach, onEdit, onClose }: { item: MerchItem; isCoach: boolean; onEdit: () => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="relative">
        <PhotoCarousel photos={photosOf(item)} name={item.name} />
        <button onClick={onClose} aria-label="Fermer" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-[#111]"><Svg d={I.x} /></button>
      </div>
      <div className="space-y-2 p-5">
        <h2 className="text-[15px] font-black uppercase tracking-[0.12em]">{item.name}</h2>
        <p className="text-[15px] tracking-[0.08em] text-dim">{formatPrice(item.price)}</p>
        {item.comment && <p className="whitespace-pre-wrap pt-1 text-[13.5px] leading-relaxed text-dim">{item.comment}</p>}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className={`mt-3 block rounded-full py-3 text-center text-[14px] font-black ${GOLD}`}>Commander</a>
        )}
        {isCoach && (
          <button onClick={onEdit} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-[13px] font-black"><Svg d={I.edit} />Modifier</button>
        )}
      </div>
    </Sheet>
  );
}

type Sort = "recent" | "asc" | "desc";
type Density = 4 | 2 | 1;

export default function Boutique({ isCoach }: { isCoach: boolean }) {
  const { library, updateLibrary } = useData();
  const items = library.merchandiseItems ?? [];
  const [sort, setSort] = useState<Sort>("recent");
  const [density, setDensity] = useState<Density>(2);
  // Écran large : 4 colonnes par défaut (téléphone : 2).
  useEffect(() => { if (window.matchMedia("(min-width: 640px)").matches) setDensity(4); }, []);
  const [detail, setDetail] = useState<MerchItem | null>(null);
  const [form, setForm] = useState<MerchItem | "new" | null>(null);

  const sorted = useMemo(() => {
    const a = [...items];
    if (sort === "asc") a.sort((x, y) => (priceNum(x.price) ?? 0) - (priceNum(y.price) ?? 0));
    else if (sort === "desc") a.sort((x, y) => (priceNum(y.price) ?? 0) - (priceNum(x.price) ?? 0));
    else a.sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? ""));
    return a;
  }, [items, sort]);

  function save(m: MerchItem) {
    updateLibrary((l) => {
      const list = l.merchandiseItems ?? [];
      l.merchandiseItems = list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m];
    });
    setForm(null); setDetail(null);
  }
  function remove(id: string) {
    updateLibrary((l) => { l.merchandiseItems = (l.merchandiseItems ?? []).filter((x) => x.id !== id); });
    setForm(null); setDetail(null);
  }

  const seg = "rounded-full px-3 py-1.5 text-[12px] font-black transition";
  return (
    <div>
      {/* Barre d'outils : nombre de produits, densité, tri */}
      <div className="mb-4 flex items-center gap-2 border-y border-line py-2.5">
        <div className="flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label="Affichage">
          {([4, 2, 1] as const).map((d) => (
            <button key={d} onClick={() => setDensity(d)} aria-pressed={density === d}
              className={`${seg} ${density === d ? "bg-surface2 text-ink shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-dim"}`}>
              {d} col.
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] font-black uppercase tracking-[0.14em] text-dim">{items.length} produit{items.length > 1 ? "s" : ""}</span>
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-dim">
          Trier par
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="!w-auto rounded-full !py-1.5 text-[12px] font-bold normal-case tracking-normal text-ink">
            <option value="recent">Nouveautés</option>
            <option value="asc">Prix croissant</option>
            <option value="desc">Prix décroissant</option>
          </select>
        </label>
        {isCoach && (
          <button onClick={() => setForm("new")} aria-label="Ajouter un produit"
            className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-black shadow-[0_6px_18px_-6px_rgba(255,170,0,0.7)] ${GOLD}`}>
            <Svg d={I.plus} className="text-lg" />Produit
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface2 text-2xl text-dim"><Svg d={I.bag} /></span>
          <p className="mt-3 font-black">La boutique est vide</p>
          <p className="mt-1 text-[13px] text-dim">{isCoach ? "Ajoute ton premier produit avec « Produit »." : "Les produits arrivent bientôt."}</p>
        </div>
      ) : (
        <div className={`grid items-start gap-x-3 gap-y-6 ${density === 4 ? "grid-cols-4" : density === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {sorted.map((m) => (
            <article key={m.id} className="min-w-0">
              <div className="relative overflow-hidden">
                <PhotoCarousel photos={photosOf(m)} name={m.name} onTap={() => setDetail(m)} />
                <button onClick={() => setDetail(m)} aria-label={`Voir ${m.name}`}
                  className={`absolute bottom-2 right-2 grid place-items-center ${density === 4 ? "h-7 w-7" : "h-9 w-9"} bg-white text-[#111] shadow-[0_2px_10px_rgba(0,0,0,0.25)] transition active:scale-95`}>
                  <Svg d={I.plus} className="text-lg" />
                </button>
              </div>
              <button onClick={() => setDetail(m)} className="mt-2.5 block w-full text-center">
                <span className={`block truncate font-black uppercase ${density === 4 ? "text-[10.5px] tracking-[0.1em]" : "text-[12px] tracking-[0.14em]"}`}>{m.name}</span>
                <span className="mt-1 block text-[12.5px] tracking-[0.1em] text-dim">{formatPrice(m.price)}</span>
              </button>
            </article>
          ))}
        </div>
      )}

      {detail && !form && <ProductDetail item={detail} isCoach={isCoach} onEdit={() => setForm(detail)} onClose={() => setDetail(null)} />}
      {form && (
        <ProductForm
          initial={form === "new" ? null : form}
          onSave={save}
          onDelete={form !== "new" ? () => remove(form.id) : undefined}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
