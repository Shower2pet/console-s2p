import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, Cpu, Loader2, Wifi, Cable, Link2 } from "lucide-react";
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
import { fetchBoards, createBoard, deleteBoard, type Board } from "@/services/boardService";

const Boards = () => {
  const qc = useQueryClient();
  const { data: boards, isLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: fetchBoards,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createdBoard, setCreatedBoard] = useState<Board | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [boardType, setBoardType] = useState<"ethernet" | "wifi">("ethernet");
  const [model, setModel] = useState("");

  const resetForm = () => {
    setBoardType("ethernet");
    setModel("");
  };

  const createMutation = useMutation({
    mutationFn: () => createBoard(boardType, model.trim()),
    onSuccess: (board) => {
      toast.success("Scheda creata con successo");
      setCreateOpen(false);
      setCreatedBoard(board);
      resetForm();
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: (err: any) => handleAppError(err, "Boards: creazione"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBoard,
    onSuccess: () => {
      toast.success("Scheda eliminata");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: (err: any) => handleAppError(err, "Boards: eliminazione"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" /> Gestione Schede
          </h1>
          <p className="text-muted-foreground">Schede hardware (Ethernet / WiFi) da associare alle stazioni</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nuova Scheda
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schede ({boards?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !boards?.length ? (
            <p className="text-muted-foreground py-8 text-center">Nessuna scheda registrata.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modello</TableHead>
                  <TableHead>Stazione</TableHead>
                  <TableHead>Data Creazione</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boards.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono font-medium">{b.id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        {b.type === "wifi" ? <Wifi className="h-3 w-3" /> : <Cable className="h-3 w-3" />}
                        {b.type === "wifi" ? "WiFi" : "Ethernet"}
                      </Badge>
                    </TableCell>
                    <TableCell>{b.model || "—"}</TableCell>
                    <TableCell>
                      {b.station_id ? (
                        <Badge variant="outline" className="gap-1">
                          <Link2 className="h-3 w-3" /> {b.station_id}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Non assegnata</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.created_at ? format(new Date(b.created_at), "dd MMM yyyy", { locale: it }) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!!b.station_id}
                        title={b.station_id ? "Disassocia prima la scheda" : "Elimina"}
                        onClick={() => setDeleteId(b.id)}
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
            <DialogTitle>Nuova Scheda</DialogTitle>
            <DialogDescription>Seleziona il tipo e inserisci il modello. L'ID verrà generato automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Tipo *</Label>
              <Select value={boardType} onValueChange={(v) => setBoardType(v as "ethernet" | "wifi")}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethernet">Ethernet</SelectItem>
                  <SelectItem value="wifi">WiFi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modello *</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Es. ESP32-S3, W5500..." className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !model.trim()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crea Scheda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created confirmation dialog */}
      <Dialog open={!!createdBoard} onOpenChange={() => setCreatedBoard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scheda Creata!</DialogTitle>
            <DialogDescription>Configura la scheda con il seguente ID:</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <code className="text-3xl font-bold text-primary bg-muted px-6 py-3 rounded-lg select-all">
              {createdBoard?.id}
            </code>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Questo ID deve essere programmato nel firmware della scheda.
          </p>
          <DialogFooter>
            <Button onClick={() => setCreatedBoard(null)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la scheda {deleteId}?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription>
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

export default Boards;
