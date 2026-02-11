import { useState, useMemo } from "react";
import { Monitor, Search, Filter, Loader2, Wrench, Save, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useStations, useUpdateStation, type WashingOption } from "@/hooks/useStations";
import { useOpenMaintenanceTicket } from "@/hooks/useMaintenanceLogs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const StationsList = () => {
  const { role, structureIds, user } = useAuth();
  const structureId = role === "manager" && structureIds.length === 1 ? structureIds[0] : undefined;
  const { data: stations, isLoading } = useStations(structureId);
  const updateStation = useUpdateStation();
  const openTicket = useOpenMaintenanceTicket();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedStation, setSelectedStation] = useState<any | null>(null);

  // Sheet state
  const [editStatus, setEditStatus] = useState("");
  const [washingOptions, setWashingOptions] = useState<WashingOption[]>([]);
  const [ticketReason, setTicketReason] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);

  const filtered = useMemo(() => (stations ?? []).filter(s => {
    const matchSearch = s.id.toLowerCase().includes(search.toLowerCase()) || s.type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  }), [search, statusFilter, stations]);

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

  const updateOption = (id: number, field: keyof WashingOption, value: string | number) => {
    setWashingOptions(washingOptions.map(o => o.id === id ? { ...o, [field]: value } : o));
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
            <Monitor className="inline mr-2 h-6 w-6 text-primary" />
            Stazioni
          </h1>
          <p className="text-muted-foreground">{filtered.length} stazioni trovate</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cerca per ID o tipo..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="AVAILABLE">Disponibile</SelectItem>
                <SelectItem value="BUSY">Occupata</SelectItem>
                <SelectItem value="OFFLINE">Offline</SelectItem>
                <SelectItem value="MAINTENANCE">Manutenzione</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(s => (
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
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Struttura: {(s as any).structures?.name ?? "—"}</p>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="capitalize rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s.type}</span>
                {s.category && <span className="text-xs text-muted-foreground">{s.category}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
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
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
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
                            <Input
                              placeholder="Nome opzione"
                              value={opt.name}
                              onChange={e => updateOption(opt.id, "name", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Prezzo (€)</Label>
                            <Input
                              type="number"
                              step="0.50"
                              value={opt.price}
                              onChange={e => updateOption(opt.id, "price", parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Durata (sec)</Label>
                            <Input
                              type="number"
                              step="30"
                              value={opt.duration}
                              onChange={e => updateOption(opt.id, "duration", parseInt(e.target.value) || 0)}
                            />
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

export default StationsList;
