"use client";

// Image « Partager ma semaine », dessinée à sa taille réelle (1080 px de large).
// Styles en ligne uniquement : l'export (html-to-image) redessine exactement ce DOM.
import type { CSSProperties, ReactNode } from "react";
import { formatDuration, type ShareExercise, type WeekSummary } from "@/lib/weekShare";

export type ShareLayout = "colonne" | "lignes" | "bandeau" | "affiche";
export type ShareFormat = "story" | "post";
export type ShareInk = "white" | "black";

export const SHARE_LAYOUTS: { id: ShareLayout; name: string }[] = [
  { id: "colonne", name: "Colonne" },
  { id: "lignes", name: "Lignes" },
  { id: "bandeau", name: "Bandeau" },
  { id: "affiche", name: "Affiche" },
];

export const shareSize = (fmt: ShareFormat) => ({ w: 1080, h: fmt === "story" ? 1920 : 1350 });

const S = "var(--font-barlow), sans-serif";
const C = "var(--font-barlow-condensed), sans-serif";

// Logo d'origine (1585 × 954) : « COACHING » y est aligné à gauche sous « NMRY ».
// On affiche les deux mots séparément, chacun centré, en recadrant l'image.
const LOGO = { w: 1585, h: 954, nmry: { x: 25, y: 0, w: 1530, h: 624 }, coaching: { x: 8, y: 683, w: 1390, h: 194 } };

