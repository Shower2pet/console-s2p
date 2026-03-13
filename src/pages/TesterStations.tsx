import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Monitor, Loader2, Cpu, PlayCircle, CheckCircle2, Link2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { takeForTesting, promoteToStock, deleteStation } from "@/services/stationService";
import { fetchAvailableBoards, assignBoardToStation, unassignBoard } from "@/services/boardService";

const TesterStations = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // PRODUCTION stations (available to take)
  const { data: productionStations, isLoading: loadingProd } = useQuery({
    queryKey: ["tester-stations", "production"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("stations")
        .select("id, type, status, description, created_at, product_id") as any)
        .eq("phase", "PRODUCTION")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // TESTING stations (owned by tester)
  const { data: testingStations, isLoading: loadingTest } = useQuery({
    queryKey: ["tester-stations", "testing", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("stations")
        .select("id, type, status, description, created_at, owner_id") as any)
        .eq("phase", "TESTING")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Boards for testing stations
  const { data: testingBoards } = useQuery({
    queryKey: ["tester-boards-assigned", user?.id],
    queryFn: async () => {
      const stationIds = (testingStations ?? []).map(s => s.id);
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

  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignBoardStation, setAssignBoardStation] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState("");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["tester-stations"] });
    qc.invalidateQueries({ queryKey: ["tester-boards-assigned"] });
    qc.invalidateQueries({ queryKey: ["boards"] });
    qc.invalidateQueries({ queryKey: ["stations"] });
  };

  const takeMutation = useMutation({
    mutationFn: (stationId: string) => takeForTesting(stationId, user!.id),
    onSuccess: () => {
      toast.success("Stazione presa in carico per il testing");
      invalidateAll();
    },
    onError: (err: any) => handleAppError(err, "TesterStations: presa in carico"),
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
    mutationFn: (boardId: string) => unassignBoard(boardId),
    onSuccess: () => {
      toast.success("Scheda scollegata");
      invalidateAll();
    },
    onError: (err: any) => handleAppError(err, "TesterStations: rimozione scheda"),
  });

  const getBoardForStation = (stationId: string) =>
    (testingBoards ?? []).find(b => b.station_id === stationId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Monitor className="h-6 w-6 text-primary" /> Stazioni
        </h1>
        <p className="text-muted-foreground">Prendi in carico stazioni dal magazzino e testa l'hardware</p>
      </div>

      <Tabs defaultValue="testing">
        <TabsList>
          <TabsTrigger value="testing">In Test ({testingStations?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="production">Da Testare ({productionStations?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* TESTING tab */}
        <TabsContent value="testing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Le Mie Stazioni in Test</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTest ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : !testingStations?.length ? (
                <p className="text-muted-foreground py-8 text-center">Nessuna stazione in test. Vai alla tab "Da Testare" per prenderne una in carico.</p>
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
                          <TableCell className="text-right">
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
        </TabsContent>

        {/* PRODUCTION tab */}
        <TabsContent value="production" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Stazioni Disponibili per il Test</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProd ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : !productionStations?.length ? (
                <p className="text-muted-foreground py-8 text-center">Nessuna stazione in produzione disponibile.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionStations.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-medium">{s.id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{s.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.description || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: it }) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => takeMutation.mutate(s.id)}
                            disabled={takeMutation.isPending}
                          >
                            {takeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                            Prendi in Carico
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            <AlertDialogAction
              onClick={() => promoteId && promoteMutation.mutate(promoteId)}
            >
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
    </div>
  );
};

export default TesterStations;
