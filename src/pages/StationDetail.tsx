import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Monitor, Loader2, Save, Plus, Trash2, Wrench, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useStation, useUpdateStation, type WashingOption } from "@/hooks/useStations";
import { useOpenMaintenanceTicket } from "@/hooks/useMaintenanceLogs";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const StationDetail = () => {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const { data: station, isLoading } = useStation(id);
  const updateStation = useUpdateStation();
  const openTicket = useOpenMaintenanceTicket();

  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editStructureId, setEditStructureId] = useState<string | null>(null);
  const [washingOptions, setWashingOptions] = useState<WashingOption[]>([]);
  const [ticketReason, setTicketReason] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch available structures for reassignment
  const { data: structures } = useQuery({
    queryKey: ["all-structures-for-station"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("structures")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Initialize form state from station data
  if (station && !initialized) {
    setEditStatus(station.status ?? "AVAILABLE");
    setEditStructureId(station.structure_id ?? "");
    const opts = Array.isArray(station.washing_options) ? station.washing_options as unknown as WashingOption[] : [];
    setWashingOptions(opts);
    setInitialized(true);
  }

  const handleSave = async () => {
    if (!station || editStatus === null) return;
    try {
      await updateStation.mutateAsync({
        id: station.id,
        status: editStatus as any,
        structure_id: editStructureId || null,
        washing_options: washingOptions as any,
      });
      toast.success("Stazione aggiornata");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleOpenTicket = async () => {
    if (!station || !ticketReason.trim()) return;
    try {
      await openTicket.mutateAsync({
        stationId: station.id,
        reason: ticketReason.trim(),
        performedBy: user?.id,
      });
      toast.success("Ticket manutenzione aperto");
      setShowTicketForm(false);
      setTicketReason("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addOption = () => {
    const nextId = washingOptions.length > 0 ? Math.max(...washingOptions.map(o => o.id)) + 1 : 1;
    setWashingOptions([...washingOptions, { id: nextId, name: "", price: 0, duration: 300 }]);
  };

  const removeOption = (optId: number) => setWashingOptions(washingOptions.filter(o => o.id !== optId));

  const updateOption = (optId: number, field: keyof WashingOption, value: string | number) => {
    setWashingOptions(washingOptions.map(o => o.id === optId ? { ...o, [field]: value } : o));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!station) return <div className="p-6 text-muted-foreground">Stazione non trovata.</div>;

  const structureName = (station as any).structures?.name;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/stations" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> {station.id}
          </h1>
          <p className="text-muted-foreground capitalize">
            {station.type} {station.category ? `• ${station.category}` : ""}
          </p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={station.status ?? "OFFLINE"} />
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Informazioni Stazione
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Struttura assegnata:</span>{" "}
            {structureName ? (
              <Link to={`/structures/${station.structure_id}`} className="text-primary hover:underline font-medium">
                {structureName}
              </Link>
            ) : (
              <span className="text-muted-foreground italic">Nessuna (in magazzino)</span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Tipo:</span>{" "}
            <span className="capitalize font-medium text-foreground">{station.type}</span>
          </div>
          {station.category && (
            <div>
              <span className="text-muted-foreground">Categoria:</span>{" "}
              <span className="font-medium text-foreground">{station.category}</span>
            </div>
          )}
          {station.owner_id && (
            <div>
              <span className="text-muted-foreground">Proprietario ID:</span>{" "}
              <span className="font-medium text-foreground">{station.owner_id}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading">Modifica Stazione</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div>
            <Label>Stato</Label>
            <Select value={editStatus ?? ""} onValueChange={setEditStatus}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Disponibile</SelectItem>
                <SelectItem value="BUSY">Occupata</SelectItem>
                <SelectItem value="OFFLINE">Offline</SelectItem>
                <SelectItem value="MAINTENANCE">Manutenzione</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Structure Reassignment */}
          <div>
            <Label>Struttura Assegnata</Label>
            <Select value={editStructureId ?? ""} onValueChange={setEditStructureId}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nessuna struttura" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nessuna (magazzino)</SelectItem>
                {(structures ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default StationDetail;
