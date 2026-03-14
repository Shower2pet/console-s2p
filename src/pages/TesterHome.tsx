import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Monitor, Cpu, Droplets, Wind, DoorOpen, ShowerHead, Loader2, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TesterStation {
  id: string;
  type: string;
  status: string | null;
  description: string | null;
  owner_id: string | null;
  last_heartbeat_at: string | null;
  product_id: string | null;
  products?: {
    type: string | null;
    name: string | null;
  } | null;
}

const fetchTesterStations = async (userId: string): Promise<TesterStation[]> => {
  const { data, error } = await (supabase
    .from("stations")
    .select("id, type, status, description, owner_id, last_heartbeat_at, product_id, products:product_id(type, name)") as any)
    .eq("phase", "TESTING")
    .eq("owner_id", userId)
    .order("id");
  if (error) throw error;
  return (data ?? []) as TesterStation[];
};

/** Format seconds as mm:ss */
const fmtTimer = (totalSec: number): string => {
  if (totalSec <= 0) return "00:00";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** Hook that counts down to an endsAt ISO timestamp, returning remaining seconds */
const useCountdown = (endsAt: string | null): number => {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!endsAt) {
      setRemaining(0);
      return;
    }
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

// Helper: read/write timer state from localStorage
const TIMER_STORAGE_KEY = "s2p_tester_timers";

interface PersistedTimers {
  stationId: string;
  washEndsAt: string | null;
  washTotalSec: number;
  tubEndsAt: string | null;
  tubTotalSec: number;
}

const loadTimers = (): PersistedTimers | null => {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTimers;
    const now = Date.now();
    const washExpired = !parsed.washEndsAt || new Date(parsed.washEndsAt).getTime() <= now;
    const tubExpired = !parsed.tubEndsAt || new Date(parsed.tubEndsAt).getTime() <= now;
    if (washExpired && tubExpired) { localStorage.removeItem(TIMER_STORAGE_KEY); return null; }
    if (washExpired) parsed.washEndsAt = null;
    if (tubExpired) parsed.tubEndsAt = null;
    return parsed;
  } catch { return null; }
};

const saveTimers = (t: PersistedTimers) => {
  try { localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(t)); } catch { /* */ }
};

const clearTimersStorage = () => {
  try { localStorage.removeItem(TIMER_STORAGE_KEY); } catch { /* */ }
};

