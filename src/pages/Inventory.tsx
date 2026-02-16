import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, Package, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchStockStations, createStation, deleteStation } from "@/services/stationService";
import { fetchActiveProducts } from "@/services/productService";

const Inventory = () => {
  const qc = useQueryClient();
  const { data: stations, isLoading } = useQuery({
    queryKey: ["stations", "stock"],
    queryFn: fetchStockStations,
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: fetchActiveProducts,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [serialNumber, setSerialNumber] = useState("");
  const [productId, setProductId] = useState("");
  const [stationDescription, setStationDescription] = useState("");

  const resetForm = () => {
    setSerialNumber("");
    setProductId("");
    setStationDescription("");
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["stations"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const product = (products ?? []).find(p => p.id === productId);
      if (!product) throw new Error("Seleziona un prodotto");
      await createStation({
        id: serialNumber.trim(),
        type: product.name,
        product_id: productId,
        description: stationDescription.trim() || null,
        status: "OFFLINE",
      });
    },
    onSuccess: () => {
      toast.success("Stazione registrata nel magazzino");
      setCreateOpen(false);
      resetForm();
      invalidate();
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("duplicate") ? "Serial Number già esistente." : err?.message || "Errore durante il salvataggio.";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStation,
    onSuccess: () => {
      toast.success("Stazione eliminata");
      setDeleteId(null);
      invalidate();
    },
    onError: (err: any) => toast.error(err?.message || "Impossibile eliminare."),
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
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nuova Produzione
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Stazioni in Stock ({stations?.length ?? 0})
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
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">{s.id}</TableCell>
                    <TableCell>{(s as any).products?.name ?? s.type}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{(s as any).products?.type ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{(s as any).description ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: it }) : "—"}</TableCell>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra Nuova Stazione</DialogTitle>
            <DialogDescription>Seleziona il prodotto e inserisci il seriale.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Prodotto *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleziona prodotto" /></SelectTrigger>
                <SelectContent>
                  {(products ?? []).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(products ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nessun prodotto nel catalogo. Creane uno prima.</p>
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
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !serialNumber.trim() || !productId}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la stazione?</AlertDialogTitle>
            <AlertDialogDescription>La stazione "{deleteId}" verrà rimossa definitivamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Inventory;
