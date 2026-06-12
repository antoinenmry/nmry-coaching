"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";

// Modales chargées à la demande (à l'ouverture) → bundle initial de /library allégé.
const ExerciseModal = dynamic(() => import("@/components/library/ExerciseModal"));
const FiltersModal = dynamic(() => import("@/components/library/FiltersModal"));
const SessionTemplateModal = dynamic(() => import("@/components/library/SessionTemplateModal"));
const WeekTemplateModal = dynamic(() => import("@/components/library/WeekTemplateModal"));
const ProgramModal = dynamic(() => import("@/components/library/ProgramModal"));
// Carte communauté : Leaflet chargé à la demande (ssr:false) → zéro impact bundle global.
const CommunityMap = dynamic(() => import("@/components/library/CommunityMap"), {
  ssr: false,
  loading: () => <p className="py-10 text-center text-dim">Chargement de la carte…</p>,
});
import type { LibraryExercise, SessionTemplate, WeekTemplate, Program, Challenge, ChallengeConditionType, AppState, SessionInstance } from "@/lib/types";

type Tab = "exercises" | "sessions" | "weeks" | "programs" | "challenges" | "map";

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

const CONDITION_LABELS: Record<ChallengeConditionType, string> = {
  session_count: "Séances validées",
  pr_count: "Records enregistrés",
  streak_weeks: "Semaines consécutives",
  goal_achieved: "Objectifs réalisés",
};

