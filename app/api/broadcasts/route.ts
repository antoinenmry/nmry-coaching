import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { insertChatMessage } from "@/lib/chat";
import { rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/broadcasts
 * Coach/admin crée un message broadcast visible en pop-up par tous ses sportifs.
 * Body: { message: string, expiresInHours?: number, sports?: string[] }
 * `sports` : n'envoie qu'aux sportifs pratiquant l'un de ces sports (absent = tous).
 *
 * GET /api/broadcasts
 * Récupère les broadcasts actifs pour l'utilisateur connecté (client).
 * Filtrés par coach_id lié au client.
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Vérifier que l'utilisateur est coach ou admin
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Anti-spam : au plus 5 broadcasts / heure par coach (push + fan-out chat à tous).
  const rl = rateLimit(`broadcast:${user.id}`, 5, 3_600_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de broadcasts envoyés, réessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { message, expiresInHours = 24, sports: rawSports } = await req.json().catch(() => ({}));
  const sports: string[] = Array.isArray(rawSports)
    ? rawSports.filter((x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 60).slice(0, 20)
    : [];
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message requis" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Message trop long (max 2000 caractères)" }, { status: 400 });
  }

  const expires_at = new Date(Date.now() + expiresInHours * 3_600_000).toISOString();

  const { data, error } = await admin
    .from("broadcasts")
    .insert({ coach_id: user.id, message: message.trim(), expires_at, ...(sports.length ? { target_sports: sports } : {}) })
    .select()
    .single();

  if (error) {
    console.error("[broadcasts] insert error:", error);
    const missing = sports.length > 0 && /target_sports/.test(error.message ?? "");
    return NextResponse.json(
      { error: missing ? "Envoi par sport indisponible : exécute supabase/broadcast-sports.sql dans Supabase." : "Erreur lors de l'envoi" },
      { status: 500 },
    );
  }

  // Destinataires : tous les sportifs du coach, ou ceux du/des sports ciblés.
  const { data: links } = await admin
    .from("coach_client")
    .select("client_id")
    .eq("coach_id", user.id);
  let recipients: string[] = (links ?? []).map((l: { client_id: string }) => l.client_id);
  if (sports.length && recipients.length) {
    const { data: rows } = await admin
      .from("app_state")
      .select("user_id, sports:data->profile->sports")
      .in("user_id", recipients);
    const wanted = new Set(sports);
    recipients = ((rows as { user_id: string; sports: string[] | null }[] | null) ?? [])
      .filter((r) => Array.isArray(r.sports) && r.sports.some((x) => wanted.has(x)))
      .map((r) => r.user_id);
  }

  // Notification push (fire-and-forget)
  Promise.allSettled(
    recipients.map((id) =>
      sendPushToUser(id, {
        title: sports.length ? `Message de votre coach · ${sports.join(", ")}` : "Message de votre coach",
        body: message.trim().slice(0, 100),
        url: "/followup",
      }),
    ),
  ).catch(() => {});

  // Fan-out dans le chat de chaque destinataire
  if (recipients.length) {
    const { data: coachProfile } = await admin
      .from("profiles").select("name").eq("id", user.id).maybeSingle();
    const coachName = (coachProfile as { name?: string } | null)?.name || "Coach";

    await Promise.allSettled(
      recipients.map((client_id) =>
        insertChatMessage(admin, {
          coachId: user.id,
          clientId: client_id,
          senderId: user.id,
          senderName: coachName,
          text: message.trim(),
          type: "broadcast",
        })
      )
    );
  }

  return NextResponse.json(data);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Trouver le coach du client
  const { data: assignment } = await admin
    .from("coach_client")
    .select("coach_id")
    .eq("client_id", user.id)
    .maybeSingle();

  if (!assignment?.coach_id) {
    return NextResponse.json([]);
  }

  // Récupérer les broadcasts actifs (non expirés)
  // `target_sports` n'existe qu'après supabase/broadcast-sports.sql : repli sans la colonne.
  type B = { id: string; message: string; created_at: string; expires_at: string; target_sports?: string[] | null };
  let list: B[] = [];
  {
    const q1 = await admin
      .from("broadcasts")
      .select("id, message, created_at, expires_at, target_sports")
      .eq("coach_id", assignment.coach_id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (!q1.error) list = (q1.data as B[] | null) ?? [];
    else {
      const q2 = await admin
        .from("broadcasts")
        .select("id, message, created_at, expires_at")
        .eq("coach_id", assignment.coach_id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      list = (q2.data as B[] | null) ?? [];
    }
  }
  // Messages ciblés par sport : visibles seulement par les sportifs de ce sport.
  if (list.some((b) => b.target_sports?.length)) {
    const { data: mine } = await admin.from("app_state").select("sports:data->profile->sports").eq("user_id", user.id).maybeSingle();
    const my = new Set(((mine as { sports?: string[] | null } | null)?.sports) ?? []);
    list = list.filter((b) => !b.target_sports?.length || b.target_sports.some((x) => my.has(x)));
  }
  const broadcasts = list.map(({ id, message, created_at, expires_at }) => ({ id, message, created_at, expires_at }));

  // Identité du coach (nom + photo URL) pour afficher sa bulle sur la pop-up.
  // Photo : uniquement une URL Storage (jamais un base64 legacy, trop lourd).
  const [{ data: coachProfile }, { data: coachState }] = await Promise.all([
    admin.from("profiles").select("name").eq("id", assignment.coach_id).maybeSingle(),
    admin.from("app_state").select("photo:data->profile->>photo").eq("user_id", assignment.coach_id).maybeSingle(),
  ]);
  const rawPhoto = (coachState as { photo?: string | null } | null)?.photo ?? "";
  const coachName = (coachProfile as { name?: string } | null)?.name ?? "";
  const coachPhoto = /^https?:\/\//.test(rawPhoto) ? rawPhoto : undefined;

  return NextResponse.json(
    (broadcasts ?? []).map((b) => ({ ...b, coachName, coachPhoto })),
  );
}
