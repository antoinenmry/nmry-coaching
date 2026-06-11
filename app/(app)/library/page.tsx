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
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionColorFilter, setSessionColorFilter] = useState<string | null>(null);
  const [sessionSportFilter, setSessionSportFilter] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // --- Onglet Semaines types ---
  const [editingWeek, setEditingWeek] = useState<WeekTemplate | null | "new">(null);
  const [weekSearch, setWeekSearch] = useState("");
  const [weekSportFilter, setWeekSportFilter] = useState<string | null>(null);

  // --- Onglet Programmes ---
  const [editingProgram, setEditingProgram] = useState<Program | null | "new">(null);
  const [programSearch, setProgramSearch] = useState("");
  const [programSportFilter, setProgramSportFilter] = useState<string | null>(null);


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
      {tab === "sessions" && canEdit && (() => {
        const colors = [...new Set(templates.sessionTemplates.map((s) => s.color))];
        // Sports disponibles parmi les séances existantes (champ sport direct)
        const availSports = [...new Set(templates.sessionTemplates.map((s) => s.sport).filter(Boolean))] as string[];
        const filtered = templates.sessionTemplates.filter((s) => {
          const matchSearch = !sessionSearch || s.name.toLowerCase().includes(sessionSearch.toLowerCase());
          const matchColor = !sessionColorFilter || s.color === sessionColorFilter;
          const matchSport = !sessionSportFilter || s.sport === sessionSportFilter;
          return matchSearch && matchColor && matchSport;
        });
        return (
          <div>
            {/* Barre filtres */}
            {templates.sessionTemplates.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Rechercher une séance…"
                    className="flex-1"
                  />
                  <button
                    onClick={() => setEditingSession("new")}
                    className="shrink-0 rounded-lg bg-ok px-3 py-2 text-[13px] font-semibold text-[#06210a]"
                  >
                    + Nouvelle
                  </button>
                </div>
                {(colors.length > 1 || availSports.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {/* Filtre couleur */}
                    {colors.length > 1 && (
                      <>
                        <button
                          onClick={() => setSessionColorFilter(null)}
                          className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${!sessionColorFilter ? "bg-accent text-[#1a1500]" : "bg-surface2 text-dim hover:text-ink"}`}
                        >
                          Toutes
                        </button>
                        {colors.map((c) => (
                          <button
                            key={c}
                            onClick={() => setSessionColorFilter(sessionColorFilter === c ? null : c)}
                            title={templates.sessionTemplates.filter((s) => s.color === c).map((s) => s.name).join(", ")}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition ${sessionColorFilter === c ? "ring-2 ring-offset-1" : "bg-surface2 hover:bg-surface"}`}
                            style={sessionColorFilter === c ? { background: c + "33", color: c } : {}}
                          >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
                            {templates.sessionTemplates.filter((s) => s.color === c).length}
                          </button>
                        ))}
                        {availSports.length > 0 && <span className="self-center text-dim/40">·</span>}
                      </>
                    )}
                    {/* Filtre sport (dynamique depuis lib.categories) */}
                    {availSports.map((sport) => (
                      <button
                        key={sport}
                        onClick={() => setSessionSportFilter(sessionSportFilter === sport ? null : sport)}
                        className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${sessionSportFilter === sport ? "bg-accent text-[#1a1500]" : "bg-surface2 text-dim hover:text-ink"}`}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {templates.sessionTemplates.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-dim">Aucune séance type pour l&apos;instant.</p>
                <p className="mt-1 text-[13px] text-dim">Crée ta première séance type pour l&apos;utiliser dans les semaines types et l&apos;appliquer rapidement au planning.</p>
                <button onClick={() => setEditingSession("new")} className="mt-4 rounded-lg bg-ok px-4 py-2 text-[13px] font-semibold text-[#06210a]">
                  + Nouvelle séance type
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-dim">Aucune séance trouvée.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filtered.map((tpl) => (
                  <SessionTemplateCard
                    key={tpl.id}
                    template={tpl}
                    expanded={expandedSession === tpl.id}
                    onToggleExpand={() => setExpandedSession(expandedSession === tpl.id ? null : tpl.id)}
                    onEdit={() => setEditingSession(tpl)}
                    onDelete={() =>
                      updateTemplates((t) => {
                        t.sessionTemplates = t.sessionTemplates.filter((s) => s.id !== tpl.id);
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
        );
      })()}

      {/* ===== TAB : SEMAINES TYPES ===== */}
      {tab === "weeks" && canEdit && (() => {
        const availWeekSports = [...new Set(templates.weekTemplates.map((w) => w.sport).filter(Boolean))] as string[];
        const filteredWeeks = templates.weekTemplates.filter((w) => {
          const matchSearch = !weekSearch || w.name.toLowerCase().includes(weekSearch.toLowerCase());
          const matchSport = !weekSportFilter || w.sport === weekSportFilter;
          return matchSearch && matchSport;
        });
        return (
          <div>
            {templates.weekTemplates.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={weekSearch}
                    onChange={(e) => setWeekSearch(e.target.value)}
                    placeholder="Rechercher une semaine…"
                    className="flex-1"
                  />
                  <button
                    onClick={() => setEditingWeek("new")}
                    className="shrink-0 rounded-lg bg-ok px-3 py-2 text-[13px] font-semibold text-[#06210a]"
                  >
                    + Nouvelle
                  </button>
                </div>
                {availWeekSports.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {availWeekSports.map((sport) => (
                      <button
                        key={sport}
                        onClick={() => setWeekSportFilter(weekSportFilter === sport ? null : sport)}
                        className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${weekSportFilter === sport ? "bg-accent text-[#1a1500]" : "bg-surface2 text-dim hover:text-ink"}`}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {templates.weekTemplates.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-dim">Aucune semaine type pour l&apos;instant.</p>
                <p className="mt-1 text-[13px] text-dim">Assemble des séances types pour créer un modèle de semaine réutilisable.</p>
                <button onClick={() => setEditingWeek("new")} className="mt-4 rounded-lg bg-ok px-4 py-2 text-[13px] font-semibold text-[#06210a]">
                  + Nouvelle semaine type
                </button>
              </div>
            ) : filteredWeeks.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-dim">Aucune semaine trouvée.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredWeeks.map((wk) => (
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
        );
      })()}

      {/* ===== TAB : PROGRAMMES ===== */}
      {tab === "programs" && canEdit && (() => {
        const allPrograms = templates.programs ?? [];
        const programSports = [...new Set(allPrograms.map((p) => p.sport).filter(Boolean))];
        const filteredPrograms = allPrograms.filter((p) => {
          const matchSearch = !programSearch || p.name.toLowerCase().includes(programSearch.toLowerCase());
          const matchSport = !programSportFilter || p.sport === programSportFilter;
          return matchSearch && matchSport;
        });
        return (
        <div>
          {allPrograms.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={programSearch}
                  onChange={(e) => setProgramSearch(e.target.value)}
                  placeholder="Rechercher un programme…"
                  className="flex-1"
                />
                <button
                  onClick={() => setEditingProgram("new")}
                  className="shrink-0 rounded-lg bg-ok px-3 py-2 text-[13px] font-semibold text-[#06210a]"
                >
                  + Nouveau
                </button>
              </div>
              {programSports.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {programSports.map((sport) => (
                    <button
                      key={sport}
                      onClick={() => setProgramSportFilter(programSportFilter === sport ? null : sport)}
                      className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${programSportFilter === sport ? "bg-accent text-[#1a1500]" : "bg-surface2 text-dim hover:text-ink"}`}
                    >
                      {sport}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {allPrograms.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-dim">Aucun programme pour l&apos;instant.</p>
              <p className="mt-1 text-[13px] text-dim">Enchaîne des semaines types pour créer un programme complet, prêt à vendre ou à injecter.</p>
              <button onClick={() => setEditingProgram("new")} className="mt-4 rounded-lg bg-ok px-4 py-2 text-[13px] font-semibold text-[#06210a]">
                + Nouveau programme
              </button>
            </div>
          ) : filteredPrograms.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-dim">Aucun programme trouvé.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredPrograms.map((prog) => (
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
        );
      })()}
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

function SessionTemplateCard({ template, expanded, onToggleExpand, onEdit, onDelete }: {
  template: SessionTemplate;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const totalSets = template.exercises.reduce((n, ex) => n + (ex.sets || 0), 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:border-accent/30">
      {/* Bandeau couleur en haut */}
      <div className="h-1.5 w-full" style={{ background: template.color }} />

      <div className="p-4">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-2">
          <button onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
            <h3 className="font-bold text-ink">{template.name}</h3>
            {template.description && (
              <p className="mt-0.5 line-clamp-1 text-[12px] text-dim">{template.description}</p>
            )}
          </button>
          <div className="flex shrink-0 gap-1">
            <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-sm hover:bg-line" aria-label="Modifier">✏️</button>
            <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-sm hover:bg-danger/15" aria-label="Supprimer">🗑️</button>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {template.sport && (
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">
              {template.sport}
            </span>
          )}
          <div className="flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5">
            <span className="text-[18px] font-black text-ink leading-none">{template.exercises.length}</span>
            <span className="text-[10px] text-dim leading-tight">exo{template.exercises.length !== 1 ? "s" : ""}</span>
          </div>
          {totalSets > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface2 px-2.5 py-1.5">
              <span className="text-[18px] font-black text-ink leading-none">{totalSets}</span>
              <span className="text-[10px] text-dim leading-tight">séries</span>
            </div>
          )}
          <button
            onClick={onToggleExpand}
            className="ml-auto text-[12px] font-semibold text-accent hover:underline"
          >
            {expanded ? "Réduire ▲" : "Détails ▼"}
          </button>
        </div>

        {/* Liste exercices dépliable */}
        {expanded && template.exercises.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-line pt-3">
            {template.exercises.map((ex, i) => (
              <div key={ex.uid} className="flex items-center gap-2.5">
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
                  style={{ background: template.color }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{ex.name}</span>
                <span className="shrink-0 text-[11px] text-dim">
                  {ex.setsLabel ?? ex.sets}×{ex.repsLabel ?? ex.reps}
                  {ex.weight > 0 && ` · ${ex.weight} kg`}
                  {ex.rpeCoach ? ` · RPE ${ex.rpeCoach}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Chips condensées (mode fermé) */}
        {!expanded && template.exercises.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {template.exercises.slice(0, 3).map((ex) => (
              <span key={ex.uid} className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-dim">
                {ex.name}
              </span>
            ))}
            {template.exercises.length > 3 && (
              <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-dim">
                +{template.exercises.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
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
  const totalSessions = template.days.reduce((n, d) => n + d.sessions.length, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:border-accent/30">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-ink">{template.name}</h3>
          {template.description && (
            <p className="mt-0.5 line-clamp-1 text-[12px] text-dim">{template.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-sm hover:bg-line" aria-label="Modifier">✏️</button>
          <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-sm hover:bg-danger/15" aria-label="Supprimer">🗑️</button>
        </div>
      </div>

      {/* Grille jours */}
      <div className="grid grid-cols-7 gap-px bg-line mx-4 rounded-xl overflow-hidden mb-3">
        {DAYS.map((dayName, dayIndex) => {
          const day = template.days.find((d) => d.dayIndex === dayIndex);
          const daySessions = day?.sessions ?? [];
          const isRest = daySessions.length === 0;
          return (
            <div key={dayIndex} className="flex flex-col bg-surface2">
              {/* Header jour */}
              <div className={`py-1 text-center text-[10px] font-bold ${isRest ? "text-dim/50" : "text-dim"}`}>
                {dayName}
              </div>
              {/* Séances */}
              <div className="flex min-h-[48px] flex-col gap-0.5 p-1">
                {isRest ? (
                  <div className="flex flex-1 items-center justify-center">
                    <span className="text-[9px] text-dim/30">—</span>
                  </div>
                ) : (
                  daySessions.map((s, idx) => {
                    const tpl = sessionTemplates.find((t) => t.id === s.tplId);
                    return (
                      <div
                        key={idx}
                        className="rounded px-1 py-0.5 text-center"
                        style={{ background: tpl?.color ? tpl.color + "cc" : "#666" }}
                        title={tpl?.name ?? "Séance supprimée"}
                      >
                        <span className="block truncate text-[9px] font-bold text-white leading-tight">
                          {tpl?.name ?? "?"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {template.sport && (
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">
            {template.sport}
          </span>
        )}
        <span className="rounded-lg bg-surface2 px-2 py-1 text-[11px] font-semibold text-dim">
          {activeDays.length}j d&apos;entraînement
        </span>
        <span className="rounded-lg bg-surface2 px-2 py-1 text-[11px] font-semibold text-dim">
          {totalSessions} séance{totalSessions !== 1 ? "s" : ""}
        </span>
      </div>
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
