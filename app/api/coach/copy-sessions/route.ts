import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionInstance } from "@/lib/types";

/**
 * POST /api/coach/copy-sessions
 * Copie des séances depuis le profil courant vers un autre sportif.
 * Body: { sessions: SessionInstance[], targetClientId: string, withDates: boolean }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Vérifier rôle coach/admin
  const { data: profile } = await admin
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["coach", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { sessions, targetClientId, withDates } = body ?? {};

  if (!sessions?.length || !targetClientId) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  // Vérifier que le client cible appartient à ce coach
  const { data: link } = await admin
    .from("coach_client")
    .select("client_id")
    .eq("coach_id", user.id)
    .eq("client_id", targetClientId)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "Client non trouvé" }, { status: 403 });

  // Lire l'app_state du client cible
  const { data: row } = await admin
    .from("app_state").select("data").eq("user_id", targetClientId).maybeSingle();
  const current = (row?.data ?? {}) as Record<string, unknown>;
  const existingSessions: SessionInstance[] = (current.sessions as SessionInstance[] | undefined) ?? [];

  // Cloner les séances avec nouveaux IDs, RPE client et commentaires client remis à zéro
  const copies: SessionInstance[] = sessions.map((s: SessionInstance) => ({
    ...structuredClone(s),
    id: crypto.randomUUID(),
    done: false,
    emoji: 0,
    coachComment: s.coachComment,
    date: withDates ? s.date : null,
    exercises: s.exercises.map((ex) => ({
      ...structuredClone(ex),
      uid: crypto.randomUUID(),
      rpeClient: 0,
      clientComment: "",
      failed: false,
    })),
  }));

  await admin.from("app_state").upsert({
    user_id: targetClientId,
    data: { ...current, sessions: [...existingSessions, ...copies] },
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ copied: copies.length });
}
