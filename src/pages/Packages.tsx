import { useState } from "react";
import { Package, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Packages = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: packages, isLoading } = useQuery({
    queryKey: ["my_credit_packages", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("owner_id", user!.id)
        .order("price_eur", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createPkg = useMutation({
    mutationFn: async (values: { name: string | null; price_eur: number; credits_value: number; is_active: boolean }) => {
      const { error } = await supabase.from("credit_packages").insert({ ...values, owner_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my_credit_packages"] }),
  });

  const updatePkg = useMutation({
    mutationFn: async ({ id, ...values }: { id: string; name?: string | null; price_eur?: number; credits_value?: number; is_active?: boolean }) => {
      const { error } = await supabase.from("credit_packages").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my_credit_packages"] }),
  });

  const deletePkg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my_credit_packages"] }),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price_eur: "", credits_value: "", is_active: true });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", price_eur: "", credits_value: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (pkg: any) => {
    setEditing(pkg);
    setForm({ name: pkg.name ?? "", price_eur: String(pkg.price_eur), credits_value: String(pkg.credits_value), is_active: pkg.is_active ?? true });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const price = parseFloat(form.price_eur);
    const credits = parseInt(form.credits_value);
    if (isNaN(price) || isNaN(credits) || price <= 0 || credits <= 0) {
      toast({ title: "Errore", description: "Prezzo e crediti devono essere valori positivi", variant: "destructive" });
      return;
    }
    try {
      if (editing) {
        await updatePkg.mutateAsync({ id: editing.id, name: form.name || null, price_eur: price, credits_value: credits, is_active: form.is_active });
        toast({ title: "Pacchetto aggiornato" });
      } else {
        await createPkg.mutateAsync({ name: form.name || null, price_eur: price, credits_value: credits, is_active: form.is_active });
        toast({ title: "Pacchetto creato" });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePkg.mutateAsync(id);
      toast({ title: "Pacchetto eliminato" });
    } catch {
      toast({ title: "Errore nell'eliminazione", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            <Package className="inline mr-2 h-6 w-6 text-primary" />
            Pacchetti Crediti
          </h1>
          <p className="text-muted-foreground">I pacchetti sono validi per tutte le tue strutture e stazioni</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nuovo Pacchetto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Pacchetto" : "Nuovo Pacchetto"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="es. Ricarica Base" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Prezzo (€)</Label><Input type="number" step="0.01" value={form.price_eur} onChange={e => setForm(f => ({ ...f, price_eur: e.target.value }))} /></div>
                <div><Label>Crediti</Label><Input type="number" value={form.credits_value} onChange={e => setForm(f => ({ ...f, credits_value: e.target.value }))} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>Attivo</Label></div>
              <Button onClick={handleSave} className="w-full" disabled={createPkg.isPending || updatePkg.isPending}>
                {(createPkg.isPending || updatePkg.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salva
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Crediti</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(packages ?? []).map(pkg => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name || "—"}</TableCell>
                  <TableCell>€{Number(pkg.price_eur).toFixed(2)}</TableCell>
                  <TableCell>{pkg.credits_value}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pkg.is_active ? "bg-success/20 text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                      {pkg.is_active ? "Attivo" : "Disattivo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(pkg)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(pkg.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(packages ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nessun pacchetto creato</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Packages;