const TesterHome = () => {
  const { user } = useAuth();
  const persisted = useMemo(() => loadTimers(), []);

  const [selectedStation, setSelectedStation] = useState<string>(persisted?.stationId ?? "");
  const [washDuration, setWashDuration] = useState(5);
  const [tubDuration, setTubDuration] = useState(5);
  const [loadingCmd, setLoadingCmd] = useState<string | null>(null);

  const [washEndsAt, setWashEndsAt] = useState<string | null>(persisted?.washEndsAt ?? null);
  const [washTotalSec, setWashTotalSec] = useState(persisted?.washTotalSec ?? 0);
  const [tubEndsAt, setTubEndsAt] = useState<string | null>(persisted?.tubEndsAt ?? null);
  const [tubTotalSec, setTubTotalSec] = useState(persisted?.tubTotalSec ?? 0);

  const washRemaining = useCountdown(washEndsAt);
  const tubRemaining = useCountdown(tubEndsAt);

  // Persist timer state
  useEffect(() => {
    if (washEndsAt || tubEndsAt) {
      saveTimers({ stationId: selectedStation, washEndsAt, washTotalSec, tubEndsAt, tubTotalSec });
    } else {
      clearTimersStorage();
    }
  }, [washEndsAt, washTotalSec, tubEndsAt, tubTotalSec, selectedStation]);

  // Auto-clear when timer reaches 0
  const washWasActive = useRef(false);
  const tubWasActive = useRef(false);

  useEffect(() => {
    if (washEndsAt && washRemaining > 0) washWasActive.current = true;
    if (washEndsAt && washRemaining <= 0 && washWasActive.current) {
      setWashEndsAt(null);
      washWasActive.current = false;
    }
  }, [washRemaining, washEndsAt]);

  useEffect(() => {
    if (tubEndsAt && tubRemaining > 0) tubWasActive.current = true;
    if (tubEndsAt && tubRemaining <= 0 && tubWasActive.current) {
      setTubEndsAt(null);
      tubWasActive.current = false;
    }
  }, [tubRemaining, tubEndsAt]);

  // Clear timers when station changes (skip initial mount with persisted station)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setWashEndsAt(null); setTubEndsAt(null);
  }, [selectedStation]);

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["tester-hw-stations", user?.id],
    queryFn: () => fetchTesterStations(user!.id),
    enabled: !!user,
  });

  const currentStation = stations.find((s) => s.id === selectedStation);
  const isTub = currentStation?.products?.type === "vasca" || currentStation?.type === "vasca";

  const sendCommand = async (command: string, extras: Record<string, any> = {}) => {
    if (!selectedStation) {
      toast.warning("Seleziona una stazione prima");
      return;
    }
    setLoadingCmd(command);
    try {
      const body: Record<string, any> = { station_id: selectedStation, command, ...extras };
      const { data, error } = await supabase.functions.invoke("station-control", { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.message || data.error);
      toast.success(`Comando ${command} inviato con successo`);

      // Start countdown timers
      if (command === "START_TIMED_WASH" && data?.ends_at) {
        setWashEndsAt(data.ends_at);
        setWashTotalSec(extras.duration_seconds ?? 0);
      }
      if (command === "START_TUB_CLEAN" && data?.ends_at) {
        setTubEndsAt(data.ends_at);
        setTubTotalSec(extras.duration_seconds ?? 0);
      }
      if (command === "STOP_WASH" || command === "OFF") setWashEndsAt(null);
      if (command === "STOP_TUB_CLEAN" || command === "OFF_RELAY2") setTubEndsAt(null);
    } catch (err: any) {
      handleAppError(err, `TesterHome: ${command}`);
    } finally {
      setLoadingCmd(null);
    }
  };

  const washIsActive = !!washEndsAt && washRemaining > 0;
  const tubIsActive = !!tubEndsAt && tubRemaining > 0;
  const washProgress = washTotalSec > 0 ? ((washTotalSec - washRemaining) / washTotalSec) * 100 : 0;
  const tubProgress = tubTotalSec > 0 ? ((tubTotalSec - tubRemaining) / tubTotalSec) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" /> Test Hardware
        </h1>
        <p className="text-muted-foreground">Pannello di controllo per testare schede e stazioni</p>
      </div>

      {/* Station selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" /> Stazione da Testare
          </CardTitle>
          <CardDescription>Seleziona una delle tue stazioni per testare i relè e le funzionalità.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : stations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna stazione in fase di test. Vai alla sezione "Stazioni" per prenderne una in carico.</p>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Seleziona stazione..." />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.id} — <span className="capitalize">{s.type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentStation && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{currentStation.type}</Badge>
                  <Badge variant={currentStation.status === "AVAILABLE" ? "default" : "secondary"}>
                    {currentStation.status ?? "N/A"}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStation && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Relay 1 — Acqua/Phon (Lavaggio) */}
          <Card className={washIsActive ? "ring-2 ring-primary/50" : ""}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-500" /> Relè 1 — Acqua / Phon
              </CardTitle>
              <CardDescription>Controlla il relè principale (lavaggio)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => sendCommand("ON")}
                  disabled={!!loadingCmd}
                  className="gap-1"
                >
                  {loadingCmd === "ON" && <Loader2 className="h-3 w-3 animate-spin" />} ON
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendCommand("OFF")}
                  disabled={!!loadingCmd}
                  className="gap-1"
                >
                  {loadingCmd === "OFF" && <Loader2 className="h-3 w-3 animate-spin" />} OFF
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-medium text-foreground">Lavaggio Temporizzato</p>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[washDuration]}
                    onValueChange={([v]) => setWashDuration(v)}
                    min={1}
                    max={60}
                    step={1}
                    className="flex-1"
                    disabled={washIsActive}
                  />
                  <span className="text-sm font-mono w-16 text-right">{washDuration} min</span>
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
                    size="sm"
                    variant="default"
                    onClick={() => sendCommand("START_TIMED_WASH", { duration_seconds: washDuration * 60 })}
                    disabled={!!loadingCmd || washIsActive}
                    className="gap-1"
                  >
                    {loadingCmd === "START_TIMED_WASH" && <Loader2 className="h-3 w-3 animate-spin" />}
                    <ShowerHead className="h-3.5 w-3.5" /> Avvia Lavaggio
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => sendCommand("STOP_WASH")}
                    disabled={!!loadingCmd}
                    className="gap-1"
                  >
                    {loadingCmd === "STOP_WASH" && <Loader2 className="h-3 w-3 animate-spin" />} Ferma
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Relay 2 — Pulizia Vasca */}
          <Card className={tubIsActive ? "ring-2 ring-primary/50" : ""}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wind className="h-5 w-5 text-emerald-500" /> Relè 2 — Pulizia Vasca
              </CardTitle>
              <CardDescription>Controlla il relè per la pulizia automatica della vasca</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ON / OFF diretti relay2 */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => sendCommand("ON_RELAY2")}
                  disabled={!!loadingCmd || !isTub}
                  className="gap-1"
                >
                  {loadingCmd === "ON_RELAY2" && <Loader2 className="h-3 w-3 animate-spin" />} ON
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendCommand("OFF_RELAY2")}
                  disabled={!!loadingCmd || !isTub}
                  className="gap-1"
                >
                  {loadingCmd === "OFF_RELAY2" && <Loader2 className="h-3 w-3 animate-spin" />} OFF
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-medium text-foreground">Pulizia Temporizzata</p>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[tubDuration]}
                    onValueChange={([v]) => setTubDuration(v)}
                    min={1}
                    max={60}
                    step={1}
                    className="flex-1"
                    disabled={!isTub || tubIsActive}
                  />
                  <span className="text-sm font-mono w-16 text-right">{tubDuration} min</span>
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
                    size="sm"
                    variant="default"
                    onClick={() => sendCommand("START_TUB_CLEAN", { duration_seconds: tubDuration * 60 })}
                    disabled={!!loadingCmd || !isTub || tubIsActive}
                    className="gap-1"
                  >
                    {loadingCmd === "START_TUB_CLEAN" && <Loader2 className="h-3 w-3 animate-spin" />}
                    Avvia Pulizia
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => sendCommand("STOP_TUB_CLEAN")}
                    disabled={!!loadingCmd || !isTub}
                    className="gap-1"
                  >
                    {loadingCmd === "STOP_TUB_CLEAN" && <Loader2 className="h-3 w-3 animate-spin" />} Ferma
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Relay 3 — Gate */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-amber-500" /> Relè 3 — Porta Automatica
              </CardTitle>
              <CardDescription>Testa l'apertura della porta (impulso 5 secondi)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => sendCommand("OPEN_GATE")}
                disabled={!!loadingCmd}
                className="gap-2"
              >
                {loadingCmd === "OPEN_GATE" && <Loader2 className="h-3 w-3 animate-spin" />}
                <DoorOpen className="h-4 w-4" /> Apri Porta
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TesterHome;
