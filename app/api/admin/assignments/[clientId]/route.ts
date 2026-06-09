import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";

/**
 * DELETE /api/admin/assignments/[clientId]
 * Désaffecte le client de son coach.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const caller = await requireRole(["admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("coach_client")
    .delete()
    .eq("client_id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
