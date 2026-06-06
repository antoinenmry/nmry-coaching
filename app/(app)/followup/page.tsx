"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useData } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";
import { emptyState, type AppState, type ChatMessage, type Followup } from "@/lib/types";

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

// ─── VoicePlayer ──────────────────────────────────────────────────────────────
function VoicePlayer({ audioUrl, isMe }: { audioUrl?: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  if (!audioUrl) return <span className="text-sm text-dim">🎤 Vocal</span>;

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => null); setPlaying(true); }
  }

  return (
    <div className="flex min-w-[150px] items-center gap-2.5">
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={e => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
      />
      <button onClick={toggle} className="shrink-0 text-base leading-none">{playing ? "⏸" : "▶️"}</button>
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isMe ? "bg-[#1a1500]/20" : "bg-surface2"}`}>
        <div
          className={`h-full rounded-full transition-all ${isMe ? "bg-[#1a1500]/60" : "bg-accent"}`}
          style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-[11px]">
        {duration > 0 ? fmtSec(playing ? current : duration) : "—"}
      </span>
    </div>
  );
}

// ─── Tab Messages ─────────────────────────────────────────────────────────────
function MessagesTab() {
  const { state, update, me, role, clients } = useData();
  const isElevated = role === "coach" || role === "admin";

  // ── Mode coach : chat indépendant (ne change PAS le profil actif global) ──
  const clientList = clients.filter(c => c.role === "client");
  const [chatClientId, setChatClientId] = useState<string | null>(
    clientList[0]?.id ?? null
  );
  const [chatState, setChatState] = useState<AppState | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const loadChat = useCallback(async (clientId: string) => {
    setChatLoading(true);
    const supabase = createClient();
    const { data: row } = await supabase
      .from("app_state").select("data").eq("user_id", clientId).maybeSingle();
    const cs: AppState = { ...emptyState(), ...(row?.data ?? {}) };
    // Marquer comme lus les messages du client
    const hasUnread = (cs.messages ?? []).some(m => !m.isRead && m.senderId !== me?.id);
    if (hasUnread && me) {
      const updated = { ...cs, messages: (cs.messages ?? []).map(m =>
        (!m.isRead && m.senderId !== me.id) ? { ...m, isRead: true } : m
      )};
      await supabase.from("app_state").upsert({
        user_id: clientId, data: updated,
        updated_at: new Date().toISOString(), updated_by_coach_at: new Date().toISOString(),
      });
      setChatState(updated);
    } else {
      setChatState(cs);
    }
    setChatLoading(false);
  }, [me]);

  useEffect(() => {
    if (isElevated && chatClientId) loadChat(chatClientId);
  }, [isElevated, chatClientId, loadChat]);

  // Messages affichés selon le rôle
  const messages = isElevated ? (chatState?.messages ?? []) : (state.messages ?? []);
  const [text, setText] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Client : marquer les messages de l'autre comme lus à l'ouverture
  useEffect(() => {
    if (isElevated) return; // coach gère ses lectures dans loadChat
    const hasUnread = (state.messages ?? []).some(m => !m.isRead && m.senderId !== me?.id);
    if (!hasUnread) return;
    update(d => {
      (d.messages ?? []).forEach(m => {
        if (!m.isRead && m.senderId !== me?.id) m.isRead = true;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function pushMsg(msg: ChatMessage) {
    if (isElevated) {
      // Coach : écriture directe dans l'app_state du client sélectionné
      if (!chatClientId || !chatState) return;
      const updated = { ...chatState, messages: [...(chatState.messages ?? []), msg] };
      const supabase = createClient();
      await supabase.from("app_state").upsert({
        user_id: chatClientId, data: updated,
        updated_at: new Date().toISOString(), updated_by_coach_at: new Date().toISOString(),
      });
      setChatState(updated);
    } else {
      // Client : via DataProvider (sauvegarde différée)
      update(d => { if (!d.messages) d.messages = []; d.messages.push(msg); });
    }
  }

  function send() {
    if (!text.trim() || !me) return;
    pushMsg({ id: uid(), text: text.trim(), isUrgent, isVoice: false,
      createdAt: new Date().toISOString(),
      senderId: me.id, senderName: me.name || me.email, isRead: false });
    setText(""); setIsUrgent(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          if (!me) return;
          pushMsg({ id: uid(), text: "", isUrgent: false, isVoice: true,
            audioUrl: reader.result as string,
            createdAt: new Date().toISOString(),
            senderId: me.id, senderName: me.name || me.email, isRead: false });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(200);
      setRecording(true); setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } catch {
      alert("Accès au microphone refusé.");
    }
  }

  function stopRecording() {
    mrRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
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

      {/* Loader pendant le chargement du chat client */}
      {isElevated && chatLoading && (
        <p className="py-4 text-center text-sm text-dim">Chargement…</p>
      )}

      {/* Bulles */}
      <div className="min-h-[280px] max-h-[52vh] overflow-y-auto space-y-2 rounded-2xl border border-line bg-surface p-3">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-dim">Aucun message. Dis bonjour 👋</p>
        )}
        {messages.map(msg => {
          const isMe = msg.senderId === me?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                msg.isUrgent
                  ? "border border-danger/40 bg-danger/10"
                  : isMe
                  ? "bg-accent"
                  : "border border-line bg-surface2"
              }`}>
                {!isMe && (
                  <p className="mb-1 text-[11px] font-semibold text-dim">{msg.senderName || "Coach"}</p>
                )}
                {msg.isUrgent && (
                  <p className="mb-1 text-[11px] font-bold text-danger">🚨 URGENCE</p>
                )}
                {msg.isVoice ? (
                  <VoicePlayer audioUrl={msg.audioUrl} isMe={isMe} />
                ) : (
                  <p className={`whitespace-pre-wrap text-sm ${isMe ? "text-[#1a1500]" : ""}`}>{msg.text}</p>
                )}
                <p className={`mt-1 text-right text-[10px] ${isMe ? "text-[#1a1500]/50" : "text-dim"}`}>
                  {fmtHour(msg.createdAt)}
                  {isMe && <span className="ml-1">{msg.isRead ? "✓✓" : "✓"}</span>}
                </p>
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
              <button
                onClick={startRecording}
                title="Message vocal"
                className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface2"
              >
                🎤
              </button>
              <button
                onClick={send}
                disabled={!text.trim()}
                className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-[#1a1500] text-lg font-bold disabled:opacity-40"
              >
                ↑
              </button>
            </div>
          </div>
        )}

        {/* Toggle Urgence */}
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
    </div>
  );
}

