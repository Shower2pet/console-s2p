import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  readonly?: boolean;
  height?: string;
}

function ClickHandler({ onChange, readonly }: { onChange: (lat: number, lng: number) => void; readonly?: boolean }) {
  useMapEvents({
    click(e) {
      if (!readonly) {
        onChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef<string>("");
  useEffect(() => {
    const key = `${lat},${lng}`;
    if (key !== prevRef.current) {
      prevRef.current = key;
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

const DEFAULT_CENTER: [number, number] = [41.9028, 12.4964]; // Rome

const MapPickerInner = ({ lat, lng, onChange, readonly = false, height = "300px" }: MapPickerProps) => {
  const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
  const hasMarker = lat != null && lng != null;

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={center}
        zoom={hasMarker ? 15 : 6}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onChange={onChange} readonly={readonly} />
        {hasMarker && (
          <>
            <Marker position={[lat!, lng!]} />
            <RecenterMap lat={lat!} lng={lng!} />
          </>
        )}
      </MapContainer>
      {!readonly && (
        <p className="text-xs text-muted-foreground mt-1.5">
          Clicca sulla mappa per posizionare il marker.
        </p>
      )}
    </div>
  );
};

export default MapPickerInner;
