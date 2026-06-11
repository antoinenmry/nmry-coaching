"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useData } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";
import { type BlockNote, type ChatMessage, type Followup } from "@/lib/types";
import MetricsTab from "./MetricsTab";

// Cache mémoire des conversations (par sportif) : réafficher instantanément au
// retour sur l'onglet, puis revalider en arrière-plan. Vit le temps de la session.
type ConvParticipant = { id: string; name: string; photo?: string };
type ConvCache = {
  messages: ChatMessage[];
  participants: { client?: ConvParticipant; coach?: ConvParticipant };
  hasMore: boolean;
};
const chatCache = new Map<string, ConvCache>();

// Cache des avatars par personne (id → photo base64). Indépendant des messages :
// les photos (parfois lourdes) sont chargées hors du chemin critique via
// /api/chat/avatars, et réutilisées d'une conversation à l'autre (instantané).
const avatarCache = new Map<string, string>();

// Convertit une ligne brute chat_messages (Realtime) en ChatMessage.
// ⚡ On omet l'audio (base64) : il reste chargé à la demande au play via messageId.
function rowToChatMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: String(r.id),
    text: (r.body as string) ?? "",
    isUrgent: !!r.is_urgent,
    isVoice: !!r.is_voice,
    audioUrl: undefined,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
    editedAt: (r.edited_at as string) ?? undefined,
    senderId: String(r.sender_id),
    senderName: (r.sender_name as string) ?? undefined,
    isRead: !!r.is_read,
    type: (r.type as ChatMessage["type"]) ?? undefined,
    attachmentUrl: (r.attachment_url as string) ?? undefined,
    attachmentType: (r.attachment_type as ChatMessage["attachmentType"]) ?? undefined,
    attachmentPath: (r.attachment_path as string) ?? undefined,
  };
}

