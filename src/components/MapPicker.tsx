import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Mapbox public token - replace with your own
const MAPBOX_TOKEN = "pk.eyJ1Ijoic2hvd2VyMnBldCIsImEiOiJjbWlydGpkZ3UwaGU2NGtzZ3JzdHM0OHd1In0.W88uve0Md19Ks3x-A8bC6A";

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  readonly?: boolean;
  height?: string;
}

const MapPicker = ({ lat, lng, onChange, readonly = false, height = "300px" }: MapPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);

  const defaultCenter: [number, number] = [12.4964, 41.9028]; // Rome [lng, lat]
  const center: [number, number] = lng != null && lat != null ? [lng, lat] : defaultCenter;
  const hasPosition = lat != null && lng != null;

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: center,
      zoom: hasPosition ? 15 : 5,
    });

    m.addControl(new mapboxgl.NavigationControl(), "top-right");

    if (hasPosition) {
      marker.current = new mapboxgl.Marker({ draggable: !readonly })
        .setLngLat([lng!, lat!])
        .addTo(m);

      if (!readonly) {
        marker.current.on("dragend", () => {
          const lngLat = marker.current!.getLngLat();
          onChange(lngLat.lat, lngLat.lng);
        });
      }
    }

    if (!readonly) {
      m.on("click", (e) => {
        const { lat: clickLat, lng: clickLng } = e.lngLat;

        if (marker.current) {
          marker.current.setLngLat([clickLng, clickLat]);
        } else {
          marker.current = new mapboxgl.Marker({ draggable: true })
            .setLngLat([clickLng, clickLat])
            .addTo(m);

          marker.current.on("dragend", () => {
            const lngLat = marker.current!.getLngLat();
            onChange(lngLat.lat, lngLat.lng);
          });
        }

        onChange(clickLat, clickLng);
      });
    }

    map.current = m;
    setLoaded(true);

    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when lat/lng props change externally
  useEffect(() => {
    if (!map.current || !loaded) return;
    if (lat != null && lng != null) {
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else {
        marker.current = new mapboxgl.Marker({ draggable: !readonly })
          .setLngLat([lng, lat])
          .addTo(map.current);
      }
      map.current.flyTo({ center: [lng, lat], zoom: 15 });
    }
  }, [lat, lng, loaded, readonly]);

  return (
    <div>
      <div
        ref={mapContainer}
        style={{ height }}
        className="rounded-lg overflow-hidden border border-border"
      />
      {!readonly && (
        <p className="text-xs text-muted-foreground mt-1.5">
          Clicca sulla mappa per posizionare il marker. Trascina per spostarlo.
        </p>
      )}
    </div>
  );
};

export default MapPicker;
