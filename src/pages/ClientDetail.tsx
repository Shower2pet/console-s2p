import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Monitor, Loader2, Mail, Phone, User, Save, Plus, Trash2, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateStation, type WashingOption } from "@/hooks/useStations";
import { useOpenMaintenanceTicket } from "@/hooks/useMaintenanceLogs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import DeletePartnerDialog from "@/components/DeletePartnerDialog";

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const updateStation = useUpdateStation();
  const openTicket = useOpenMaintenanceTicket();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Sheet state
  const [selectedStation, setSelectedStation] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [washingOptions, setWashingOptions] = useState<WashingOption[]>([]);
  const [ticketReason, setTicketReason] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["client-profile", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: structures, isLoading: structLoading } = useQuery({
    queryKey: ["client-structures", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("structures")
        .select("*")
        .eq("owner_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const structureIds = (structures ?? []).map((s) => s.id);

  const { data: stations } = useQuery({
    queryKey: ["client-stations", structureIds],
    enabled: structureIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("*, structures(name)")
        .in("structure_id", structureIds);
      if (error) throw error;
      return data;
    },
  });

  const openSheet = (station: any) => {
    setSelectedStation(station);
    setEditStatus(station.status ?? "AVAILABLE");
    const opts = Array.isArray(station.washing_options) ? station.washing_options as WashingOption[] : [];
    setWashingOptions(opts);
    setShowTicketForm(false);
    setTicketReason("");
  };

  const handleSave = async () => {
    if (!selectedStation) return;
    try {
      await updateStation.mutateAsync({
        id: selectedStation.id,
        status: editStatus as any,
        washing_options: washingOptions as any,
      });
      toast.success("Stazione aggiornata");
      setSelectedStation(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleOpenTicket = async () => {
    if (!selectedStation || !ticketReason.trim()) return;
    try {
      await openTicket.mutateAsync({
        stationId: selectedStation.id,
        reason: ticketReason.trim(),
        performedBy: user?.id,
      });
      toast.success("Ticket manutenzione aperto");
      setSelectedStation(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addOption = () => {
    const nextId = washingOptions.length > 0 ? Math.max(...washingOptions.map(o => o.id)) + 1 : 1;
    setWashingOptions([...washingOptions, { id: nextId, name: "", price: 0, duration: 300 }]);
  };

  const removeOption = (id: number) => setWashingOptions(washingOptions.filter(o => o.id !== id));

  const updateOption = (optId: number, field: keyof WashingOption, value: string | number) => {
    setWashingOptions(washingOptions.map(o => o.id === optId ? { ...o, [field]: value } : o));
  };

  if (profileLoading || structLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return <div className="p-6 text-muted-foreground">Cliente non trovato.</div>;

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";

  const handleDeletePartner = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: id },
      });
      if (error) {
        const msg = typeof data === "object" && data?.error ? data.error : error.message;
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success("Partner eliminato con successo");
      navigate("/clients");
    } catch (err: any) {
      toast.error(err.message ?? "Errore durante l'eliminazione");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/clients" className="rounded-lg p-2 hover:bg-accent transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{displayName}</h1>
            <p className="text-muted-foreground capitalize">{profile.role ?? "user"}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-2" /> Elimina Partner
        </Button>
      </div>

      <DeletePartnerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        partnerName={displayName}
        onConfirm={handleDeletePartner}
      />

      {/* Profile info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Informazioni Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{profile.email ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{profile.phone ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="capitalize rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {profile.role ?? "user"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Structures */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Strutture ({(structures ?? []).length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(structures ?? []).map((s) => (
            <Link key={s.id} to={`/structures/${s.id}`}>
              <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-heading">{s.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {s.address && <p className="text-xs text-muted-foreground">{s.address}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
          {(structures ?? []).length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-4">Nessuna struttura.</p>
          )}
        </div>
      </div>

      {/* Stations */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" /> Stazioni ({(stations ?? []).length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(stations ?? []).map((s) => (
            <Card
              key={s.id}
              className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full"
              onClick={() => openSheet(s)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-heading">{s.id}</CardTitle>
                  <StatusBadge status={s.status ?? "OFFLINE"} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Struttura: {(s as any).structures?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground capitalize">Tipo: {s.type} {s.category ? `• ${s.category}` : ""}</p>
              </CardContent>
            </Card>
          ))}
          {(stations ?? []).length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-4">Nessuna stazione.</p>
          )}
        </div>
      </div>

      {/* Station Edit Sheet */}
      <Sheet open={!!selectedStation} onOpenChange={(open) => !open && setSelectedStation(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selectedStation && (
            <>
              <SheetHeader>
                <SheetTitle className="font-heading">Stazione {selectedStation.id}</SheetTitle>
                <SheetDescription>Tipo: {selectedStation.type} {selectedStation.category ? `• ${selectedStation.category}` : ""}</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Status */}
                <div>
                  <Label>Stato</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">Disponibile</SelectItem>
                      <SelectItem value="BUSY">Occupata</SelectItem>
                      <SelectItem value="OFFLINE">Offline</SelectItem>
                      <SelectItem value="MAINTENANCE">Manutenzione</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Washing Options Editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Opzioni Lavaggio</Label>
                    <Button variant="outline" size="sm" onClick={addOption} className="gap-1">
                      <Plus className="h-3 w-3" /> Aggiungi
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {washingOptions.map((opt) => (
                      <Card key={opt.id} className="p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <Input placeholder="Nome opzione" value={opt.name} onChange={e => updateOption(opt.id, "name", e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Prezzo (€)</Label>
                            <Input type="number" step="0.50" value={opt.price} onChange={e => updateOption(opt.id, "price", parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <Label className="text-xs">Durata (sec)</Label>
                            <Input type="number" step="30" value={opt.duration} onChange={e => updateOption(opt.id, "duration", parseInt(e.target.value) || 0)} />
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeOption(opt.id)} className="mt-1 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3 mr-1" /> Rimuovi
                        </Button>
                      </Card>
                    ))}
                    {washingOptions.length === 0 && <p className="text-xs text-muted-foreground">Nessuna opzione configurata.</p>}
                  </div>
                </div>

                <Button onClick={handleSave} disabled={updateStation.isPending} className="w-full gap-2">
                  <Save className="h-4 w-4" /> Salva Modifiche
                </Button>

                {/* Maintenance Ticket */}
                <div className="border-t pt-4">
                  {!showTicketForm ? (
                    <Button variant="outline" onClick={() => setShowTicketForm(true)} className="w-full gap-2 border-warning/50 text-warning-foreground hover:bg-warning/10">
                      <Wrench className="h-4 w-4" /> Apri Ticket Manutenzione
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Label>Motivo Manutenzione</Label>
                      <Textarea value={ticketReason} onChange={e => setTicketReason(e.target.value)} placeholder="Descrivi il problema..." />
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowTicketForm(false)} className="flex-1">Annulla</Button>
                        <Button onClick={handleOpenTicket} disabled={openTicket.isPending || !ticketReason.trim()} className="flex-1 gap-2">
                          <Wrench className="h-4 w-4" /> Conferma
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ClientDetail;