// ─── Tab Santé ─────────────────────────────────────────────────────────────────
function SanteTab() {
  const { state, update } = useData();
  const [type, setType] = useState<"pain" | "injury" | "note">("pain");
  const [text, setText] = useState("");
  const [dateStart, setDateStart] = useState(todayKey());
  const [dateEnd, setDateEnd] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function add() {
    if (!text.trim()) return;
    const entry: Followup = {
      id: uid(),
      date: type === "injury" ? dateStart : todayKey(),
      ...(type === "injury" && dateEnd ? { dateEnd } : {}),
      type,
      text: text.trim(),
    };
    update(d => { d.followups.unshift(entry); });
    setText(""); setDateStart(todayKey()); setDateEnd("");
  }

  const injuries = state.followups.filter(f => f.type === "injury");
  const pains    = state.followups.filter(f => f.type === "pain");
  const notes    = state.followups.filter(f => f.type === "note");
  const editing  = state.followups.find(f => f.id === editingId) ?? null;

  return (
    <div className="space-y-4">
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

// ─── Tab Diète ─────────────────────────────────────────────────────────────────
function DieteTab() {
  const { state, update } = useData();
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-bold">🥗 Plan alimentaire</h2>
        <p className="mb-3 text-[12px] text-dim">Rédigé par le coach · modifiable</p>
        <textarea
          value={state.profile.diet}
          onChange={e => update(d => { d.profile.diet = e.target.value; })}
          placeholder="Petit-déj, déjeuner, collation, dîner, macros…"
          className="min-h-[130px]"
        />
      </section>
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-bold">💬 Ton commentaire</h2>
        <p className="mb-3 text-[12px] text-dim">Difficultés, ressenti, questions…</p>
        <textarea
          value={state.profile.dietComment ?? ""}
          onChange={e => update(d => { d.profile.dietComment = e.target.value; })}
          placeholder="Ex : J&apos;ai du mal avec les quantités le soir…"
          className="min-h-[100px]"
        />
      </section>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function FollowupPage() {
  const { state, me, loading } = useData();
  const [tab, setTab] = useState<"messages" | "sante" | "diete">("messages");

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  const unreadCount = (state.messages ?? []).filter(m => !m.isRead && m.senderId !== me?.id).length;

  return (
    <div className="space-y-4">
      {/* Switch onglets */}
      <div className="flex rounded-2xl bg-surface2 p-1">
        {([
          { id: "messages", label: "💬 Messages" },
          { id: "sante",    label: "🩹 Santé" },
          { id: "diete",    label: "🍏 Diète" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
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
      {tab === "diete"    && <DieteTab />}
    </div>
  );
}
