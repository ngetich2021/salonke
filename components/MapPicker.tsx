"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

const DEFAULT_CENTER: [number, number] = [-1.2921, 36.8219]; // Nairobi

export function MapPicker({
  lat,
  lng,
  onChange,
  className = "h-64 w-full overflow-hidden rounded-xl border border-black/[.08] dark:border-white/[.145]",
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const start: [number, number] =
        lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;

      const map = L.map(containerRef.current).setView(
        start,
        lat != null && lng != null ? 15 : 6
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker(start, { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChangeRef.current(pos.lat, pos.lng);
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Map is created once; external lat/lng changes are synced in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || lat == null || lng == null) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
  }, [lat, lng]);

  // `isolate` boxes in Leaflet's internal panes (it stacks its tiles,
  // markers, and popups with z-index up to 700, none of which set a
  // position/z-index on their own root) inside their own stacking context —
  // without it, those panes compete directly with the rest of the page and
  // can render above the sticky header/ad player (z-40/z-50) once scrolled.
  return <div ref={containerRef} className={`isolate ${className}`} />;
}
