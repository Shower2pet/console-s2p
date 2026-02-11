import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Building2, Plus, Loader2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useStructures, useCreateStructure } from "@/hooks/useStructures";
import { toast } from "sonner";
import MapPicker from "@/components/MapPicker";
import StaticMapPreview from "@/components/StaticMapPreview";

const StructuresList = () => {
  const { role, structureIds, user } = useAuth();
  const { data: structures, isLoading } = useStructures();
  const createStructure = useCreateStructure();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);

  // Manager with one structure → redirect to detail
  if (role === "manager" && structureIds.length === 1) {
    return <Navigate to={`/structures/${structureIds[0]}`} replace />;
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createStructure.mutateAsync({
        name: name.trim(),
        address: address.trim() || null,
        owner_id: user?.id,
        geo_lat: geoLat,
        geo_lng: geoLng,
      });
      toast.success("Struttura creata");
      setOpen(false);
      setName("");
      setAddress("");
      setGeoLat(null);
      setGeoLng(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            <Building2 className="inline mr-2 h-6 w-6 text-primary" />
            {role === "admin" ? "Tutte le Strutture" : "Le Mie Strutture"}
          </h1>
          <p className="text-muted-foreground">{(structures ?? []).length} strutture</p>
        </div>
        {(role === "partner" || role === "admin") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Aggiungi Struttura</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-heading">Nuova Struttura</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Nome</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="mt-1.5" placeholder="Es. PetShop Roma" />
                </div>
                <div>
                  <Label>Indirizzo</Label>
                  <Input value={address} onChange={e => setAddress(e.target.value)} className="mt-1.5" placeholder="Via Roma 1, Roma" />
                </div>
                <div>
                  <Label>Posizione sulla mappa</Label>
                  <div className="mt-1.5">
                    <MapPicker
                      lat={geoLat}
                      lng={geoLng}
                      onChange={(lat, lng) => { setGeoLat(lat); setGeoLng(lng); }}
                      height="250px"
                    />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={createStructure.isPending} className="w-full">
                  {createStructure.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Crea Struttura
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(structures ?? []).map((s) => (
          <Link key={s.id} to={`/structures/${s.id}`}>
            <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
              <StaticMapPreview lat={s.geo_lat} lng={s.geo_lng} height="120px" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading">{s.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {s.address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {s.address}
                  </p>
                )}
                {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
              </CardContent>
            </Card>
          </Link>
        ))}
        {(structures ?? []).length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">Nessuna struttura trovata.</p>
        )}
      </div>
    </div>
  );
};

export default StructuresList;
