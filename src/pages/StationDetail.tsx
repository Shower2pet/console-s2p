import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Monitor, Loader2, Save, Plus, Trash2, Wrench, Building2,
  Power, PowerOff, RotateCcw, Warehouse, AlertTriangle, MapPin, ShieldAlert, Droplets, Square, Cpu, Star, Clock, Timer, DoorOpen
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useStation, useUpdateStation, type WashingOption } from "@/hooks/useStations";
import { useCreateMaintenanceTicket } from "@/hooks/useMaintenanceLogs";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStructuresForOwner } from "@/services/structureService";
import { supabase } from "@/integrations/supabase/client";
import { fetchPartnersList } from "@/services/profileService";
import { invokeStationControl, invokeStartTimedWash, invokeStartTubClean, invokeStopWash, invokeStopTubClean } from "@/services/stationService";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { handleAppError } from "@/lib/globalErrorHandler";
import MapPicker from "@/components/MapPicker";
import StationUsersList from "@/components/StationUsersList";
import StationWashLogs from "@/components/StationWashLogs";
import StationMaintenanceHistory from "@/components/StationMaintenanceHistory";
import { fetchStationAvgRating, fetchStationRatings } from "@/services/ratingService";

/** Format seconds as mm:ss */
const fmtTimer = (totalSec: number): string => {
  if (totalSec <= 0) return "00:00";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** Hook that counts down to an endsAt ISO timestamp */
const useCountdown = (endsAt: string | null): number => {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!endsAt) { setRemaining(0); return; }
    const calc = () => Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
    setRemaining(calc());
    intervalRef.current = setInterval(() => {
      const r = calc();
      setRemaining(r);
      if (r <= 0 && intervalRef.current) clearInterval(intervalRef.current);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [endsAt]);
  return remaining;
};

// localStorage helpers for admin station timers
const ADMIN_TIMER_KEY = "s2p_admin_station_timers";
interface AdminPersistedTimers {
  stationId: string;
  washEndsAt: string | null;
  washTotalSec: number;
  tubEndsAt: string | null;
  tubTotalSec: number;
}
const loadAdminTimers = (stationId: string): AdminPersistedTimers | null => {
  try {
    const raw = localStorage.getItem(ADMIN_TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminPersistedTimers;
    if (parsed.stationId !== stationId) return null;
    const now = Date.now();
    if (parsed.washEndsAt && new Date(parsed.washEndsAt).getTime() <= now) parsed.washEndsAt = null;
    if (parsed.tubEndsAt && new Date(parsed.tubEndsAt).getTime() <= now) parsed.tubEndsAt = null;
    if (!parsed.washEndsAt && !parsed.tubEndsAt) { localStorage.removeItem(ADMIN_TIMER_KEY); return null; }
    return parsed;
  } catch { return null; }
};
const saveAdminTimers = (t: AdminPersistedTimers) => {
  try { localStorage.setItem(ADMIN_TIMER_KEY, JSON.stringify(t)); } catch {}
};
const clearAdminTimers = () => {
  try { localStorage.removeItem(ADMIN_TIMER_KEY); } catch {}
};

/** Numeric input that tracks raw string while editing to avoid "sticky 0" issues */
const NumericInput = ({
  numericValue,
  onNumericChange,
  integer,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  numericValue: number;
  onNumericChange: (v: number) => void;
  integer?: boolean;
}) => {
  const [raw, setRaw] = useState<string>(numericValue ? String(numericValue) : "");
  const [focused, setFocused] = useState(false);

  // Sync from parent when not focused
  useEffect(() => {
    if (!focused) setRaw(numericValue ? String(numericValue) : "");
  }, [numericValue, focused]);

  return (
    <Input
      {...props}
      type="number"
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        const parsed = integer ? parseInt(e.target.value) : parseFloat(e.target.value);
        onNumericChange(isNaN(parsed) ? 0 : parsed);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (raw === "") onNumericChange(0);
      }}
    />
  );
};

const StationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isPartner, isManager, isTester } = useAuth();
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
  const [editHasAccessGate, setEditHasAccessGate] = useState(false);
  const [manualWashMinutes, setManualWashMinutes] = useState(5);
  const [washBusy, setWashBusy] = useState(false);
  const [tubCleanMinutes, setTubCleanMinutes] = useState(5);
  const [tubCleanBusy, setTubCleanBusy] = useState(false);
  const [editBoardId, setEditBoardId] = useState<string>("__none__");
  const qc = useQueryClient();

  // Timer state for countdown (persisted in localStorage)
  const persistedTimers = useMemo(() => id ? loadAdminTimers(id) : null, [id]);
  const [washEndsAt, setWashEndsAt] = useState<string | null>(persistedTimers?.washEndsAt ?? null);
  const [washTotalSec, setWashTotalSec] = useState(persistedTimers?.washTotalSec ?? 0);
  const [tubEndsAt, setTubEndsAt] = useState<string | null>(persistedTimers?.tubEndsAt ?? null);
  const [tubTotalSec, setTubTotalSec] = useState(persistedTimers?.tubTotalSec ?? 0);

  const washRemaining = useCountdown(washEndsAt);
  const tubRemaining = useCountdown(tubEndsAt);

  // Persist timers
  useEffect(() => {
    if (id && (washEndsAt || tubEndsAt)) {
      saveAdminTimers({ stationId: id, washEndsAt, washTotalSec, tubEndsAt, tubTotalSec });
    } else {
      clearAdminTimers();
    }
  }, [id, washEndsAt, washTotalSec, tubEndsAt, tubTotalSec]);

  // Auto-clear expired timers & send STOP command immediately
  const washWasActive = useRef(false);
  const tubWasActive = useRef(false);
  useEffect(() => {
    if (washEndsAt && washRemaining > 0) washWasActive.current = true;
    if (washEndsAt && washRemaining <= 0 && washWasActive.current) {
      // Send STOP to turn off relay immediately instead of waiting for cron
      if (id) {
        invokeStopWash(id).catch((e) => console.error("Auto-stop wash failed:", e));
      }
      setWashEndsAt(null);
      washWasActive.current = false;
    }
  }, [washRemaining, washEndsAt, id]);
  useEffect(() => {
    if (tubEndsAt && tubRemaining > 0) tubWasActive.current = true;
    if (tubEndsAt && tubRemaining <= 0 && tubWasActive.current) {
      if (id) {
        invokeStopTubClean(id).catch((e) => console.error("Auto-stop tub clean failed:", e));
      }
      setTubEndsAt(null);
      tubWasActive.current = false;
    }
  }, [tubRemaining, tubEndsAt, id]);

  // Ratings
  const { data: avgRating } = useQuery({
    queryKey: ["station-avg-rating", id],
    enabled: !!id,
    queryFn: () => fetchStationAvgRating(id!),
  });
  const { data: latestRatings } = useQuery({
    queryKey: ["station-ratings", id],
    enabled: !!id,
    queryFn: () => fetchStationRatings(id!, 10),
  });


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

  // Check if station owner has Fiskaly configured
  const ownerIdForFiskaly = station?.owner_id ?? (station?.structure_id ? undefined : undefined);
  const { data: ownerProfile } = useQuery({
    queryKey: ["owner-fiskaly-check", station?.owner_id],
    enabled: !!station?.owner_id,
    queryFn: async () => {
      // Admin can read any profile; partner can read own
      const { data, error } = await supabase
        .from("profiles")
        .select("id, fiskaly_system_id")
        .eq("id", station!.owner_id!)
        .single();
      if (error) return null;
      return data;
    },
  });
  const ownerHasFiskaly = !!ownerProfile?.fiskaly_system_id;

  // Board associated with this station
  const { data: currentBoard } = useQuery({
    queryKey: ["board-for-station", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("id, type, model")
        .eq("station_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // All unassigned boards (for reassignment)
  const { data: availableBoards } = useQuery({
    queryKey: ["available-boards"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("id, type, model")
        .is("station_id", null)
        .order("id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateBoardMutation = useMutation({
    mutationFn: async ({ newBoardId }: { newBoardId: string | null }) => {
      // Unlink current board if any
      if (currentBoard) {
        const { error } = await supabase
          .from("boards")
          .update({ station_id: null })
          .eq("id", currentBoard.id);
        if (error) throw error;
      }
      // Link new board
      if (newBoardId) {
        const { error } = await supabase
          .from("boards")
          .update({ station_id: id! })
          .eq("id", newBoardId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-for-station", id] });
      qc.invalidateQueries({ queryKey: ["available-boards"] });
      toast.success("Scheda aggiornata con successo");
    },
    onError: (e: any) => handleAppError(e, "StationDetail: aggiornamento scheda"),
  });
  useEffect(() => {
    if (station && !initialized) {
      setEditStatus(station.status ?? "AVAILABLE");
      setEditStructureId(station.structure_id ?? "__none__");
      setEditOwnerId(station.owner_id ?? "__none__");
      setEditVisibility(station.visibility ?? "PUBLIC");
      setEditHasAccessGate(station.has_access_gate ?? false);
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

  const isHeartbeatRecent = (lastHeartbeat: string | null | undefined, thresholdMs = 90_000): boolean => {
    if (!lastHeartbeat) return false;
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    return diff < thresholdMs;
  };

  const formatHeartbeatAgo = (lastHeartbeat: string | null | undefined): string => {
    if (!lastHeartbeat) return "Mai ricevuto";
    const diffMs = Date.now() - new Date(lastHeartbeat).getTime();
    if (diffMs < 0) return "Adesso";
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s fa`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min fa`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h fa`;
    const days = Math.floor(hours / 24);
    return `${days}g fa`;
  };

  const heartbeatOkForHw = station ? isHeartbeatRecent(station.last_heartbeat_at, 100_000) : false;
  const isTestingPhase = (station as any)?.phase === "TESTING";
  // Admin and testers in TESTING bypass heartbeat requirement
  const hwEnabled = heartbeatOkForHw || isAdmin || (isTester && isTestingPhase);

  const handleSave = async () => {
    if (!station) return;

    // Blocca attivazione se heartbeat non recente (tester in TESTING bypassa)
    if (editStatus === "AVAILABLE" && !isHeartbeatRecent(station.last_heartbeat_at) && !(isTester && isTestingPhase)) {
      toast.error("Impossibile attivare la stazione: nessun heartbeat recente. Verificare che il dispositivo sia acceso e connesso.");
      return;
    }

    // Blocca attivazione se nessuna scheda associata (tester bypassa)
    if (editStatus === "AVAILABLE" && !currentBoard && !(isTester && isTestingPhase)) {
      toast.error("Impossibile attivare la stazione: nessuna scheda hardware associata. Associare prima una scheda dalla sezione dedicata.");
      return;
    }

    // Blocca attivazione se Fiskaly non configurato (tester bypassa)
    if (editStatus === "AVAILABLE" && !ownerHasFiskaly && !(isTester && isTestingPhase)) {
      if (isAdmin) {
        toast.error("Impossibile attivare la stazione: configurare prima Fiskaly per il partner proprietario dalla sezione Impostazioni Sistema → Partner Fiscali.");
      } else {
        toast.error("Impossibile attivare la stazione: i dati fiscali non sono ancora configurati. Contattare l'amministratore per completare la configurazione.");
      }
      return;
    }

    try {
      const payload: Record<string, any> = {
        id: station.id,
        status: editStatus,
        // Gestione manual_offline
        ...(editStatus === 'OFFLINE' && { manual_offline: true }),
        ...(editStatus === 'AVAILABLE' && { manual_offline: false }),
        structure_id: editStructureId === "__none__" ? null : editStructureId,
        washing_options: washingOptions as any,
        visibility: editVisibility as any,
        has_access_gate: editHasAccessGate,
        geo_lat: stationLat,
        geo_lng: stationLng,
      };
      if (isAdmin) {
        payload.owner_id = editOwnerId === "__none__" ? null : editOwnerId;
      }
      await updateStation.mutateAsync(payload as any);
      toast.success("Stazione aggiornata con successo");
    } catch (e: any) {
      handleAppError(e, "StationDetail: salvataggio stazione");
    }
  };

  const invokeHardware = async (command: "ON" | "OFF" | "PULSE", duration_minutes?: number) => {
    if (!station) return;
    if ((command === "ON" || command === "OFF") && !hwEnabled) {
      toast.error("Stazione offline: nessun heartbeat ricevuto negli ultimi 100 secondi. Verificare che il dispositivo sia acceso e connesso.");
      return;
    }
    setHwBusy(true);
    try {
      await invokeStationControl(station.id, command, duration_minutes);
      toast.success("Comando hardware inviato");
    } catch (e: any) {
      handleAppError(e, "StationDetail: comando hardware");
    } finally {
      setHwBusy(false);
    }
  };

  const handleHwOn = async () => {
    await invokeHardware("ON");
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
      handleAppError(e, "StationDetail: rimozione dal cliente");
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
      handleAppError(e, "StationDetail: apertura ticket manutenzione");
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
  const canCommand = isAdmin || isPartner || isManager || isTester;
  const canEditInfo = isAdmin || isPartner || isManager;
  const canMoveStructure = isAdmin || isPartner;
  const canRemoveFromClient = isAdmin;
  const canChangeOwner = isAdmin;

  const isTubStation = (station as any).products?.type === "vasca" || station.type === "vasca";

  const washIsActive = !!washEndsAt && washRemaining > 0;
  const tubIsActive = !!tubEndsAt && tubRemaining > 0;
  const washProgress = washTotalSec > 0 ? ((washTotalSec - washRemaining) / washTotalSec) * 100 : 0;
  const tubProgress = tubTotalSec > 0 ? ((tubTotalSec - tubRemaining) / tubTotalSec) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Fiskaly not configured warning */}
      {station.owner_id && !ownerHasFiskaly && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Configurazione fiscale mancante</p>
            <p className="text-amber-700 dark:text-amber-400 mt-0.5">
              {isAdmin
                ? "Il partner proprietario non ha Fiskaly configurato. La stazione non può essere attivata. Vai in Impostazioni Sistema → Partner Fiscali per completare il setup."
                : "I dati fiscali non sono ancora stati configurati per il tuo account. La stazione non può essere attivata finché l'amministratore non completa la configurazione."}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-accent transition-colors self-start">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" /> <span className="truncate">{station.id}</span>
          </h1>
          <p className="text-muted-foreground capitalize">
            {station.type}
          </p>
          <p className={`text-xs flex items-center gap-1 mt-1 ${heartbeatOkForHw ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            <Clock className="h-3 w-3" /> Ultimo heartbeat: {formatHeartbeatAgo(station.last_heartbeat_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={station.status ?? "OFFLINE"} />
          {station.manual_offline && (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <ShieldAlert className="h-3 w-3" /> Disattivata
            </span>
          )}
        </div>
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
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">

              {/* Attiva Servizio (ON) */}
              <Button
                variant="outline"
                onClick={handleHwOn}
                disabled={hwBusy || updateStation.isPending || !canActivate || !hwEnabled}
                className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
              >
                {hwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Attiva Servizio
              </Button>

              {/* Spegni Servizio (OFF) */}
              <Button
                variant="destructive"
                onClick={() => invokeHardware("OFF")}
                disabled={hwBusy || updateStation.isPending || !hwEnabled}
                className="gap-2"
              >
                {hwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />} Spegni Servizio
              </Button>

              {/* Apri Porta (relay3) */}
              <Button
                variant="outline"
                onClick={() => {
                  if (!station) return;
                  setHwBusy(true);
                  supabase.functions.invoke("station-control", {
                    body: { station_id: station.id, command: "OPEN_GATE" },
                  }).then(({ data, error }) => {
                    if (error || data?.error) {
                      handleAppError(new Error(error?.message || data?.message || data?.error), "StationDetail: apri porta");
                    } else {
                      toast.success("Comando apertura porta inviato");
                    }
                  }).finally(() => setHwBusy(false));
                }}
                disabled={hwBusy || !hwEnabled}
                className="gap-2"
              >
                {hwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />} Apri Porta
              </Button>
            </div>
            {!hwEnabled && (
              <div className="text-xs text-destructive flex items-center gap-1.5 border-t pt-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Stazione offline — nessun heartbeat negli ultimi 100 secondi. I comandi ON/OFF sono disabilitati.</span>
              </div>
            )}
            {(missingReqs || !ownerHasFiskaly || !currentBoard) && (
              <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                <p className="font-medium text-foreground text-sm">Per attivare la stazione servono:</p>
                <p className={!!currentBoard ? "text-success-foreground" : "text-destructive"}>
                  {!!currentBoard ? "✓" : "✗"} Scheda hardware associata
                </p>
                <p className={hasStructure ? "text-success-foreground" : "text-destructive"}>
                  {hasStructure ? "✓" : "✗"} Assegnata a una struttura
                </p>
                <p className={hasGeo ? "text-success-foreground" : "text-destructive"}>
                  {hasGeo ? "✓" : "✗"} Posizione GPS inserita
                </p>
                <p className={hasPricing ? "text-success-foreground" : "text-destructive"}>
                  {hasPricing ? "✓" : "✗"} Almeno un'opzione di lavaggio configurata
                </p>
                <p className={ownerHasFiskaly ? "text-success-foreground" : "text-destructive"}>
                  {ownerHasFiskaly ? "✓" : "✗"} Configurazione fiscale (Fiskaly)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        );
      })()}

      {/* Manual Commands: Wash (relay1) + Tub Clean (relay2, vasca only) */}
      {canCommand && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" /> Comandi Manuali
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Lavaggio Manuale (relay1) */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Lavaggio Manuale</h4>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Durata: {manualWashMinutes} min</Label>
                <Slider min={1} max={60} step={1} value={[manualWashMinutes]} onValueChange={([v]) => setManualWashMinutes(v)} disabled={!hwEnabled || washBusy || washIsActive} />
                <div className="flex justify-between text-xs text-muted-foreground"><span>1 min</span><span>60 min</span></div>
              </div>

              {/* Countdown timer */}
              {washIsActive && (
                <div className="space-y-1.5 py-2 px-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5 animate-pulse" /> Lavaggio in corso
                    </span>
                    <span className="text-lg font-mono font-bold text-primary">{fmtTimer(washRemaining)}</span>
                  </div>
                  <Progress value={washProgress} className="h-2" />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (!station) return;
                    setWashBusy(true);
                    try {
                      const res = await invokeStartTimedWash(station.id, manualWashMinutes * 60);
                      setWashEndsAt(res.ends_at);
                      setWashTotalSec(manualWashMinutes * 60);
                      const endsAtFormatted = new Date(res.ends_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      toast.success(`Lavaggio avviato (${manualWashMinutes} min) — termine previsto: ${endsAtFormatted}`);
                    } catch (e: any) {
                      if (e.message === "STATION_OFFLINE") {
                        toast.error("Stazione offline: nessun heartbeat recente. Impossibile avviare il lavaggio.");
                      } else {
                        handleAppError(e, "StationDetail: lavaggio manuale");
                      }
                    } finally {
                      setWashBusy(false);
                    }
                  }}
                  disabled={!hwEnabled || washBusy || washIsActive}
                  className="gap-2"
                >
                  {washBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  Avvia Lavaggio ({manualWashMinutes} min)
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (!station) return;
                    setWashBusy(true);
                    try {
                      await invokeStopWash(station.id);
                      setWashEndsAt(null);
                      toast.success("Lavaggio interrotto.");
                    } catch (e: any) {
                      handleAppError(e, "StationDetail: stop lavaggio");
                    } finally {
                      setWashBusy(false);
                    }
                  }}
                  disabled={!hwEnabled || washBusy}
                  className="gap-2"
                >
                  {washBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  Ferma
                </Button>
              </div>
            </div>

            {/* Pulizia Vasca (relay2) — solo vasche */}
            {isTubStation && (
              <>
                <div className="border-t" />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-primary" /> Pulizia Automatica Vasca
                  </h4>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Durata: {tubCleanMinutes} min</Label>
                    <Slider min={1} max={60} step={1} value={[tubCleanMinutes]} onValueChange={([v]) => setTubCleanMinutes(v)} disabled={!hwEnabled || tubCleanBusy || tubIsActive} />
                    <div className="flex justify-between text-xs text-muted-foreground"><span>1 min</span><span>60 min</span></div>
                  </div>

                  {/* Countdown timer */}
                  {tubIsActive && (
                    <div className="space-y-1.5 py-2 px-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                          <Timer className="h-3.5 w-3.5 animate-pulse" /> Pulizia in corso
                        </span>
                        <span className="text-lg font-mono font-bold text-primary">{fmtTimer(tubRemaining)}</span>
                      </div>
                      <Progress value={tubProgress} className="h-2" />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        if (!station) return;
                        setTubCleanBusy(true);
                        try {
                          const res = await invokeStartTubClean(station.id, tubCleanMinutes * 60);
                          setTubEndsAt(res.ends_at);
                          setTubTotalSec(tubCleanMinutes * 60);
                          const endsAtFormatted = new Date(res.ends_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                          toast.success(`Pulizia vasca avviata (${tubCleanMinutes} min) — termine previsto: ${endsAtFormatted}`);
                        } catch (e: any) {
                          if (e.message === "STATION_OFFLINE") {
                            toast.error("Stazione offline: nessun heartbeat recente. Impossibile avviare la pulizia.");
                          } else {
                            handleAppError(e, "StationDetail: pulizia vasca");
                          }
                        } finally {
                          setTubCleanBusy(false);
                        }
                      }}
                      disabled={!hwEnabled || tubCleanBusy || tubIsActive}
                      variant="secondary"
                      className="gap-2"
                    >
                      {tubCleanBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Droplets className="h-4 w-4" />}
                      Avvia Pulizia ({tubCleanMinutes} min)
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (!station) return;
                        setTubCleanBusy(true);
                        try {
                          await invokeStopTubClean(station.id);
                          setTubEndsAt(null);
                          toast.success("Pulizia vasca interrotta.");
                        } catch (e: any) {
                          handleAppError(e, "StationDetail: stop pulizia vasca");
                        } finally {
                          setTubCleanBusy(false);
                        }
                      }}
                      disabled={!hwEnabled || tubCleanBusy}
                      className="gap-2"
                    >
                      {tubCleanBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                      Ferma
                    </Button>
                  </div>
                </div>
              </>
            )}

            {!hwEnabled && (
              <div className="text-xs text-destructive flex items-center gap-1.5 border-t pt-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Stazione offline — i comandi manuali sono disabilitati.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Informazioni Stazione
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
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

      {/* Board Association - Admin only */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" /> Scheda Associata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentBoard ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium font-mono">{currentBoard.id}</p>
                  <p className="text-xs text-muted-foreground capitalize">{currentBoard.type}{currentBoard.model ? ` — ${currentBoard.model}` : ""}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateBoardMutation.mutate({ newBoardId: null })}
                  disabled={updateBoardMutation.isPending}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  {updateBoardMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Scollega
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nessuna scheda associata.</p>
            )}

            <div>
              <Label>Associa una scheda</Label>
              <div className="flex gap-2 mt-1.5">
                <Select value={editBoardId} onValueChange={setEditBoardId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona scheda" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Seleziona —</SelectItem>
                    {(availableBoards ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.id} ({b.type}{b.model ? ` — ${b.model}` : ""})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (editBoardId && editBoardId !== "__none__") {
                      updateBoardMutation.mutate({ newBoardId: editBoardId });
                      setEditBoardId("__none__");
                    }
                  }}
                  disabled={editBoardId === "__none__" || updateBoardMutation.isPending}
                  size="default"
                  className="gap-1 shrink-0"
                >
                  {updateBoardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Associa
                </Button>
              </div>
              {(availableBoards ?? []).length === 0 && !currentBoard && (
                <p className="text-xs text-muted-foreground mt-1">Nessuna scheda libera disponibile.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

            {/* Access Gate toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Porta d'accesso automatica</Label>
                <p className="text-xs text-muted-foreground">Se attivo, l'app utente mostrerà il pulsante "Apri Porta"</p>
              </div>
              <Switch checked={editHasAccessGate} onCheckedChange={setEditHasAccessGate} />
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
                        <NumericInput
                          step="0.50"
                          placeholder="0"
                          numericValue={opt.price}
                          onNumericChange={(v) => updateOption(opt.id, "price", v)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Durata (min)</Label>
                        <NumericInput
                          step="1"
                          min="1"
                          placeholder="0"
                          numericValue={Math.round(opt.duration / 60)}
                          onNumericChange={(v) => updateOption(opt.id, "duration", v * 60)}
                          integer
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



      {/* Station Users */}
      <StationUsersList stationId={station.id} />

      {/* Wash Session Logs */}
      <StationWashLogs stationId={station.id} />

      {/* Station Ratings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" /> Valutazioni
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {avgRating?.total_count ?? 0} {(avgRating?.total_count ?? 0) === 1 ? "recensione" : "recensioni"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!avgRating || avgRating.total_count === 0) ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">Nessuna valutazione ricevuta.</p>
          ) : (
            <>
              {/* Average */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-5 w-5 ${s <= Math.round(avgRating.avg_rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <span className="text-xl font-bold">{avgRating.avg_rating}</span>
                <span className="text-sm text-muted-foreground">/ 5</span>
              </div>

              {/* Latest reviews */}
              {latestRatings && latestRatings.length > 0 && (
                <div className="space-y-3">
                  {latestRatings.map((r) => (
                    <div key={r.id} className="flex flex-col gap-1 border-t pt-3 first:border-0 first:pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3.5 w-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                      {(r.user_first_name || r.user_last_name || r.user_email) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {r.user_first_name || r.user_last_name
                            ? `${r.user_first_name ?? ""} ${r.user_last_name ?? ""}`.trim()
                            : r.user_email}
                        </span>
                      )}
                      {r.comment && (
                        <p className="text-sm text-foreground">{r.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <StationMaintenanceHistory stationId={station.id} />

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
