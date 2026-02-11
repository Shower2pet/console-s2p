import { MapPin } from "lucide-react";
import { useState } from "react";

const MAPBOX_TOKEN = "pk.eyJ1Ijoic2hvd2VyMnBldCIsImEiOiJjbWlydGpkZ3UwaGU2NGtzZ3JzdHM0OHd1In0.W88uve0Md19Ks3x-A8bC6A";

interface StaticMapPreviewProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  height?: string;
}

const StaticMapPreview = ({ lat, lng, height = "120px" }: StaticMapPreviewProps) => {
  const [error, setError] = useState(false);

  if (lat == null || lng == null) return null;

  const numLat = Number(lat);
  const numLng = Number(lng);
  const zoom = 14;
  const width = 400;
  const imgHeight = parseInt(height) || 120;

  // Use Mapbox Static Images API
  const src = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+ef4444(${numLng},${numLat})/${numLng},${numLat},${zoom},0/${width}x${imgHeight}@2x?access_token=${MAPBOX_TOKEN}`;

  if (error) {
    return (
      <div
        className="relative rounded-md overflow-hidden bg-muted flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center text-muted-foreground text-xs">
          <MapPin className="h-4 w-4 mx-auto mb-1" />
          {numLat.toFixed(4)}, {numLng.toFixed(4)}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-md overflow-hidden bg-muted"
      style={{ height }}
    >
      <img
        src={src}
        alt="Posizione sulla mappa"
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setError(true)}
      />
      <div className="absolute bottom-1 right-1 bg-background/80 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] text-muted-foreground flex items-center gap-0.5">
        <MapPin className="h-2.5 w-2.5" />
        {numLat.toFixed(4)}, {numLng.toFixed(4)}
      </div>
    </div>
  );
};

export default StaticMapPreview;
