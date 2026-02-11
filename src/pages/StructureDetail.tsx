import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Monitor, Loader2, Package, Plus, Trash2, Save, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useStructure } from "@/hooks/useStructures";
import { useStations } from "@/hooks/useStations";
import { useCreditPackages, useCreateCreditPackage, useUpdateCreditPackage, useDeleteCreditPackage } from "@/hooks/useCreditPackages";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

const StructureDetail = () => {
  const { id } = useParams();
  const { data: structure, isLoading } = useStructure(id);
  const { data: stations, isLoading: stLoading } = useStations(id);
  const { data: packages, isLoading: pkgLoading } = useCreditPackages(id);
  const createPkg = useCreateCreditPackage();
  const updatePkg = useUpdateCreditPackage();
  const deletePkg = useDeleteCreditPackage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<string | null>(null);
  const [pkgName, setPkgName] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgCredits, setPkgCredits] = useState("");

  const resetForm = () => {
    setPkgName("");
    setPkgPrice("");
    setPkgCredits("");
    setEditingPkg(null);
  };

  const handleCreatePkg = async () => {
    if (!pkgPrice || !pkgCredits) return;
    try {
      await createPkg.mutateAsync({
        structure_id: id!,
        name: pkgName.trim() || null,
        price_eur: parseFloat(pkgPrice),
        credits_value: parseFloat(pkgCredits),
      });
      toast.success("Pacchetto creato");
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUpdatePkg = async () => {
    if (!editingPkg || !pkgPrice || !pkgCredits) return;
    try {
      await updatePkg.mutateAsync({
        id: editingPkg,
        name: pkgName.trim() || null,
        price_eur: parseFloat(pkgPrice),
        credits_value: parseFloat(pkgCredits),
      });
      toast.success("Pacchetto aggiornato");
      setEditingPkg(null);
      resetForm();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeletePkg = async (pkgId: string) => {
    try {
      await deletePkg.mutateAsync(pkgId);
      toast.success("Pacchetto eliminato");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEditPkg = (pkg: any) => {
    setEditingPkg(pkg.id);
    setPkgName(pkg.name ?? "");
    setPkgPrice(String(pkg.price_eur));
    setPkgCredits(String(pkg.credits_value));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!structure) return <div className="p-6 text-muted-foreground">Struttura non trovata.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/structures" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{structure.name}</h1>
          {structure.address && <p className="text-muted-foreground">{structure.address}</p>}
        </div>
      </div>

      <Tabs defaultValue="stations">
        <TabsList>
          <TabsTrigger value="stations" className="gap-2"><Monitor className="h-4 w-4" /> Macchine</TabsTrigger>
          <TabsTrigger value="packages" className="gap-2"><Package className="h-4 w-4" /> Prodotti</TabsTrigger>
        </TabsList>

        <TabsContent value="stations" className="mt-4">
          {stLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(stations ?? []).map((s) => (
                <Link key={s.id} to="/stations">
                  <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base font-heading">{s.id}</CardTitle>
                        <StatusBadge status={s.status ?? "OFFLINE"} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground capitalize">Tipo: {s.type}</p>
                      {s.category && <p className="text-xs text-muted-foreground">Categoria: {s.category}</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {(stations ?? []).length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Nessuna stazione collegata.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="packages" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-semibold text-foreground">Pacchetti Crediti</h2>
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> Nuovo Pacchetto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading">Nuovo Pacchetto Crediti</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Nome (opzionale)</Label>
                    <Input value={pkgName} onChange={(e) => setPkgName(e.target.value)} placeholder="Es. Starter Pack" className="mt-1.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Prezzo (€)</Label>
                      <Input type="number" step="0.50" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} placeholder="20.00" className="mt-1.5" />
                    </div>
                    <div>
                      <Label>Crediti</Label>
                      <Input type="number" step="1" value={pkgCredits} onChange={(e) => setPkgCredits(e.target.value)} placeholder="25" className="mt-1.5" />
                    </div>
                  </div>
                  <Button onClick={handleCreatePkg} disabled={createPkg.isPending} className="w-full">
                    {createPkg.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Crea Pacchetto
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {pkgLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(packages ?? []).map((pkg) => (
                <Card key={pkg.id} className="relative">
                  {editingPkg === pkg.id ? (
                    <CardContent className="p-4 space-y-3">
                      <Input value={pkgName} onChange={(e) => setPkgName(e.target.value)} placeholder="Nome" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Prezzo (€)</Label>
                          <Input type="number" step="0.50" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Crediti</Label>
                          <Input type="number" step="1" value={pkgCredits} onChange={(e) => setPkgCredits(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdatePkg} disabled={updatePkg.isPending} className="flex-1 gap-1">
                          <Save className="h-3 w-3" /> Salva
                        </Button>
                        <Button size="sm" variant="outline" onClick={resetForm} className="flex-1">Annulla</Button>
                      </div>
                    </CardContent>
                  ) : (
                    <>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base font-heading">{pkg.name ?? "Pacchetto"}</CardTitle>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditPkg(pkg)} className="h-7 w-7 p-0">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeletePkg(pkg.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <p className="text-2xl font-heading font-bold text-foreground">€{pkg.price_eur.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{pkg.credits_value} crediti</p>
                        <p className="text-xs text-muted-foreground">
                          {pkg.is_active ? "✅ Attivo" : "⏸️ Disattivato"}
                        </p>
                      </CardContent>
                    </>
                  )}
                </Card>
              ))}
              {(packages ?? []).length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-8">Nessun pacchetto configurato.</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StructureDetail;
