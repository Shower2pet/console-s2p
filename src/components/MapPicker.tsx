import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const MapPickerInner = lazy(() => import("./MapPickerInner"));

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  readonly?: boolean;
  height?: string;
}

const MapPicker = (props: MapPickerProps) => {
  return (
    <Suspense
      fallback={
        <div
          style={{ height: props.height ?? "300px" }}
          className="rounded-lg border border-border flex items-center justify-center bg-muted"
        >
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <MapPickerInner {...props} />
    </Suspense>
  );
};

export default MapPicker;
