import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToCoachClients } from "@/lib/push";
import { insertChatMessage } from "@/lib/chat";
import { rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/broadcasts
 * Coach/admin crée un message broadcast visible en pop-up par tous ses sportifs.
 * Body: { message: string, expiresInHours?: number }
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

  const { message, expiresInHours = 24 } = await req.json().catch(() => ({}));
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message requis" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Message trop long (max 2000 caractères)" }, { status: 400 });
  }

  const expires_at = new Date(Date.now() + expiresInHours * 3_600_000).toISOString();

  const { data, error } = await admin
    .from("broadcasts")
    .insert({ coach_id: user.id, message: message.trim(), expires_at })
    .select()
    .single();

  if (error) {
    console.error("[broadcasts] insert error:", error);
    return NextResponse.json({ error: "Erreur lors de l'envoi" }, { status: 500 });
  }

  // Notification push à tous les sportifs (fire-and-forget)
  sendPushToCoachClients(user.id, {
    title: "📢 Message de votre coach",
    body: message.trim().slice(0, 100),
    url: "/followup",
  }).catch(() => {});

  // Fan-out dans le chat de chaque sportif
  const { data: links } = await admin
    .from("coach_client")
    .select("client_id")
    .eq("coach_id", user.id);

  if (links?.length) {
    const { data: coachProfile } = await admin
      .from("profiles").select("name").eq("id", user.id).maybeSingle();
    const coachName = (coachProfile as { name?: string } | null)?.name || "Coach";

    await Promise.allSettled(
      links.map(({ client_id }: { client_id: string }) =>
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
  const { data: broadcasts } = await admin
    .from("broadcasts")
    .select("id, message, created_at, expires_at")
    .eq("coach_id", assignment.coach_id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return NextResponse.json(broadcasts ?? []);
}