function lightenHex(hex: string): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 55);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 55);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 55);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const PRESET_COLORS = [
  "#534AB7", // violet
  "#1D9E75", // teal
  "#BA7517", // amber
  "#D85A30", // coral
  "#D4537E", // rose
  "#378ADD", // bleu
  "#639922", // vert
  "#E24B4A", // rouge
];

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-${week}`;
}

function computeStreakWeeks(sessions: SessionInstance[]): number {
  const doneDates = sessions.filter((s) => s.done && s.date).map((s) => s.date!);
  if (!doneDates.length) return 0;
  const weeks = new Set(doneDates.map(isoWeekKey));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    if (weeks.has(isoWeekKey(cursor.toISOString().slice(0, 10)))) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    } else break;
  }
  return streak;
}

function computeChallengeProgress(ch: Challenge, state: AppState): { current: number; target: number; pct: number } {
  const target = ch.condition.value;
  let current = 0;
  switch (ch.condition.type) {
    case "session_count":
      current = state.sessions.filter((s) => s.done).length;
      break;
    case "pr_count":
      current = state.records.strength.reduce((n, ex) => n + ex.entries.length, 0);
      break;
    case "streak_weeks":
      current = computeStreakWeeks(state.sessions);
      break;
    case "goal_achieved":
      current = state.goals.filter((g) => (g.events ?? []).some((e) => e.achieved.trim())).length;
      break;
  }
  return { current, target, pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0 };
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function LibraryPage() {
  const { library: lib, updateLibrary, templates, updateTemplates, loading, role, state, update } = useData();
  const canEdit = role === "coach" || role === "admin";
  const [tab, setTab] = useState<Tab>("exercises");

  // --- Onglet Exercices ---
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  // --- Onglet Défis ---
  const [cIcon, setCIcon] = useState("🏆");
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cCondType, setCCondType] = useState<ChallengeConditionType>("session_count");
  const [cCondValue, setCCondValue] = useState("10");
  const [cColor, setCColor] = useState(PRESET_COLORS[0]);
  const [cBadgeImage, setCBadgeImage] = useState("");
  const [badgeImgBusy, setBadgeImgBusy] = useState(false);
  const badgeFileRef = useRef<HTMLInputElement>(null);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);

  // Auto-unlock : dès que l'onglet Défis est ouvert, on vérifie et on enregistre les badges débloqués
  useEffect(() => {
    if (tab !== "challenges") return;
    const challenges = lib.challenges ?? [];
    if (!challenges.length) return;
    const unlockedIds = new Set((state.badges ?? []).map((b) => b.challengeId));
    const toUnlock = challenges.filter((ch) => {
      if (unlockedIds.has(ch.id)) return false;
      return computeChallengeProgress(ch, state).pct >= 100;
    });
    if (!toUnlock.length) return;
    update((d) => {
      if (!d.badges) d.badges = [];
      toUnlock.forEach((ch) => {
        if (!d.badges!.find((b) => b.challengeId === ch.id)) {
          d.badges!.push({ challengeId: ch.id, unlockedAt: today() });
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);


  const activeFilterCount = Object.values(selected).reduce((n, v) => n + v.length, 0);

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
        {(canEdit || (lib.challenges ?? []).length > 0) && (
          <TabButton active={tab === "challenges"} onClick={() => setTab("challenges")} label="Défis" count={(lib.challenges ?? []).length} />
        )}
        {(canEdit || lib.mapVisible) && (
          <TabButton active={tab === "map"} onClick={() => setTab("map")} label="Ma carte" />
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

          {/* Filtres — barre de déclenchement */}
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-[13px] transition ${
                activeFilterCount > 0
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-line bg-surface2 text-dim hover:text-ink"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              Filtres
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-[#1a1500]">
                  {activeFilterCount}
                </span>
              )}
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`ml-auto transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setSelected({})}
                className="rounded-xl border border-line px-3 py-2 text-[12px] text-dim hover:text-danger"
              >
                Effacer filtres
              </button>
            )}
          </div>

          {/* Panneau filtres déroulant */}
          {filtersOpen && (
            <div className="mb-3 rounded-xl border border-line bg-surface p-3 space-y-3">
              {lib.categories.map((cat) => (
                <div key={cat.id}>
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-dim">{cat.name}</span>
                  <div className="flex flex-wrap gap-1.5">
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
                </div>
              ))}
            </div>
          )}

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

      {/* ===== TAB : DÉFIS ===== */}
      {tab === "challenges" && (() => {
        const challenges = lib.challenges ?? [];
        const unlockedIds = new Set((state.badges ?? []).map((b) => b.challengeId));

        if (canEdit) {
          // ---- Vue coach : formulaire + gestion ----
          async function handleBadgeImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBadgeImgBusy(true);
            try {
              const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
              const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
              const w = Math.round(bitmap.width * scale);
              const h = Math.round(bitmap.height * scale);
              const canvas = document.createElement("canvas");
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext("2d");
              if (!ctx) return;
              ctx.drawImage(bitmap, 0, 0, w, h);
              bitmap.close?.();
              const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
              if (!blob) return;
              const supabase = createClient();
              // Nettoyage de l'ancienne image si remplacement
              if (cBadgeImage) {
                const old = cBadgeImage.split("/badges/")[1];
                if (old) supabase.storage.from("badges").remove([old]).catch(() => {});
              }
              const path = `${editingChallengeId ?? `tmp-${Date.now()}`}.jpg`;
              const { error } = await supabase.storage.from("badges").upload(path, blob, {
                contentType: "image/jpeg", upsert: true, cacheControl: "31536000",
              });
              if (!error) setCBadgeImage(supabase.storage.from("badges").getPublicUrl(path).data.publicUrl);
            } finally {
              setBadgeImgBusy(false);
            }
          }

          function saveChallenge() {
            if (!cTitle.trim()) return;
            const val = parseInt(cCondValue) || 1;
            if (editingChallengeId) {
              updateLibrary((lib) => {
                const ch = (lib.challenges ?? []).find((c) => c.id === editingChallengeId);
                if (ch) Object.assign(ch, { icon: cIcon, title: cTitle.trim(), description: cDesc.trim(), condition: { type: cCondType, value: val }, color: cColor, badgeImage: cBadgeImage || undefined });
              });
              setEditingChallengeId(null);
            } else {
              const newChallenge: Challenge = { id: uid(), icon: cIcon, title: cTitle.trim(), description: cDesc.trim(), condition: { type: cCondType, value: val }, color: cColor, badgeImage: cBadgeImage || undefined };
              updateLibrary((lib) => { lib.challenges = [...(lib.challenges ?? []), newChallenge]; });
            }
            setCIcon("🏆"); setCTitle(""); setCDesc(""); setCCondType("session_count"); setCCondValue("10"); setCColor(PRESET_COLORS[0]); setCBadgeImage("");
          }

          function startEdit(ch: Challenge) {
            setEditingChallengeId(ch.id);
            setCIcon(ch.icon); setCTitle(ch.title); setCDesc(ch.description);
            setCCondType(ch.condition.type); setCCondValue(String(ch.condition.value));
            setCColor(ch.color ?? PRESET_COLORS[0]);
            setCBadgeImage(ch.badgeImage ?? "");
          }

          function cancelEdit() {
            setEditingChallengeId(null);
            setCIcon("🏆"); setCTitle(""); setCDesc(""); setCCondType("session_count"); setCCondValue("10"); setCColor(PRESET_COLORS[0]); setCBadgeImage("");
          }

          return (
            <div>
              <section className="mb-5 rounded-2xl border border-line bg-surface p-4">
                <h3 className="mb-3 font-bold">{editingChallengeId ? "Modifier le défi" : "Nouveau défi"}</h3>
                <div className="mb-3 grid grid-cols-[52px_52px_1fr] gap-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] text-dim">Icône</span>
                    <input value={cIcon} onChange={(e) => setCIcon(e.target.value)} className="text-center text-lg" maxLength={4} />
                  </label>
                  {/* Upload image badge */}
                  <div>
                    <span className="mb-1.5 block text-[13px] text-dim">Image</span>
                    <button
                      type="button"
                      onClick={() => badgeFileRef.current?.click()}
                      disabled={badgeImgBusy}
                      className="relative flex h-10 w-full items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-line bg-surface2 transition hover:border-accent disabled:opacity-60"
                      title="Uploader une image de badge"
                    >
                      {badgeImgBusy ? (
                        <span className="text-sm animate-pulse">⏳</span>
                      ) : cBadgeImage ? (
                        <img src={cBadgeImage} alt="badge" className="h-full w-full object-cover rounded-[9px]" />
                      ) : (
                        <span className="text-sm">🖼️</span>
                      )}
                    </button>
                    {cBadgeImage && (
                      <button type="button" onClick={() => setCBadgeImage("")} className="mt-0.5 w-full text-[10px] text-center text-dim hover:text-danger">Retirer</button>
                    )}
                    <input ref={badgeFileRef} type="file" accept="image/*" className="hidden" onChange={handleBadgeImageUpload} />
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] text-dim">Titre</span>
                    <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Ex : Premier pas" />
                  </label>
                </div>
                <label className="mb-3 block">
                  <span className="mb-1.5 block text-[13px] text-dim">Description</span>
                  <input value={cDesc} onChange={(e) => setCDesc(e.target.value)} placeholder="Ce que le sportif doit accomplir…" />
                </label>
                <div className="mb-3 grid grid-cols-[1fr_80px] gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] text-dim">Condition</span>
                    <select value={cCondType} onChange={(e) => setCCondType(e.target.value as ChallengeConditionType)} className="w-full">
                      {(Object.entries(CONDITION_LABELS) as [ChallengeConditionType, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] text-dim">Valeur</span>
                    <input type="number" min="1" value={cCondValue} onChange={(e) => setCCondValue(e.target.value)} className="text-center" />
                  </label>
                </div>
                {/* Sélecteur de couleur */}
                <div className="mb-4">
                  <span className="mb-1.5 block text-[13px] text-dim">Couleur du badge</span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setCColor(hex)}
                        className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                        style={{ background: hex, outline: cColor === hex ? `3px solid ${hex}` : "none", outlineOffset: "2px", transform: cColor === hex ? "scale(1.15)" : undefined }}
                        aria-label={hex}
                      />
                    ))}
                    {/* Aperçu */}
                    <div className="ml-auto flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: cColor + "20", border: `1px solid ${cColor}50` }}>
                      {cBadgeImage ? (
                        <img src={cBadgeImage} alt="badge" className="h-8 w-8 rounded-lg object-cover" />
                      ) : (
                        <span className="text-xl">{cIcon || "🏆"}</span>
                      )}
                      <span className="text-[13px] font-semibold" style={{ color: cColor }}>{cTitle || "Aperçu"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveChallenge} disabled={!cTitle.trim()} className="flex-1 rounded-xl bg-accent py-2.5 font-semibold text-[#1a1500] disabled:opacity-40">
                    {editingChallengeId ? "Enregistrer" : "+ Créer le défi"}
                  </button>
                  {editingChallengeId && (
                    <button onClick={cancelEdit} className="rounded-xl bg-surface2 px-4 py-2.5 font-semibold text-dim">Annuler</button>
                  )}
                </div>
              </section>

              {challenges.length === 0 ? (
                <p className="py-10 text-center text-dim">Aucun défi créé pour l&apos;instant.</p>
              ) : (
                <div className="space-y-3">
                  {challenges.map((ch) => {
                    const color = ch.color ?? PRESET_COLORS[0];
                    const lighter = lightenHex(color);
                    const isEditing = editingChallengeId === ch.id;
                    return (
                      <div key={ch.id} className={`overflow-hidden rounded-2xl transition ${isEditing ? "ring-2 ring-accent/50" : ""}`} style={{ border: `0.5px solid ${color}50` }}>
                        {/* Bandeau gradient pleine largeur */}
                        <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: `linear-gradient(135deg, ${color}, ${lighter})` }}>
                          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-2xl" style={{ background: "rgba(255,255,255,0.20)" }}>
                            {ch.badgeImage ? (
                              <img src={ch.badgeImage} alt={ch.title} className="h-full w-full object-cover" />
                            ) : ch.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white leading-tight">{ch.title}</p>
                            {ch.description && <p className="truncate text-[12px] text-white/70">{ch.description}</p>}
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button onClick={() => startEdit(ch)} className="grid h-8 w-8 place-items-center rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.22)" }} aria-label="Modifier">✏️</button>
                            <button onClick={() => {
                              const badgePath = ch.badgeImage?.split("/badges/")[1];
                              if (badgePath) createClient().storage.from("badges").remove([badgePath]).catch(() => {});
                              updateLibrary((lib) => { lib.challenges = (lib.challenges ?? []).filter((c) => c.id !== ch.id); });
                            }} className="grid h-8 w-8 place-items-center rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.22)" }} aria-label="Supprimer">🗑️</button>
                          </div>
                        </div>
                        {/* Pied de carte */}
                        <div className="flex items-center bg-surface px-4 py-2">
                          <p className="text-[12px] text-dim">{CONDITION_LABELS[ch.condition.type]} — <strong className="text-ink">{ch.condition.value}</strong></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // ---- Vue client : badges visuels ----
        if (challenges.length === 0) {
          return <p className="py-10 text-center text-dim">Aucun défi disponible pour l&apos;instant.</p>;
        }

        const newlyUnlocked = challenges.filter((ch) => {
          const badge = (state.badges ?? []).find((b) => b.challengeId === ch.id);
          return badge && badge.unlockedAt === today();
        });

        return (
          <div>
            {/* Bannière de félicitations si nouveau badge aujourd'hui */}
            {newlyUnlocked.length > 0 && (
              <div className="mb-4 rounded-2xl border border-ok/40 bg-ok/10 p-4 text-center">
                <p className="text-2xl mb-1">🎉</p>
                <p className="font-bold text-ok">
                  {newlyUnlocked.length === 1
                    ? `Badge débloqué : ${newlyUnlocked[0].title} !`
                    : `${newlyUnlocked.length} badges débloqués aujourd'hui !`}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {challenges.map((ch) => {
                const prog = computeChallengeProgress(ch, state);
                const unlocked = unlockedIds.has(ch.id);
                const unlockedAt = (state.badges ?? []).find((b) => b.challengeId === ch.id)?.unlockedAt;
                return <BadgeCard key={ch.id} ch={ch} prog={prog} unlocked={unlocked} unlockedAt={unlockedAt ?? null} />;
              })}
            </div>
          </div>
        );
      })()}

      {/* ===== TAB : MA CARTE ===== */}
      {tab === "map" && (canEdit || lib.mapVisible) && (
        <div>
          {canEdit && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <span className="text-base">🚧</span>
              <p className="text-[12px] text-dim">
                Carte de la communauté. <strong className="text-ink">Masquée aux sportifs</strong> pour
                l&apos;instant — seuls ceux qui ont coché « Visible sur la carte » dans leur profil y apparaissent.
              </p>
            </div>
          )}
          <CommunityMap />
        </div>
      )}
    </div>
  );
}

