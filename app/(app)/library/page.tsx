"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import ExerciseModal from "@/components/library/ExerciseModal";
import FiltersModal from "@/components/library/FiltersModal";
import SessionTemplateModal from "@/components/library/SessionTemplateModal";
import WeekTemplateModal from "@/components/library/WeekTemplateModal";
import ProgramModal from "@/components/library/ProgramModal";
import type { LibraryExercise, SessionTemplate, WeekTemplate, Program } from "@/lib/types";

type Tab = "exercises" | "sessions" | "weeks" | "programs";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function LibraryPage() {
  const { library: lib, updateLibrary, templates, updateTemplates, loading, role, state, update } = useData();
  const canEdit = role === "coach" || role === "admin";
  const [tab, setTab] = useState<Tab>("exercises");

  // --- Onglet Exercices ---
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<{ ex: LibraryExercise; edit: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingFilters, setManagingFilters] = useState(false);

  // --- Onglet Séances types ---
  const [editingSession, setEditingSession] = useState<SessionTemplate | null | "new">(null);

  // --- Onglet Semaines types ---
  const [editingWeek, setEditingWeek] = useState<WeekTemplate | null | "new">(null);

  // --- Onglet Programmes ---
  const [editingProgram, setEditingProgram] = useState<Program | null | "new">(null);

  // Exercices filtrés
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return lib.exercises.filter((ex) => {
      if (q) {
        const name = ex.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        if (!name.includes(q)) return false;
      }
      return lib.categories.every((cat) => {
        const sels = selected[cat.id] ?? [];
        return sels.length === 0 || (ex.tags[cat.id] ?? []).some((t) => sels.includes(t));
      });
    });
  }, [lib.exercises, lib.categories, selected, search]);

  function countFor(catId: string, optId: string | null) {
    const base = lib.exercises.filter((ex) =>
      lib.categories.every((c) => {
        if (c.id === catId) return true;
        const sels = selected[c.id] ?? [];
        return sels.length === 0 || (ex.tags[c.id] ?? []).some((t) => sels.includes(t));
      }),
    );
    return optId ? base.filter((ex) => (ex.tags[catId] ?? []).includes(optId)).length : base.length;
  }

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div>
      {/* En-tête */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">📚 Bibliothèque</h2>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-line bg-surface2 p-1">
        <TabButton active={tab === "exercises"} onClick={() => setTab("exercises")} label="Exercices" count={lib.exercises.length} />
        {canEdit && (
          <>
            <TabButton active={tab === "sessions"} onClick={() => setTab("sessions")} label="Séances types" count={templates.sessionTemplates.length} />
            <TabButton active={tab === "weeks"} onClick={() => setTab("weeks")} label="Semaines types" count={templates.weekTemplates.length} />
            <TabButton active={tab === "programs"} onClick={() => setTab("programs")} label="Programmes" count={(templates.programs ?? []).length} />
          </>
        )}
      </div>

      {/* ===== TAB : EXERCICES ===== */}
      {tab === "exercises" && (
        <div>
          {/* Actions coach */}
          {canEdit && (
            <div className="mb-4 flex justify-end gap-2">
              <button
                onClick={() => setManagingFilters(true)}
                className="rounded-lg border border-line bg-surface2 px-3 py-2 text-[13px] font-semibold"
              >
                Gérer les filtres
              </button>
              <button
                onClick={() => setCreating(true)}
                className="rounded-lg bg-ok px-3 py-2 text-[13px] font-semibold text-[#06210a]"
              >
                + Créer un exercice
              </button>
            </div>
          )}

          {/* Recherche */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un exercice…"
            className="mb-4 w-full"
          />

          {/* Filtres */}
          <div className="mb-4 space-y-2">
            {lib.categories.map((cat) => (
              <div key={cat.id} className="flex flex-wrap items-center gap-2">
                <span className="mr-1 w-full text-[11px] uppercase tracking-wide text-dim sm:w-auto">{cat.name}</span>
                <Chip
                  active={!(selected[cat.id]?.length)}
                  label="Tous"
                  count={countFor(cat.id, null)}
                  onClick={() => setSelected((s) => ({ ...s, [cat.id]: [] }))}
                />
                {cat.options.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={(selected[cat.id] ?? []).includes(opt.id)}
                    label={opt.label}
                    count={countFor(cat.id, opt.id)}
                    onClick={() =>
                      setSelected((s) => {
                        const cur = s[cat.id] ?? [];
                        return {
                          ...s,
                          [cat.id]: cur.includes(opt.id)
                            ? cur.filter((x) => x !== opt.id)
                            : [...cur, opt.id],
                        };
                      })
                    }
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Cartes exercices */}
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-dim">Aucun exercice pour ces filtres.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((ex) => (
                <ExerciseCard
                  key={ex.id}
                  ex={ex}
                  tagLabels={tagLabels(ex, lib.categories)}
                  canEdit={canEdit}
                  isFav={state.preferences?.favoriteExerciseId === ex.id}
                  onFav={() =>
                    update((s) => {
                      s.preferences.favoriteExerciseId =
                        s.preferences.favoriteExerciseId === ex.id ? undefined : ex.id;
                    })
                  }
                  onView={() => setViewing({ ex, edit: false })}
                  onEdit={() => setViewing({ ex, edit: true })}
                  onDelete={() =>
                    updateLibrary((lib) => {
                      lib.exercises = lib.exercises.filter((e) => e.id !== ex.id);
                    })
                  }
                />
              ))}
            </div>
          )}

          {creating && (
            <ExerciseModal
              categories={lib.categories}
              exercise={null}
              onClose={() => setCreating(false)}
            />
          )}
          {viewing && (
            <ExerciseModal
              categories={lib.categories}
              exercise={viewing.ex}
              readOnly={!viewing.edit}
              onClose={() => setViewing(null)}
            />
          )}
          {managingFilters && (
            <FiltersModal categories={lib.categories} onClose={() => setManagingFilters(false)} />
          )}
        </div>
      )}

      {/* ===== TAB : SÉANCES TYPES ===== */}
      {tab === "sessions" && canEdit && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] text-dim">
              {templates.sessionTemplates.length} séance{templates.sessionTemplates.length !== 1 ? "s" : ""} type
            </p>
            <button
              onClick={() => setEditingSession("new")}
              className="rounded-lg bg-ok px-3 py-2 text-[13px] font-semibold text-[#06210a]"
            >
              + Nouvelle séance type
            </button>
          </div>

          {templates.sessionTemplates.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-dim">Aucune séance type pour l&apos;instant.</p>
              <p className="mt-1 text-[13px] text-dim">Crée ta première séance type pour l&apos;utiliser dans les semaines types et l&apos;appliquer rapidement au planning.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates.sessionTemplates.map((tpl) => (
                <SessionTemplateCard
                  key={tpl.id}
                  template={tpl}
                  onEdit={() => setEditingSession(tpl)}
                  onDelete={() =>
                    updateTemplates((t) => {
                      t.sessionTemplates = t.sessionTemplates.filter((s) => s.id !== tpl.id);
                      // Nettoyer les références dans les semaines types
                      t.weekTemplates = t.weekTemplates.map((w) => ({
                        ...w,
                        days: w.days.map((d) => ({
                          ...d,
                          sessions: d.sessions.filter((s) => s.tplId !== tpl.id),
                        })).filter((d) => d.sessions.length > 0),
                      }));
                    })
                  }
                />
              ))}
            </div>
          )}

          {editingSession !== null && (
            <SessionTemplateModal
              template={editingSession === "new" ? null : editingSession}
              onClose={() => setEditingSession(null)}
            />
          )}
        </div>
      )}

      {/* ===== TAB : SEMAINES TYPES ===== */}
      {tab === "weeks" && canEdit && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] text-dim">
              {templates.weekTemplates.length} semaine{templates.weekTemplates.length !== 1 ? "s" : ""} type
            </p>
            <button
              onClick={() => setEditingWeek("new")}
              className="rounded-lg bg-ok px-3 py-2 text-[13px] font-semibold text-[#06210a]"
            >
              + Nouvelle semaine type
            </button>
          </div>

          {templates.weekTemplates.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-dim">Aucune semaine type pour l&apos;instant.</p>
              <p className="mt-1 text-[13px] text-dim">Assemble des séances types pour créer un modèle de semaine réutilisable.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates.weekTemplates.map((wk) => (
                <WeekTemplateCard
                  key={wk.id}
                  template={wk}
                  sessionTemplates={templates.sessionTemplates}
                  onEdit={() => setEditingWeek(wk)}
                  onDelete={() =>
                    updateTemplates((t) => {
                      t.weekTemplates = t.weekTemplates.filter((w) => w.id !== wk.id);
                    })
                  }
                />
              ))}
            </div>
          )}

          {editingWeek !== null && (
            <WeekTemplateModal
              template={editingWeek === "new" ? null : editingWeek}
              onClose={() => setEditingWeek(null)}
            />
          )}
        </div>
      )}

      {/* ===== TAB : PROGRAMMES ===== */}
      {tab === "programs" && canEdit && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] text-dim">
              {(templates.programs ?? []).length} programme{(templates.programs ?? []).length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setEditingProgram("new")}
              className="rounded-lg bg-ok px-3 py-2 text-[13px] font-semibold text-[#06210a]"
            >
              + Nouveau programme
            </button>
          </div>

          {(templates.programs ?? []).length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-dim">Aucun programme pour l&apos;instant.</p>
              <p className="mt-1 text-[13px] text-dim">Enchaîne des semaines types pour créer un programme complet, prêt à vendre ou à injecter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(templates.programs ?? []).map((prog) => (
                <ProgramCard
                  key={prog.id}
                  program={prog}
                  weekTemplates={templates.weekTemplates}
                  onEdit={() => setEditingProgram(prog)}
                  onDelete={() =>
                    updateTemplates((t) => {
                      t.programs = (t.programs ?? []).filter((p) => p.id !== prog.id);
                    })
                  }
                />
              ))}
            </div>
          )}

          {editingProgram !== null && (
            <ProgramModal
              program={editingProgram === "new" ? null : editingProgram}
              onClose={() => setEditingProgram(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function TabButton({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
        active ? "bg-surface text-ink shadow-sm" : "text-dim hover:text-ink"
      }`}
    >
      {label}
      <span className={`ml-1 text-[11px] ${active ? "text-dim" : "text-dim/60"}`}>({count})</span>
    </button>
  );
}

function tagLabels(ex: LibraryExercise, categories: ReturnType<typeof useData>["library"]["categories"]) {
  return categories.flatMap((c) =>
    (ex.tags[c.id] ?? []).map((tagId) => c.options.find((o) => o.id === tagId)?.label).filter(Boolean),
  ) as string[];
}

function Chip({ active, label, count, onClick }: {
  active: boolean; label: string; count: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
        active ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface2 text-ink"
      }`}
    >
      {label}
      <span className={`text-xs ${active ? "text-accent" : "text-dim"}`}>{count}</span>
    </button>
  );
}

function ExerciseCard({ ex, tagLabels, canEdit, isFav, onFav, onView, onEdit, onDelete }: {
  ex: LibraryExercise; tagLabels: string[]; canEdit: boolean;
  isFav: boolean; onFav: () => void;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div
      className="group cursor-pointer rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/40"
      onClick={canEdit ? onEdit : onView}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold transition-colors group-hover:text-accent">{ex.name}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {/* Étoile favori — visible par tous */}
          <button
            onClick={(e) => { e.stopPropagation(); onFav(); }}
            className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-base transition hover:scale-110"
            aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
            title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            {isFav ? "⭐" : "☆"}
          </button>
          {canEdit ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Modifier">✏️</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Supprimer">🗑️</button>
            </>
          ) : (
            <span className="ml-1 text-[12px] text-dim">Voir →</span>
          )}
        </div>
      </div>
      {tagLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tagLabels.map((t) => (
            <span key={t} className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-dim">{t}</span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {ex.video && <span className="text-sm text-accent2">▶ Vidéo</span>}
        {ex.comment && <span className="truncate text-[12px] italic text-dim">💬 {ex.comment}</span>}
      </div>
    </div>
  );
}

function SessionTemplateCard({ template, onEdit, onDelete }: {
  template: SessionTemplate; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="group rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="h-4 w-4 shrink-0 rounded-full"
            style={{ background: template.color }}
          />
          <h3 className="font-bold truncate">{template.name}</h3>
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Modifier">✏️</button>
          <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Supprimer">🗑️</button>
        </div>
      </div>
      {template.description && (
        <p className="mt-1.5 text-[13px] text-dim line-clamp-2">{template.description}</p>
      )}
      <p className="mt-2 text-[12px] text-dim">
        {template.exercises.length} exercice{template.exercises.length !== 1 ? "s" : ""}
      </p>
      {template.exercises.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {template.exercises.slice(0, 4).map((ex) => (
            <span key={ex.uid} className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-dim">
              {ex.name}
            </span>
          ))}
          {template.exercises.length > 4 && (
            <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-dim">
              +{template.exercises.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function WeekTemplateCard({ template, sessionTemplates, onEdit, onDelete }: {
  template: WeekTemplate;
  sessionTemplates: SessionTemplate[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const activeDays = template.days.filter((d) => d.sessions.length > 0);
  return (
    <div className="group rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/40">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold">{template.name}</h3>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Modifier">✏️</button>
          <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Supprimer">🗑️</button>
        </div>
      </div>
      {template.description && (
        <p className="mt-1.5 text-[13px] text-dim line-clamp-2">{template.description}</p>
      )}

      {/* Mini-calendrier semaine */}
      <div className="mt-3 grid grid-cols-7 gap-0.5">
        {DAYS.map((dayName, dayIndex) => {
          const day = template.days.find((d) => d.dayIndex === dayIndex);
          const hasSessions = (day?.sessions.length ?? 0) > 0;
          const firstTpl = day?.sessions[0]
            ? sessionTemplates.find((t) => t.id === day!.sessions[0].tplId)
            : undefined;
          return (
            <div key={dayIndex} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-dim">{dayName}</span>
              <div
                className={`h-6 w-6 rounded-md ${hasSessions ? "text-white" : "bg-surface2"}`}
                style={hasSessions ? { background: firstTpl?.color ?? "#666" } : {}}
                title={hasSessions ? day!.sessions.map((s) => sessionTemplates.find((t) => t.id === s.tplId)?.name ?? "?").join(", ") : "Repos"}
              >
                {hasSessions && day!.sessions.length > 1 && (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-bold">
                    {day!.sessions.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[12px] text-dim">
        {activeDays.length} jour{activeDays.length !== 1 ? "s" : ""} d&apos;entraînement
      </p>
    </div>
  );
}

function ProgramCard({ program, weekTemplates, onEdit, onDelete }: {
  program: Program;
  weekTemplates: WeekTemplate[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">{program.sport}</span>
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-dim">{program.level}</span>
          </div>
          <h3 className="font-bold">{program.name}</h3>
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Modifier">✏️</button>
          <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Supprimer">🗑️</button>
        </div>
      </div>
      {program.description && (
        <p className="mt-1.5 text-[13px] text-dim line-clamp-2">{program.description}</p>
      )}

      {/* Frise des semaines */}
      {program.weeks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {program.weeks.map((w, idx) => {
            const wk = weekTemplates.find((t) => t.id === w.weekTplId);
            return (
              <span
                key={idx}
                className="rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-semibold text-dim"
                title={wk?.name ?? "Semaine supprimée"}
              >
                S{idx + 1}
              </span>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-[12px] text-dim">
        {program.weeks.length} semaine{program.weeks.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
