import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";

/**
 * Notes privées du coach sur un sportif (jamais visibles par le sportif).
 * GET    /api/coach/notes?clientId=…   → { notes }
 * POST   /api/coach/notes { clientId, text } → { note }
 * DELETE /api/coach/notes?id=…
 * Accès : le coach affecté au sportif, ou un admin.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING_TABLE = { error: "Notes indisponibles : la table coach_notes n'existe pas encore (supabase/coach-notes.sql)." };

type Admin = ReturnType<typeof createAdminClient>;

async function canSee(admin: Admin, caller: { user: { id: string }; role: string }, clientId: string) {
  if (caller.role === "admin") return true;
  const { data } = await admin
    .from("coach_client").select("client_id")
    .eq("coach_id", caller.user.id).eq("client_id", clientId).maybeSingle();
  return !!data;
}

const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";

export async function GET(req: NextRequest) {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = req.nextUrl.searchParams.get("clientId") ?? "";
  if (!UUID_RE.test(clientId)) return NextResponse.json({ error: "clientId invalide" }, { status: 400 });

  const admin = createAdminClient();
  if (!(await canSee(admin, caller, clientId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await admin
    .from("coach_notes")
    .select("id, body, author_id, author_name, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    if (isMissingTable(error)) return NextResponse.json(MISSING_TABLE, { status: 503 });
    console.error("[coach/notes] GET", error);
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const clientId = String(body?.clientId ?? "");
  const text = String(body?.text ?? "").trim();
  if (!UUID_RE.test(clientId)) return NextResponse.json({ error: "clientId invalide" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Note vide" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Note trop longue (2 000 caractères max)." }, { status: 400 });

  const admin = createAdminClient();
  if (!(await canSee(admin, caller, clientId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: me } = await admin.from("profiles").select("name").eq("id", caller.user.id).maybeSingle();
  const { data, error } = await admin
    .from("coach_notes")
    .insert({
      client_id: clientId,
      author_id: caller.user.id,
      author_name: (me as { name?: string } | null)?.name || caller.user.email || "Coach",
      body: text,
    })
    .select("id, body, author_id, author_name, created_at")
    .single();
  if (error) {
    if (isMissingTable(error)) return NextResponse.json(MISSING_TABLE, { status: 503 });
    console.error("[coach/notes] POST", error);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }
  return NextResponse.json({ note: data });
}

export async function DELETE(req: NextRequest) {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "id invalide" }, { status: 400 });

  const admin = createAdminClient();
  const { data: note, error } = await admin.from("coach_notes").select("client_id").eq("id", id).maybeSingle();
  if (error && isMissingTable(error)) return NextResponse.json(MISSING_TABLE, { status: 503 });
  if (!note) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!(await canSee(admin, caller, (note as { client_id: string }).client_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await admin.from("coach_notes").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
