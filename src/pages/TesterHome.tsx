import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Monitor, Cpu, Droplets, Wind, DoorOpen, ShowerHead, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
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
}

const fetchTesterStations = async (userId: string): Promise<TesterStation[]> => {
  const { data, error } = await supabase
    .from("stations")
    .select("id, type, status, description, owner_id, last_heartbeat_at, product_id")
    .eq("phase" as any, "TESTING" as any)
    .eq("owner_id", userId)
    .order("id");
  if (error) throw error;
  return (data ?? []) as TesterStation[];
};

const TesterHome = () => {
  const { user } = useAuth();
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [washDuration, setWashDuration] = useState(5);
  const [tubDuration, setTubDuration] = useState(5);
  const [loadingCmd, setLoadingCmd] = useState<string | null>(null);

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["tester-stations", user?.id],
    queryFn: () => fetchTesterStations(user!.id),
    enabled: !!user,
  });

  const currentStation = stations.find((s) => s.id === selectedStation);
  const isTub = currentStation?.type?.toLowerCase().includes("vasca") || currentStation?.type?.toLowerCase().includes("tub");

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
    } catch (err: any) {
      handleAppError(err, `TesterHome: ${command}`);
    } finally {
      setLoadingCmd(null);
    }
  };

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
            <p className="text-sm text-muted-foreground">Nessuna stazione creata. Vai alla sezione "Stazioni" per crearne una.</p>
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
          <Card>
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
                  />
                  <span className="text-sm font-mono w-16 text-right">{washDuration} min</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => sendCommand("START_TIMED_WASH", { duration_seconds: washDuration * 60 })}
                    disabled={!!loadingCmd}
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

          {/* Relay 2 — Pulizia Vasca (only for tub stations) */}
          <Card className={!isTub ? "opacity-50" : ""}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wind className="h-5 w-5 text-emerald-500" /> Relè 2 — Pulizia Vasca
                {!isTub && <Badge variant="secondary" className="text-xs">Solo Vasca</Badge>}
              </CardTitle>
              <CardDescription>Controlla il relè per la pulizia automatica della vasca</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <Slider
                    value={[tubDuration]}
                    onValueChange={([v]) => setTubDuration(v)}
                    min={1}
                    max={60}
                    step={1}
                    className="flex-1"
                    disabled={!isTub}
                  />
                  <span className="text-sm font-mono w-16 text-right">{tubDuration} min</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => sendCommand("START_TUB_CLEAN", { duration_seconds: tubDuration * 60 })}
                    disabled={!!loadingCmd || !isTub}
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
