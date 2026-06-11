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
      const size = count > 1 ? 46 : 38;
      const city = arr[0].city;
      const names = arr.map((m) => m.firstName).join(", ");
      // Pastille = cercle (compteur) + étiquette ville intégrée → très lisible sur la carte.
      const icon = L.divIcon({
        className: "",
        html:
          `<div style="display:flex;flex-direction:column;align-items:center;width:140px">` +
          `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${PIN};color:#fff;font-weight:700;font-size:16px;border:3px solid #0e0e10;box-shadow:0 2px 8px rgba(0,0,0,0.5),0 0 0 5px rgba(83,74,183,0.22)">${count}</div>` +
          `<div style="margin-top:5px;background:#0e0e10;color:#fff;font-size:11px;font-weight:600;padding:2px 9px;border-radius:99px;border:1px solid ${PIN};white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.5)">${city}</div>` +
          `</div>`,
        iconSize: [140, size + 28],
        iconAnchor: [70, size / 2],
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
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: PIN }}
                >
                  {m.firstName.slice(0, 1).toUpperCase()}
                </div>
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
