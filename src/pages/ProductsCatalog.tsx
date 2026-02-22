import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Package, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Catalogo Prodotti
          </h1>
          <p className="text-sm text-muted-foreground">{activeProducts.length} prodotti attivi</p>
        </div>
        <Button onClick={openCreate} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Nuovo Prodotto
        </Button>
      </div>

      {/* Mobile: card list — Desktop: table would scroll, so use cards everywhere */}
      <div className="space-y-3">
        {activeProducts.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-muted-foreground text-center">Nessun prodotto nel catalogo.</p>
            </CardContent>
          </Card>
        ) : (
          activeProducts.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground text-sm sm:text-base">{p.name}</p>
                      <Badge variant="secondary" className="capitalize text-xs">{p.type}</Badge>
                    </div>
                    {p.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
