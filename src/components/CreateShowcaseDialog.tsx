import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createShowcaseStation } from "@/services/stationService";
import MapPicker from "@/components/MapPicker";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateShowcaseDialog = ({ open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("BRACCO");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: createShowcaseStation,
    onSuccess: () => {
      toast.success("Stazione vetrina creata");
      qc.invalidateQueries({ queryKey: ["stations"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Errore nella creazione"),
  });

  const resetForm = () => {
    setId("");
    setTitle("");
    setType("BRACCO");
    setDescription("");
    setLat(null);
    setLng(null);
  };

  const handleSubmit = () => {
    if (!id.trim()) return toast.error("ID obbligatorio");
    if (!title.trim()) return toast.error("Titolo obbligatorio");
    if (lat == null || lng == null) return toast.error("Posizione GPS obbligatoria");

    mutation.mutate({
      id: id.trim(),
      type,
      showcase_title: title.trim(),
      description: description.trim() || null,
      geo_lat: lat,
      geo_lng: lng,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova Stazione Vetrina</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ID Stazione *</Label>
              <Input value={id} onChange={e => setId(e.target.value)} placeholder="es. SHOWCASE-001" className="mt-1.5" />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRACCO">Bracco (Doccia)</SelectItem>
                  <SelectItem value="VASCA">Vasca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Titolo *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome visibile all'utente" className="mt-1.5" />
          </div>

          <div>
            <Label>Descrizione</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrizione opzionale..." className="mt-1.5" rows={3} />
          </div>

          <div>
            <Label>Posizione sulla mappa *</Label>
            <div className="mt-1.5 rounded-md overflow-hidden border">
              <MapPicker
                lat={lat ?? 41.9028}
                lng={lng ?? 12.4964}
                onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }}
              />
            </div>
            {lat != null && lng != null && (
              <p className="text-xs text-muted-foreground mt-1">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Crea Vetrina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateShowcaseDialog;