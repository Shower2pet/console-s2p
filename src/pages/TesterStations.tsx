import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Monitor, Loader2, Cpu, Plus, CheckCircle2, Link2, Trash2, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { createTesterStation, promoteToStock, deleteStation } from "@/services/stationService";
import { fetchAvailableBoards, assignBoardToStation, unassignBoard } from "@/services/boardService";
import { fetchActiveProducts } from "@/services/productService";

const TesterStations = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // TESTING stations (owned by tester)
  const { data: testingStations, isLoading } = useQuery({
    queryKey: ["tester-stations", "testing", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("stations")
        .select("id, type, status, description, created_at, owner_id, product_id, last_heartbeat_at") as any)
        .eq("phase", "TESTING")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Boards assigned to testing stations
  const { data: testingBoards } = useQuery({
    queryKey: ["tester-boards-assigned", user?.id],
    queryFn: async () => {
      const stationIds = (testingStations ?? []).map((s: any) => s.id);
      if (stationIds.length === 0) return [];
      const { data, error } = await supabase
        .from("boards")
        .select("id, type, model, station_id")
        .in("station_id", stationIds);
      if (error) throw error;
      return data;
    },
    enabled: !!(testingStations && testingStations.length > 0),
  });

  const { data: availableBoards } = useQuery({
    queryKey: ["boards", "available"],
    queryFn: fetchAvailableBoards,
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: fetchActiveProducts,
  });

  // UI state
  const [createOpen, setCreateOpen] = useState(false);
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignBoardStation, setAssignBoardStation] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState("");

  // Create form state
  const [serialNumber, setSerialNumber] = useState("");
  const [productId, setProductId] = useState("");
  const [stationDescription, setStationDescription] = useState("");
  const [createBoardId, setCreateBoardId] = useState("");

  const resetCreateForm = () => {
    setSerialNumber("");
    setProductId("");
    setStationDescription("");
    setCreateBoardId("");
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["tester-stations"] });
    qc.invalidateQueries({ queryKey: ["tester-boards-assigned"] });
    qc.invalidateQueries({ queryKey: ["tester-hw-stations"] });
    qc.invalidateQueries({ queryKey: ["boards"] });
    qc.invalidateQueries({ queryKey: ["stations"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const product = (products ?? []).find((p: any) => p.id === productId);
      if (!product) throw new Error("Seleziona un prodotto");
      if (!createBoardId) throw new Error("Seleziona una scheda hardware");
      const stationId = serialNumber.trim();
      await createTesterStation({
        id: stationId,
        type: product.name,
        product_id: productId,
        description: stationDescription.trim() || null,
      }, user!.id);
      await assignBoardToStation(createBoardId, stationId);
    },
    onSuccess: () => {
      toast.success("Stazione creata e scheda associata");
      setCreateOpen(false);
      resetCreateForm();
      invalidateAll();
    },
    onError: (err: any) => handleAppError(err, "TesterStations: creazione stazione"),
  });

  const promoteMutation = useMutation({
    mutationFn: (stationId: string) => promoteToStock(stationId),
    onSuccess: () => {
      toast.success("Stazione collaudata e spostata in Stock");
      setPromoteId(null);
      invalidateAll();
    },
    onError: (err: any) => handleAppError(err, "TesterStations: promozione a stock"),
  });

  const assignBoardMutation = useMutation({
    mutationFn: async ({ boardId, stationId }: { boardId: string; stationId: string }) => {
      await assignBoardToStation(boardId, stationId);
    },
    onSuccess: () => {
      toast.success("Scheda associata alla stazione");
      setAssignBoardStation(null);
      setSelectedBoardId("");
      invalidateAll();
    },
    onError: (err: any) => handleAppError(err, "TesterStations: associazione scheda"),
  });

  const unassignBoardMutation = useMutation({
    mutationFn: (boardId: string) => unassignBoard(boardId),
    onSuccess: () => {
      toast.success("Scheda scollegata");
      invalidateAll();
    },
    onError: (err: any) => handleAppError(err, "TesterStations: rimozione scheda"),
  });

  const deleteMutation = useMutation({
    mutationFn: (stationId: string) => deleteStation(stationId),
    onSuccess: () => {
      toast.success("Stazione eliminata");
      setDeleteId(null);
      invalidateAll();
    },
    onError: (err: any) => handleAppError(err, "TesterStations: eliminazione stazione"),
  });

  const getBoardForStation = (stationId: string) =>
    (testingBoards ?? []).find((b: any) => b.station_id === stationId);

  const isHeartbeatRecent = (lastHeartbeat: string | null | undefined) => {
    if (!lastHeartbeat) return false;
    return Date.now() - new Date(lastHeartbeat).getTime() < 100_000;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> Stazioni
          </h1>
          <p className="text-muted-foreground">Crea stazioni, installa schede e collauda l'hardware</p>
        </div>
        <Button onClick={() => { resetCreateForm(); setCreateOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nuova Stazione
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Le Mie Stazioni in Test ({testingStations?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !testingStations?.length ? (
            <p className="text-muted-foreground py-8 text-center">Nessuna stazione in test. Crea una nuova stazione per iniziare il collaudo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Scheda</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testingStations.map((s: any) => {
                  const board = getBoardForStation(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono font-medium">{s.id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{s.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === "AVAILABLE" ? "default" : "outline"}>{s.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {board ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="gap-1">
                              <Cpu className="h-3 w-3" /> {board.id}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-xs text-destructive"
                              onClick={() => unassignBoardMutation.mutate(board.id)}
                              disabled={unassignBoardMutation.isPending}
                            >
                              Scollega
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => { setAssignBoardStation(s.id); setSelectedBoardId(""); }}
                          >
                            <Link2 className="h-3 w-3" /> Associa Scheda
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: it }) : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(s.id)}
                          title="Elimina stazione"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1"
                          onClick={() => setPromoteId(s.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Collaudato
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create station dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Stazione</DialogTitle>
            <DialogDescription>Seleziona il prodotto, inserisci il seriale e associa una scheda hardware.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Prodotto *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleziona prodotto" /></SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(products ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nessun prodotto nel catalogo.</p>
              )}
            </div>
            <div>
              <Label>Numero Seriale *</Label>
              <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="SN-2024-001" className="mt-1.5" />
            </div>
            <div>
              <Label>Descrizione (opzionale)</Label>
              <Textarea value={stationDescription} onChange={e => setStationDescription(e.target.value)} placeholder="Note aggiuntive..." className="mt-1.5" />
            </div>
            <div>
              <Label>Scheda Hardware *</Label>
              <Select value={createBoardId} onValueChange={setCreateBoardId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleziona scheda..." /></SelectTrigger>
                <SelectContent>
                  {(availableBoards ?? []).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.id} — {b.type === "wifi" ? "WiFi" : "Ethernet"} ({b.model})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(availableBoards ?? []).length === 0 && (
                <p className="text-xs text-destructive mt-1">Nessuna scheda disponibile. Chiedi all'admin di crearne una.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !serialNumber.trim() || !productId || !createBoardId}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crea Stazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote confirmation */}
      <AlertDialog open={!!promoteId} onOpenChange={(open) => !open && setPromoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma collaudo stazione {promoteId}</AlertDialogTitle>
            <AlertDialogDescription>
              La stazione verrà marcata come collaudata e spostata in Stock. Non potrai più testarla dopo questa operazione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => promoteId && promoteMutation.mutate(promoteId)}>
              {promoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Conferma Collaudato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign board dialog */}
      <AlertDialog open={!!assignBoardStation} onOpenChange={(open) => !open && setAssignBoardStation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Associa Scheda a {assignBoardStation}</AlertDialogTitle>
            <AlertDialogDescription>Seleziona una scheda disponibile da associare a questa stazione.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
              <SelectTrigger><SelectValue placeholder="Seleziona scheda..." /></SelectTrigger>
              <SelectContent>
                {(availableBoards ?? []).map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.id} ({b.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(availableBoards ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">Nessuna scheda disponibile.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={!selectedBoardId || assignBoardMutation.isPending}
              onClick={() => assignBoardStation && selectedBoardId && assignBoardMutation.mutate({ boardId: selectedBoardId, stationId: assignBoardStation })}
            >
              {assignBoardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Associa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la stazione {deleteId}?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione è irreversibile. La stazione e la scheda associata verranno scollegate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TesterStations;
