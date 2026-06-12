"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import type { PartnerLink, ShopItem, TrainingPlan } from "@/lib/types";
import { countProgramSessions } from "@/lib/program";

/* ── Helpers ────────────────────────────────────────────────────────────── */

const PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#a855f7","#ec4899"];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return PALETTE[h % PALETTE.length];
}

function initials(name: string) {
  return name.split(/[\s&\-]+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function normalizeUrl(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

function displayUrl(url: string) {
  try { return new URL(normalizeUrl(url)).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

/* ── Composant principal ────────────────────────────────────────────────── */

type TabId = "parrainage" | "plan" | "shop";

export default function ShopPage() {
  const { library, updateLibrary, role, previewAsClient } = useData();
  const isCoach = !previewAsClient && (role === "coach" || role === "admin");
  const tabsVisible = library.shopTabsVisible ?? { plan: false, shop: false };

  // Onglets visibles selon le rôle
  const visibleTabs = useMemo<{ id: TabId; label: string; locked?: boolean }[]>(() => {
    const tabs: { id: TabId; label: string; locked?: boolean }[] = [
      { id: "parrainage", label: "🤝 Parrainage" },
    ];
    if (isCoach || tabsVisible.plan) tabs.push({ id: "plan", label: "📋 Plans", locked: isCoach && !tabsVisible.plan });
    if (isCoach || tabsVisible.shop) tabs.push({ id: "shop", label: "🛒 Shop", locked: isCoach && !tabsVisible.shop });
    return tabs;
  }, [isCoach, tabsVisible]);

  const [activeTab, setActiveTab] = useState<TabId>("parrainage");
  const currentTab = visibleTabs.find((t) => t.id === activeTab) ? activeTab : "parrainage";

  function toggleTab(tab: "plan" | "shop") {
    updateLibrary((lib) => {
      const cur = lib.shopTabsVisible ?? { plan: false, shop: false };
      lib.shopTabsVisible = { ...cur, [tab]: !cur[tab] };
    });
  }

  return (
    <div className="pb-24">
      {/* En-tête page */}
      <div className="mb-6">
        <p className="text-[13px] text-dim">Codes promo, produits & avantages exclusifs</p>
      </div>

      {/* Barre d'onglets */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition",
              currentTab === tab.id
                ? "bg-accent text-[#1a1500] shadow-sm"
                : "bg-surface2 text-dim hover:text-ink",
            ].join(" ")}
          >
            {tab.label}
            {tab.locked && <span className="text-[10px] opacity-60">🔒</span>}
          </button>
        ))}
      </div>

      {/* Contenu des onglets */}
      {currentTab === "parrainage" && <ParrainageTab isCoach={isCoach} />}
      {currentTab === "plan" && <PlanTab isCoach={isCoach} />}
      {currentTab === "shop" && <ShopTab isCoach={isCoach} />}

      {/* Panneau gestion onglets — coach uniquement */}
      {isCoach && (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-dim">⚙ Activation des onglets</p>
          <div className="space-y-2.5">
            {(["plan", "shop"] as const).map((tab) => (
              <div key={tab} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{tab === "plan" ? "📋 Plans" : "🛒 Shop"}</p>
                  <p className="text-[12px] text-dim">
                    {tabsVisible[tab] ? "Visible par tous les sportifs" : "Masqué aux sportifs"}
                  </p>
                </div>
                <button
                  onClick={() => toggleTab(tab)}
                  className={[
                    "relative h-7 w-12 rounded-full transition-colors",
                    tabsVisible[tab] ? "bg-ok" : "bg-surface2",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                      tabsVisible[tab] ? "left-6" : "left-1",
                    ].join(" ")}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ONGLET PARRAINAGE
══════════════════════════════════════════════════════════════════════════ */

const EMPTY_PARTNER: Omit<PartnerLink, "id"> = { name: "", url: "", code: "", discount: "", comment: "" };

function ParrainageTab({ isCoach }: { isCoach: boolean }) {
  const { library, updateLibrary } = useData();
  const partners = library.partnerLinks ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<PartnerLink, "id">>(EMPTY_PARTNER);
  const [copied, setCopied] = useState<string | null>(null);

  function openNew() { setForm(EMPTY_PARTNER); setEditingId("new"); }
  function openEdit(p: PartnerLink) {
    setForm({ name: p.name, url: p.url, code: p.code ?? "", discount: p.discount ?? "", comment: p.comment ?? "", color: p.color });
    setEditingId(p.id);
  }
  function cancel() { setEditingId(null); }

  function save() {
    if (!form.name.trim() || !form.url.trim()) return;
    updateLibrary((lib) => {
      const links = lib.partnerLinks ?? [];
      const entry: PartnerLink = {
        id: editingId === "new" ? crypto.randomUUID() : editingId!,
        name: form.name.trim(),
        url: normalizeUrl(form.url.trim()),
        code: form.code?.trim() || undefined,
        discount: form.discount?.trim() || undefined,
        comment: form.comment?.trim() || undefined,
        color: form.color || undefined,
      };
      if (editingId === "new") { lib.partnerLinks = [...links, entry]; }
      else { lib.partnerLinks = links.map((l) => l.id === editingId ? entry : l); }
    });
    cancel();
  }

  function remove(id: string) {
    updateLibrary((lib) => { lib.partnerLinks = (lib.partnerLinks ?? []).filter((p) => p.id !== id); });
  }

  function copy(code: string, id: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      {partners.length === 0 && !editingId && (
        <EmptyState emoji="🤝" title="Aucun partenaire" subtitle={isCoach ? "Ajoute tes premiers partenaires — tes sportifs verront leurs codes promo ici." : "Aucun partenaire disponible pour l'instant."} />
      )}

      {partners.map((p) => {
        if (editingId === p.id) {
          return (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-accent/30 bg-surface2">
              <PartnerForm form={form} setForm={setForm} onSave={save} onCancel={cancel} />
            </div>
          );
        }
        const color = p.color ?? avatarColor(p.name);
        return (
          <div key={p.id} className="overflow-hidden rounded-2xl border border-line shadow-sm">
            {/* Bannière gradient */}
            <div
              className="relative overflow-hidden p-5"
              style={{ background: `linear-gradient(135deg, ${color}dd 0%, ${color}88 100%)` }}
            >
              {/* Cercles décoratifs */}
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-4 -right-2 h-16 w-16 rounded-full bg-white/5" />

              <div className="relative flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow"
                  style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}
                >
                  {initials(p.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">{p.name}</p>
                  <a href={normalizeUrl(p.url)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[12px] text-white/75 hover:text-white">
                    <span className="truncate">{displayUrl(p.url)}</span>
                    <span>↗</span>
                  </a>
                </div>
                {isCoach && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => openEdit(p)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-sm backdrop-blur-sm hover:bg-white/30">✏️</button>
                    <button onClick={() => remove(p.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-sm backdrop-blur-sm hover:bg-red-500/50">🗑️</button>
                  </div>
                )}
              </div>
            </div>

            {/* Corps de la carte */}
            <div className="bg-surface p-4 space-y-3">
              {/* Code promo */}
              {p.code && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-dim">Code exclusif</p>
                  <button
                    onClick={() => copy(p.code!, p.id)}
                    className={[
                      "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 transition-all",
                      copied === p.id
                        ? "border-ok/50 bg-ok/10"
                        : "border-dashed border-line hover:border-accent/40 hover:bg-accent/5",
                    ].join(" ")}
                  >
                    <span className={`font-mono text-xl font-black tracking-[0.25em] ${copied === p.id ? "text-ok" : "text-ink"}`}>
                      {p.code}
                    </span>
                    <span className="text-xl">{copied === p.id ? "✅" : "📋"}</span>
                  </button>
                </div>
              )}

              {/* Remise */}
              {p.discount && (
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-ok/30 bg-ok/10 px-3 py-1 text-[13px] font-bold text-ok">
                    🏷️ {p.discount}
                  </span>
                </div>
              )}

              {/* Commentaire */}
              {p.comment && (
                <p className="border-l-2 border-line pl-3 text-[13px] italic text-dim">{p.comment}</p>
              )}
            </div>
          </div>
        );
      })}

      {editingId === "new" && (
        <div className="overflow-hidden rounded-2xl border border-accent/30 bg-surface2">
          <PartnerForm form={form} setForm={setForm} onSave={save} onCancel={cancel} isNew />
        </div>
      )}

      {isCoach && !editingId && (
        <AddButton onClick={openNew} label="Ajouter un partenaire" />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ONGLET PLANS — vitrine de vente reliée aux programmes de la bibliothèque
══════════════════════════════════════════════════════════════════════════ */

type PublishForm = {
  price: string;
  description: string;
  color: string;
  difficulty: number;   // 1-5
  goal: string;
  distance: string;
};

const EMPTY_PUBLISH_FORM: PublishForm = { price: "", description: "", color: "", difficulty: 0, goal: "", distance: "" };

function PlanTab({ isCoach }: { isCoach: boolean }) {
  const { library, updateLibrary, templates } = useData();
  const plans = library.trainingPlans ?? [];
  const programs = templates.programs ?? [];

  const publishedProgramIds = new Set(plans.map((p) => p.programId));
  const unpublished = programs.filter((p) => !publishedProgramIds.has(p.id));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishingProgramId, setPublishingProgramId] = useState<string | null>(null);
  const [form, setForm] = useState<PublishForm>(EMPTY_PUBLISH_FORM);

  function startPublish(programId: string) {
    const prog = programs.find((p) => p.id === programId);
    setPublishingProgramId(programId);
    setEditingId(null);
    setForm({ ...EMPTY_PUBLISH_FORM, description: prog?.description ?? "" });
  }
  function startEdit(plan: TrainingPlan) {
    setEditingId(plan.id);
    setPublishingProgramId(null);
    setForm({
      price: plan.price,
      description: plan.description,
      color: plan.color ?? "",
      difficulty: plan.difficulty ?? 0,
      goal: plan.goal ?? "",
      distance: plan.distance ?? "",
    });
  }
  function cancel() { setEditingId(null); setPublishingProgramId(null); }

  function savePublish() {
    const prog = programs.find((p) => p.id === publishingProgramId);
    if (!prog) return;
    const sessionsTotal = countProgramSessions(prog, templates.weekTemplates);
    updateLibrary((lib) => {
      const list = lib.trainingPlans ?? [];
      lib.trainingPlans = [...list, {
        id: crypto.randomUUID(),
        programId: prog.id,
        name: prog.name,
        sport: prog.sport,
        level: prog.level,
        durationWeeks: prog.weeks.length,
        sessionsTotal,
        price: form.price.trim(),
        description: form.description.trim(),
        color: form.color || undefined,
        difficulty: form.difficulty || undefined,
        goal: form.goal.trim() || undefined,
        distance: form.distance.trim() || undefined,
        visible: false,
      }];
    });
    cancel();
  }

  function saveEdit() {
    updateLibrary((lib) => {
      lib.trainingPlans = (lib.trainingPlans ?? []).map((p) =>
        p.id === editingId ? {
          ...p,
          price: form.price.trim(),
          description: form.description.trim(),
          color: form.color || undefined,
          difficulty: form.difficulty || undefined,
          goal: form.goal.trim() || undefined,
          distance: form.distance.trim() || undefined,
        } : p);
    });
    cancel();
  }

  function toggleVisible(id: string) {
    updateLibrary((lib) => {
      lib.trainingPlans = (lib.trainingPlans ?? []).map((p) =>
        p.id === id ? { ...p, visible: !p.visible } : p);
    });
  }

  // Re-synchronise les snapshots depuis le programme source (si modifié depuis)
  function resync(plan: TrainingPlan) {
    const prog = programs.find((p) => p.id === plan.programId);
    if (!prog) return;
    const sessionsTotal = countProgramSessions(prog, templates.weekTemplates);
    updateLibrary((lib) => {
      lib.trainingPlans = (lib.trainingPlans ?? []).map((p) =>
        p.id === plan.id ? { ...p, name: prog.name, sport: prog.sport, level: prog.level, durationWeeks: prog.weeks.length, sessionsTotal } : p);
    });
  }

  function unpublish(id: string) {
    updateLibrary((lib) => { lib.trainingPlans = (lib.trainingPlans ?? []).filter((p) => p.id !== id); });
  }

  // ── Vue SPORTIF : uniquement les plans visibles ──────────────────────────
  if (!isCoach) {
    const visible = plans.filter((p) => p.visible);
    if (visible.length === 0) {
      return <EmptyState emoji="📋" title="Aucun plan disponible" subtitle="Aucun plan en vente pour l'instant." />;
    }
    return (
      <div className="space-y-4">
        {visible.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
      </div>
    );
  }

  // ── Vue COACH : gestion complète ─────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Section : plans en vente */}
      <div className="space-y-4">
        <SectionLabel emoji="🏷️" text={`Mes plans (${plans.length})`} />

        {plans.length === 0 && (
          <p className="rounded-xl border border-dashed border-line bg-surface2 p-4 text-center text-[13px] text-dim">
            Aucun plan publié. Mets un programme en vente ci-dessous ↓
          </p>
        )}

        {plans.map((plan) => {
          const sourceExists = programs.some((p) => p.id === plan.programId);
          if (editingId === plan.id) {
            return (
              <div key={plan.id} className="overflow-hidden rounded-2xl border border-accent/30 bg-surface2">
                <PlanForm form={form} setForm={setForm} onSave={saveEdit} onCancel={cancel} title="Modifier le plan" />
              </div>
            );
          }
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              coach={{
                sourceExists,
                onToggle: () => toggleVisible(plan.id),
                onEdit: () => startEdit(plan),
                onResync: () => resync(plan),
                onUnpublish: () => unpublish(plan.id),
              }}
            />
          );
        })}
      </div>

      {/* Section : programmes à publier */}
      <div className="space-y-3">
        <SectionLabel emoji="📦" text="Mettre un programme en vente" />

        {programs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface2 p-4 text-center text-[13px] text-dim">
            Aucun programme dans la bibliothèque. Crée-en un dans <span className="font-semibold text-ink">Bibliothèque → Programmes</span>.
          </p>
        ) : unpublished.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface2 p-4 text-center text-[13px] text-dim">
            ✅ Tous tes programmes sont déjà en vente.
          </p>
        ) : (
          unpublished.map((prog) => {
            if (publishingProgramId === prog.id) {
              const sessionsTotal = countProgramSessions(prog, templates.weekTemplates);
              return (
                <div key={prog.id} className="overflow-hidden rounded-2xl border border-accent/30 bg-surface2">
                  <div className="border-b border-line bg-accent/5 px-4 py-2.5 text-[13px]">
                    <span className="font-bold">{prog.name}</span>
                    <span className="text-dim"> · {prog.weeks.length} sem. · {sessionsTotal} séances</span>
                  </div>
                  <PlanForm form={form} setForm={setForm} onSave={savePublish} onCancel={cancel} title="Mettre en vente" isPublish />
                </div>
              );
            }
            return (
              <button
                key={prog.id}
                onClick={() => startPublish(prog.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface2 p-3.5 text-left transition hover:border-accent/40 hover:bg-accent/5"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-lg">📋</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{prog.name}</p>
                  <p className="text-[12px] text-dim">{prog.sport} · {prog.level} · {prog.weeks.length} semaines</p>
                </div>
                <span className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-bold text-[#1a1500]">Vendre →</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* Carte d'un plan — partagée vue coach (avec contrôles) / sportif (vitrine). */
function PlanCard({ plan, coach }: {
  plan: TrainingPlan;
  coach?: {
    sourceExists: boolean;
    onToggle: () => void;
    onEdit: () => void;
    onResync: () => void;
    onUnpublish: () => void;
  };
}) {
  const sessionsPerWeek = plan.durationWeeks > 0 ? Math.round(plan.sessionsTotal / plan.durationWeeks) : 0;
  const dimmed = coach && !plan.visible;
  return (
    <div className={`overflow-hidden rounded-2xl border shadow-sm transition ${dimmed ? "border-line opacity-60" : "border-accent/30"} bg-surface2`}>
      {/* Header coloré */}
      {plan.color ? (
        <div
          className="relative overflow-hidden p-5"
          style={{ background: `linear-gradient(135deg, ${plan.color}cc 0%, ${plan.color}66 100%)` }}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white">{plan.sport}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">{plan.level}</span>
              </div>
              <p className="font-bold text-white">{plan.name}</p>
              {(plan.goal || plan.distance) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {plan.goal && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] text-white/90">🎯 {plan.goal}</span>}
                  {plan.distance && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] text-white/90">📏 {plan.distance}</span>}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {plan.price && (
                <div className="rounded-xl bg-white/20 px-3 py-1.5 text-center backdrop-blur-sm">
                  <p className="text-[16px] font-black text-white">{plan.price}</p>
                </div>
              )}
              {plan.difficulty ? (
                <p className="text-[14px]">
                  {"💧".repeat(plan.difficulty)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden bg-gradient-to-br from-accent/30 to-accent/10 p-5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-bold text-accent">{plan.sport}</span>
                <span className="rounded-full border border-line bg-surface/50 px-2.5 py-0.5 text-[11px] font-semibold text-dim">{plan.level}</span>
              </div>
              <p className="font-bold text-ink">{plan.name}</p>
              {(plan.goal || plan.distance) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {plan.goal && <span className="rounded-full bg-surface/70 px-2 py-0.5 text-[11px] text-dim">🎯 {plan.goal}</span>}
                  {plan.distance && <span className="rounded-full bg-surface/70 px-2 py-0.5 text-[11px] text-dim">📏 {plan.distance}</span>}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {plan.price && (
                <div className="rounded-xl bg-surface/80 px-3 py-1.5 text-center backdrop-blur-sm">
                  <p className="text-[16px] font-black text-ink">{plan.price}</p>
                </div>
              )}
              {plan.difficulty ? (
                <p className="text-[14px]">
                  {"💧".repeat(plan.difficulty)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Corps */}
      <div className="space-y-3 p-4">
        {/* Stats */}
        <div className="flex gap-3">
          <Stat value={plan.durationWeeks} label="semaines" />
          <Stat value={sessionsPerWeek} label="séances / sem." />
          <Stat value={plan.sessionsTotal} label="séances total" />
        </div>

        {plan.description && (
          <p className="border-l-2 border-accent/40 pl-3 text-[13px] text-dim">{plan.description}</p>
        )}

        {/* Contrôles coach */}
        {coach ? (
          <div className="space-y-2 border-t border-line pt-3">
            {!coach.sourceExists && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">
                ⚠ Programme source supprimé de la bibliothèque. La vente reste possible mais l&apos;injection ne fonctionnera plus.
              </p>
            )}
            {/* Toggle visibilité */}
            <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5">
              <div>
                <p className="text-[13px] font-semibold">{plan.visible ? "👁️ Visible par les sportifs" : "🙈 Masqué"}</p>
                <p className="text-[11px] text-dim">{plan.visible ? "En vente dans leur onglet Plans" : "Brouillon — invisible côté sportif"}</p>
              </div>
              <button
                onClick={coach.onToggle}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${plan.visible ? "bg-ok" : "bg-surface2"}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${plan.visible ? "left-6" : "left-1"}`} />
              </button>
            </div>
            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={coach.onEdit} className="flex-1 rounded-lg bg-surface py-2 text-[12px] font-semibold text-ink hover:bg-line">✏️ Prix / texte</button>
              {coach.sourceExists && (
                <button onClick={coach.onResync} className="rounded-lg bg-surface px-3 py-2 text-[12px] font-semibold text-dim hover:bg-line" title="Resynchroniser depuis le programme">↻</button>
              )}
              <button onClick={coach.onUnpublish} className="rounded-lg bg-surface px-3 py-2 text-[12px] font-semibold text-danger hover:bg-danger/15" title="Retirer de la vente">🗑️</button>
            </div>
          </div>
        ) : (
          /* CTA sportif */
          <button
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-dashed border-line bg-surface px-4 py-3 text-center text-[13px] font-semibold text-dim"
          >
            🔒 Achat bientôt disponible
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl bg-surface p-3 text-center">
      <p className="text-[20px] font-black text-ink">{value}</p>
      <p className="text-[11px] text-dim">{label}</p>
    </div>
  );
}

function SectionLabel({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{emoji}</span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-dim">{text}</span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ONGLET SHOP
══════════════════════════════════════════════════════════════════════════ */

const EMPTY_SHOP: Omit<ShopItem, "id"> = { image: "", name: "", brand: "", url: "", code: "", discount: "", comment: "", category: "" };

function ShopTab({ isCoach }: { isCoach: boolean }) {
  const { library, updateLibrary } = useData();
  const items = library.shopItems ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ShopItem, "id">>(EMPTY_SHOP);
  const [copied, setCopied] = useState<string | null>(null);

  function openNew() { setForm(EMPTY_SHOP); setEditingId("new"); }
  function openEdit(item: ShopItem) {
    setForm({ image: item.image, name: item.name, brand: item.brand, url: item.url, code: item.code ?? "", discount: item.discount ?? "", comment: item.comment ?? "", category: item.category });
    setEditingId(item.id);
  }
  function cancel() { setEditingId(null); }

  function save() {
    if (!form.name.trim() || !form.url.trim()) return;
    updateLibrary((lib) => {
      const list = lib.shopItems ?? [];
      const entry: ShopItem = {
        id: editingId === "new" ? crypto.randomUUID() : editingId!,
        image: form.image.trim(),
        name: form.name.trim(),
        brand: form.brand.trim(),
        url: normalizeUrl(form.url.trim()),
        code: form.code?.trim() || undefined,
        discount: form.discount?.trim() || undefined,
        comment: form.comment?.trim() || undefined,
        category: form.category.trim() || "Général",
      };
      lib.shopItems = editingId === "new" ? [...list, entry] : list.map((i) => i.id === editingId ? entry : i);
    });
    cancel();
  }

  function remove(id: string) {
    updateLibrary((lib) => { lib.shopItems = (lib.shopItems ?? []).filter((i) => i.id !== id); });
  }

  function copy(code: string, id: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }

  // Grouper par catégorie
  const grouped = useMemo(() => {
    const map = new Map<string, ShopItem[]>();
    items.forEach((item) => {
      const cat = item.category || "Général";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="space-y-6">
      {items.length === 0 && !editingId && (
        <EmptyState emoji="🛒" title="Aucune recommandation" subtitle={isCoach ? "Ajoute des produits recommandés — compléments, équipement, accessoires…" : "Aucune recommandation pour l'instant."} />
      )}

      {grouped.map(([category, catItems]) => (
        <div key={category}>
          {/* Catégorie header */}
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-dim">{category}</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="space-y-3">
            {catItems.map((item) => {
              if (editingId === item.id) {
                return (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-accent/30 bg-surface2">
                    <ShopItemForm form={form} setForm={setForm} onSave={save} onCancel={cancel} />
                  </div>
                );
              }
              return (
                <div key={item.id} className="flex gap-3 overflow-hidden rounded-2xl border border-line bg-surface2 p-3 shadow-sm">
                  {/* Thumbnail */}
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl text-dim">🛒</div>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">{item.name}</p>
                        {item.brand && <p className="text-[12px] text-dim">{item.brand}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {isCoach && (
                          <>
                            <button onClick={() => openEdit(item)} className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-xs hover:bg-line">✏️</button>
                            <button onClick={() => remove(item.id)} className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-xs hover:bg-danger/15">🗑️</button>
                          </>
                        )}
                        <a href={normalizeUrl(item.url)} target="_blank" rel="noopener noreferrer"
                          className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-sm text-accent hover:bg-accent/25">
                          ↗
                        </a>
                      </div>
                    </div>

                    {/* Code + remise */}
                    {(item.code || item.discount) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.code && (
                          <button
                            onClick={() => copy(item.code!, item.id)}
                            className={[
                              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[12px] font-bold transition",
                              copied === item.id ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-surface hover:border-accent/30",
                            ].join(" ")}
                          >
                            {item.code} {copied === item.id ? "✅" : "📋"}
                          </button>
                        )}
                        {item.discount && (
                          <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-1 text-[11px] font-bold text-ok">
                            {item.discount}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Commentaire */}
                    {item.comment && (
                      <p className="text-[12px] italic text-dim">{item.comment}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {editingId === "new" && (
        <div className="overflow-hidden rounded-2xl border border-accent/30 bg-surface2">
          <ShopItemForm form={form} setForm={setForm} onSave={save} onCancel={cancel} isNew />
        </div>
      )}

      {isCoach && !editingId && (
        <AddButton onClick={openNew} label="Ajouter un produit" />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FORMULAIRES
══════════════════════════════════════════════════════════════════════════ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-dim">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent";

function FormFooter({ onSave, onCancel, canSave, isNew }: { onSave: () => void; onCancel: () => void; canSave: boolean; isNew?: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <button onClick={onCancel} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-semibold text-dim hover:bg-surface">Annuler</button>
      <button onClick={onSave} disabled={!canSave} className="flex-1 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-[#1a1500] disabled:opacity-40">
        {isNew ? "✓ Ajouter" : "✓ Enregistrer"}
      </button>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-dim">Couleur de la bannière</label>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(value === c ? "" : c)}
            className="h-7 w-7 rounded-lg border-2 transition"
            style={{ background: c, borderColor: value === c ? "white" : "transparent", outline: value === c ? `2px solid ${c}` : "none" }}
            title={c}
          />
        ))}
        {value && !PALETTE.includes(value) && (
          <div className="h-7 w-7 rounded-lg border-2 border-white" style={{ background: value }} />
        )}
      </div>
    </div>
  );
}

function PartnerForm({ form, setForm, onSave, onCancel, isNew }: {
  form: Omit<PartnerLink, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<PartnerLink, "id">>>;
  onSave: () => void; onCancel: () => void; isNew?: boolean;
}) {
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  return (
    <div className="space-y-3 p-4">
      {isNew && <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Nouveau partenaire</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nom de l'entreprise *"><input autoFocus value={form.name} onChange={f("name")} placeholder="ex: Whey & Co" className={inputCls} /></Field>
        <Field label="Lien *"><input value={form.url} onChange={f("url")} placeholder="https://..." type="url" className={inputCls} /></Field>
        <Field label="Code promo"><input value={form.code} onChange={f("code")} placeholder="ex: NMRY10" className={`${inputCls} font-mono uppercase`} /></Field>
        <Field label="Remise"><input value={form.discount} onChange={f("discount")} placeholder="ex: -10% sur tout" className={inputCls} /></Field>
      </div>
      <ColorPicker value={form.color} onChange={(c) => setForm((prev) => ({ ...prev, color: c || undefined }))} />
      <Field label="Commentaire (infos partenariat…)">
        <textarea value={form.comment} onChange={f("comment")} placeholder="Partenaire depuis 2024, qualité premium…" rows={3} className={`${inputCls} resize-none`} />
      </Field>
      <FormFooter onSave={onSave} onCancel={onCancel} canSave={!!form.name.trim() && !!form.url.trim()} isNew={isNew} />
    </div>
  );
}

function PlanForm({ form, setForm, onSave, onCancel, title, isPublish }: {
  form: PublishForm;
  setForm: React.Dispatch<React.SetStateAction<PublishForm>>;
  onSave: () => void; onCancel: () => void; title: string; isPublish?: boolean;
}) {
  const f = (k: keyof PublishForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  return (
    <div className="space-y-3 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-accent">{title}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Prix"><input autoFocus value={form.price} onChange={f("price")} placeholder="ex: 49 €" className={inputCls} /></Field>
        <Field label="Distance (discrète)"><input value={form.distance} onChange={f("distance")} placeholder="ex: 10 km" className={inputCls} /></Field>
      </div>
      <Field label="Objectif (discret)"><input value={form.goal} onChange={f("goal")} placeholder="ex: Terminer un 10km" className={inputCls} /></Field>

      {/* Difficulté : gourdes 💧 */}
      <div>
        <label className="mb-1 block text-[12px] font-semibold text-dim">Difficulté</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, difficulty: prev.difficulty === d ? 0 : d }))}
              className="flex-1 rounded-lg border border-line bg-surface py-2 text-[18px] transition hover:border-accent/40"
              title={`Niveau ${d}`}
            >
              {d <= (form.difficulty ?? 0) ? "💧" : <span className="text-dim text-[12px]">○</span>}
            </button>
          ))}
        </div>
        {form.difficulty ? (
          <p className="mt-1 text-[11px] text-dim">Niveau {form.difficulty}/5</p>
        ) : (
          <p className="mt-1 text-[11px] text-dim">Aucune difficulté renseignée</p>
        )}
      </div>

      <ColorPicker value={form.color} onChange={(c) => setForm((prev) => ({ ...prev, color: c }))} />

      <Field label="Description (argumentaire de vente)">
        <textarea value={form.description} onChange={f("description")} placeholder="À qui s'adresse ce plan, objectifs, ce qu'il contient…" rows={3} className={`${inputCls} resize-none`} />
      </Field>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-line py-2.5 text-[13px] font-semibold text-dim hover:bg-surface">Annuler</button>
        <button onClick={onSave} className="flex-1 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-[#1a1500]">
          {isPublish ? "✓ Mettre en vente" : "✓ Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function ShopItemForm({ form, setForm, onSave, onCancel, isNew }: {
  form: Omit<ShopItem, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<ShopItem, "id">>>;
  onSave: () => void; onCancel: () => void; isNew?: boolean;
}) {
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  return (
    <div className="space-y-3 p-4">
      {isNew && <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Nouveau produit recommandé</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nom du produit *"><input autoFocus value={form.name} onChange={f("name")} placeholder="ex: Whey Gold Standard" className={inputCls} /></Field>
        <Field label="Marque"><input value={form.brand} onChange={f("brand")} placeholder="ex: Optimum Nutrition" className={inputCls} /></Field>
        <Field label="Catégorie"><input value={form.category} onChange={f("category")} placeholder="ex: Compléments" className={inputCls} /></Field>
        <Field label="Lien *"><input value={form.url} onChange={f("url")} placeholder="https://..." type="url" className={inputCls} /></Field>
        <Field label="Code promo"><input value={form.code} onChange={f("code")} placeholder="ex: NMRY15" className={`${inputCls} font-mono uppercase`} /></Field>
        <Field label="Remise"><input value={form.discount} onChange={f("discount")} placeholder="ex: -15%" className={inputCls} /></Field>
        <Field label="Image (URL)" ><input value={form.image} onChange={f("image")} placeholder="https://..." type="url" className={inputCls} /></Field>
      </div>
      <Field label="Commentaire">
        <textarea value={form.comment} onChange={f("comment")} placeholder="Ma source numéro 1, rapport qualité/prix imbattable…" rows={2} className={`${inputCls} resize-none`} />
      </Field>
      <FormFooter onSave={onSave} onCancel={onCancel} canSave={!!form.name.trim() && !!form.url.trim()} isNew={isNew} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPOSANTS UI RÉUTILISABLES
══════════════════════════════════════════════════════════════════════════ */

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="py-16 text-center">
      <div className="mb-4 text-5xl">{emoji}</div>
      <p className="font-bold text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-dim">{subtitle}</p>
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-4 text-[13px] font-semibold text-dim transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
    >
      <span className="text-base">＋</span> {label}
    </button>
  );
}