function Crop({ src, part, scale }: { src: string; part: { x: number; y: number; w: number; h: number }; scale: number }) {
  return (
    <div style={{ width: part.w * scale, height: part.h * scale, overflow: "hidden", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{ position: "absolute", left: -part.x * scale, top: -part.y * scale, width: LOGO.w * scale, height: LOGO.h * scale, maxWidth: "none" }}
      />
    </div>
  );
}

export default function WeekShareCard({
  summary, exercises, layout, fmt, ink, shadow, photo,
}: {
  summary: WeekSummary;
  exercises: ShareExercise[];
  layout: ShareLayout;
  fmt: ShareFormat;
  ink: ShareInk;
  shadow: boolean;
  photo: string | null; // object URL de la photo de fond, null = texte seul (PNG transparent)
}) {
  const story = fmt === "story";
  const { w: W, h: H } = shareSize(fmt);
  const k = story ? 1 : 0.82;
  const T = story ? 210 : 84;  // zones recouvertes par l'interface Instagram en story
  const B = story ? 330 : 96;
  const px = (n: number) => Math.round(n * k);
  const color = ink === "white" ? "#ffffff" : "#202120";
  const rule = ink === "white" ? "rgba(255,255,255,0.42)" : "rgba(32,33,32,0.36)";
  const textShadow = shadow ? (ink === "white" ? "0 2px 26px rgba(0,0,0,0.42)" : "0 2px 26px rgba(255,255,255,0.45)") : "none";

  const count = summary.count;
  const countLabel = count > 1 ? "séances" : "séance";
  const time = `${summary.estimated ? "≈ " : ""}${formatDuration(summary.minutes)}`;

  // Logo : largeur de « NMRY » fixe, « COACHING » à la même échelle, tous deux centrés.
  const scale = (300 * k) / LOGO.nmry.w;
  const logoSrc = ink === "white" ? "/logo-dark.png" : "/logo-light.png";
  const logoH = (LOGO.coaching.y + LOGO.coaching.h - LOGO.nmry.y) * scale;
  const top = T + logoH + 120 * k;

  const font = (weight: number, size: number, lh: number | string, family = S): CSSProperties => ({
    fontFamily: family, fontWeight: weight, fontSize: px(size), lineHeight: lh,
  });
  const gap = (n: number) => <div style={{ height: px(n) }} />;

  let body: ReactNode = null;

  if (layout === "colonne") {
    const stat = (v: ReactNode, l: string) => (
      <div>
        <div style={{ ...font(700, 150, 1, C), margin: `-${px(12)}px 0 -${px(14)}px` }}>{v}</div>
        <div style={{ ...font(500, 34, 1.2), marginTop: px(8), opacity: 0.85 }}>{l}</div>
      </div>
    );
    body = (
      <div style={{ position: "absolute", left: 0, right: 0, top, bottom: B, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {stat(count, countLabel)}
        {gap(56)}
        {stat(time, "d'entraînement")}
        {exercises.length > 0 && <div style={{ width: px(96), height: Math.max(2, 3 * k), background: rule, margin: `${px(64)}px 0` }} />}
        {exercises.map((e) => (
          <div key={e.key} style={{ marginBottom: px(40) }}>
            <div style={font(600, 36, 1.15)}>{e.name}</div>
            <div style={{ ...font(600, 58, 1.05, C), marginTop: px(6) }}>
              {e.sr}
              {e.sr && e.load && <span style={{ display: "inline-block", width: px(30) }} />}
              {e.load}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === "lignes") {
    const rows: [string, ReactNode][] = [
      ["Séances", count],
      ["Temps total", time],
      ...exercises.map((e): [string, ReactNode] => [
        e.name,
        <>
          {e.sr && <span style={{ fontWeight: 600, fontSize: px(50), opacity: 0.82, marginRight: e.load ? px(22) : 0 }}>{e.sr}</span>}
          {e.load}
        </>,
      ]),
    ];
    body = (
      <div style={{ position: "absolute", left: px(90), right: px(90), bottom: B }}>
        {rows.map(([label, value], i) => (
          <div
            key={i}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: px(24), padding: `${px(22)}px 0`,
              borderTop: `2px solid ${rule}`, borderBottom: i === rows.length - 1 ? `2px solid ${rule}` : undefined,
            }}
          >
            <span style={{ ...font(500, 36, 1.2), minWidth: 0 }}>{label}</span>
            <span style={{ ...font(700, 72, 1, C), whiteSpace: "nowrap" }}>{value}</span>
          </div>
        ))}
      </div>
    );
  }

  if (layout === "bandeau") {
    const stat = (v: ReactNode, l: string) => (
      <div>
        <div style={{ ...font(700, 168, 1, C), margin: `-${px(14)}px 0 -${px(16)}px` }}>{v}</div>
        <div style={{ ...font(500, 34, 1.2), marginTop: px(10), opacity: 0.85 }}>{l}</div>
      </div>
    );
    body = (
      <div style={{ position: "absolute", left: px(90), right: px(90), bottom: B }}>
        <div style={{ display: "flex", gap: px(110) }}>{stat(count, countLabel)}{stat(time, "d'entraînement")}</div>
        {exercises.length > 0 && (
          <>
            <div style={{ height: 2, background: rule, margin: `${px(48)}px 0 ${px(40)}px` }} />
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${exercises.length}, minmax(0, 1fr))`, gap: px(36) }}>
              {exercises.map((e) => (
                <div key={e.key}>
                  <div style={{ ...font(600, 30, 1.2), minHeight: px(72) }}>{e.name}</div>
                  <div style={{ ...font(700, (e.load || e.sr).length > 7 ? 56 : 78, 1, C), marginTop: px(6), whiteSpace: "nowrap" }}>{e.load || e.sr}</div>
                  {e.load && e.sr && <div style={{ ...font(600, 40, 1.1, C), opacity: 0.82, marginTop: px(6) }}>{e.sr}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (layout === "affiche") {
    body = (
      <div style={{ position: "absolute", left: 0, right: 0, top, bottom: B, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...font(700, story ? 640 : 520, 1, C), letterSpacing: "-0.03em", margin: `-${px(story ? 110 : 90)}px 0 -${px(story ? 60 : 50)}px`, paddingRight: "0.03em" }}>{count}</div>
          <div style={{ ...font(600, 48, 1.2), marginTop: px(40) }}>{countLabel} cette semaine</div>
          <div style={{ ...font(500, 36, 1.2), marginTop: px(10), opacity: 0.85 }}>{time} d&apos;entraînement</div>
        </div>
        {exercises.length > 0 && (
          <div style={{ paddingTop: px(30), borderTop: `2px solid ${rule}`, width: px(700) }}>
            {exercises.map((e) => (
              <div key={e.key} style={{ display: "flex", justifyContent: "space-between", gap: px(40), ...font(500, 32, 1.6) }}>
                <span style={{ textAlign: "left" }}>{e.name}</span>
                <span style={{ ...font(600, 38, 1.6, C), whiteSpace: "nowrap" }}>
                  {e.sr}
                  {e.sr && e.load && <span style={{ display: "inline-block", width: px(18) }} />}
                  {e.load}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative", width: W, height: H, overflow: "hidden", color, textShadow, fontFamily: S,
        backgroundImage: photo ? `url("${photo}")` : undefined, backgroundSize: "cover", backgroundPosition: "center",
      }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, top: T, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Crop src={logoSrc} part={LOGO.nmry} scale={scale} />
        <div style={{ height: (LOGO.coaching.y - LOGO.nmry.h) * scale }} />
        <Crop src={logoSrc} part={LOGO.coaching} scale={scale} />
        <div style={{ ...font(500, 30, 1.2), marginTop: px(30), opacity: 0.85, textAlign: "center" }}>{summary.label}</div>
      </div>
      {body}
    </div>
  );
}
