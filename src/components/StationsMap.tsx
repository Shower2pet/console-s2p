import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2hvd2VyMnBldCIsImEiOiJjbWlydGpkZ3UwaGU2NGtzZ3JzdHM0OHd1In0.W88uve0Md19Ks3x-A8bC6A";

interface StationPin {
  id: string;
  lat: number;
  lng: number;
  status: string;
  name?: string;
}

interface StationsMapProps {
  stations: StationPin[];
  height?: string;
}

const statusColors: Record<string, string> = {
  AVAILABLE: "#22c55e",   // green
  BUSY: "#3b82f6",        // blue
  MAINTENANCE: "#ef4444", // red
  OFFLINE: "#6b7280",     // gray
};

const StationsMap = ({ stations, height = "400px" }: StationsMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const validStations = stations.filter(s => s.lat && s.lng);

    const center: [number, number] = validStations.length > 0
      ? [validStations[0].lng, validStations[0].lat]
      : [12.4964, 41.9028];

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: validStations.length > 1 ? 5 : 13,
    });

    m.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add markers
    validStations.forEach((s) => {
      const color = statusColors[s.status] ?? "#6b7280";

      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = color;
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(
        `<div style="font-family:Outfit,sans-serif;font-size:13px;padding:2px 4px;">
          <strong>${s.id}</strong><br/>
          <span style="color:${color};font-weight:600;">${s.status}</span>
          ${s.name ? `<br/><span style="color:#64748b;">${s.name}</span>` : ""}
        </div>`
      );

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .setPopup(popup)
        .addTo(m);

      markersRef.current.push(marker);
    });

    // Fit bounds if multiple stations
    if (validStations.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      validStations.forEach(s => bounds.extend([s.lng, s.lat]));
      m.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }

    map.current = m;

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      m.remove();
      map.current = null;
    };
  }, [stations]);

  return (
    <div
      ref={mapContainer}
      style={{ height }}
      className="rounded-lg overflow-hidden border border-border"
    />
  );
};

export default StationsMap;