// ─── Utils ────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const todayKey = () => new Date().toISOString().slice(0, 10);
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function frDate(key: string) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
function fmtSec(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, "0")}`;
}
function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function isActive(f: Followup): boolean {
  const today = todayKey();
  if (f.type !== "injury") return false;
  if (f.date > today) return false;
  return !f.dateEnd || f.dateEnd >= today;
}

// ─── Médias chat (compression + limites) ────────────────────────────────────────
const MAX_IMAGE_DIM = 1600;        // px (plus grand côté) — suffisant pour du plein écran mobile
const IMAGE_QUALITY = 0.8;         // qualité JPEG après recompression
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 Mo (pas de compression vidéo côté client)
const fmtMo = (b: number) => `${(b / 1024 / 1024).toFixed(0)} Mo`;

/**
 * Recompresse une image côté navigateur : redimensionne à MAX_IMAGE_DIM et
 * réencode en JPEG. Une photo de smartphone (~8 Mo) descend en général sous 800 Ko.
 * Respecte l'orientation EXIF. Renvoie le fichier d'origine si compression inutile
 * ou impossible (GIF animé, erreur de décodage…).
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest > MAX_IMAGE_DIM) {
      const scale = MAX_IMAGE_DIM / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", IMAGE_QUALITY));
    if (!blob || blob.size >= file.size) return file; // ne jamais alourdir
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#a855f7","#ec4899"];
function avatarBg(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}
const Avatar = memo(function Avatar({ name, photo, size = 26 }: { name?: string; photo?: string; size?: number }) {
  const n = name ?? "?";
  if (photo) {
    return (
      <img src={photo} alt={n} className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div
      className="shrink-0 grid place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: avatarBg(n), fontSize: Math.round(size * 0.38) }}
    >
      {initials(n)}
    </div>
  );
});

// ─── VoicePlayer ──────────────────────────────────────────────────────────────
const SPEEDS = [0.5, 1, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];

function VoicePlayer({ audioUrl, messageId, isMe }: { audioUrl?: string; messageId?: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [error, setError] = useState(false);
  // L'audio n'est pas dans le payload de la liste : on le charge à la demande au play.
  const [src, setSrc] = useState<string | null>(audioUrl ?? null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const wantPlayRef = useRef(false);

  // Quand la source arrive (après chargement paresseux), on lance la lecture.
  useEffect(() => {
    if (!src || !wantPlayRef.current) return;
    wantPlayRef.current = false;
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = speed;
    a.play().catch(() => { setError(true); setPlaying(false); });
  }, [src, speed]);

  // Ni audio inline, ni identifiant pour le charger → placeholder.
  if (!audioUrl && !messageId) return <span className="text-sm text-dim">🎤 Vocal</span>;

  async function fetchAudio() {
    if (src || !messageId) return;
    setLoadingAudio(true);
    try {
      const res = await fetch(`/api/chat/audio?id=${encodeURIComponent(messageId)}`);
      if (res.ok) { const d = await res.json(); if (d.audioUrl) setSrc(d.audioUrl); else setError(true); }
      else setError(true);
    } catch { setError(true); }
    finally { setLoadingAudio(false); }
  }

  // ▶/⏸ — piloté par les events onPlay/onPause (plus fiable que setState direct)
  function toggle() {
    const a = audioRef.current;
    if (playing) { a?.pause(); return; }
    setError(false);
    if (!src) { wantPlayRef.current = true; fetchAudio(); return; } // charge puis joue (effet)
    if (!a) return;
    a.playbackRate = speed;
    a.play().catch((err) => {
      console.warn("[NMRY] Audio play error:", err);
      setError(true);
      setPlaying(false);
    });
  }

  // Seek en cliquant sur la barre
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  }

  function changeSpeed(s: Speed) {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }

  const progressPct = duration ? (current / duration) * 100 : 0;
  const remaining = duration > 0 ? duration - current : 0;

  return (
    <div className="flex min-w-[170px] flex-col gap-1.5">
      {/* Élément audio — preload + playsInline requis iOS Safari */}
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="metadata"
        playsInline
        onLoadedMetadata={(e) => {
          const d = (e.target as HTMLAudioElement).duration;
          setDuration(isFinite(d) ? d : 0);
        }}
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onError={() => { setError(true); setPlaying(false); }}
      />

      {/* Ligne principale : bouton + barre + durée */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="shrink-0 text-base leading-none"
          aria-label={playing ? "Pause" : "Lecture"}
        >
          {error ? "⚠️" : loadingAudio ? "⏳" : playing ? "⏸" : "▶️"}
        </button>

        {/* Barre de progression cliquable */}
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`flex-1 h-2 rounded-full overflow-hidden cursor-pointer ${
            isMe ? "bg-[#1a1500]/20" : "bg-surface2"
          }`}
          onClick={seek}
        >
          <div
            className={`h-full rounded-full ${isMe ? "bg-[#1a1500]/70" : "bg-accent"}`}
            style={{ width: `${progressPct}%`, transition: playing ? "none" : "width .1s" }}
          />
        </div>

        {/* Temps restant */}
        <span className="shrink-0 tabular-nums text-[11px]">
          {duration > 0 ? `-${fmtSec(remaining)}` : "—"}
        </span>
      </div>

      {/* Contrôles de vitesse */}
      <div className="flex items-center gap-1 pl-7">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => changeSpeed(s)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
              speed === s
                ? isMe
                  ? "bg-[#1a1500]/30 text-[#1a1500]"
                  : "bg-accent/20 text-accent"
                : isMe
                  ? "text-[#1a1500]/40 hover:text-[#1a1500]/70"
                  : "text-dim hover:text-ink"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Tab Messages ─────────────────────────────────────────────────────────────
function MessagesTab() {
  const { me, role, clients } = useData();
  const isElevated = role === "coach" || role === "admin";

  // ── Conversation courante (isolée par sportif, stockée en base) ──
  const clientList = clients.filter(c => c.role === "client");
  const [chatClientId, setChatClientId] = useState<string | null>(null);
  // Le coach choisit un sportif ; le sportif est toujours sur sa propre conversation.
  const convClientId = isElevated ? chatClientId : (me?.id ?? null);

  type Participant = { id: string; name: string; photo?: string };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<{ client?: Participant; coach?: Participant }>({});
  // Photos des participants (id → base64), chargées séparément des messages.
  const [avatarPhotos, setAvatarPhotos] = useState<Record<string, string>>({});
  const [chatLoading, setChatLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPrependingRef = useRef(false);

  // Sélectionne le premier sportif une fois la liste chargée (coach)
  useEffect(() => {
    if (isElevated && !chatClientId && clientList.length > 0) {
      setChatClientId(clientList[0].id);
    }
  }, [isElevated, chatClientId, clientList]);

  // Première page : les 15 messages les plus récents.
  // ⚡ Cache-first : si la conversation est déjà en mémoire, on l'affiche
  //    instantanément (pas de spinner) puis on revalide en arrière-plan.
  const loadMessages = useCallback(async (clientId: string) => {
    const cached = chatCache.get(clientId);
    if (cached) {
      setMessages(cached.messages);
      setParticipants(cached.participants);
      setHasMore(cached.hasMore);
    } else {
      setChatLoading(true);
    }
    try {
      const res = await fetch(`/api/chat?clientId=${encodeURIComponent(clientId)}`);
      if (res.ok) {
        const data = await res.json();
        const next: ConvCache = {
          messages: data.messages ?? [],
          participants: data.participants ?? {},
          hasMore: !!data.hasMore,
        };
        setMessages(next.messages);
        setParticipants(next.participants);
        setHasMore(next.hasMore);
        chatCache.set(clientId, next);
      }
    } catch { /* silencieux */ }
    setChatLoading(false);
  }, []);

  // Remonter : charge la page précédente (messages antérieurs au plus ancien affiché),
  // en préservant la position de défilement.
  const loadMore = useCallback(async () => {
    if (!convClientId || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const scroller = scrollRef.current;
    const prevHeight = scroller?.scrollHeight ?? 0;
    const oldest = messages[0];
    try {
      const res = await fetch(
        `/api/chat?clientId=${encodeURIComponent(convClientId)}&before=${encodeURIComponent(oldest.createdAt)}`,
      );
      if (res.ok) {
        const data = await res.json();
        isPrependingRef.current = true; // empêche le scroll auto vers le bas
        setMessages(prev => [...(data.messages ?? []), ...prev]);
        setHasMore(!!data.hasMore);
        requestAnimationFrame(() => {
          if (scroller) scroller.scrollTop = scroller.scrollHeight - prevHeight;
        });
      }
    } catch { /* silencieux */ }
    setLoadingMore(false);
  }, [convClientId, loadingMore, messages]);

  // Charge les photos des participants HORS du chemin critique : les messages
  // s'affichent sans les attendre, les avatars apparaissent dès qu'elles arrivent.
  const loadAvatars = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`/api/chat/avatars?clientId=${encodeURIComponent(clientId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const next: Record<string, string> = {};
      for (const p of [data.client, data.coach]) {
        if (p?.id && p.photo) { avatarCache.set(p.id, p.photo); next[p.id] = p.photo; }
      }
      if (Object.keys(next).length) setAvatarPhotos(prev => ({ ...prev, ...next }));
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    if (!convClientId) return;
    loadMessages(convClientId);   // messages (rapide)
    loadAvatars(convClientId);    // photos (en parallèle, hors chemin critique)
  }, [convClientId, loadMessages, loadAvatars]);

  // Seed instantané des avatars déjà connus (cache module) dès que les
  // participants (ids) sont résolus → pas de clignotement au retour.
  useEffect(() => {
    const seed: Record<string, string> = {};
    for (const p of [participants.client, participants.coach]) {
      if (p?.id && avatarCache.has(p.id)) seed[p.id] = avatarCache.get(p.id)!;
    }
    if (Object.keys(seed).length) setAvatarPhotos(prev => ({ ...prev, ...seed }));
  }, [participants]);

  // Garde le cache mémoire à jour après chaque évolution de la liste
  // (Realtime, envoi optimiste, édition, suppression).
  useEffect(() => {
    if (!convClientId) return;
    chatCache.set(convClientId, { messages, participants, hasMore });
  }, [convClientId, messages, participants, hasMore]);

  // ⚡ Realtime : messages en direct (plus besoin de recharger). On s'abonne
  //    UNIQUEMENT à la conversation active (filter client_id) → isolation stricte,
  //    et la RLS (chat_self/chat_coach/chat_admin) borne ce que l'abonné peut voir.
  useEffect(() => {
    if (!convClientId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${convClientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `client_id=eq.${convClientId}` },
        payload => {
          const m = rowToChatMessage(payload.new as Record<string, unknown>);
          setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `client_id=eq.${convClientId}` },
        payload => {
          const m = rowToChatMessage(payload.new as Record<string, unknown>);
          // On conserve l'audioUrl déjà chargé localement le cas échéant.
          setMessages(prev => prev.map(x => (x.id === m.id ? { ...m, audioUrl: x.audioUrl ?? m.audioUrl } : x)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages", filter: `client_id=eq.${convClientId}` },
        payload => {
          const oldId = (payload.old as { id?: string })?.id;
          if (oldId) setMessages(prev => prev.filter(x => x.id !== oldId));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [convClientId]);

  const [text, setText] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [notifyDebug, setNotifyDebug] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    // En remontant l'historique, on conserve la position (pas de scroll vers le bas).
    if (isPrependingRef.current) { isPrependingRef.current = false; return; }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Envoie un message (texte, vocal ou media) via l'API chat, puis recharge la conversation.
  // Renvoie true si l'enregistrement a réussi (utile pour nettoyer un média orphelin).
  async function postMessage(payload: { text?: string; audioUrl?: string; isVoice?: boolean; isUrgent?: boolean; attachmentUrl?: string; attachmentType?: string; attachmentPath?: string }): Promise<boolean> {
    if (!convClientId || !me) return false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: convClientId, ...payload }),
      });
      if (!res.ok) {
        setNotifyDebug("⚠️ Envoi impossible (HTTP " + res.status + ")");
        setTimeout(() => setNotifyDebug(null), 6000);
        return false;
      }
      // Message urgent d'un sportif → email d'alerte au coach (en plus du push)
      if (payload.isUrgent && !isElevated) {
        fetch("/api/messages/urgent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: me.id, messageText: payload.text ?? "", clientName: me.name || me.email }),
        }).catch(() => {});
      }
      await loadMessages(convClientId);
      return true;
    } catch (e) {
      setNotifyDebug("⚠️ Erreur réseau : " + (e as Error).message);
      setTimeout(() => setNotifyDebug(null), 6000);
      return false;
    }
  }

  async function send() {
    if (!text.trim() || !me) return;
    const msgText = text.trim();
    setText("");
    const urgent = isUrgent;
    setIsUrgent(false);
    await postMessage({ text: msgText, isUrgent: urgent });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Laisser le navigateur choisir le format supporté (mp4 sur iOS, webm sur Chrome)
      // Ne pas forcer audio/webm — non supporté sur iOS Safari
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        // Utiliser le vrai MIME type choisi par le navigateur
        const mimeType = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => {
          if (!me) return;
          postMessage({ isVoice: true, audioUrl: reader.result as string });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(200);
      setRecording(true); setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } catch {
      alert("Accès au microphone refusé ou non disponible.");
    }
  }

  function stopRecording() {
    mrRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // ── Upload média (direct navigateur → Supabase Storage) ─────────────────────
  // ⚡ On NE passe PAS par une route serverless : Vercel plafonne le corps des
  //    requêtes à ~4,5 Mo, ce qui tuerait l'envoi de vidéos. L'upload direct
  //    contourne cette limite et fait un saut réseau de moins.
  function flashError(msg: string) {
    setNotifyDebug(msg);
    setTimeout(() => setNotifyDebug(null), 6000);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!original || !convClientId || !me) return;

    const isImage = original.type.startsWith("image/");
    const isVideo = original.type.startsWith("video/");
    if (!isImage && !isVideo) {
      flashError("⚠️ Format non supporté (photo ou vidéo uniquement).");
      return;
    }
    // Les vidéos ne sont pas compressables côté client → limite stricte avant upload.
    if (isVideo && original.size > MAX_VIDEO_BYTES) {
      flashError(`⚠️ Vidéo trop lourde (${fmtMo(original.size)}, max ${fmtMo(MAX_VIDEO_BYTES)}). Réduis la durée ou la qualité.`);
      return;
    }

    setUploading(true);
    try {
      const file = isImage ? await compressImage(original) : original;
      const ext = isImage ? "jpg" : (file.name.split(".").pop()?.toLowerCase() || "mp4");
      const path = `chat/${convClientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        flashError("⚠️ Upload échoué : " + upErr.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      const ok = await postMessage({
        attachmentUrl: publicUrl,
        attachmentType: isImage ? "image" : "video",
        attachmentPath: path,
      });
      // Si l'enregistrement du message échoue, on nettoie le fichier orphelin.
      if (!ok) {
        await supabase.storage.from("chat-attachments").remove([path]).catch(() => {});
      }
    } catch (err) {
      flashError("⚠️ Erreur : " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // ── Edit / Delete ──────────────────────────────────────────────────────────
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function deleteMsg(id: string) {
    setMessages(prev => prev.filter(m => m.id !== id)); // optimiste
    await fetch(`/api/chat/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function saveEdit(id: string) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, text: trimmed, editedAt: new Date().toISOString() } : m
    )); // optimiste
    setEditingMsgId(null);
    await fetch(`/api/chat/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    }).catch(() => {});
  }

  // État d'attente coach sans client sélectionné
  if (isElevated && clientList.length === 0) return (
    <p className="rounded-xl bg-surface2 px-4 py-3 text-sm text-dim">Aucun sportif affecté.</p>
  );

  return (
    <div className="space-y-3">
      {/* Sélecteur de conversation (coach/admin) — indépendant du profil actif */}
      {isElevated && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-dim">Conversation avec :</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {clientList.map(c => (
              <button
                key={c.id}
                onClick={() => setChatClientId(c.id)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  c.id === chatClientId
                    ? "bg-accent text-[#1a1500]"
                    : "border border-line bg-surface2 text-dim"
                }`}
              >
                {c.name || c.email}
              </button>
            ))}
          </div>
        </div>
      )}

      {isElevated && chatLoading && (
        <p className="py-4 text-center text-sm text-dim">Chargement…</p>
      )}

      {/* Bulles */}
      <div ref={scrollRef} className="min-h-[280px] max-h-[52vh] overflow-y-auto space-y-2 rounded-2xl border border-line bg-surface p-3">
        {messages.length === 0 && !chatLoading && (
          <p className="py-10 text-center text-sm text-dim">Aucun message. Dis bonjour 👋</p>
        )}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mx-auto block rounded-full border border-line bg-surface2 px-4 py-1.5 text-[12px] font-semibold text-dim transition disabled:opacity-50"
          >
            {loadingMore ? "Chargement…" : "↑ Voir les messages précédents"}
          </button>
        )}
        {messages.map((msg, i) => {
          // ── Messages système ──────────────────────────────────────────
          if (msg.type === "broadcast") {
            return (
              <div key={msg.id} className="rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-violet-500/20 px-3 py-2">
                  <span className="text-sm">📢</span>
                  <span className="flex-1 text-[12px] font-semibold text-violet-400">Annonce de l&apos;équipe</span>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-400">Pour tous</span>
                </div>
                <div className="px-3 py-2 text-[13.5px] text-ink">{msg.text}</div>
                <div className="px-3 pb-2 text-[11px] text-dim">{msg.senderName} · {fmtHour(msg.createdAt)}</div>
              </div>
            );
          }
          if (msg.type === "plan_update") {
            return (
              <div key={msg.id} className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-indigo-500/20 px-3 py-2">
                  <span className="text-sm">🗓️</span>
                  <span className="text-[12px] font-semibold text-indigo-400">Programme mis à jour</span>
                </div>
                <div className="px-3 py-2 text-[13.5px] text-ink">{msg.text}</div>
                <a
                  href="/plan"
                  className="mx-3 mb-3 flex items-center gap-1.5 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 text-[12px] font-semibold text-indigo-400"
                >
                  ▶ Voir ma programmation
                </a>
                <div className="px-3 pb-2 text-[11px] text-dim">{fmtHour(msg.createdAt)}</div>
              </div>
            );
          }

          // ── Message normal ────────────────────────────────────────────
          const isMe = msg.senderId === me?.id;
          const isEditing = editingMsgId === msg.id;
          // Avatar/nom résolus depuis les participants renvoyés par le serveur
          const sender = msg.senderId === participants.coach?.id
            ? participants.coach
            : msg.senderId === participants.client?.id
            ? participants.client
            : undefined;
          const senderPhoto = (sender ? avatarPhotos[sender.id] : undefined) ?? sender?.photo;
          const senderName = sender?.name || msg.senderName || (isMe ? (me?.name || "Moi") : "Coach");
          // Avatar affiché seulement en tête d'une série de messages du même expéditeur
          const prev = messages[i - 1];
          const showAvatar =
            !prev || prev.type === "broadcast" || prev.type === "plan_update" || prev.senderId !== msg.senderId;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""} ${showAvatar ? "mt-2" : ""}`}>
              {showAvatar ? (
                <Avatar name={senderName} photo={senderPhoto} size={26} />
              ) : (
                <div className="w-[26px] shrink-0" aria-hidden />
              )}
              <div className={`flex max-w-[74%] flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className={`rounded-2xl px-3.5 py-2.5 ${
                msg.isUrgent
                  ? "border border-danger/60 bg-danger/25"
                  : isMe
                  ? "bg-accent"
                  : "border border-line bg-surface2"
              }`}>
                {!isMe && showAvatar && (
                  <p className="mb-1 text-[11px] font-semibold text-dim">{senderName}</p>
                )}
                {msg.isUrgent && (
                  <p className="mb-1 text-[11px] font-bold text-danger">🚨 URGENCE</p>
                )}
                {/* Mode édition inline */}
                {isEditing && !msg.isVoice ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      autoFocus
                      rows={3}
                      className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(msg.id)} className="rounded-lg bg-ok px-3 py-1 text-[12px] font-semibold text-[#06210a]">Enregistrer</button>
                      <button onClick={() => setEditingMsgId(null)} className="rounded-lg bg-surface2 px-3 py-1 text-[12px] text-dim">Annuler</button>
                    </div>
                  </div>
                ) : msg.isVoice ? (
                  <VoicePlayer audioUrl={msg.audioUrl} messageId={msg.id} isMe={isMe} />
                ) : msg.attachmentUrl ? (
                  <div>
                    {msg.attachmentType === "image" ? (
                      <img
                        src={msg.attachmentUrl}
                        alt="photo"
                        className="max-w-[240px] rounded-xl cursor-pointer"
                        style={{ maxHeight: 280, objectFit: "cover" }}
                        onClick={() => setLightboxUrl(msg.attachmentUrl!)}
                      />
                    ) : (
                      <video
                        src={msg.attachmentUrl}
                        controls
                        playsInline
                        className="max-w-[240px] rounded-xl"
                        style={{ maxHeight: 280 }}
                      />
                    )}
                    {msg.text && <p className={`mt-1.5 whitespace-pre-wrap text-sm ${isMe ? "text-[#1a1500]" : "text-ink"}`}>{msg.text}</p>}
                  </div>
                ) : (
                  <p className={`whitespace-pre-wrap text-sm ${msg.isUrgent ? "text-white" : isMe ? "text-[#1a1500]" : "text-ink"}`}>{msg.text}</p>
                )}
                <p className={`mt-1 text-right text-[10px] ${msg.isUrgent ? "text-white/60" : isMe ? "text-[#1a1500]/50" : "text-dim"}`}>
                  {fmtHour(msg.createdAt)}
                  {msg.editedAt && <span className="ml-1 italic">modifié</span>}
                  {isMe && <span className="ml-1">{msg.isRead ? "✓✓" : "✓"}</span>}
                </p>
              </div>

              {/* Actions sur ses propres messages */}
              {isMe && !isEditing && (
                <div className="mt-0.5 flex gap-2 px-1">
                  {!msg.isVoice && (
                    <button
                      onClick={() => { setEditingMsgId(msg.id); setEditText(msg.text); }}
                      className="text-[11px] text-dim hover:text-ink"
                    >✏️ Modifier</button>
                  )}
                  <button
                    onClick={() => deleteMsg(msg.id)}
                    className="text-[11px] text-dim hover:text-danger"
                  >🗑️ Supprimer</button>
                </div>
              )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <div className="rounded-2xl border border-line bg-surface p-3 space-y-2.5">
        {recording ? (
          <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-danger" />
            <span className="flex-1 text-sm font-semibold text-danger">Enregistrement… {fmtSec(recTime)}</span>
            <button onClick={stopRecording} className="rounded-lg bg-danger px-3 py-1.5 text-sm font-bold text-white">
              Envoyer ↑
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Écris ton message…"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex shrink-0 flex-col gap-1.5">
                <button onClick={startRecording} title="Message vocal"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface2">🎤</button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Envoyer une photo ou vidéo"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface2 text-lg disabled:opacity-40"
                >{uploading ? "⏳" : "📎"}</button>
                <button onClick={send} disabled={!text.trim()}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-[#1a1500] text-lg font-bold disabled:opacity-40">↑</button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
        <button
          onClick={() => setIsUrgent(u => !u)}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
            isUrgent ? "border border-danger/40 bg-danger/10 text-danger" : "bg-surface2 text-dim"
          }`}
        >
          <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition ${
            isUrgent ? "border-danger bg-danger" : "border-dim bg-transparent"
          }`} />
          Marquer comme urgence 🚨
        </button>
      </div>

      {/* Diagnostic notif (disparaît après 8s) */}
      {notifyDebug && (
        <p className="rounded-lg bg-surface2 px-3 py-2 text-[12px] leading-snug text-dim">{notifyDebug}</p>
      )}

      {/* Lightbox image */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white text-lg"
          >✕</button>
          <img
            src={lightboxUrl}
            alt="photo"
            className="max-h-[90vh] max-w-full rounded-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Tab Santé ─────────────────────────────────────────────────────────────────
function SanteTab() {
  const { state, update, role, me } = useData();
  const isElevated = role === "coach" || role === "admin";
  const [subTab, setSubTab] = useState<"suivi" | "metriques">("suivi");
  const [type, setType] = useState<"pain" | "injury" | "note">("pain");
  const [text, setText] = useState("");
  const [dateStart, setDateStart] = useState(todayKey());
  const [dateEnd, setDateEnd] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function add() {
    if (!text.trim()) return;
    const entryText = text.trim();
    const entry: Followup = {
      id: uid(),
      date: type === "injury" ? dateStart : todayKey(),
      ...(type === "injury" && dateEnd ? { dateEnd } : {}),
      type,
      text: entryText,
    };
    update(d => { d.followups.unshift(entry); });
    setText(""); setDateStart(todayKey()); setDateEnd("");

    // Notifier le coach si c'est une blessure (client uniquement)
    if (type === "injury" && !isElevated && me) {
      fetch("/api/followup/notify-injury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: me.id, clientName: me.name || me.email, injuryText: entryText }),
      }).catch(() => {});
    }
  }

  const injuries = state.followups.filter(f => f.type === "injury");
  const pains    = state.followups.filter(f => f.type === "pain");
  const notes    = state.followups.filter(f => f.type === "note");
  const editing  = state.followups.find(f => f.id === editingId) ?? null;

  return (
    <div className="space-y-4">
      {/* Sous-onglets Suivi / Métriques */}
      <div className="flex rounded-xl bg-surface2 p-1">
        {(["suivi", "metriques"] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
              subTab === t ? "bg-surface text-ink shadow-sm" : "text-dim"
            }`}
          >
            {t === "suivi" ? "📋 Suivi" : "📊 Métriques"}
          </button>
        ))}
      </div>

      {subTab === "metriques" && <MetricsTab />}

      {subTab === "suivi" && <>
      {/* Nouvelle entrée */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-bold">Nouvelle entrée</h2>

        {/* Toggle segmenté */}
        <div className="mb-4 flex rounded-xl bg-surface2 p-1">
          {([
            { id: "pain",   label: "🤕 Douleur" },
            { id: "injury", label: "🚨 Blessure" },
            { id: "note",   label: "📝 Note" },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => { setType(t.id); setDateEnd(""); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                type === t.id
                  ? t.id === "injury" ? "bg-danger text-white"
                  : t.id === "pain"   ? "bg-surface text-ink border border-line shadow-sm"
                  : "bg-accent text-[#1a1500]"
                  : "text-dim"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {type === "injury" && (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[13px] text-dim">Début</span>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] text-dim">Fin <span className="opacity-60">(optionnel)</span></span>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} min={dateStart} />
            </label>
          </div>
        )}

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-dim">
            {type === "injury" ? "Zone, intensité, contexte…" : type === "pain" ? "Où ? Intensité ?" : "Ressenti, observation…"}
          </span>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              type === "injury" ? "Ex : Épaule droite, 7/10 après développé couché" :
              type === "pain"   ? "Ex : Genoux gauche, gêne légère en squat" :
                                  "Ex : Récupération difficile cette semaine"
            }
          />
        </label>
        <button
          onClick={add}
          disabled={!text.trim()}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-40"
        >
          Ajouter
        </button>
      </section>

      {/* Blessures */}
      {injuries.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="font-bold text-danger">🚨 Blessures</h3>
          {injuries.map(f => {
            const active = isActive(f);
            return (
              <div key={f.id} className={`rounded-xl border p-3.5 ${active ? "border-danger/50 bg-danger/5" : "border-line bg-surface"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[11px] font-bold text-danger">🚨 Blessure</span>
                    {active && <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">Active</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingId(f.id)} className="rounded-lg bg-surface2 px-2.5 py-1 text-[12px] text-dim">Modifier</button>
                    <button onClick={() => update(d => { d.followups = d.followups.filter(x => x.id !== f.id); })} className="rounded-lg bg-surface2 px-2.5 py-1 text-[12px] text-dim">Suppr.</button>
                  </div>
                </div>
                <div className="mt-1.5 text-[12px] text-dim">
                  {f.dateEnd ? `Du ${frDate(f.date)} au ${frDate(f.dateEnd)}` : `Depuis le ${frDate(f.date)}`}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{f.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Douleurs */}
      {pains.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="font-bold" style={{ color: "#f97316" }}>🤕 Douleurs</h3>
          {pains.map(f => (
            <div key={f.id} className="rounded-xl border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: "#f97316" }}>Douleur</span>
                <button onClick={() => update(d => { d.followups = d.followups.filter(x => x.id !== f.id); })} className="rounded-lg bg-surface2 px-2.5 py-1 text-[12px] text-dim">Suppr.</button>
              </div>
              <div className="mt-1.5 text-[12px] text-dim">{frDate(f.date)}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{f.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="font-bold text-accent2">📝 Notes</h3>
          {notes.map(f => (
            <div key={f.id} className="rounded-xl border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-accent2/20 px-2 py-0.5 text-[11px] font-bold text-accent2">Note</span>
                <button onClick={() => update(d => { d.followups = d.followups.filter(x => x.id !== f.id); })} className="rounded-lg bg-surface2 px-2.5 py-1 text-[12px] text-dim">Suppr.</button>
              </div>
              <div className="mt-1.5 text-[12px] text-dim">{frDate(f.date)}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{f.text}</p>
            </div>
          ))}
        </div>
      )}

      {state.followups.length === 0 && (
        <p className="py-8 text-center text-sm text-dim">Aucune entrée pour l&apos;instant.</p>
      )}

      {editing && <EditInjuryModal followup={editing} onClose={() => setEditingId(null)} />}
      </>}
    </div>
  );
}

// ─── Modal édition blessure ───────────────────────────────────────────────────
function EditInjuryModal({ followup, onClose }: { followup: Followup; onClose: () => void }) {
  const { update } = useData();
  const [dateStart, setDateStart] = useState(followup.date);
  const [dateEnd, setDateEnd]     = useState(followup.dateEnd ?? "");
  const [text, setText]           = useState(followup.text);

  function save() {
    update(d => {
      const f = d.followups.find(x => x.id === followup.id);
      if (!f) return;
      f.date = dateStart;
      f.dateEnd = dateEnd || undefined;
      f.text = text.trim() || f.text;
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Modifier</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Début</span>
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Fin <span className="opacity-60">(optionnel)</span></span>
            <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} min={dateStart} />
          </label>
        </div>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-dim">Détails</span>
          <textarea value={text} onChange={e => setText(e.target.value)} className="min-h-[80px]" />
        </label>
        <button onClick={save} className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ─── Tab Bloc-notes ────────────────────────────────────────────────────────────
function BlocNotesTab() {
  const { state, update, me, role } = useData();
  const isCoach = role === "coach" || role === "admin";
  const notes: BlockNote[] = state.notes ?? [];

  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function addNote() {
    if (!text.trim() || !me) return;
    const note: BlockNote = {
      id: uid(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
      authorId: me.id,
      authorName: me.name || me.email || "Moi",
      authorRole: role,
    };
    update(d => { d.notes = [note, ...(d.notes ?? [])]; });
    setText("");
  }

  function saveEdit() {
    if (!editText.trim() || !editingId) return;
    update(d => {
      const n = (d.notes ?? []).find(x => x.id === editingId);
      if (n) { n.text = editText.trim(); n.updatedAt = new Date().toISOString(); }
    });
    setEditingId(null);
  }

  function deleteNote(id: string) {
    update(d => { d.notes = (d.notes ?? []).filter(x => x.id !== id); });
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const roleLabel: Record<string, string> = {
    coach: "Coach", admin: "Coach", client: "Sportif",
  };

  return (
    <div className="space-y-4">
      {/* Plan alimentaire du coach (conservé) */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-bold">🥗 Plan alimentaire</h2>
        <p className="mb-3 text-[12px] text-dim">Rédigé par le coach</p>
        <textarea
          value={state.profile.diet}
          onChange={e => update(d => { d.profile.diet = e.target.value; })}
          placeholder="Petit-déj, déjeuner, collation, dîner, macros…"
          className="min-h-[100px]"
          readOnly={!isCoach}
        />
      </section>

      {/* Bloc-notes partagé */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-bold">📓 Bloc-notes</h2>
        <p className="mb-3 text-[12px] text-dim">
          Visible par le coach et le sportif · chacun peut ajouter
        </p>

        {/* Saisie */}
        <div className="mb-4 space-y-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Ajoute une note, observation, question…"
            className="min-h-[80px]"
          />
          <button
            onClick={addNote}
            disabled={!text.trim()}
            className="w-full rounded-xl bg-accent py-2.5 font-semibold text-[#1a1500] disabled:opacity-40"
          >
            + Ajouter la note
          </button>
        </div>

        {/* Archive */}
        {notes.length === 0 ? (
          <p className="py-6 text-center text-sm text-dim">Aucune note pour l&apos;instant.</p>
        ) : (
          <div className="space-y-3">
            {notes.map(n => {
              const isOwn = n.authorId === me?.id;
              const isEditingThis = editingId === n.id;
              return (
                <div key={n.id} className="rounded-xl border border-line bg-surface2 p-3.5">
                  {/* En-tête note */}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        n.authorRole === "client"
                          ? "bg-accent2/20 text-accent2"
                          : "bg-accent/20 text-accent"
                      }`}>
                        {roleLabel[n.authorRole] ?? n.authorRole} · {n.authorName}
                      </span>
                    </div>
                    {/* Actions — auteur seulement */}
                    {isOwn && !isEditingThis && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingId(n.id); setEditText(n.text); }}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-dim hover:text-ink"
                          title="Modifier"
                        >✏️</button>
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-dim hover:text-danger"
                          title="Supprimer"
                        >🗑️</button>
                      </div>
                    )}
                  </div>

                  {/* Contenu */}
                  {isEditingThis ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        autoFocus
                        className="min-h-[70px]"
                      />
                      <div className="flex gap-2">
                        <button onClick={saveEdit}
                          className="rounded-lg bg-ok px-3 py-1.5 text-[13px] font-semibold text-[#06210a]">
                          Enregistrer
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="rounded-lg bg-surface px-3 py-1.5 text-[13px] text-dim">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{n.text}</p>
                  )}

                  {/* Horodatage */}
                  <p className="mt-2 text-[11px] text-dim">
                    {fmtDate(n.createdAt)}
                    {n.updatedAt && <span className="ml-1 italic">· modifié</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function FollowupPage() {
  const { loading } = useData();
  const [tab, setTab] = useState<"messages" | "sante" | "notes">("messages");
  const [unreadCount, setUnreadCount] = useState(0);

  // Compteur de messages non lus (rafraîchi à l'ouverture et à chaque changement d'onglet)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat/unread")
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => { if (!cancelled) setUnreadCount(d.count ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tab]);

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div className="space-y-4">
      {/* Switch onglets */}
      <div className="flex rounded-2xl bg-surface2 p-1">
        {([
          { id: "messages", label: "💬 Messages" },
          { id: "sante",    label: "🩹 Santé" },
          { id: "notes",    label: "📓 Bloc-notes" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition ${
              tab === t.id ? "bg-accent text-[#1a1500] shadow-sm" : "text-dim"
            }`}
          >
            {t.label}
            {t.id === "messages" && unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "messages" && <MessagesTab />}
      {tab === "sante"    && <SanteTab />}
      {tab === "notes"    && <BlocNotesTab />}
    </div>
  );
}
