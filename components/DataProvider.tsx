"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AUTH_ENABLED } from "@/lib/config";
import {
  emptyState,
  type AppState,
  type ExerciseLibrary,
  type Profile,
  type Role,
  type TemplateLibrary,
} from "@/lib/types";
type Mode = "auth" | "local";

const LOCAL_KEY = "nmry-local-state";
const LOCAL_ROLE_KEY = "nmry-local-role";
const COACH_CLIENT_KEY = "nmry-coach-selected-client";
const LOCAL_PROFILE: Profile = { id: "local", email: "", name: "Moi", role: "client" };
const EMPTY_TEMPLATES: TemplateLibrary = { sessionTemplates: [], weekTemplates: [] };

function loadLocal(): AppState {
  if (typeof window === "undefined") return emptyState();
  try {
    return { ...emptyState(), ...JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") };
  } catch {
    return emptyState();
  }
}

function savedRole(): Role {
  if (typeof window === "undefined") return "client";
  const r = localStorage.getItem(LOCAL_ROLE_KEY);
  return r === "coach" || r === "client" || r === "admin" ? r : "client";
}

interface DataContextValue {
  me: Profile | null;
  state: AppState;
  update: (recipe: (draft: AppState) => void) => void;
  library: ExerciseLibrary;
  updateLibrary: (recipe: (draft: ExerciseLibrary) => void) => void;
  flushLibrary: () => Promise<void>;
  templates: TemplateLibrary;
  updateTemplates: (recipe: (draft: TemplateLibrary) => void) => void;
  loading: boolean;
  saving: boolean;
  activeUserId: string | null;
  clients: Profile[];
  switchClient: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  role: Role;
  setRole: (r: Role) => void;
  previewAsClient: boolean;
  setPreviewAsClient: (v: boolean) => void;
  hasCoach: boolean; // false = client sans coach affecté (accès bloqué)
  /** Coach : { [clientId]: ISOstring } — dernière notif programme par sportif */
  planNotifSentAt: Record<string, string>;
  /** Enregistre localement qu'une notif vient d'être envoyée (le serveur gère la persistence) */
  recordPlanNotif: (clientId: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData doit être utilisé dans <DataProvider>");
  return ctx;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("local");
  const [me, setMe] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Profile[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [state, setState] = useState<AppState>(emptyState());
  const [library, setLibraryState] = useState<ExerciseLibrary>(emptyState().library);
  const [templates, setTemplates] = useState<TemplateLibrary>(EMPTY_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRoleState] = useState<Role>("client");
  const [previewAsClient, setPreviewAsClient] = useState(false);
  const [hasCoach, setHasCoach] = useState(true); // optimiste par défaut
  const [planNotifSentAt, setPlanNotifSentAt] = useState<Record<string, string>>({});

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    if (typeof window !== "undefined") localStorage.setItem(LOCAL_ROLE_KEY, r);
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libraryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const templatesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  const libraryRef = useRef(library);
  const templatesRef = useRef(templates);
  const activeRef = useRef(activeUserId);
  const modeRef = useRef(mode);
  const meRef = useRef(me);
  stateRef.current = state;
  libraryRef.current = library;
  templatesRef.current = templates;
  activeRef.current = activeUserId;
  modeRef.current = mode;
  meRef.current = me;

  const loadStateFor = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("app_state")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      setActiveUserId(userId);
      setState({ ...emptyState(), ...(data?.data ?? {}) });
    },
    [supabase],
  );

  useEffect(() => {
    // --- Mode local forcé (AUTH_ENABLED = false) ---
    if (!AUTH_ENABLED) {
      const local = loadLocal();
      setMode("local");
      setMe(LOCAL_PROFILE);
      setActiveUserId(LOCAL_PROFILE.id);
      setState(local);
      setLibraryState(local.library);
      setRoleState(savedRole());
      setLoading(false);
      return;
    }

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // --- Non connecté ---
      if (!user) {
        router.replace("/login");
        return;
      }

      // --- Compte Supabase ---
      setMode("auth");
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,email,name,role,status,vacation_start,vacation_end")
        .eq("id", user.id)
        .maybeSingle();
      const myProfile: Profile =
        profile ?? { id: user.id, email: user.email ?? "", name: "", role: "client" };
      setMe(myProfile);
      setRoleState(myProfile.role);

      // Charger la bibliothèque globale (partagée entre tous les comptes)
      const { data: libRow } = await supabase
        .from("library_state")
        .select("data")
        .eq("id", 1)
        .maybeSingle();
      setLibraryState((libRow?.data as ExerciseLibrary | null) ?? emptyState().library);

      // Charger les templates (coach/admin uniquement — RLS bloque les clients)
      if (myProfile.role === "coach" || myProfile.role === "admin") {
        const res = await fetch("/api/templates");
        if (res.ok) setTemplates((await res.json()) as TemplateLibrary);
      }

      // Helper : charger planNotifSentAt depuis les préférences propres au coach
      const coachUserId = user.id;
      async function loadCoachPlanNotif() {
        const { data: ownRow } = await supabase
          .from("app_state").select("data").eq("user_id", coachUserId).maybeSingle();
        const ownPrefs = (ownRow?.data as Record<string,unknown> | null)?.preferences as Record<string,unknown> | undefined;
        if (ownPrefs?.planNotifSentAt) {
          setPlanNotifSentAt(ownPrefs.planNotifSentAt as Record<string, string>);
        }
      }

      if (myProfile.role === "admin") {
        // Admin : voit tous les profils (clients + coaches)
        const { data: all } = await supabase
          .from("profiles")
          .select("id,email,name,role,status,vacation_start,vacation_end")
          .order("created_at");
        const list = (all ?? []) as Profile[];
        setClients(list);
        const savedId = typeof window !== "undefined" ? localStorage.getItem(COACH_CLIENT_KEY) : null;
        const savedClient = savedId ? list.find((c) => c.id === savedId) : null;
        await Promise.all([
          loadStateFor(savedClient ? savedClient.id : user.id),
          loadCoachPlanNotif(),
        ]);
      } else if (myProfile.role === "coach") {
        // Coach : uniquement ses clients affectés
        const { data: assignments } = await supabase
          .from("coach_client")
          .select("client_id")
          .eq("coach_id", user.id);
        const assignedIds = (assignments ?? []).map((a: { client_id: string }) => a.client_id);
        let list: Profile[] = [];
        if (assignedIds.length > 0) {
          const { data: assigned } = await supabase
            .from("profiles")
            .select("id,email,name,role,status,vacation_start,vacation_end")
            .in("id", assignedIds)
            .order("created_at");
          list = (assigned ?? []) as Profile[];
        }
        setClients(list);
        const savedId = typeof window !== "undefined" ? localStorage.getItem(COACH_CLIENT_KEY) : null;
        const savedClient = savedId ? list.find((c) => c.id === savedId) : null;
        await Promise.all([
          loadStateFor(savedClient ? savedClient.id : user.id),
          loadCoachPlanNotif(),
        ]);
      } else {
        // Client : vérifier qu'il a un coach affecté via l'API (bypass RLS coach_client)
        // En cas d'erreur réseau on laisse passer (fail-open) pour ne pas bloquer les clients existants
        try {
          const res = await fetch("/api/me/has-coach");
          if (res.ok) {
            const { hasCoach } = await res.json();
            setHasCoach(hasCoach);
          }
          // Si res not ok : hasCoach reste true par défaut (fail-open)
        } catch {
          // Erreur réseau : hasCoach reste true (fail-open)
        }
        await loadStateFor(user.id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushNow = useCallback(async () => {
    const userId = activeRef.current;
    if (!userId) return;

    if (modeRef.current !== "auth") {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(stateRef.current));
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const isCoachSaving = ["coach","admin"].includes(meRef.current?.role ?? "");
    const { error } = await supabase.from("app_state").upsert({
      user_id: userId,
      data: stateRef.current,
      updated_at: now,
      ...(isCoachSaving
        ? { updated_by_coach_at: now }
        : { updated_by_client_at: now }),
    });
    if (error) console.error("Sauvegarde échouée", error);
    setSaving(false);
  }, [supabase]);

  const pushLibraryNow = useCallback(async () => {
    if (modeRef.current !== "auth") return;
    const res = await fetch("/api/library", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(libraryRef.current),
    });
    if (!res.ok) console.error("Sauvegarde bibliothèque échouée", await res.text());
  }, []);

  const pushTemplatesNow = useCallback(async () => {
    if (modeRef.current !== "auth") return;
    const res = await fetch("/api/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(templatesRef.current),
    });
    if (!res.ok) console.error("Sauvegarde templates échouée", await res.text());
  }, []);

  const update = useCallback(
    (recipe: (draft: AppState) => void) => {
      if (
        modeRef.current === "auth" &&
        meRef.current?.role === "client" &&
        activeRef.current !== meRef.current?.id
      ) {
        console.error("[NMRY] Écriture refusée : client ne peut modifier que ses propres données.");
        return;
      }
      setState((prev) => {
        const next = structuredClone(prev);
        recipe(next);
        return next;
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(pushNow, 500);
    },
    [pushNow],
  );

  const updateLibrary = useCallback(
    (recipe: (draft: ExerciseLibrary) => void) => {
      if (modeRef.current !== "auth") {
        update((s) => { recipe(s.library); });
        return;
      }
      setLibraryState((prev) => {
        const next = structuredClone(prev);
        recipe(next);
        return next;
      });
      if (libraryTimer.current) clearTimeout(libraryTimer.current);
      libraryTimer.current = setTimeout(pushLibraryNow, 500);
    },
    [pushLibraryNow, update],
  );

  const updateTemplates = useCallback(
    (recipe: (draft: TemplateLibrary) => void) => {
      if (modeRef.current === "auth" && !["coach","admin"].includes(meRef.current?.role ?? "")) {
        console.error("[NMRY] Modification templates refusée : rôle insuffisant.");
        return;
      }
      setTemplates((prev) => {
        const next = structuredClone(prev);
        recipe(next);
        return next;
      });
      if (templatesTimer.current) clearTimeout(templatesTimer.current);
      templatesTimer.current = setTimeout(pushTemplatesNow, 500);
    },
    [pushTemplatesNow],
  );

  const switchClient = useCallback(
    async (userId: string) => {
      setLoading(true);
      if (typeof window !== "undefined") localStorage.setItem(COACH_CLIENT_KEY, userId);
      await loadStateFor(userId);
      setLoading(false);
    },
    [loadStateFor],
  );

  const signOut = useCallback(async () => {
    if (modeRef.current === "auth") await supabase.auth.signOut();
    router.replace("/login");
  }, [supabase, router]);

  const recordPlanNotif = useCallback((clientId: string) => {
    setPlanNotifSentAt((prev) => ({ ...prev, [clientId]: new Date().toISOString() }));
  }, []);

  return (
    <DataContext.Provider
      value={{
        me, state, update,
        library, updateLibrary, flushLibrary: pushLibraryNow,
        templates, updateTemplates,
        loading, saving,
        activeUserId, clients, switchClient, signOut,
        role: previewAsClient ? "client" : role,
        setRole, previewAsClient, setPreviewAsClient,
        hasCoach,
        planNotifSentAt, recordPlanNotif,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
