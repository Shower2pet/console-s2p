import { useState, useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { Building2, Plus, Loader2, MapPin, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useStructures, useCreateStructure } from "@/hooks/useStructures";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import MapPicker from "@/components/MapPicker";
import StaticMapPreview from "@/components/StaticMapPreview";
import { fetchPartnersList } from "@/services/profileService";

const StructuresList = () => {
  const { role, structureIds, user, isAdmin } = useAuth();
  const { data: structures, isLoading } = useStructures();
  const createStructure = useCreateStructure();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => (structures ?? []).filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.address ?? "").toLowerCase().includes(q);
  }), [structures, search]);

  const { data: partners } = useQuery({
    queryKey: ["partners-for-structure"],
    enabled: isAdmin,
    queryFn: fetchPartnersList,
  });

  if (role === "manager" && structureIds.length === 1) {
    return <Navigate to={`/structures/${structureIds[0]}`} replace />;
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    const ownerId = isAdmin ? selectedOwnerId : user?.id;
    if (isAdmin && !ownerId) {
      toast.error("Seleziona un cliente");
      return;
    }
    try {
      await createStructure.mutateAsync({
        name: name.trim(),
        address: address.trim() || null,
        owner_id: ownerId,
        geo_lat: geoLat,
        geo_lng: geoLng,
      });
      toast.success("Struttura creata");
      setOpen(false);
      setName("");
      setAddress("");
      setGeoLat(null);
      setGeoLng(null);
      setSelectedOwnerId("");
    } catch (e: any) {
      handleAppError(e, "StructuresList: creazione struttura");
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
          <p className="text-muted-foreground">{filtered.length} strutture</p>
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
                {isAdmin && (
                  <div>
                    <Label>Cliente (Partner) *</Label>
                    <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleziona cliente..." /></SelectTrigger>
                      <SelectContent>
                        {(partners ?? []).map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.legal_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || p.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Nome *</Label>
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
                      onAddressFound={(addr) => { if (!address) setAddress(addr); }}
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

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cerca strutture..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
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
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">Nessuna struttura trovata.</p>
        )}
      </div>
    </div>
  );
};

export default StructuresList;
