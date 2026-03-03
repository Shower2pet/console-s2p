import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { ArrowLeft, Wrench, AlertTriangle, CheckCircle, Loader2, Clock, User, MapPin, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useMaintenanceLogs, useUpdateMaintenanceStatus } from "@/hooks/useMaintenanceLogs";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import { Link } from "react-router-dom";

const statusLabels: Record<string, string> = {
  open: "Da risolvere",
  in_progress: "In risoluzione",
  risolto: "Risolto",
};

const statusColors: Record<string, string> = {
  open: "bg-destructive/15 text-destructive border-destructive/30",
  in_progress: "bg-warning/15 text-warning-foreground border-warning/30",
  risolto: "bg-success/15 text-success-foreground border-success/30",
};

const severityLabels: Record<string, string> = { low: "Basso", high: "Alto" };
const severityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  high: "bg-destructive/15 text-destructive border-destructive/30",
};

const MaintenanceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: logs, isLoading } = useMaintenanceLogs();
  const updateStatus = useUpdateMaintenanceStatus();

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newTicketStatus, setNewTicketStatus] = useState<string>("open");
  const [statusNotes, setStatusNotes] = useState("");

  const log = useMemo(() => (logs ?? []).find(l => l.id === id), [logs, id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!log) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate("/maintenance")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla lista
        </Button>
        <p className="text-muted-foreground text-center py-12">Ticket non trovato.</p>
      </div>
    );
  }

  const structName = (log as any).stations?.structures?.name ?? "—";
  const stationId = log.station_id ?? "—";
  const structureId = (log as any).stations?.structure_id;
  const authorProfile = (log as any).author_profile;
  const authorName = authorProfile
    ? [authorProfile.first_name, authorProfile.last_name].filter(Boolean).join(" ") || authorProfile.email || "—"
    : "Sistema";

  const handleUpdateStatus = async () => {
    try {
      await updateStatus.mutateAsync({
        logId: log.id,
        status: newTicketStatus,
        notes: statusNotes || undefined,
        stationId: log.station_id ?? undefined,
      });
      toast.success("Stato aggiornato");
      setStatusDialogOpen(false);
      setStatusNotes("");
    } catch (e: any) {
      handleAppError(e, "MaintenanceDetail: aggiornamento stato");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/maintenance")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Wrench className="h-6 w-6 text-primary" />
              Ticket Manutenzione
            </h1>
            <p className="text-sm text-muted-foreground">
              {structName} — {stationId}
            </p>
          </div>
        </div>
        {log.status !== "risolto" && (
          <Button
            onClick={() => {
              setNewTicketStatus(log.status === "open" ? "in_progress" : "risolto");
              setStatusNotes(log.notes ?? "");
              setStatusDialogOpen(true);
            }}
          >
            Aggiorna Stato
          </Button>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Status & Severity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stato & Gravità</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Stato:</span>
              <Badge variant="outline" className={statusColors[log.status ?? "open"]}>
                {statusLabels[log.status ?? "open"]}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Gravità:</span>
              <Badge variant="outline" className={severityColors[log.severity ?? "low"]}>
                {log.severity === "high" && <AlertTriangle className="h-3 w-3 mr-1" />}
                {severityLabels[log.severity ?? "low"]}
              </Badge>
            </div>
            {log.severity === "high" && log.status !== "risolto" && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                La stazione è in stato MANUTENZIONE
              </p>
            )}
            {log.status === "risolto" && (
              <p className="text-xs text-muted-foreground bg-success/10 p-2 rounded flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                Ticket risolto
              </p>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> Posizione
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-xs text-muted-foreground">Struttura</span>
              {structureId ? (
                <Link to={`/structures/${structureId}`} className="block text-sm font-medium text-primary hover:underline">
                  {structName}
                </Link>
              ) : (
                <p className="text-sm font-medium">{structName}</p>
              )}
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Stazione</span>
              <Link to={`/stations/${stationId}`} className="block text-sm font-medium text-primary hover:underline">
                {stationId}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Dates & Author */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Cronologia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-xs text-muted-foreground">Creato il</span>
              <p className="text-sm font-medium">
                {log.created_at ? format(new Date(log.created_at), "dd MMMM yyyy, HH:mm", { locale: it }) : "—"}
              </p>
            </div>
            {log.ended_at && (
              <div>
                <span className="text-xs text-muted-foreground">Risolto il</span>
                <p className="text-sm font-medium">
                  {format(new Date(log.ended_at), "dd MMMM yyyy, HH:mm", { locale: it })}
                </p>
              </div>
            )}
            <Separator />
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground">Aperto da</span>
                <p className="text-sm font-medium">{authorName}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description & Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Descrizione
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {log.reason || "Nessuna descrizione fornita."}
          </p>
          {log.notes && (
            <>
              <Separator />
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Note</span>
                <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{log.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Update Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aggiorna Stato Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nuovo stato</Label>
              <Select value={newTicketStatus} onValueChange={setNewTicketStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Da risolvere</SelectItem>
                  <SelectItem value="in_progress">In risoluzione</SelectItem>
                  <SelectItem value="risolto">Risolto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={statusNotes}
                onChange={e => setStatusNotes(e.target.value)}
                placeholder="Note di aggiornamento..."
                rows={2}
              />
            </div>
            {log.severity === "high" && newTicketStatus === "risolto" && (
              <p className="text-xs text-muted-foreground bg-success/10 p-2 rounded flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> Risolvendo questo ticket, la stazione tornerà DISPONIBILE automaticamente.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleUpdateStatus} disabled={updateStatus.isPending}>
              {updateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaintenanceDetail;
