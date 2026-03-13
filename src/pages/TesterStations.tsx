import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, Monitor, Loader2, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAvailableBoards, assignBoardToStation } from "@/services/boardService";

const STATION_TYPES = ["bracco", "vasca"];

const TesterStations = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: stations, isLoading } = useQuery({
    queryKey: ["tester-stations-list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("id, type, status, description, created_at, owner_id")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: availableBoards } = useQuery({
    queryKey: ["boards", "available"],
    queryFn: fetchAvailableBoards,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [stationId, setStationId] = useState("");
  const [stationType, setStationType] = useState("bracco");
  const [description, setDescription] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState("");

  const resetForm = () => {
    setStationId("");
    setStationType("bracco");
    setDescription("");
    setSelectedBoardId("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!stationId.trim()) throw new Error("ID stazione obbligatorio");
      const { error } = await supabase.from("stations").insert({
        id: stationId.trim(),
        type: stationType,
        description: description.trim() || null,
        owner_id: user!.id,
        status: "OFFLINE" as any,
        visibility: "HIDDEN" as any,
      } as any);
      if (error) throw error;

      // Assign board if selected
      if (selectedBoardId) {
        await assignBoardToStation(selectedBoardId, stationId.trim());
      }
    },
    onSuccess: () => {
      toast.success("Stazione di test creata");
      setCreateOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["tester-stations"] });
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: (err: any) => handleAppError(err, "TesterStations: creazione"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stazione eliminata");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["tester-stations"] });
    },
    onError: (err: any) => handleAppError(err, "TesterStations: eliminazione"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> Stazioni di Test
          </h1>
          <p className="text-muted-foreground">Crea e gestisci stazioni per il testing hardware</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nuova Stazione
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Le Mie Stazioni ({stations?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !stations?.length ? (
            <p className="text-muted-foreground py-8 text-center">Nessuna stazione di test. Creane una per iniziare.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Data Creazione</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">{s.id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{s.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "AVAILABLE" ? "default" : "outline"}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.description || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: it }) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(s.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Stazione di Test</DialogTitle>
            <DialogDescription>Crea una stazione per testare l'hardware. Sarà visibile solo a te.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>ID Stazione *</Label>
              <Input
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                placeholder="Es. TEST_001"
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={stationType} onValueChange={setStationType}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrizione</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrizione opzionale"
                className="mt-1.5"
              />
            </div>
            {availableBoards && availableBoards.length > 0 && (
              <div>
                <Label className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" /> Associa Scheda
                </Label>
                <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nessuna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna</SelectItem>
                    {availableBoards.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.id} ({b.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !stationId.trim()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crea Stazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la stazione {deleteId}?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione è irreversibile. La stazione verrà rimossa dal sistema.</AlertDialogDescription>
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
