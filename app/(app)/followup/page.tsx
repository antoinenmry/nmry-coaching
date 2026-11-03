"use client";

import { Fragment, useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from "react";
import { useData } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";
import { type BlockNote, type ChatMessage, type Followup } from "@/lib/types";
import ChatAvatar from "@/components/ChatAvatar";
import MetricsTab from "./MetricsTab";
import ConversationList, { type ConversationRow, type ConversationSummary } from "./ConversationList";

// Cache mémoire des conversations (par sportif) : réafficher instantanément au
// retour sur l'onglet, puis revalider en arrière-plan. Vit le temps de la session.
type ConvParticipant = { id: string; name: string; photo?: string };
type ConvCache = {
  messages: ChatMessage[];
  participants: { client?: ConvParticipant; coach?: ConvParticipant };
  hasMore: boolean;
};
const chatCache = new Map<string, ConvCache>();

// Emojis de réaction (tapback) proposés sur un message : pouce en l'air, pouce en bas, cœur, rire.
const REACTION_EMOJIS = ["👍", "👎", "❤️", "😂"];

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
    audioPath: (r.audio_path as string) ?? undefined,
    reaction: (r.reaction as string) ?? undefined,
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
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
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
  if (!audioUrl && !messageId) return <span className="text-sm text-dim">Vocal</span>;

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
          {error ? "!" : loadingAudio ? "…" : playing ? <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg> : <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>}
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
/** Zone réellement visible de l'écran (clavier déduit) : garde la saisie au-dessus du clavier. */
function useVisibleViewport() {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const measure = () => setBox(vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight });
    measure();
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);
  return box;
}

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return phone;
}

