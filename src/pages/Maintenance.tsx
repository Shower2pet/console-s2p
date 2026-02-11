import { useState } from "react";
import { Link } from "react-router-dom";
import { Wrench, AlertTriangle, AlertCircle, Info, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { useMaintenanceLogs, useCloseMaintenanceTicket } from "@/hooks/useMaintenanceLogs";
import { useStations } from "@/hooks/useStations";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

const Maintenance = () => {
  const { data: logs, isLoading } = useMaintenanceLogs();
  const { data: stations } = useStations();
  const closeTicket = useCloseMaintenanceTicket();
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeNotes, setCloseNotes] = useState("");

  const offlineStations = (stations ?? []).filter(s => s.status === "OFFLINE" || s.status === "MAINTENANCE");
  const openTickets = (logs ?? []).filter(l => !l.ended_at);
  const closedTickets = (logs ?? []).filter(l => l.ended_at);

  const handleClose = async (logId: string, stationId: string) => {
    try {
      await closeTicket.mutateAsync({ logId, notes: closeNotes, stationId });
      toast.success("Ticket chiuso, stazione riportata in AVAILABLE");
      setClosingId(null);
      setCloseNotes("");
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
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <Wrench className="inline mr-2 h-6 w-6 text-primary" />
          Manutenzione
        </h1>
        <p className="text-muted-foreground">Ticket aperti: {openTickets.length}</p>
      </div>

      {/* Offline/Maintenance stations alert */}
      {offlineStations.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Stazioni Non Operative ({offlineStations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {offlineStations.map(s => (
                <Link key={s.id} to="/stations" className="flex items-center gap-2 rounded-lg border p-3 bg-card hover:shadow-md hover:border-primary/30 transition-all">
                  <span className="text-sm font-medium text-foreground">{s.id}</span>
                  <StatusBadge status={s.status ?? "OFFLINE"} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open tickets */}
      {openTickets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Ticket Aperti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openTickets.map(log => (
              <div key={log.id} className="flex items-start gap-4 rounded-lg p-3 border bg-warning/5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{log.reason ?? "Nessun motivo"}</p>
                  <p className="text-xs text-muted-foreground">
                    Stazione: {log.station_id} • Aperto: {log.started_at ? format(new Date(log.started_at), "dd/MM/yyyy HH:mm") : "—"}
                  </p>
                </div>
                {closingId === log.id ? (
                  <div className="flex items-center gap-2">
                    <Input placeholder="Note chiusura..." value={closeNotes} onChange={e => setCloseNotes(e.target.value)} className="w-48" />
                    <Button size="sm" onClick={() => handleClose(log.id, log.station_id!)} disabled={closeTicket.isPending}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setClosingId(null)}>✕</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setClosingId(log.id)}>
                    Chiudi Ticket
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Closed tickets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading">Storico Ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {closedTickets.map(log => (
            <div key={log.id} className="flex items-start gap-4 rounded-lg p-3 hover:bg-accent/50 transition-colors border">
              <div className={cn("rounded-lg p-2 flex-shrink-0 bg-success/10")}>
                <CheckCircle className="h-4 w-4 text-success-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{log.reason ?? "—"}</p>
                {log.notes && <p className="text-xs text-muted-foreground mt-0.5">Note: {log.notes}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Stazione: {log.station_id} •
                  {log.started_at ? ` Da ${format(new Date(log.started_at), "dd/MM HH:mm")}` : ""} 
                  {log.ended_at ? ` a ${format(new Date(log.ended_at), "dd/MM HH:mm")}` : ""}
                </p>
              </div>
            </div>
          ))}
          {closedTickets.length === 0 && <p className="text-sm text-muted-foreground">Nessun ticket chiuso.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default Maintenance;
