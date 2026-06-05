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
import { emptyState, type AppState, type Profile, type Role } from "@/lib/types";
import { isGuestClient, setGuest } from "@/lib/guest";

type Mode = "auth" | "guest" | "local";

// --- Mode local (sans connexion) : persistance dans le navigateur ---
const LOCAL_KEY = "nmry-local-state";
const LOCAL_ROLE_KEY = "nmry-local-role";
const LOCAL_PROFILE: Profile = { id: "local", email: "", name: "Moi", role: "client" };
function loadLocal(): AppState {
  if (typeof window === "undefined") return emptyState();
  try {
    return { ...emptyState(), ...JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") };
  } catch {
    return emptyState();
  }
}

interface DataContextValue {
  me: Profile | null;
  state: AppState;
  /** Met à jour l'état et déclenche une sauvegarde différée. */
  update: (recipe: (draft: AppState) => void) => void;
  loading: boolean;
  saving: boolean;
  activeUserId: string | null;
  clients: Profile[]; // non vide seulement pour le coach
  switchClient: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  role: Role; // rôle effectif (compte si connecté, sinon bascule locale)
  setRole: (r: Role) => void; // n'a d'effet qu'en mode local
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

  const [me, setMe] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Profile[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [state, setState] = useState<AppState>(emptyState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRoleState] = useState<Role>("coach");

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    if (!AUTH_ENABLED && typeof window !== "undefined") localStorage.setItem(LOCAL_ROLE_KEY, r);
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  const activeRef = useRef(activeUserId);
  stateRef.current = state;
  activeRef.current = activeUserId;

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

  // Chargement initial : profil + (clients si coach) + état
  useEffect(() => {
    // Mode local : pas de Supabase, on lit le navigateur.
    if (!AUTH_ENABLED) {
      setMe(LOCAL_PROFILE);
      setActiveUserId(LOCAL_PROFILE.id);
      setState(loadLocal());
      const savedRole = (typeof window !== "undefined" && localStorage.getItem(LOCAL_ROLE_KEY)) as Role | null;
      setRoleState(savedRole === "client" || savedRole === "coach" ? savedRole : "coach");
      setLoading(false);
      return;
    }

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,email,name,role")
        .eq("id", user.id)
        .maybeSingle();
      const myProfile: Profile =
        profile ?? { id: user.id, email: user.email ?? "", name: "", role: "client" };
      setMe(myProfile);
      setRoleState(myProfile.role);

      if (myProfile.role === "coach") {
        const { data: all } = await supabase
          .from("profiles")
          .select("id,email,name,role")
          .order("created_at");
        const list = (all ?? []) as Profile[];
        setClients(list);
        const firstClient = list.find((c) => c.role === "client");
        await loadStateFor(firstClient ? firstClient.id : user.id);
      } else {
        await loadStateFor(user.id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushNow = useCallback(async () => {
    const userId = activeRef.current;
    if (!userId) return;

    // Mode local : on écrit dans le navigateur.
    if (!AUTH_ENABLED) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(stateRef.current));
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("app_state").upsert({
      user_id: userId,
      data: stateRef.current,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("Sauvegarde échouée", error);
    setSaving(false);
  }, [supabase]);

  const update = useCallback(
    (recipe: (draft: AppState) => void) => {
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

  const switchClient = useCallback(
    async (userId: string) => {
      setLoading(true);
      await loadStateFor(userId);
      setLoading(false);
    },
    [loadStateFor],
  );

  const signOut = useCallback(async () => {
    if (!AUTH_ENABLED) return; // pas de connexion en mode local
    await supabase.auth.signOut();
    router.replace("/login");
  }, [supabase, router]);

  return (
    <DataContext.Provider
      value={{ me, state, update, loading, saving, activeUserId, clients, switchClient, signOut, role, setRole }}
    >
      {children}
    </DataContext.Provider>
  );
}
