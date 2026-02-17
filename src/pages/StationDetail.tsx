import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Monitor, Loader2, Save, Plus, Trash2, Wrench, Building2,
  Power, PowerOff, RotateCcw, Warehouse, AlertTriangle, MapPin, Timer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useStation, useUpdateStation, type WashingOption } from "@/hooks/useStations";
import { useCreateMaintenanceTicket } from "@/hooks/useMaintenanceLogs";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { fetchStructuresForOwner } from "@/services/structureService";
import { fetchPartnersList } from "@/services/profileService";
import { invokeStationControl } from "@/services/stationService";
import { toast } from "sonner";
import MapPicker from "@/components/MapPicker";

const StationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isPartner, isManager } = useAuth();
  const { data: station, isLoading, error: stationError } = useStation(id);
  const updateStation = useUpdateStation();
  const openTicket = useCreateMaintenanceTicket();

  const [editStatus, setEditStatus] = useState<string>("");
  const [editStructureId, setEditStructureId] = useState<string>("");
  const [editOwnerId, setEditOwnerId] = useState<string>("");
  const [editVisibility, setEditVisibility] = useState<string>("PUBLIC");
  const [washingOptions, setWashingOptions] = useState<WashingOption[]>([]);
  const [ticketReason, setTicketReason] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [stationLat, setStationLat] = useState<number | null>(null);
  const [stationLng, setStationLng] = useState<number | null>(null);
  const [hwBusy, setHwBusy] = useState(false);

  // Fetch structures for reassignment – filtered by station owner
  const stationOwnerId = station?.owner_id ?? editOwnerId;
  const effectiveOwnerId = stationOwnerId && stationOwnerId !== "__none__" ? stationOwnerId : null;
  const { data: structures } = useQuery({
    queryKey: ["structures-for-station-owner", effectiveOwnerId],
    enabled: !!effectiveOwnerId,
    queryFn: () => fetchStructuresForOwner(effectiveOwnerId!),
  });

  // Admin: fetch partners for owner reassignment
  const { data: partners } = useQuery({
    queryKey: ["partners-list"],
    enabled: isAdmin,
    queryFn: fetchPartnersList,
  });

  // Initialize form state from station data
  useEffect(() => {
    if (station && !initialized) {
      setEditStatus(station.status ?? "AVAILABLE");
      setEditStructureId(station.structure_id ?? "__none__");
      setEditOwnerId(station.owner_id ?? "__none__");
      setEditVisibility(station.visibility ?? "PUBLIC");
      setEditOwnerId(station.owner_id ?? "__none__");
      const opts = Array.isArray(station.washing_options)
        ? (station.washing_options as unknown as WashingOption[])
        : [];
      setWashingOptions(opts);
      // Initialize station position: use station's own, or fall back to structure's
      const sLat = station.geo_lat ? Number(station.geo_lat) : null;
      const sLng = station.geo_lng ? Number(station.geo_lng) : null;
      const structLat = (station as any).structures?.geo_lat ? Number((station as any).structures.geo_lat) : null;
      const structLng = (station as any).structures?.geo_lng ? Number((station as any).structures.geo_lng) : null;
      setStationLat(sLat ?? structLat);
      setStationLng(sLng ?? structLng);
      setInitialized(true);
    }
  }, [station, initialized]);

  // Reset initialized when id changes
  useEffect(() => {
    setInitialized(false);
  }, [id]);

  const handleSave = async () => {
    if (!station) return;
    try {
      const payload: Record<string, any> = {
        id: station.id,
        status: editStatus,
        structure_id: editStructureId === "__none__" ? null : editStructureId,
        washing_options: washingOptions as any,
        visibility: editVisibility as any,
        geo_lat: stationLat,
        geo_lng: stationLng,
      };
      if (isAdmin) {
        payload.owner_id = editOwnerId === "__none__" ? null : editOwnerId;
      }
      await updateStation.mutateAsync(payload as any);
      toast.success("Stazione aggiornata con successo");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const invokeHardware = async (command: "ON" | "OFF" | "PULSE", duration_minutes?: number) => {
    if (!station) return;
    setHwBusy(true);
    try {
      await invokeStationControl(station.id, command, duration_minutes);
      toast.success("Comando hardware inviato");
    } catch (e: any) {
      toast.error(e.message ?? "Errore di comunicazione con la stazione");
    } finally {
      setHwBusy(false);
    }
  };

  const handleHwOn = async () => {
    await invokeHardware("ON");
  };

  const handleHwReset = async () => {
    if (!station) return;
    setHwBusy(true);
    try {
      await invokeStationControl(station.id, "OFF");
      await updateStation.mutateAsync({ id: station.id, status: "AVAILABLE" } as any);
      setEditStatus("AVAILABLE");
      toast.success("Comando hardware inviato");
    } catch (e: any) {
      toast.error(e.message ?? "Errore di comunicazione con la stazione");
    } finally {
      setHwBusy(false);
    }
  };

  const handleHwTest = async () => {
    await invokeHardware("PULSE", 1);
  };

  const handleRemoveFromClient = async () => {
    if (!station) return;
    try {
      await updateStation.mutateAsync({
        id: station.id,
        owner_id: null,
        structure_id: null,
      } as any);
      setEditOwnerId("");
      setEditStructureId("");
      toast.success("Stazione rimossa dal cliente e spostata in magazzino");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleOpenTicket = async (severity: "low" | "high" = "low") => {
    if (!station || !ticketReason.trim()) return;
    try {
      await openTicket.mutateAsync({
        stationId: station.id,
        reason: ticketReason.trim(),
        severity,
        performedBy: user?.id,
      });
      toast.success(`Ticket manutenzione aperto (gravità: ${severity === "high" ? "Alta" : "Bassa"})`);
      setShowTicketForm(false);
      setTicketReason("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addOption = () => {
    const nextId = washingOptions.length > 0 ? Math.max(...washingOptions.map((o) => o.id)) + 1 : 1;
    setWashingOptions([...washingOptions, { id: nextId, name: "", price: 0, duration: 300 }]);
  };

  const removeOption = (optId: number) =>
    setWashingOptions(washingOptions.filter((o) => o.id !== optId));

  const updateOption = (optId: number, field: keyof WashingOption, value: string | number) => {
    setWashingOptions(washingOptions.map((o) => (o.id === optId ? { ...o, [field]: value } : o)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (stationError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Errore nel caricamento della stazione.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna indietro
        </Button>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Monitor className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Stazione non trovata.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna indietro
        </Button>
      </div>
    );
  }

  const structureName = (station as any).structures?.name;
  // Permissions
  const canCommand = isAdmin || isPartner || isManager;
  const canEditInfo = isAdmin || isPartner || isManager;
  const canMoveStructure = isAdmin || isPartner;
  const canRemoveFromClient = isAdmin;
  const canChangeOwner = isAdmin;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> {station.id}
          </h1>
          <p className="text-muted-foreground capitalize">
            {station.type}
          </p>
        </div>
        <StatusBadge status={station.status ?? "OFFLINE"} />
      </div>

      {/* Commands */}
      {canCommand && (() => {
        const hasStructure = !!station.structure_id;
        const hasGeo = !!(station.geo_lat ?? (station as any).structures?.geo_lat);
        const opts = Array.isArray(station.washing_options)
          ? (station.washing_options as unknown as any[])
          : [];
        const hasPricing = opts.length > 0;
        const canActivate = isAdmin || (hasStructure && hasGeo && hasPricing);
        const missingReqs = !isAdmin && (!hasStructure || !hasGeo || !hasPricing);

        return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Power className="h-5 w-5 text-primary" /> Controlli Hardware
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {/* Avvia Test 1 Min (PULSE) */}
              <Button
                variant="outline"
                onClick={handleHwTest}
                disabled={hwBusy || updateStation.isPending}
                className="gap-2"
              >
                {hwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Timer className="h-4 w-4" />} Avvia Test (1 Minuto)
              </Button>

              {/* Accendi Forzato (ON) — with warning confirmation dialog */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={hwBusy || updateStation.isPending || !canActivate}
                    className="gap-2 border-warning/50 text-warning-foreground hover:bg-warning/10"
                  >
                    {hwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Accendi (Forzato)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" /> Attenzione
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      L'erogazione forzata non si fermerà in automatico. Vuoi procedere?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleHwOn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Conferma</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Spegni / Reset (OFF + status AVAILABLE) */}
              <Button
                variant="destructive"
                onClick={handleHwReset}
                disabled={hwBusy || updateStation.isPending}
                className="gap-2"
              >
                {hwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />} Spegni / Reset
              </Button>
            </div>
            {missingReqs && (
              <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                <p className="font-medium text-foreground text-sm">Per attivare la stazione servono:</p>
                <p className={hasStructure ? "text-success-foreground" : "text-destructive"}>
                  {hasStructure ? "✓" : "✗"} Assegnata a una struttura
                </p>
                <p className={hasGeo ? "text-success-foreground" : "text-destructive"}>
                  {hasGeo ? "✓" : "✗"} Posizione GPS inserita
                </p>
                <p className={hasPricing ? "text-success-foreground" : "text-destructive"}>
                  {hasPricing ? "✓" : "✗"} Almeno un'opzione di lavaggio configurata
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        );
      })()}

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
          {station.owner_id && (
            <div>
              <span className="text-muted-foreground">Proprietario ID:</span>{" "}
              <span className="font-medium text-foreground text-xs">{station.owner_id}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map Position */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Posizione Stazione
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stationLat != null && stationLng != null && (
            <p className="text-sm text-muted-foreground">
              Lat: {stationLat.toFixed(6)}, Lng: {stationLng.toFixed(6)}
            </p>
          )}
          <MapPicker
            lat={stationLat}
            lng={stationLng}
            onChange={(lat, lng) => { setStationLat(lat); setStationLng(lng); }}
            readonly={!canEditInfo}
            height="350px"
          />
          {canEditInfo && stationLat != null && (
            <p className="text-xs text-muted-foreground">
              Ricorda di cliccare "Salva Modifiche" per salvare la nuova posizione.
            </p>
          )}
          {!canEditInfo && stationLat == null && (
            <p className="text-sm text-muted-foreground italic">Nessuna posizione impostata.</p>
          )}
        </CardContent>
      </Card>

      {canEditInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading">Modifica Stazione</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status selector */}
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

            {/* Structure Reassignment - admin & partner only */}
            {canMoveStructure && (
              <div>
                <Label>Struttura Assegnata</Label>
                <Select value={editStructureId} onValueChange={setEditStructureId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nessuna struttura" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuna (magazzino)</SelectItem>
                    {(structures ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Owner change - admin only */}
            {canChangeOwner && (
              <div>
                <Label>Proprietario (Cliente)</Label>
                <Select value={editOwnerId} onValueChange={setEditOwnerId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nessun proprietario" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuno (magazzino)</SelectItem>
                    {(partners ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.legal_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Visibility selector */}
            <div>
              <Label>Visibilità (sulla mappa)</Label>
              <Select value={editVisibility} onValueChange={setEditVisibility}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Pubblico</SelectItem>
                  <SelectItem value="RESTRICTED">Struttura (solo clienti)</SelectItem>
                  <SelectItem value="HIDDEN">Invisibile</SelectItem>
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
                        <Input placeholder="Nome opzione" value={opt.name} onChange={(e) => updateOption(opt.id, "name", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Prezzo (€)</Label>
                        <Input type="number" step="0.50" value={opt.price} onChange={(e) => updateOption(opt.id, "price", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <Label className="text-xs">Durata (min)</Label>
                        <Input type="number" step="1" min="1" value={Math.round(opt.duration / 60)} onChange={(e) => updateOption(opt.id, "duration", (parseInt(e.target.value) || 0) * 60)} />
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
          </CardContent>
        </Card>
      )}

      {/* Admin: Remove from client */}
      {canRemoveFromClient && station.owner_id && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2 text-destructive">
              <Warehouse className="h-5 w-5" /> Azioni Avanzate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleRemoveFromClient}
              disabled={updateStation.isPending}
              className="w-full gap-2"
            >
              <Warehouse className="h-4 w-4" /> Rimuovi dal Cliente e Sposta in Magazzino
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Ticket */}
      {canCommand && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" /> Manutenzione
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showTicketForm ? (
              <Button variant="outline" onClick={() => setShowTicketForm(true)} className="w-full gap-2 border-warning/50 text-warning-foreground hover:bg-warning/10">
                <Wrench className="h-4 w-4" /> Apri Ticket Manutenzione
              </Button>
            ) : (
              <div className="space-y-3">
                <Label>Motivo Manutenzione</Label>
                <Textarea value={ticketReason} onChange={(e) => setTicketReason(e.target.value)} placeholder="Descrivi il problema..." />
                <p className="text-xs text-muted-foreground">Gravità Bassa: la stazione resta operativa. Gravità Alta: la stazione va in manutenzione.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowTicketForm(false)} className="flex-1">Annulla</Button>
                  <Button variant="outline" onClick={() => handleOpenTicket("low")} disabled={openTicket.isPending || !ticketReason.trim()} className="flex-1 gap-2">
                    Bassa
                  </Button>
                  <Button variant="destructive" onClick={() => handleOpenTicket("high")} disabled={openTicket.isPending || !ticketReason.trim()} className="flex-1 gap-2">
                    <AlertTriangle className="h-4 w-4" /> Alta
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StationDetail;
