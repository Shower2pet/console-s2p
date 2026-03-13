import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, Package, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchStockStations, createStation, deleteStation } from "@/services/stationService";
import { assignBoardToStation } from "@/services/boardService";
import CreateStationWizard, { type WizardData } from "@/components/CreateStationWizard";

const Inventory = () => {
  const qc = useQueryClient();
  const { data: stations, isLoading } = useQuery({
    queryKey: ["stations", "stock"],
    queryFn: fetchStockStations,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["stations"] });
    qc.invalidateQueries({ queryKey: ["boards"] });
  };

  const handleCreate = async (data: WizardData) => {
    setCreatePending(true);
    try {
      await createStation({
        id: data.serialNumber,
        type: data.productType,
        product_id: data.productId,
        description: data.description || null,
        status: "OFFLINE",
      });
      await assignBoardToStation(data.boardId, data.serialNumber);
      toast.success("Stazione registrata nel magazzino");
      setCreateOpen(false);
      invalidate();
    } catch (err: any) {
      handleAppError(err, "Inventory: creazione stazione");
    } finally {
      setCreatePending(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: deleteStation,
    onSuccess: () => {
      toast.success("Stazione eliminata");
      setDeleteId(null);
      invalidate();
    },
    onError: (err: any) => handleAppError(err, "Inventory: eliminazione stazione"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Magazzino Hardware
          </h1>
          <p className="text-muted-foreground">Stazioni prodotte non ancora assegnate</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuova Produzione
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Magazzino ({stations?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !stations?.length ? (
            <p className="text-muted-foreground py-8 text-center">Nessuna stazione in magazzino.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seriale</TableHead>
                  <TableHead>Prodotto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">{s.id}</TableCell>
                    <TableCell>{s.products?.name ?? s.type}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{s.products?.type ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.phase === "STOCK" ? "default" : "outline"}>{s.phase}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{s.description ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: it }) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
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

      <CreateStationWizard
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isPending={createPending}
        title="Registra Nuova Stazione"
        description="Segui i passaggi per registrare una nuova stazione nel magazzino."
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la stazione {deleteId}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Questa azione è <strong>irreversibile</strong>. Verranno eliminati definitivamente anche:</span>
              <ul className="list-disc list-inside text-sm space-y-0.5">
                <li>Sessioni di lavaggio associate</li>
                <li>Log di manutenzione</li>
                <li>Comandi cancello</li>
                <li>Log di accesso</li>
                <li>Transazioni collegate</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Elimina definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Inventory;
