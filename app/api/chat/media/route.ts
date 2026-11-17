import { NextRequest, NextResponse } from "next/server";
import { isPausedClient, pausedResponse } from "@/lib/apiAuth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMediaPath } from "@/lib/media";

const SIGNED_TTL = 60 * 60; // 1 h

/**
 * GET /api/chat/media?p=<chemin>
 * Relais des photos, vidéos et vocaux du chat (bucket privé). Autorisé : le sportif de la
 * conversation, son coach actuel, ou un admin. Répond par une redirection vers une URL signée.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isPausedClient(user.id)) return pausedResponse();

  const p = req.nextUrl.searchParams.get("p");
  if (!isMediaPath(p)) return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });

  const admin = createAdminClient();
  // Le fichier doit appartenir à un message : c'est sa conversation qui donne le droit d'accès.
  let clientId: string | null = null;
  for (const col of ["attachment_path", "audio_path"] as const) {
    const { data } = await admin.from("chat_messages").select("client_id").eq(col, p).limit(1).maybeSingle();
    if (data) { clientId = (data as { client_id: string }).client_id; break; }
  }
  if (!clientId) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  let allowed = clientId === user.id;
  if (!allowed) {
    const [{ data: link }, { data: me }] = await Promise.all([
      admin.from("coach_client").select("client_id").eq("coach_id", user.id).eq("client_id", clientId).maybeSingle(),
      admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    allowed = !!link || (me as { role?: string } | null)?.role === "admin";
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: signed, error } = await admin.storage.from("chat-attachments").createSignedUrl(p, SIGNED_TTL);
  if (error || !signed?.signedUrl) return NextResponse.json({ error: "Fichier indisponible" }, { status: 404 });

  const res = NextResponse.redirect(signed.signedUrl, 302);
  // Le navigateur réutilise la redirection tant que l'URL signée est valable.
  res.headers.set("Cache-Control", `private, max-age=${SIGNED_TTL - 300}`);
  return res;
}