function IconButton({ label, onClick, disabled, pressed, tone, children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  tone: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:opacity-40 ${tone}`}
    >
      {children}
    </button>
  );
}

function MessagesTab({ initialClientId, focusMsgId, onConversationClosed }: {
  initialClientId?: string;
  focusMsgId?: string;
  onConversationClosed: () => void;
}) {
  const { me, role, clients } = useData();
  const isElevated = role === "coach" || role === "admin";

  // ── Conversation courante (isolée par sportif, stockée en base) ──
  const clientList = clients.filter(c => c.role === "client");
  const [chatClientId, setChatClientId] = useState<string | null>(null);
  // Le coach ouvre une conversation depuis sa liste ; le sportif est toujours sur la sienne.
  const convClientId = isElevated ? chatClientId : (me?.id ?? null);

  type Participant = { id: string; name: string; photo?: string };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<{ client?: Participant; coach?: Participant }>({});
  // Photos des participants (id → base64), chargées séparément des messages.
  const [avatarPhotos, setAvatarPhotos] = useState<Record<string, string>>({});
  const [chatLoading, setChatLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPrependingRef = useRef(false);

  // Lien direct (message urgent de la vue d'ensemble) : ouvre la conversation concernée.
  useEffect(() => {
    if (!isElevated || chatClientId || !initialClientId) return;
    if (clientList.some((c) => c.id === initialClientId)) setChatClientId(initialClientId);
  }, [isElevated, chatClientId, clientList, initialClientId]);

  // Liste des conversations : dernier message et non-lus par sportif.
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      if (res.ok) setConversations((await res.json()).conversations ?? []);
    } catch { /* silencieux */ }
  }, []);

  const markConversationRead = useCallback((clientId: string) => {
    setConversations(prev => prev.map(c => (c.clientId === clientId ? { ...c, unread: 0, urgent: 0 } : c)));
  }, []);

  useEffect(() => {
    if (!isElevated) return;
    loadConversations();
  }, [isElevated, loadConversations]);

  // En quittant une conversation, les messages reçus pendant sa lecture passent en lus
  // (GET /api/chat marque la conversation lue), puis la liste se met à jour.
  useEffect(() => {
    if (!isElevated || !chatClientId) return;
    const leftId = chatClientId;
    return () => {
      markConversationRead(leftId);
      fetch(`/api/chat?clientId=${encodeURIComponent(leftId)}`).catch(() => {}).finally(loadConversations);
    };
  }, [isElevated, chatClientId, markConversationRead, loadConversations]);

  // Nouveaux messages : la liste se met à jour en direct, ou au retour dans l'app.
  useEffect(() => {
    if (!isElevated || !me?.id) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(loadConversations, 400);
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const supabase = createClient();
    const channel = supabase
      .channel(`conversations:${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `coach_id=eq.${me.id}` },
        refresh,
      )
      .subscribe();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [isElevated, me?.id, loadConversations]);

  // Ouvrir une conversation ajoute une entrée d'historique : le retour du téléphone revient à la liste.
  const pushedHistoryRef = useRef(false);
  function openConversation(id: string) {
    if (id === chatClientId) return;
    const url = `/followup?client=${encodeURIComponent(id)}`;
    if (chatClientId) {
      window.history.replaceState(window.history.state, "", url);
    } else {
      window.history.pushState(window.history.state, "", url);
      pushedHistoryRef.current = true;
    }
    markConversationRead(id);
    setChatClientId(id);
  }
  function closeConversation() {
    if (pushedHistoryRef.current) { window.history.back(); return; }
    window.history.replaceState(window.history.state, "", "/followup");
    setChatClientId(null);
    onConversationClosed();
  }
  useEffect(() => {
    if (!isElevated) return;
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get("client");
      setChatClientId(id);
      if (!id) {
        pushedHistoryRef.current = false;
        onConversationClosed();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isElevated, onConversationClosed]);

  // Message ciblé par le lien : on le met en surbrillance puis on l'oublie.
  const [highlightId, setHighlightId] = useState<string | null>(focusMsgId ?? null);
  const focusDoneRef = useRef<string | null>(null);
  const moreTriesRef = useRef(0);

  // Première page : les 15 messages les plus récents.
  // ⚡ Cache-first : si la conversation est déjà en mémoire, on l'affiche
  //    instantanément (pas de spinner) puis on revalide en arrière-plan.
  const activeConvRef = useRef<string | null>(null);
  activeConvRef.current = convClientId;
  const loadMessages = useCallback(async (clientId: string) => {
    const cached = chatCache.get(clientId);
    if (cached) {
      setMessages(cached.messages);
      setParticipants(cached.participants);
      setHasMore(cached.hasMore);
    } else {
      // Jamais les messages de la conversation précédente sous le nom d'un autre sportif.
      setMessages([]);
      setParticipants({});
      setHasMore(false);
      setChatLoading(true);
    }
    try {
      const res = await fetch(`/api/chat?clientId=${encodeURIComponent(clientId)}`);
      if (res.ok) {
        const data = await res.json();
        if (activeConvRef.current !== clientId) return; // réponse d'une conversation déjà quittée
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
    if (activeConvRef.current === clientId) setChatLoading(false);
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
    // ⚠️ On scrolle UNIQUEMENT le conteneur interne (scrollRef), jamais scrollIntoView() :
    // celui-ci remonte aussi les ancêtres (toute la page) pour rendre le marqueur visible,
    // ce qui masquait les onglets Messages/Santé/Bloc-notes en haut de page à l'ouverture.
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages.length, convClientId]);

  // Lien « message urgent » depuis la vue d'ensemble : on amène le message ciblé
  // dans la fenêtre du chat (scroll du conteneur seulement) et on le surligne.
  useEffect(() => {
    if (!focusMsgId || focusDoneRef.current === focusMsgId) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const el = scroller.querySelector<HTMLElement>(`[data-msg-id="${focusMsgId}"]`);
    if (!el) {
      // Pas encore chargé : on remonte l'historique (3 pages maximum).
      if (hasMore && !loadingMore && moreTriesRef.current < 3) {
        moreTriesRef.current += 1;
        loadMore();
      }
      return;
    }
    focusDoneRef.current = focusMsgId;
    scroller.scrollTop = Math.max(0, el.offsetTop - scroller.clientHeight / 2 + el.clientHeight / 2);
    setHighlightId(focusMsgId);
    const t = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(t);
  }, [focusMsgId, messages, hasMore, loadingMore, loadMore]);

  // Envoie un message (texte, vocal ou media) via l'API chat, puis recharge la conversation.
  // Renvoie true si l'enregistrement a réussi (utile pour nettoyer un média orphelin).
  async function postMessage(payload: { text?: string; audioUrl?: string; audioPath?: string; isVoice?: boolean; isUrgent?: boolean; attachmentUrl?: string; attachmentType?: string; attachmentPath?: string }): Promise<boolean> {
    if (!convClientId || !me) return false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: convClientId, ...payload }),
      });
      if (!res.ok) {
        setNotifyDebug("Envoi impossible (HTTP " + res.status + ")");
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
      if (isElevated) loadConversations();
      return true;
    } catch (e) {
      setNotifyDebug("Erreur réseau : " + (e as Error).message);
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
      mr.onstop = async () => {
        const mimeType = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        if (!me) return;

        // Upload direct vers Storage (évite le blob base64 en DB → ↓ egress/Disk IO).
        const ext = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "webm";
        const path = `${me.id}/${Date.now()}.${ext}`;
        const supabase = createClient();
        const { error } = await supabase.storage
          .from("chat-attachments")
          .upload(path, blob, { contentType: mimeType, cacheControl: "31536000" });

        if (!error) {
          const url = supabase.storage.from("chat-attachments").getPublicUrl(path).data.publicUrl;
          postMessage({ isVoice: true, audioUrl: url, audioPath: path });
        } else {
          // Repli base64 si l'upload échoue (réseau coupé, quota Storage plein, etc.)
          const reader = new FileReader();
          reader.onload = () => {
            postMessage({ isVoice: true, audioUrl: reader.result as string });
          };
          reader.readAsDataURL(blob);
        }
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
      flashError("Format non supporté (photo ou vidéo uniquement).");
      return;
    }
    // Les vidéos ne sont pas compressables côté client → limite stricte avant upload.
    if (isVideo && original.size > MAX_VIDEO_BYTES) {
      flashError(`Vidéo trop lourde (${fmtMo(original.size)}, max ${fmtMo(MAX_VIDEO_BYTES)}). Réduis la durée ou la qualité.`);
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
        // cacheControl 1 an : chemin horodaté unique → revisionnages servis depuis le cache (↓ egress).
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
      if (upErr) {
        flashError("Upload échoué : " + upErr.message);
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
      flashError("Erreur : " + (err as Error).message);
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

  // ── Réaction (tapback) sur un message ──────────────────────────────────────
  const [reactingId, setReactingId] = useState<string | null>(null);
  // Bulle touchée : affiche ses actions (au survol sur ordinateur), pour garder le fil lisible.
  const [actionsId, setActionsId] = useState<string | null>(null);

  async function setReaction(id: string, reaction: string | null) {
    setReactingId(null);
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, reaction: reaction ?? undefined } : m))); // optimiste
    await fetch(`/api/chat/${id}/reaction`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction }),
    }).catch(() => {});
  }

  // Coach sur téléphone : la conversation occupe tout l'écran, comme une app de messagerie.
  const viewport = useVisibleViewport();
  const isPhone = useIsPhone();
  const fullScreen = isElevated && isPhone && !!convClientId;
  useEffect(() => {
    if (!fullScreen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [fullScreen]);

  // Sportif : la conversation remplit l'écran sous les onglets, saisie toujours visible.
  const rootRef = useRef<HTMLDivElement>(null);
  const [athleteTop, setAthleteTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (isElevated || !rootRef.current) return;
    setAthleteTop(rootRef.current.getBoundingClientRect().top + window.scrollY);
  }, [isElevated]);
  const athleteHeight = athleteTop !== null && viewport ? Math.max(360, viewport.height - athleteTop - 16) : undefined;

  // Le champ grandit avec le message, jusqu'à sa hauteur max.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  // État d'attente coach sans client sélectionné
  if (isElevated && clientList.length === 0) return (
    <p className="rounded-xl bg-surface2 px-4 py-3 text-sm text-dim">Aucun sportif affecté.</p>
  );

  const renderMessage = (msg: ChatMessage, i: number) => {
    // ── Messages système ──────────────────────────────────────────
    if (msg.type === "broadcast") {
      return (
        <div key={msg.id} className="rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-violet-500/20 px-3 py-2">
            <span className="flex-1 text-[12px] font-semibold text-violet-400">Annonce de l&apos;équipe</span>
            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-400">Pour tous</span>
          </div>
          <div className="px-3 py-2 text-[13.5px] text-ink">{msg.text}</div>
          <div className="px-3 pb-2 text-[11px] text-dim">{msg.senderName} · {fmtTime(msg.createdAt)}</div>
        </div>
      );
    }
    if (msg.type === "plan_update") {
      return (
        <div key={msg.id} className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-indigo-500/20 px-3 py-2">
            <span className="text-[12px] font-semibold text-indigo-400">Programme mis à jour</span>
          </div>
          <div className="px-3 py-2 text-[13.5px] text-ink">{msg.text}</div>
          <a
            href="/plan"
            className="mx-3 mb-3 flex items-center gap-1.5 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 text-[12px] font-semibold text-indigo-400"
          >
            ▶ Voir ma programmation
          </a>
          <div className="px-3 pb-2 text-[11px] text-dim">{fmtTime(msg.createdAt)}</div>
        </div>
      );
    }

    // ── Message normal ────────────────────────────────────────────
    const isMe = msg.senderId === me?.id;
    const isEditing = editingMsgId === msg.id;
    const prev = messages[i - 1];
    const startsGroup =
      !prev || prev.type === "broadcast" || prev.type === "plan_update" || prev.senderId !== msg.senderId;
    return (
      <div
        key={msg.id}
        data-msg-id={msg.id}
        className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""} ${startsGroup ? "mt-2" : ""} ${
          highlightId === msg.id ? "rounded-2xl ring-2 ring-danger ring-offset-2 ring-offset-surface" : ""
        }`}
      >
        <div
          className={`group flex max-w-[78%] flex-col ${isMe ? "items-end" : "items-start"}`}
          onClick={e => {
            if ((e.target as HTMLElement).closest("button, a, audio, video, img, textarea")) return;
            setActionsId(id => (id === msg.id ? null : msg.id));
          }}
        >
        <div className={`relative rounded-2xl px-3.5 py-2.5 ${
          msg.isUrgent
            ? "border border-danger/60 bg-danger/25"
            : isMe
            ? "bg-accent"
            : "border border-line bg-surface2"
        }`}>
          {/* Badge de réaction (tapback), accroché au coin bas de la bulle */}
          {msg.reaction && (
            <button
              onClick={() => setReactingId(id => (id === msg.id ? null : msg.id))}
              className={`absolute -bottom-2.5 ${isMe ? "-left-2" : "-right-2"} grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-surface2 text-[13px] shadow-sm`}
            >{msg.reaction}</button>
          )}
          {msg.isUrgent && (
            <p className="mb-1 text-[11px] font-bold text-danger">URGENCE</p>
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
            {fmtTime(msg.createdAt)}
            {msg.editedAt && <span className="ml-1 italic">modifié</span>}
            {isMe && <span className="ml-1">{msg.isRead ? "✓✓" : "✓"}</span>}
          </p>
        </div>

        {/* Actions (réagir pour tout le monde ; modifier/suppr. sur ses propres messages) */}
        {!isEditing && (
          <div className={`${actionsId === msg.id ? "flex" : "hidden md:group-hover:flex"} items-center gap-2 px-1 ${msg.reaction ? "mt-2.5" : "mt-0.5"} ${isMe ? "flex-row-reverse" : ""}`}>
            {isMe && !msg.isVoice && (
              <button
                onClick={() => { setEditingMsgId(msg.id); setEditText(msg.text); }}
                className="text-[11px] text-dim hover:text-ink"
              >Modifier</button>
            )}
            {isMe && (
              <button
                onClick={() => deleteMsg(msg.id)}
                className="text-[11px] text-dim hover:text-danger"
              >Supprimer</button>
            )}
            <button
              onClick={() => setReactingId(id => (id === msg.id ? null : msg.id))}
              className="text-[11px] text-dim hover:text-ink"
            >Réagir</button>
          </div>
        )}

        {/* Picker de réaction inline */}
        {reactingId === msg.id && (
          <div className={`mt-1 flex gap-1 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
            {REACTION_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setReaction(msg.id, msg.reaction === e ? null : e)}
                className={`grid h-8 w-8 place-items-center rounded-full border text-base transition ${
                  msg.reaction === e ? "border-accent bg-accent/15" : "border-line bg-surface2"
                }`}
              >{e}</button>
            ))}
          </div>
        )}
        </div>
      </div>
    );
  };

  const conversationRows: ConversationRow[] = clientList.map(c => ({
    clientId: c.id,
    name: c.name || c.email,
    unread: 0,
    urgent: 0,
    last: null,
    ...conversations.find(x => x.clientId === c.id),
  }));
  const openRow = conversationRows.find(r => r.clientId === convClientId);
  const headName = isElevated ? openRow?.name : participants.coach?.name || "Ton coach";
  const headPhoto = isElevated
    ? (convClientId ? avatarPhotos[convClientId] : undefined) ?? openRow?.photo
    : (participants.coach ? avatarPhotos[participants.coach.id] ?? participants.coach.photo : undefined);

  return (
    <div
      ref={rootRef}
      className={isElevated
        ? "md:ml-[calc(50%-min(590px,50vw-16px))] md:flex md:h-[calc(100dvh-230px)] md:min-h-[480px] md:w-[min(1180px,calc(100vw-32px))] md:overflow-hidden md:rounded-2xl md:border md:border-line"
        : "flex flex-col overflow-hidden rounded-2xl border border-line bg-bg"}
      style={!isElevated && athleteHeight ? { height: athleteHeight } : undefined}
    >
      {isElevated && (
        <div className="md:w-[340px] md:shrink-0 md:overflow-y-auto md:border-r md:border-line md:p-2">
          <ConversationList rows={conversationRows} selectedId={chatClientId} onOpen={openConversation} />
        </div>
      )}

      {!convClientId ? (
        <p className="hidden flex-1 place-items-center text-sm text-dim md:grid">Choisis une conversation.</p>
      ) : (
      <section
        aria-label={`Conversation avec ${headName ?? "ton coach"}`}
        className={`flex min-h-0 min-w-0 flex-1 flex-col bg-bg ${isElevated ? "max-md:fixed max-md:inset-x-0 max-md:z-40" : ""}`}
        style={fullScreen && viewport ? { top: viewport.top, height: viewport.height } : undefined}
      >
      <header className="flex shrink-0 items-center gap-2.5 border-b border-line bg-surface px-3 py-2 max-md:pt-[max(env(safe-area-inset-top),0.5rem)]">
        {isElevated && (
          <button
            onClick={closeConversation}
            aria-label="Retour à la liste des conversations"
            className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl md:hidden"
          >
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
          </button>
        )}
        <ChatAvatar name={headName} photo={headPhoto} size={40} />
        <div className="min-w-0">
          <p className="truncate text-base font-black">{headName}</p>
          {!isElevated && participants.coach?.name && <p className="text-xs text-dim">Ton coach</p>}
        </div>
      </header>

      {/* Bulles */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
        {chatLoading && (
          <p className="py-4 text-center text-sm text-dim">Chargement…</p>
        )}
        {messages.length === 0 && !chatLoading && (
          <p className="py-10 text-center text-sm text-dim">Aucun message. Dis bonjour</p>
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
        {messages.map((msg, i) => (
          <Fragment key={msg.id}>
            {(i === 0 || fmtDay(messages[i - 1].createdAt) !== fmtDay(msg.createdAt)) && (
              <p className="mx-auto my-2 w-fit rounded-full bg-surface2 px-3 py-1 text-xs font-bold text-dim">{fmtDay(msg.createdAt)}</p>
            )}
            {renderMessage(msg, i)}
          </Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <div className="shrink-0 border-t border-line bg-surface px-2.5 pb-[max(env(safe-area-inset-bottom),0.625rem)] pt-2">
        {isUrgent && !recording && (
          <p className="px-2 pb-1.5 text-xs font-bold text-danger">Message urgent : ton coach reçoit une alerte.</p>
        )}
        {recording ? (
          <div className="flex items-center gap-3 rounded-full border border-danger/30 bg-danger/10 py-1 pl-4 pr-1">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-danger" />
            <span className="flex-1 text-sm font-semibold text-danger">Enregistrement… {fmtSec(recTime)}</span>
            <button onClick={stopRecording} className="min-h-11 rounded-full bg-danger px-4 text-sm font-bold text-white">
              Envoyer
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1">
            <IconButton
              label="Joindre une photo ou une vidéo"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              tone="text-dim"
            >
              {uploading ? "…" : <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12l-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" /></svg>}
            </IconButton>
            {!isElevated && (
              <IconButton
                label="Marquer comme urgence"
                onClick={() => setIsUrgent(u => !u)}
                pressed={isUrgent}
                tone={isUrgent ? "bg-danger text-white" : "text-danger"}
              >
                <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L2 20h20zM12 10v4M12 17.5v.01" /></svg>
              </IconButton>
            )}
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={isElevated ? `Écrire à ${headName?.split(" ")[0] ?? "ton sportif"}` : "Écrire à ton coach"}
              aria-label="Ton message"
              rows={1}
              className={`mx-1 !min-h-11 max-h-[120px] min-w-0 flex-1 !resize-none !rounded-[22px] !px-4 !py-2.5 outline-none ${
                isUrgent ? "!border-danger" : "focus:!border-accent"
              }`}
            />
            {text.trim() ? (
              <IconButton label="Envoyer" onClick={send} tone="bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]">
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </IconButton>
            ) : (
              <IconButton label="Enregistrer un message vocal" onClick={startRecording} tone="bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]">
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              </IconButton>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />
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
      </section>
      )}
    </div>
  );
}

// ─── Tab Santé ─────────────────────────────────────────────────────────────────
// Même esthétique que /plan : cartes en dégradé léger de la couleur du type,
// liseré à gauche, pilules de statut. La saisie passe par une pop-up (bouton +)
// pour que la liste reste lisible.
type FollowupType = "pain" | "injury" | "note";
const FU_META: Record<FollowupType, { label: string; plural: string; color: string; hint: string; placeholder: string }> = {
  injury: { label: "Blessure", plural: "Blessures", color: "var(--color-danger)", hint: "Zone, intensité, contexte…", placeholder: "Ex : Épaule droite, 7/10 après développé couché" },
  pain:   { label: "Douleur",  plural: "Douleurs",  color: "#f97316",             hint: "Où ? Intensité ?",            placeholder: "Ex : Genou gauche, gêne légère en squat" },
  note:   { label: "Note",     plural: "Notes",     color: "var(--color-accent2)", hint: "Ressenti, observation…",     placeholder: "Ex : Récupération difficile cette semaine" },
};
const FU_ORDER: FollowupType[] = ["injury", "pain", "note"];
const FU_LABEL = "mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.12em] text-dim";
const GOLD = "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]";

function SanteTab() {
  const { state } = useData();
  const [subTab, setSubTab] = useState<"suivi" | "metriques">("suivi");
  const [metricView, setMetricView] = useState<"donnees" | "tendances">("donnees");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = state.followups.find(f => f.id === editingId) ?? null;

  return (
    <div className="space-y-4">
      {/* Une seule ligne : sous-onglets à gauche, action ou 2ᵉ sélecteur à droite
          (avant : 3 barres empilées avant le contenu). */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-full border border-line bg-surface p-0.5">
          {(["suivi", "metriques"] as const).map(t => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-black transition ${
                subTab === t ? "bg-surface2 text-ink shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-dim"
              }`}
            >
              {t === "suivi" ? "Suivi" : "Métriques"}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          {subTab === "suivi" ? (
            <button
              onClick={() => setAdding(true)}
              aria-label="Nouvelle entrée"
              className={`grid h-10 w-10 place-items-center rounded-full text-2xl font-black leading-none shadow-[0_6px_18px_-6px_rgba(255,170,0,0.7)] transition active:scale-95 ${GOLD}`}
            >
              +
            </button>
          ) : (
            <div className="flex rounded-full border border-line bg-surface p-0.5">
              {(["donnees", "tendances"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setMetricView(t)}
                  className={`rounded-full px-2.5 py-1.5 text-[12px] font-black transition ${
                    metricView === t ? "bg-surface2 text-ink shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-dim"
                  }`}
                >
                  {t === "donnees" ? "Données" : "Tendances"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {subTab === "metriques" && <MetricsTab view={metricView} />}

      {subTab === "suivi" && <>
        {state.followups.length === 0 ? (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-line p-4 text-left text-[13px] leading-snug text-dim"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2 text-lg font-black text-accent">+</span>
            Aucune entrée. Ajoute une douleur, une blessure ou une note.
          </button>
        ) : (
          FU_ORDER.map(type => {
            const items = state.followups.filter(f => f.type === type);
            if (items.length === 0) return null;
            const meta = FU_META[type];
            return (
              <section key={type} className="space-y-2">
                <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: meta.color }}>
                  {meta.plural}
                  <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-surface2 px-1 text-[10px] tracking-normal text-dim">
                    {items.length}
                  </span>
                </h3>
                {items.map(f => <FollowupCard key={f.id} f={f} onOpen={() => setEditingId(f.id)} />)}
              </section>
            );
          })
        )}

        {adding && <NewFollowupModal onClose={() => setAdding(false)} />}
        {editing && <EditFollowupModal followup={editing} onClose={() => setEditingId(null)} />}
      </>}
    </div>
  );
}

// Carte d'une entrée : un tap ouvre l'édition (suppression dans la pop-up).
function FollowupCard({ f, onOpen }: { f: Followup; onOpen: () => void }) {
  const meta = FU_META[f.type as FollowupType] ?? FU_META.note;
  const active = isActive(f);
  const date = f.type === "injury"
    ? (f.dateEnd ? `${frDate(f.date)} → ${frDate(f.dateEnd)}` : `Depuis le ${frDate(f.date)}`)
    : frDate(f.date);
  return (
    <button
      onClick={onOpen}
      className="relative block w-full overflow-hidden rounded-2xl border py-3 pl-4 pr-3.5 text-left transition active:scale-[0.99]"
      style={{
        background: `linear-gradient(105deg, color-mix(in srgb, ${meta.color} ${active ? 30 : 20}%, var(--color-surface)) 0%, color-mix(in srgb, ${meta.color} 6%, var(--color-surface)) 60%, var(--color-surface) 100%)`,
        borderColor: `color-mix(in srgb, ${meta.color} ${active ? 50 : 28}%, transparent)`,
      }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: meta.color }} />
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-dim">{date}</span>
        {active && (
          <span className="rounded-full bg-danger px-2 py-0.5 text-[10.5px] font-black text-white">En cours</span>
        )}
        <span aria-hidden className="ml-auto text-lg leading-none text-dim">›</span>
      </div>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[14px] leading-snug text-ink">{f.text}</p>
    </button>
  );
}

// ─── Pop-up nouvelle entrée ────────────────────────────────────────────────────
function NewFollowupModal({ onClose }: { onClose: () => void }) {
  const { update, role, me } = useData();
  const isElevated = role === "coach" || role === "admin";
  const [type, setType] = useState<FollowupType>("pain");
  const [text, setText] = useState("");
  const [dateStart, setDateStart] = useState(todayKey());
  const [dateEnd, setDateEnd] = useState("");
  const meta = FU_META[type];

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

    // Notifier le coach si c'est une blessure (client uniquement)
    if (type === "injury" && !isElevated && me) {
      fetch("/api/followup/notify-injury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: me.id, clientName: me.name || me.email, injuryText: entryText }),
      }).catch(() => {});
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Nouvelle entrée</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-surface2">✕</button>
        </div>

        {/* Type : pilules à la couleur du type */}
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-full border border-line bg-surface2 p-1">
          {(["pain", "injury", "note"] as const).map(t => {
            const on = type === t;
            const c = FU_META[t].color;
            return (
              <button
                key={t}
                onClick={() => { setType(t); setDateEnd(""); }}
                className={`rounded-full py-2 text-[13px] font-black transition ${on ? "text-white" : "text-dim"}`}
                style={on ? { background: `linear-gradient(135deg, color-mix(in srgb, ${c} 85%, white), ${c})`, boxShadow: `0 6px 16px -8px ${c}` } : undefined}
              >
                {FU_META[t].label}
              </button>
            );
          })}
        </div>

        {type === "injury" && (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className={FU_LABEL}>Début</span>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
            </label>
            <label className="block">
              <span className={FU_LABEL}>Fin <span className="normal-case tracking-normal opacity-70">(optionnel)</span></span>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} min={dateStart} />
            </label>
          </div>
        )}

        <label className="mb-4 block">
          <span className={FU_LABEL}>{meta.hint}</span>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder={meta.placeholder} className="min-h-[96px]" autoFocus />
        </label>
        <button
          onClick={add}
          disabled={!text.trim()}
          className={`w-full rounded-full py-3 font-black transition active:scale-[0.98] disabled:opacity-40 ${GOLD}`}
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

// ─── Modal édition (blessure / douleur / note) ─────────────────────────────────
function EditFollowupModal({ followup, onClose }: { followup: Followup; onClose: () => void }) {
  const { update } = useData();
  const [dateStart, setDateStart] = useState(followup.date);
  const [dateEnd, setDateEnd]     = useState(followup.dateEnd ?? "");
  const [text, setText]           = useState(followup.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = FU_META[followup.type as FollowupType] ?? FU_META.note;

  function save() {
    update(d => {
      const f = d.followups.find(x => x.id === followup.id);
      if (!f) return;
      f.date = dateStart;
      if (followup.type === "injury") f.dateEnd = dateEnd || undefined;
      f.text = text.trim() || f.text;
    });
    onClose();
  }

  function remove() {
    update(d => { d.followups = d.followups.filter(x => x.id !== followup.id); });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10.5px] font-black uppercase tracking-[0.12em]" style={{ color: meta.color }}>{meta.label}</span>
            <h2 className="text-lg font-black">Modifier</h2>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-surface2">✕</button>
        </div>
        {followup.type === "injury" ? (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className={FU_LABEL}>Début</span>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
            </label>
            <label className="block">
              <span className={FU_LABEL}>Fin <span className="normal-case tracking-normal opacity-70">(optionnel)</span></span>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} min={dateStart} />
            </label>
          </div>
        ) : (
          <label className="mb-3 block">
            <span className={FU_LABEL}>Date</span>
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
          </label>
        )}
        <label className="mb-4 block">
          <span className={FU_LABEL}>Détails</span>
          <textarea value={text} onChange={e => setText(e.target.value)} className="min-h-[96px]" />
        </label>
        <button onClick={save} className={`w-full rounded-full py-3 font-black transition active:scale-[0.98] ${GOLD}`}>
          Enregistrer
        </button>
        <button
          onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
          className={`mt-2 w-full rounded-full border py-2.5 text-[13px] font-black transition ${
            confirmDelete ? "border-danger bg-danger text-white" : "border-danger/40 text-danger"
          }`}
        >
          {confirmDelete ? "Confirmer la suppression" : "Supprimer"}
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
        <h2 className="mb-1 font-black">Plan alimentaire</h2>
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
        <h2 className="mb-1 font-black">Bloc-notes</h2>
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
                        ><svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg></button>
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-dim hover:text-danger"
                          title="Supprimer"
                        ><svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></button>
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
  // ?client=<id>&msg=<id> — arrivée depuis un message urgent de la vue d'ensemble.
  // Lu depuis window (pas useSearchParams : évite d'imposer un <Suspense> au build).
  const [deepLink, setDeepLink] = useState<{ client?: string; msg?: string }>({});
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const client = p.get("client") ?? undefined;
    const msg = p.get("msg") ?? undefined;
    if (client || msg) { setDeepLink({ client, msg }); setTab("messages"); }
  }, []);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadRefresh, setUnreadRefresh] = useState(0);
  const onConversationClosed = useCallback(() => {
    setDeepLink({});
    setUnreadRefresh(n => n + 1);
  }, []);

  // Ouvre TOUJOURS la page en haut (onglets Messages/Santé/Bloc-notes visibles),
  // jamais scrollée dans le chat comme avant. Sans le `scrollRestoration = "manual"`,
  // le navigateur peut réappliquer sa propre restauration de scroll (visite précédente
  // laissée tout en bas du chat) APRÈS notre scrollTo, et annuler l'effet.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const prevRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => { window.history.scrollRestoration = prevRestoration; };
  }, []);

  // Compteur de messages non lus (rafraîchi à l'ouverture et à chaque changement d'onglet)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat/unread")
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => { if (!cancelled) setUnreadCount(d.count ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tab, unreadRefresh]);

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div className="space-y-4">
      {/* Switch onglets */}
      <div className="flex rounded-full border border-line bg-surface p-1">
        {([
          { id: "messages", label: "Messages" },
          { id: "sante",    label: "Santé" },
          { id: "notes",    label: "Bloc-notes" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex-1 rounded-full py-2.5 text-[13px] font-black transition ${
              tab === t.id
                ? "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500] shadow-[0_6px_18px_-6px_rgba(255,170,0,0.7)]"
                : "text-dim"
            }`}
          >
            {t.label}
            {t.id === "messages" && unreadCount > 0 && (
              <span className="absolute right-1 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "messages" && <MessagesTab initialClientId={deepLink.client} focusMsgId={deepLink.msg} onConversationClosed={onConversationClosed} />}
      {tab === "sante"    && <SanteTab />}
      {tab === "notes"    && <BlocNotesTab />}
    </div>
  );
}
