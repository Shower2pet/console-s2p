import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, Pencil, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MODELS = ["BRACCO", "BARBONCINO", "AKITA", "HUSKY"] as const;

const stationSchema = z.object({
  id: z.string().trim().min(1, "Serial Number obbligatorio").max(50, "Max 50 caratteri"),
  type: z.enum(MODELS, { required_error: "Seleziona un modello" }),
});

type StationForm = z.infer<typeof stationSchema>;

const useStockStations = () =>
  useQuery({
    queryKey: ["stations", "stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("*")
        .is("structure_id", null)
        .is("owner_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

const Inventory = () => {
  const qc = useQueryClient();
  const { data: stations, isLoading } = useStockStations();
  const [createOpen, setCreateOpen] = useState(false);
  const [editStation, setEditStation] = useState<{ id: string; type: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const createForm = useForm<StationForm>({
    resolver: zodResolver(stationSchema),
    defaultValues: { id: "", type: undefined },
  });

  const editForm = useForm<StationForm>({
    resolver: zodResolver(stationSchema),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["stations"] });

  const createMutation = useMutation({
    mutationFn: async (values: StationForm) => {
      const { error } = await supabase.from("stations").insert({ id: values.id, type: values.type } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Stazione registrata", description: "La stazione è stata aggiunta al magazzino." });
      setCreateOpen(false);
      createForm.reset();
      invalidate();
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("duplicate") ? "Serial Number già esistente." : err?.message || "Errore durante il salvataggio.";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ oldId, values }: { oldId: string; values: StationForm }) => {
      // If ID changed, we need to delete and recreate since id is the PK
      if (oldId !== values.id) {
        const { data: existing, error: fetchErr } = await supabase.from("stations").select("*").eq("id", oldId).single();
        if (fetchErr) throw fetchErr;
        const { error: delErr } = await supabase.from("stations").delete().eq("id", oldId);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from("stations").insert({
          ...existing,
          id: values.id,
          type: values.type,
        } as any);
        if (insErr) throw insErr;
      } else {
        const { error } = await supabase.from("stations").update({ type: values.type }).eq("id", oldId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Stazione aggiornata" });
      setEditStation(null);
      invalidate();
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("duplicate") ? "Serial Number già esistente." : err?.message || "Errore durante la modifica.";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Stazione eliminata" });
      setDeleteId(null);
      invalidate();
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err?.message || "Impossibile eliminare.", variant: "destructive" });
    },
  });

  const openEdit = (station: { id: string; type: string }) => {
    setEditStation(station);
    editForm.reset({ id: station.id, type: station.type as any });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Magazzino Hardware</h1>
          <p className="text-muted-foreground">Stazioni prodotte non ancora assegnate</p>
        </div>
        <Button onClick={() => { createForm.reset(); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova Produzione
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stazioni in Stock ({stations?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Caricamento...</p>
          ) : !stations?.length ? (
            <p className="text-muted-foreground py-8 text-center">Nessuna stazione in magazzino.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Modello</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data Creazione</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">{s.id}</TableCell>
                    <TableCell>{s.type}</TableCell>
                    <TableCell>{s.category ?? "—"}</TableCell>
                    <TableCell>{s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: it }) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-accent text-accent-foreground">Libera</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit({ id: s.id, type: s.type })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra Nuova Stazione</DialogTitle>
            <DialogDescription>Inserisci i dati della stazione appena prodotta.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField control={createForm.control} name="id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial Number</FormLabel>
                  <FormControl><Input placeholder="SN-2024-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Modello</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleziona modello" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvataggio..." : "Registra"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editStation} onOpenChange={(open) => !open && setEditStation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Stazione</DialogTitle>
            <DialogDescription>Modifica il Serial Number o il modello.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((v) => editMutation.mutate({ oldId: editStation!.id, values: v }))} className="space-y-4">
              <FormField control={editForm.control} name="id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial Number</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Modello</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la stazione?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione è irreversibile. La stazione "{deleteId}" verrà rimossa definitivamente.</AlertDialogDescription>
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
