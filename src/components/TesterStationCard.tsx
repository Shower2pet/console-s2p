import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Cpu, Wifi, WifiOff, CheckCircle2, Circle, Trash2, Link2, Loader2, ArrowRight, XCircle, FlaskConical,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import { promoteToStock, deleteStation } from "@/services/stationService";
import { assignBoardToStation, unassignBoard, type Board } from "@/services/boardService";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TesterStationCardProps {
  station: {
    id: string;
    type: string;
    status: string | null;
    description: string | null;
    created_at: string | null;
    last_heartbeat_at: string | null;
  };
  board: Board | null;
  availableBoards: Board[];
  onInvalidate: () => void;
}

const isHeartbeatRecent = (lastHeartbeat: string | null | undefined) => {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() < 100_000;
};

const TesterStationCard = ({ station, board, availableBoards, onInvalidate }: TesterStationCardProps) => {
  const qc = useQueryClient();
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState("");

  const online = isHeartbeatRecent(station.last_heartbeat_at);
  const hasBoard = !!board;
  const readyToPromote = hasBoard; // board is mandatory, heartbeat optional for tester

  const checklist = [
    { label: "Scheda hardware collegata", ok: hasBoard },
    { label: "Heartbeat ricevuto", ok: online },
  ];

  const promoteMutation = useMutation({
    mutationFn: () => promoteToStock(station.id),
    onSuccess: () => {
      toast.success("Stazione collaudata e spostata in Stock");
      setPromoteOpen(false);
      onInvalidate();
    },
    onError: (err: any) => handleAppError(err, "TesterStationCard: promozione"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStation(station.id),
    onSuccess: () => {
      toast.success("Stazione eliminata");
      setDeleteOpen(false);
      onInvalidate();
    },
    onError: (err: any) => handleAppError(err, "TesterStationCard: eliminazione"),
  });

  const unassignMutation = useMutation({
    mutationFn: () => unassignBoard(board!.id),
    onSuccess: () => {
      toast.success("Scheda scollegata");
      onInvalidate();
    },
    onError: (err: any) => handleAppError(err, "TesterStationCard: scollega scheda"),
  });

  const assignMutation = useMutation({
    mutationFn: () => assignBoardToStation(selectedBoardId, station.id),
    onSuccess: () => {
      toast.success("Scheda associata");
      setAssignOpen(false);
      setSelectedBoardId("");
      onInvalidate();
    },
    onError: (err: any) => handleAppError(err, "TesterStationCard: associa scheda"),
  });

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* Top colored strip */}
        <div className={cn("h-1.5 w-full", online ? "bg-emerald-500" : "bg-destructive")} />

        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono font-bold text-base text-foreground">{station.id}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="capitalize text-xs">{station.type}</Badge>
                <Badge variant={station.status === "AVAILABLE" ? "default" : "outline"} className="text-xs">
                  {station.status}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {online ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full">
                  <Wifi className="h-3 w-3" /> Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  <WifiOff className="h-3 w-3" /> Offline
                </span>
              )}
            </div>
          </div>

          {station.description && (
            <p className="text-xs text-muted-foreground">{station.description}</p>
          )}

          {/* Board section */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Scheda Hardware</p>
            {board ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm font-medium">{board.id}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {board.type === "wifi" ? "WiFi" : "ETH"}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => unassignMutation.mutate()}
                  disabled={unassignMutation.isPending}
                >
                  {unassignMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Scollega"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={() => { setAssignOpen(true); setSelectedBoardId(""); }}
              >
                <Link2 className="h-3.5 w-3.5" /> Associa Scheda
              </Button>
            )}
          </div>

          {/* Checklist */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Checklist Collaudo</p>
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40" />
                )}
                <span className={cn("text-xs", item.ok ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Date */}
          <p className="text-[11px] text-muted-foreground">
            Creata il {station.created_at ? format(new Date(station.created_at), "dd MMM yyyy", { locale: it }) : "—"}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive gap-1 text-xs"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Elimina
            </Button>
            <div className="flex-1" />
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setPromoteOpen(true)}
              disabled={!readyToPromote}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Collaudato
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Promote dialog */}
      <AlertDialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma collaudo stazione {station.id}</AlertDialogTitle>
            <AlertDialogDescription>
              La stazione verrà marcata come collaudata e spostata in Stock. Non potrai più testarla dopo questa operazione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => promoteMutation.mutate()} disabled={promoteMutation.isPending}>
              {promoteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Conferma Collaudato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la stazione {station.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione è irreversibile. La stazione e la scheda associata verranno scollegate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign board dialog */}
      <AlertDialog open={assignOpen} onOpenChange={setAssignOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Associa Scheda a {station.id}</AlertDialogTitle>
            <AlertDialogDescription>Seleziona una scheda disponibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
              <SelectTrigger><SelectValue placeholder="Seleziona scheda..." /></SelectTrigger>
              <SelectContent>
                {availableBoards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.id} — {b.type === "wifi" ? "WiFi" : "Ethernet"} ({b.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableBoards.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">Nessuna scheda disponibile.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={!selectedBoardId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Associa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TesterStationCard;
