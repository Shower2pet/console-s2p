import { MapPin } from "lucide-react";

interface StaticMapPreviewProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  height?: string;
}

const StaticMapPreview = ({ lat, lng, height = "120px" }: StaticMapPreviewProps) => {
  if (lat == null || lng == null) return null;

  const zoom = 14;
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${lonToTile(Number(lng), zoom)}/${latToTile(Number(lat), zoom)}.png`;

  return (
    <div
      className="relative rounded-md overflow-hidden bg-muted"
      style={{ height }}
    >
      <img
        src={`https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=400x${parseInt(height)}&maptype=mapnik&markers=${lat},${lng},red-pushpin`}
        alt="Posizione sulla mappa"
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute bottom-1 right-1 bg-background/80 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] text-muted-foreground flex items-center gap-0.5">
        <MapPin className="h-2.5 w-2.5" />
        {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
      </div>
    </div>
  );
};

function lonToTile(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function latToTile(lat: number, zoom: number) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

export default StaticMapPreview;
