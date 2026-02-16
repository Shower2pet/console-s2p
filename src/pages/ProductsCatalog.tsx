import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Package, Loader2 } from "lucide-react";
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
import { fetchProducts, createProduct, updateProduct, deactivateProduct, type Product } from "@/services/productService";

const ProductsCatalog = () => {
  const qc = useQueryClient();
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");

  const openCreate = () => {
    setEditProduct(null);
    setName("");
    setType("");
    setDescription("");
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setName(p.name);
    setType(p.type);
    setDescription(p.description ?? "");
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editProduct) {
        await updateProduct(editProduct.id, {
          name: name.trim(),
          type: type.trim(),
          description: description.trim() || null,
        });
      } else {
        await createProduct({
          name: name.trim(),
          type: type.trim(),
          description: description.trim() || null,
        });
      }
    },
    onSuccess: () => {
      toast.success(editProduct ? "Prodotto aggiornato" : "Prodotto creato");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deactivateProduct,
    onSuccess: () => {
      toast.success("Prodotto disattivato");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeProducts = (products ?? []).filter(p => p.is_active);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Catalogo Prodotti
          </h1>
          <p className="text-muted-foreground">{activeProducts.length} prodotti attivi</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nuovo Prodotto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {activeProducts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessun prodotto nel catalogo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeProducts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{p.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[300px] truncate">{p.description ?? "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editProduct ? "Modifica Prodotto" : "Nuovo Prodotto"}</DialogTitle>
            <DialogDescription>
              {editProduct ? "Aggiorna le informazioni del prodotto." : "Aggiungi un nuovo prodotto al catalogo."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Es. Akita" className="mt-1.5" />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="doccia">Doccia</SelectItem>
                  <SelectItem value="vasca">Vasca</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrizione</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrizione opzionale..." className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim() || !type.trim()}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editProduct ? "Salva" : "Crea Prodotto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disattivare il prodotto?</AlertDialogTitle>
            <AlertDialogDescription>Il prodotto verrà disattivato dal catalogo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disattiva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductsCatalog;
