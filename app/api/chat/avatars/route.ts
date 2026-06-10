import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCoachOf } from "@/lib/chat";

/**
 * GET /api/chat/avatars?clientId=…
 * Renvoie les photos (base64) des participants d'une conversation, HORS du
 * chemin critique du chat : { client: {id, photo?}, coach: {id, photo?} }.
 *
 * Les messages se chargent via /api/chat sans attendre ces photos (parfois
 * lourdes pour de vieux uploads). Le front les fusionne dans les avatars ensuite.
 *
 * Autorisation : identique à GET /api/chat (sa propre conversation, ou
 * coach/admin de la conversation).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const myRole = (me as { role?: string } | null)?.role ?? "client";
  const isElevated = myRole === "coach" || myRole === "admin";

  const paramClient = req.nextUrl.searchParams.get("clientId");
  const clientId = isElevated ? paramClient : user.id;
  if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

  // Autorisation : ma propre conversation, ou coach/admin du client
  if (clientId !== user.id) {
    if (!isElevated) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (myRole === "coach") {
      const { data: link } = await admin
        .from("coach_client").select("client_id")
        .eq("coach_id", user.id).eq("client_id", clientId).maybeSingle();
      if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const coachId = await getCoachOf(admin, clientId);
  const ids = [clientId, ...(coachId ? [coachId] : [])];

  // On ne lit QUE la photo (chemin JSON), pas le blob app_state entier.
  const { data: photos } = await admin
    .from("app_state")
    .select("user_id, photo:data->profile->>photo")
    .in("user_id", ids);
  const photoMap = new Map(
    (photos as { user_id: string; photo?: string | null }[] | null ?? []).map(p => [p.user_id, p.photo]),
  );
  const photoOf = (id: string) => {
    const photo = photoMap.get(id);
    return typeof photo === "string" && photo ? photo : undefined;
  };

  return NextResponse.json({
    client: { id: clientId, photo: photoOf(clientId) },
    coach: coachId ? { id: coachId, photo: photoOf(coachId) } : null,
  });
}
