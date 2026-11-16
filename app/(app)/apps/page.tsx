"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { canEditAnnouncements } from "@/lib/config";
import { appsOf, safeUrl } from "@/lib/apps";
import type { AppShowcase } from "@/lib/types";

const EMPTY: AppShowcase = { id: "", name: "", tagline: "", status: "soon" };

function AppIcon({ app }: { app: AppShowcase }) {
  const icon = safeUrl(app.icon);
  if (icon) {
    return <img src={icon} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />;
  }
  return (
    <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-2xl font-black text-[#1a1500]">
      {app.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function AppForm({ initial, onSave, onDelete, onClose }: {
  initial: AppShowcase;
  onSave: (app: AppShowcase) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const set = (patch: Partial<AppShowcase>) => setDraft((d) => ({ ...d, ...patch }));
  const badUrl = (u?: string) => !!u?.trim() && !safeUrl(u);
  const invalid = !draft.name.trim() || badUrl(draft.url) || badUrl(draft.icon);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="app-form-title" className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl border-t border-line bg-surface sm:rounded-3xl sm:border">
        <h2 id="app-form-title" className="shrink-0 p-5 pb-3 text-lg font-black">
          {initial.id ? "Modifier l'appli" : "Ajouter une appli"}
        </h2>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5">
          <label className="block text-sm font-semibold">
            Nom
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className="mt-1" autoFocus />
          </label>
          <label className="block text-sm font-semibold">
            Description
            <textarea value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} rows={3} className="mt-1 !min-h-0" />
          </label>
          <fieldset>
            <legend className="text-sm font-semibold">Statut</legend>
            <div className="mt-1 flex rounded-full bg-surface2 p-1">
              {(["soon", "available"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set({ status: s })}
                  aria-pressed={draft.status === s}
                  className={`min-h-10 flex-1 rounded-full text-sm font-black ${
                    draft.status === s ? "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]" : "text-dim"
                  }`}
                >
                  {s === "soon" ? "Bientôt disponible" : "Disponible"}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">
            Lien (App Store, site…)
            <input value={draft.url ?? ""} onChange={(e) => set({ url: e.target.value })} type="url" placeholder="https://" className="mt-1" />
            {badUrl(draft.url) && <span className="mt-1 block text-xs text-danger">Le lien doit commencer par https://</span>}
          </label>
          <label className="block text-sm font-semibold">
            Icône (adresse de l&apos;image)
            <input value={draft.icon ?? ""} onChange={(e) => set({ icon: e.target.value })} type="url" placeholder="https://" className="mt-1" />
            {badUrl(draft.icon) && <span className="mt-1 block text-xs text-danger">L&apos;adresse doit commencer par https://</span>}
          </label>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-line p-5 pt-3">
          {onDelete && (
            <button onClick={onDelete} className="rounded-full bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
              Supprimer
            </button>
          )}
          <button onClick={onClose} className="flex-1 rounded-full bg-surface2 py-3 text-sm font-bold">Annuler</button>
          <button
            onClick={() => onSave({ ...draft, name: draft.name.trim(), tagline: draft.tagline.trim(), url: draft.url?.trim() || undefined, icon: draft.icon?.trim() || undefined })}
            disabled={invalid}
            className="flex-1 rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] py-3 text-sm font-black text-[#1a1500] disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppsPage() {
  const { library, updateLibrary, me } = useData();
  const canEdit = canEditAnnouncements(me?.email);
  const isElevated = me?.role === "coach" || me?.role === "admin";
  const apps = appsOf(library);
  const [editing, setEditing] = useState<AppShowcase | null>(null);

  function save(app: AppShowcase) {
    updateLibrary((l) => {
      const list = (l.apps ??= appsOf(library).map((a) => ({ ...a })));
      if (!app.id) list.push({ ...app, id: crypto.randomUUID() });
      else {
        const i = list.findIndex((a) => a.id === app.id);
        if (i === -1) list.push(app); else list[i] = app;
      }
    });
    setEditing(null);
  }

  function remove(id: string) {
    updateLibrary((l) => { l.apps = appsOf(l).filter((a) => a.id !== id); });
    setEditing(null);
  }

  if (!isElevated && !library.appsVisible) {
    return <p className="py-10 text-center text-dim">Cette page n&apos;est pas encore disponible.</p>;
  }

  return (
    <div className="space-y-3">
      {isElevated && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-bold">Visible par les sportifs</span>
            <span className="block text-xs text-dim">
              {library.appsVisible ? "Les sportifs voient le bouton et la page." : "Masqué : seuls les coachs voient cette page."}
            </span>
          </span>
          {canEdit ? (
            <button
              role="switch"
              aria-checked={!!library.appsVisible}
              aria-label="Visible par les sportifs"
              onClick={() => updateLibrary((l) => { l.appsVisible = !l.appsVisible; })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${library.appsVisible ? "bg-ok" : "bg-surface2 ring-1 ring-line"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${library.appsVisible ? "left-6" : "left-1"}`} />
            </button>
          ) : (
            <span className="shrink-0 text-xs font-bold text-dim">{library.appsVisible ? "Visible" : "Masqué"}</span>
          )}
        </div>
      )}
      <p className="text-sm text-dim">Les applis créées par l&apos;équipe NMRY.</p>

      {apps.length === 0 && <p className="py-10 text-center text-dim">Aucune appli pour l&apos;instant.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {apps.map((app) => {
          const link = safeUrl(app.url);
          return (
            <article key={app.id} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
              <AppIcon app={app} />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                <h2 className="text-lg font-black leading-tight">{app.name}</h2>
                {app.tagline && <p className="whitespace-pre-wrap text-sm text-dim">{app.tagline}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {app.status === "available" && link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] px-4 py-2 text-sm font-black text-[#1a1500]"
                    >
                      Découvrir
                    </a>
                  ) : (
                    <span className="rounded-full border border-accent/50 px-3 py-1 text-xs font-black text-accent">
                      {app.status === "available" ? "Disponible" : "Bientôt disponible"}
                    </span>
                  )}
                  {canEdit && (
                    <button onClick={() => setEditing(app)} className="px-2 py-1 text-xs font-bold text-dim underline underline-offset-2">
                      Modifier
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {canEdit && (
        <button
          onClick={() => setEditing(EMPTY)}
          className="w-full rounded-2xl border border-dashed border-line py-4 text-sm font-bold text-dim hover:text-ink"
        >
          Ajouter une appli
        </button>
      )}

      {editing && (
        <AppForm
          initial={editing}
          onSave={save}
          onDelete={editing.id ? () => remove(editing.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
