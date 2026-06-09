import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";
import type { TemplateLibrary } from "@/lib/types";

const EMPTY: TemplateLibrary = { sessionTemplates: [], weekTemplates: [] };

/**
 * GET /api/templates
 * Retourne la bibliothèque de templates (séances types + semaines types).
 * Accessible uniquement aux rôles coach et admin.
 */
export async function GET() {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("template_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();

  if (error) { console.error("[templates] error:", error); return NextResponse.json({ error: "Erreur interne" }, { status: 500 }); }
  return NextResponse.json((data?.data as TemplateLibrary) ?? EMPTY);
}

/**
 * PUT /api/templates
 * Remplace la bibliothèque de templates.
 * Accessible uniquement aux rôles coach et admin.
 */
export async function PUT(req: NextRequest) {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as TemplateLibrary | null;
  if (!body || typeof body !== "object" || !Array.isArray(body.sessionTemplates) || !Array.isArray(body.weekTemplates)) {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("template_state")
    .upsert({ id: 1, data: body, updated_at: new Date().toISOString() });

  if (error) { console.error("[templates] error:", error); return NextResponse.json({ error: "Erreur interne" }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
