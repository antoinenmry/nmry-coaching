"use client";

import { memo } from "react";

const AVATAR_PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#a855f7","#ec4899"];
function avatarBg(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

/** Photo de la personne, ou ses initiales sur une couleur déduite de son nom. */
const ChatAvatar = memo(function ChatAvatar({ name, photo, size = 26 }: { name?: string; photo?: string; size?: number }) {
  const n = name ?? "?";
  if (photo) {
    return (
      <img src={photo} alt="" className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: avatarBg(n), fontSize: Math.round(size * 0.34) }}
    >
      {initials(n)}
    </div>
  );
});

export default ChatAvatar;
