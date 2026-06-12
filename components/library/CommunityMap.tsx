"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

interface MapMember {
  firstName: string;
  city: string;
  lat: number;
  lng: number;
  sports: string[];
  photo?: string;
}

// Couleur accent (violet NMRY) pour les pastilles de ville.
const PIN = "#534AB7";

export default function CommunityMap() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapObj = useRef<LeafletMap | null>(null);
  const markers = useRef<LayerGroup | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Lref = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const [members, setMembers] = useState<MapMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Chargement des membres (coach/admin only côté serveur) ──
  useEffect(() => {
    let cancel = false;
    fetch("/api/community/map")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (!cancel) setMembers(d.members ?? []); })
      .catch(() => { if (!cancel) setError("Impossible de charger la carte."); });
    return () => { cancel = true; };
  }, []);

  // ── Init Leaflet (une fois, import dynamique → client only) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !mapDiv.current || mapObj.current) return;
      Lref.current = leaflet;
      const map = leaflet.map(mapDiv.current, { zoomControl: false, attributionControl: true }).setView([46.6, 2.4], 5);
      // Localisation FR : retire le préfixe "Leaflet" et traduit les boutons de zoom.
      map.attributionControl.setPrefix(false);
      leaflet.control.zoom({ zoomInTitle: "Zoomer", zoomOutTitle: "Dézoomer" }).addTo(map);
      leaflet
        .tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap, &copy; CARTO",
          maxZoom: 19,
        })
        .addTo(map);
      markers.current = leaflet.layerGroup().addTo(map);
      mapObj.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapObj.current?.remove();
      mapObj.current = null;
      markers.current = null;
      setMapReady(false);
    };
  }, []);

  // ── (Re)pose des pastilles quand les membres sont chargés ──
  useEffect(() => {
    const L = Lref.current;
    const map = mapObj.current;
    const layer = markers.current;
    if (!mapReady || !L || !map || !layer || !members) return;

    layer.clearLayers();
    // Regroupement par coordonnées arrondies (= une pastille par ville).
    const groups = new Map<string, MapMember[]>();
    members.forEach((m) => {
      const key = `${m.lat},${m.lng}`;
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    });

    const bounds: [number, number][] = [];
    groups.forEach((arr, key) => {
      const [lat, lng] = key.split(",").map(Number);
      bounds.push([lat, lng]);
      const count = arr.length;
      const city = arr[0].city;
      const names = arr.map((m) => m.firstName).join(", ");

      // Génère une pastille circulaire : photo si dispo, sinon initiale colorée.
      const avatar = (m: MapMember, size: number, zIndex: number, offset: number) => {
        const border = `border:2.5px solid #0e0e10`;
        const pos = `position:absolute;left:${offset}px;top:0;z-index:${zIndex}`;
        const circle = `width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;${border};${pos}`;
        if (m.photo) {
          return `<div style="${circle}"><img src="${m.photo}" style="width:100%;height:100%;object-fit:cover" /></div>`;
        }
        return `<div style="${circle};background:${PIN};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${Math.round(size * 0.4)}px">${m.firstName.slice(0, 1).toUpperCase()}</div>`;
      };

      let avatarsHtml: string;
      let stackW: number;
      const AV = 42; // taille avatar unique
      const SM = 32; // taille avatars en stack
      const STEP = 20; // décalage horizontal par avatar

      if (count === 1) {
        stackW = AV;
        avatarsHtml = avatar(arr[0], AV, 1, 0);
      } else {
        const visible = arr.slice(0, 3);
        stackW = SM + (visible.length - 1) * STEP + (count > 3 ? STEP : 0);
        avatarsHtml = visible.map((m, i) => avatar(m, SM, visible.length - i, i * STEP)).join("");
        if (count > 3) {
          const extra = count - 3;
          avatarsHtml += `<div style="position:absolute;left:${3 * STEP}px;top:0;z-index:0;width:${SM}px;height:${SM}px;border-radius:50%;background:#1e1e2e;border:2.5px solid #0e0e10;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:10px;font-weight:700">+${extra}</div>`;
        }
      }

      const iconH = (count === 1 ? AV : SM) + 26;
      const iconW = Math.max(stackW + 8, 100);
      const icon = L.divIcon({
        className: "",
        html:
          `<div style="display:flex;flex-direction:column;align-items:center;width:${iconW}px">` +
          `<div style="position:relative;height:${count === 1 ? AV : SM}px;width:${stackW}px;margin:0 auto">${avatarsHtml}</div>` +
          `<div style="margin-top:6px;background:#0e0e10;color:#fff;font-size:11px;font-weight:600;padding:2px 9px;border-radius:99px;border:1px solid ${PIN};white-space:nowrap">${city}</div>` +
          `</div>`,
        iconSize: [iconW, iconH],
        iconAnchor: [iconW / 2, (count === 1 ? AV : SM) / 2],
      });
      L.marker([lat, lng], { icon })
        .addTo(layer)
        .bindPopup(`<strong>${city}</strong><br>${names}`);
    });

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    setTimeout(() => map.invalidateSize(), 60);
  }, [mapReady, members]);

  const cityCount = useMemo(() => {
    if (!members) return 0;
    return new Set(members.map((m) => `${m.lat},${m.lng}`)).size;
  }, [members]);

  return (
    <div>
      {/* Stats */}
      <div className="mb-3 flex gap-2">
        <Stat n={members?.length ?? 0} label="membres" />
        <Stat n={cityCount} label="villes" />
      </div>

      {/* Carte */}
      <div className="overflow-hidden rounded-2xl border border-line shadow-sm">
        <div ref={mapDiv} style={{ height: 440, width: "100%", background: "#14141a" }} />
      </div>

      {/* États */}
      {error && <p className="mt-3 text-center text-[13px] text-danger">{error}</p>}
      {!error && members === null && (
        <p className="mt-3 text-center text-[13px] text-dim">Chargement de la carte…</p>
      )}
      {!error && members && members.length === 0 && (
        <p className="mt-3 rounded-xl bg-surface2 px-3 py-3 text-center text-[13px] text-dim">
          Aucun membre visible pour l&apos;instant. Les sportifs apparaîtront ici dès qu&apos;ils
          activeront « Visible sur la carte » dans leur profil.
        </p>
      )}

      {/* Liste des membres */}
      {members && members.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dim">Membres</p>
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
                {m.photo ? (
                  <img
                    src={m.photo}
                    alt={m.firstName}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
                    style={{ background: PIN }}
                  >
                    {m.firstName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink">{m.firstName}</p>
                  <p className="flex items-center gap-1 text-[11px] text-dim">📍 {m.city}</p>
                  {m.sports.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.sports.slice(0, 4).map((s) => (
                        <span key={s} className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl border border-line bg-surface2 px-3 py-2.5 text-center">
      <div className="text-xl font-bold text-accent">{n}</div>
      <div className="text-[10px] text-dim">{label}</div>
    </div>
  );
}
