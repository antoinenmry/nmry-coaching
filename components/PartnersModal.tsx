"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import type { PartnerLink } from "@/lib/types";

// Palette de couleurs pour les avatars
const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#a855f7", "#ec4899",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(/[\s&-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

function displayUrl(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const EMPTY_FORM: Omit<PartnerLink, "id"> = { name: "", url: "", code: "", discount: "" };

export default function PartnersModal({ onClose }: { onClose: () => void }) {
  const { library, updateLibrary, role, previewAsClient } = useData();
  const isCoach = !previewAsClient && (role === "coach" || role === "admin");
  const partners: PartnerLink[] = library.partnerLinks ?? [];

  const [editingId, setEditingId] = useState<string | null>(null); // null = liste, "new" = ajout, id = édition
  const [form, setForm] = useState<Omit<PartnerLink, "id">>(EMPTY_FORM);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function openEdit(p: PartnerLink) {
    setForm({ name: p.name, url: p.url, code: p.code ?? "", discount: p.discount ?? "" });
    setEditingId(p.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function save() {
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    updateLibrary((lib) => {
      const links = lib.partnerLinks ?? [];
      if (editingId === "new") {
        links.push({
          id: crypto.randomUUID(),
          name: form.name.trim(),
          url: normalizeUrl(form.url.trim()),
          code: form.code?.trim() || undefined,
          discount: form.discount?.trim() || undefined,
        });
        lib.partnerLinks = links;
      } else {
        const idx = links.findIndex((p) => p.id === editingId);
        if (idx !== -1) {
          links[idx] = {
            id: editingId!,
            name: form.name.trim(),
            url: normalizeUrl(form.url.trim()),
            code: form.code?.trim() || undefined,
            discount: form.discount?.trim() || undefined,
          };
        }
        lib.partnerLinks = links;
      }
    });
    setSaving(false);
    cancelEdit();
  }

  function remove(id: string) {
    updateLibrary((lib) => {
      lib.partnerLinks = (lib.partnerLinks ?? []).filter((p) => p.id !== id);
    });
  }

  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const showEmpty = partners.length === 0 && !editingId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-3xl border-t border-line bg-surface sm:rounded-3xl sm:border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">🎁 Partenaires</h2>
            <p className="text-[12px] text-dim">Codes promo exclusifs</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2 text-base">✕</button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* État vide */}
          {showEmpty && (
            <div className="py-10 text-center">
              <p className="text-4xl mb-3">🎁</p>
              <p className="font-semibold text-ink">Aucun partenaire pour l'instant</p>
              {isCoach && (
                <p className="mt-1 text-[13px] text-dim">
                  Ajoute tes partenaires et codes promo — tes sportifs y auront accès ici.
                </p>
              )}
            </div>
          )}

          {/* Liste des partenaires */}
          {partners.map((p) => {
            const color = avatarColor(p.name);
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-surface2">
                {isEditing ? (
                  <EditForm
                    form={form}
                    setForm={setForm}
                    onSave={save}
                    onCancel={cancelEdit}
                    saving={saving}
                  />
                ) : (
                  <div className="p-4">
                    {/* Ligne principale */}
                    <div className="mb-3 flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-extrabold text-white shadow-sm"
                        style={{ background: color }}
                      >
                        {initials(p.name)}
                      </div>
                      {/* Nom + URL */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink">{p.name}</p>
                        <a
                          href={normalizeUrl(p.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 truncate text-[12px] text-accent hover:underline"
                        >
                          <span className="truncate">{displayUrl(p.url)}</span>
                          <span className="shrink-0 text-[10px]">↗</span>
                        </a>
                      </div>
                      {/* Actions coach */}
                      {isCoach && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-sm hover:bg-line"
                          >✏️</button>
                          <button
                            onClick={() => remove(p.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-sm hover:bg-danger/15"
                          >🗑️</button>
                        </div>
                      )}
                    </div>

                    {/* Code promo + description */}
                    {(p.code || p.discount) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {p.code && (
                          <button
                            onClick={() => copyCode(p.code!, p.id)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-mono font-bold transition-all ${
                              copied === p.id
                                ? "border-ok/40 bg-ok/10 text-ok"
                                : "border-line bg-surface hover:border-accent/40 hover:bg-accent/5"
                            }`}
                          >
                            <span className="tracking-widest">{p.code}</span>
                            <span className="text-[14px]">{copied === p.id ? "✅" : "📋"}</span>
                          </button>
                        )}
                        {p.discount && (
                          <span className="rounded-full border border-ok/30 bg-ok/10 px-3 py-1.5 text-[13px] font-semibold text-ok">
                            {p.discount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Formulaire d'ajout */}
          {editingId === "new" && (
            <div className="overflow-hidden rounded-2xl border border-accent/30 bg-surface2">
              <EditForm
                form={form}
                setForm={setForm}
                onSave={save}
                onCancel={cancelEdit}
                saving={saving}
                isNew
              />
            </div>
          )}
        </div>

        {/* Footer coach */}
        {isCoach && !editingId && (
          <div className="border-t border-line/60 px-5 py-4">
            <button
              onClick={openNew}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-3 text-[13px] font-semibold text-dim transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
            >
              <span className="text-base">＋</span>
              Ajouter un partenaire
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Formulaire d'ajout / édition ────────────────────────────────────────────
function EditForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  isNew = false,
}: {
  form: Omit<PartnerLink, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<PartnerLink, "id">>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const canSave = form.name.trim().length > 0 && form.url.trim().length > 0;

  return (
    <div className="space-y-3 p-4">
      {isNew && (
        <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Nouveau partenaire</p>
      )}

      <div>
        <label className="mb-1 block text-[12px] font-semibold text-dim">Nom de l'entreprise *</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="ex: Whey & Co"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
          autoFocus
        />
      </div>

      <div>
        <label className="mb-1 block text-[12px] font-semibold text-dim">Lien *</label>
        <input
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="https://..."
          type="url"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[12px] font-semibold text-dim">Code promo</label>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="ex: NMRY10"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-accent"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[12px] font-semibold text-dim">Remise</label>
          <input
            value={form.discount}
            onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
            placeholder="ex: -10% sur tout"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-semibold text-dim hover:bg-surface"
        >
          Annuler
        </button>
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="flex-1 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-[#1a1500] disabled:opacity-40"
        >
          {saving ? "…" : isNew ? "✓ Ajouter" : "✓ Enregistrer"}
        </button>
      </div>
    </div>
  );
}
