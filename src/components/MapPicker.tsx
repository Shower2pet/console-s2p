import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

// Mapbox public token - replace with your own
const MAPBOX_TOKEN = "pk.eyJ1Ijoic2hvd2VyMnBldCIsImEiOiJjbWlydGpkZ3UwaGU2NGtzZ3JzdHM0OHd1In0.W88uve0Md19Ks3x-A8bC6A";

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  onAddressFound?: (address: string) => void;
  readonly?: boolean;
  height?: string;
}

const MapPicker = ({ lat, lng, onChange, onAddressFound, readonly = false, height = "300px" }: MapPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const onAddressFoundRef = useRef(onAddressFound);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Keep refs in sync without re-running effects
  onChangeRef.current = onChange;
  onAddressFoundRef.current = onAddressFound;

  const defaultCenter: [number, number] = [12.4964, 41.9028];
  const initialCenter = useRef<[number, number]>(
    lng != null && lat != null ? [lng, lat] : defaultCenter
  );
  const initialHasPosition = useRef(lat != null && lng != null);

  const placeMarker = useCallback((lngLat: [number, number], flyTo = true) => {
    if (!map.current) return;
    const [mLng, mLat] = lngLat;

    if (marker.current) {
      marker.current.setLngLat(lngLat);
    } else {
      marker.current = new mapboxgl.Marker({ draggable: !readonly })
        .setLngLat(lngLat)
        .addTo(map.current);

      if (!readonly) {
        marker.current.on("dragend", () => {
          const pos = marker.current!.getLngLat();
          onChangeRef.current(pos.lat, pos.lng);
          reverseGeocode(pos.lng, pos.lat);
        });
      }
    }

    if (flyTo) {
      map.current.flyTo({ center: lngLat, zoom: 15 });
    }

    onChangeRef.current(mLat, mLng);
  }, [readonly]);

  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=it&limit=1`
      );
      const data = await res.json();
      if (data.features?.[0]?.place_name) {
        onAddressFoundRef.current?.(data.features[0].place_name);
      }
    } catch {
      // silent
    }
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCenter.current,
      zoom: initialHasPosition.current ? 15 : 5,
    });

    m.addControl(new mapboxgl.NavigationControl(), "top-right");

    if (initialHasPosition.current) {
      marker.current = new mapboxgl.Marker({ draggable: !readonly })
        .setLngLat(initialCenter.current)
        .addTo(m);

      if (!readonly) {
        marker.current.on("dragend", () => {
          const pos = marker.current!.getLngLat();
          onChangeRef.current(pos.lat, pos.lng);
          reverseGeocode(pos.lng, pos.lat);
        });
      }
    }

    if (!readonly) {
      m.on("click", (e) => {
        const { lat: cLat, lng: cLng } = e.lngLat;
        placeMarker([cLng, cLat], false);
        reverseGeocode(cLng, cLat);
      });
    }

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker if lat/lng change externally
  useEffect(() => {
    if (!map.current) return;
    if (lat != null && lng != null) {
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else {
        marker.current = new mapboxgl.Marker({ draggable: !readonly })
          .setLngLat([lng, lat])
          .addTo(map.current);

        if (!readonly) {
          marker.current.on("dragend", () => {
            const pos = marker.current!.getLngLat();
            onChangeRef.current(pos.lat, pos.lng);
            reverseGeocode(pos.lng, pos.lat);
          });
        }
      }
      map.current.flyTo({ center: [lng, lat], zoom: 15 });
    }
  }, [lat, lng, readonly, reverseGeocode]);

  // Geocode search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&language=it&limit=5&country=it`
      );
      const data = await res.json();
      setSuggestions(data.features ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const selectSuggestion = useCallback((feature: any) => {
    const [sLng, sLat] = feature.center;
    placeMarker([sLng, sLat]);
    onAddressFoundRef.current?.(feature.place_name);
    setSearchQuery(feature.place_name);
    setSuggestions([]);
  }, [placeMarker]);

  return (
    <div>
      {!readonly && (
        <div className="relative mb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cerca indirizzo..."
              className="pl-8 h-9 text-sm"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border last:border-0"
                >
                  {s.place_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        ref={mapContainer}
        style={{ height }}
        className="rounded-lg overflow-hidden border border-border"
      />
      {!readonly && (
        <p className="text-xs text-muted-foreground mt-1.5">
          Cerca un indirizzo o clicca sulla mappa per posizionare il marker.
        </p>
      )}
    </div>
  );
};

export default MapPicker;