// ---- Badge components ----

function CircularGauge({ pct, color, children }: { pct: number; color: string; children: React.ReactNode }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto 10px" }}>
      <svg width="88" height="88" style={{ position: "absolute", inset: 0 }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-surface2" />
        {pct > 0 && (
          <circle
            cx="44" cy="44" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
          />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

function BadgeCard({ ch, prog, unlocked, unlockedAt }: {
  ch: Challenge;
  prog: { current: number; target: number; pct: number };
  unlocked: boolean;
  unlockedAt: string | null;
}) {
  const color = ch.color ?? PRESET_COLORS[0];
  const locked = prog.pct === 0 && !unlocked;

  return (
    <div
      className="rounded-2xl p-4 text-center transition"
      style={{
        border: unlocked ? `1.5px solid ${color}60` : "0.5px solid var(--color-border-tertiary, #e5e5e5)",
        background: unlocked ? `${color}12` : undefined,
        opacity: locked ? 0.55 : 1,
      }}
    >
      <CircularGauge pct={unlocked ? 100 : prog.pct} color={color}>
        {ch.badgeImage && !locked ? (
          <img src={ch.badgeImage} alt={ch.title} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span style={{ fontSize: 30, filter: locked ? "grayscale(1)" : "none" }}>
            {locked ? "🔒" : ch.icon}
          </span>
        )}
      </CircularGauge>

      <p className="text-[13px] font-bold leading-tight mb-1" style={{ color: unlocked ? color : undefined }}>
        {ch.title}
      </p>

      {unlocked ? (
        <p className="text-[11px] text-dim">
          Débloqué{unlockedAt ? ` le ${new Date(unlockedAt + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}
        </p>
      ) : (
        <>
          <p className="text-[12px] font-semibold" style={{ color }}>
            {prog.current}<span className="text-dim font-normal">/{prog.target}</span>
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-surface2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${prog.pct}%`, background: color }} />
          </div>
          <p className="mt-1 text-[10px] text-dim">{CONDITION_LABELS[ch.condition.type]}</p>
        </>
      )}
    </div>
  );
}

// ---- Sub-components ----

function TabButton({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
        active ? "bg-surface text-ink shadow-sm" : "text-dim hover:text-ink"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1 text-[11px] ${active ? "text-dim" : "text-dim/60"}`}>({count})</span>
      )}
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

function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  const id = youtubeId(url);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg">
        <div className="mb-2 flex justify-end">
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20"
          >✕</button>
        </div>
        {id ? (
          <div className="overflow-hidden rounded-2xl" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="rounded-2xl bg-surface p-6 text-center">
            <p className="mb-3 text-dim">Lien non-YouTube — ouverture externe</p>
            <a href={url} target="_blank" rel="noreferrer"
              className="rounded-xl bg-accent px-4 py-2 font-semibold text-[#1a1500]">
              Ouvrir la vidéo ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function ExerciseCard({ ex, tagLabels, canEdit, isFav, onFav, onView, onEdit, onDelete }: {
  ex: LibraryExercise; tagLabels: string[]; canEdit: boolean;
  isFav: boolean; onFav: () => void;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
      <div
        className="group cursor-pointer rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/40"
        onClick={canEdit ? onEdit : onView}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold transition-colors group-hover:text-accent">{ex.name}</h3>
          <div className="flex shrink-0 items-center gap-1">
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
          {ex.video && (
            <button
              onClick={(e) => { e.stopPropagation(); setVideoOpen(true); }}
              className="flex items-center gap-1 rounded-lg bg-accent2/15 px-2.5 py-1 text-[12px] font-semibold text-accent2 transition hover:bg-accent2/25"
            >
              ▶ Vidéo
            </button>
          )}
          {ex.comment && <span className="truncate text-[12px] italic text-dim">💬 {ex.comment}</span>}
        </div>
      </div>

      {videoOpen && ex.video && (
        <VideoModal url={ex.video} onClose={() => setVideoOpen(false)} />
      )}
    </>
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
