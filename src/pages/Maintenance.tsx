import { useState, useMemo } from "react";
import { Wrench, Plus, Loader2, ArrowUpDown, Search, AlertTriangle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMaintenanceLogs, useCreateMaintenanceTicket, useUpdateMaintenanceStatus } from "@/hooks/useMaintenanceLogs";
import { useStations } from "@/hooks/useStations";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";

type TicketStatus = "open" | "in_progress" | "risolto";
type SortField = "created_at" | "severity" | "status";
type SortDir = "asc" | "desc";

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

const Maintenance = () => {
  const { data: logs, isLoading } = useMaintenanceLogs();
  const { data: stations } = useStations();
  const { user, isAdmin } = useAuth();
  const createTicket = useCreateMaintenanceTicket();
  const updateStatus = useUpdateMaintenanceStatus();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Create ticket dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newStationId, setNewStationId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newSeverity, setNewSeverity] = useState<"low" | "high">("low");

  // Status change dialog
  const [statusDialogLog, setStatusDialogLog] = useState<any | null>(null);
  const [newTicketStatus, setNewTicketStatus] = useState<string>("open");
  const [statusNotes, setStatusNotes] = useState("");

  const stationOptions = useMemo(() => {
    return (stations ?? []).map(s => ({
      id: s.id,
      label: `${(s as any).structures?.name ? (s as any).structures.name + " - " : ""}${s.id}`,
    }));
  }, [stations]);

  const filteredLogs = useMemo(() => {
    let items = [...(logs ?? [])];

    // Text search
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(l => {
        const structName = (l as any).stations?.structures?.name ?? "";
        return (
          l.reason?.toLowerCase().includes(q) ||
          l.station_id?.toLowerCase().includes(q) ||
          structName.toLowerCase().includes(q) ||
          (l as any).author_profile?.first_name?.toLowerCase().includes(q) ||
          (l as any).author_profile?.last_name?.toLowerCase().includes(q)
        );
      });
    }

    // Filters
    if (filterStatus !== "all") items = items.filter(l => l.status === filterStatus);
    if (filterSeverity !== "all") items = items.filter(l => l.severity === filterSeverity);

    // Sort
    items.sort((a, b) => {
      let va: any, vb: any;
      if (sortField === "created_at") {
        va = a.created_at ?? ""; vb = b.created_at ?? "";
      } else if (sortField === "severity") {
        va = a.severity === "high" ? 1 : 0; vb = b.severity === "high" ? 1 : 0;
      } else {
        const order = { open: 0, in_progress: 1, risolto: 2 };
        va = order[a.status as keyof typeof order] ?? 3;
        vb = order[b.status as keyof typeof order] ?? 3;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [logs, search, filterStatus, filterSeverity, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const handleCreateTicket = async () => {
    if (!newStationId || !newReason.trim()) {
      toast.error("Seleziona una stazione e inserisci la descrizione");
      return;
    }
    try {
      await createTicket.mutateAsync({
        stationId: newStationId,
        reason: newReason.trim(),
        severity: newSeverity,
        performedBy: user?.id,
      });
      toast.success("Ticket creato");
      setCreateOpen(false);
      setNewStationId("");
      setNewReason("");
      setNewSeverity("low");
    } catch (e: any) {
      handleAppError(e, "Maintenance: creazione ticket");
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusDialogLog) return;
    try {
      await updateStatus.mutateAsync({
        logId: statusDialogLog.id,
        status: newTicketStatus,
        notes: statusNotes || undefined,
      });
      toast.success("Stato aggiornato");
      setStatusDialogLog(null);
      setStatusNotes("");
    } catch (e: any) {
      handleAppError(e, "Maintenance: aggiornamento stato ticket");
    }
  };

  const openTicketsCount = (logs ?? []).filter(l => l.status !== "risolto").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" /> Manutenzione
          </h1>
          <p className="text-muted-foreground">
            {openTicketsCount} ticket aperti
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuovo Ticket
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per stazione, struttura, motivo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="open">Da risolvere</SelectItem>
                <SelectItem value="in_progress">In risoluzione</SelectItem>
                <SelectItem value="risolto">Risolto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Gravità" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="low">Basso</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("severity")}>
                  <span className="flex items-center gap-1">
                    Gravità <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">
                    Stato <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead>Autore</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                  <span className="flex items-center gap-1">
                    Data <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Nessun ticket trovato.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map(log => {
                  const structName = (log as any).stations?.structures?.name ?? "—";
                  const title = `${structName} - ${log.station_id ?? "?"}`;
                  const authorProfile = (log as any).author_profile;
                  const authorName = authorProfile
                    ? [authorProfile.first_name, authorProfile.last_name].filter(Boolean).join(" ") || authorProfile.email || "—"
                    : "Sistema";

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium text-foreground max-w-[200px] truncate">
                        {title}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-muted-foreground">
                        {log.reason ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={severityColors[log.severity ?? "low"]}>
                          {log.severity === "high" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {severityLabels[log.severity ?? "low"]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[log.status ?? "open"]}>
                          {statusLabels[log.status ?? "open"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{authorName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {log.created_at ? format(new Date(log.created_at), "dd/MM/yy HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {log.status !== "risolto" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setStatusDialogLog(log);
                              setNewTicketStatus(log.status === "open" ? "in_progress" : "risolto");
                              setStatusNotes(log.notes ?? "");
                            }}
                          >
                            Aggiorna
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {log.ended_at ? format(new Date(log.ended_at), "dd/MM HH:mm") : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Ticket Manutenzione</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Stazione *</Label>
              <Select value={newStationId} onValueChange={setNewStationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stazione..." />
                </SelectTrigger>
                <SelectContent>
                  {stationOptions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrizione *</Label>
              <Textarea
                value={newReason}
                onChange={e => setNewReason(e.target.value)}
                placeholder="Descrivi il problema..."
                rows={3}
              />
            </div>
            <div>
              <Label>Gravità</Label>
              <Select value={newSeverity} onValueChange={v => setNewSeverity(v as "low" | "high")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basso — La stazione può continuare a funzionare</SelectItem>
                  <SelectItem value="high">Alto — La stazione verrà messa in MANUTENZIONE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
            <Button onClick={handleCreateTicket} disabled={createTicket.isPending}>
              {createTicket.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crea Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!statusDialogLog} onOpenChange={open => { if (!open) setStatusDialogLog(null); }}>
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
            {statusDialogLog?.severity === "high" && newTicketStatus === "risolto" && (
              <p className="text-xs text-muted-foreground bg-success/10 p-2 rounded">
                ✅ Risolvendo questo ticket, la stazione tornerà DISPONIBILE automaticamente.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogLog(null)}>Annulla</Button>
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

export default Maintenance;
