import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * PUT /api/library
 * Remplace la bibliothèque partagée (library_state id=1).
 * Accessible à tout utilisateur authentifié (coach, admin, sportif).
 * Utilise le service role pour contourner la RLS write-only-coach.
 */
export async function PUT(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("library_state")
    .upsert({ id: 1, data: body, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
