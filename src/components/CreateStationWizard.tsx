import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Package, Hash, Cpu, ClipboardCheck, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchActiveProducts } from "@/services/productService";
import { fetchAvailableBoards } from "@/services/boardService";

interface CreateStationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: WizardData) => Promise<void>;
  isPending: boolean;
  title?: string;
  description?: string;
}

export interface WizardData {
  productId: string;
  productType: string;
  serialNumber: string;
  description: string;
  boardId: string;
}

const STEPS = [
  { id: 1, label: "Prodotto", icon: Package },
  { id: 2, label: "Seriale", icon: Hash },
  { id: 3, label: "Scheda HW", icon: Cpu },
  { id: 4, label: "Riepilogo", icon: ClipboardCheck },
] as const;

const CreateStationWizard = ({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  title = "Nuova Stazione",
  description = "Segui i passaggi per creare una nuova stazione.",
}: CreateStationWizardProps) => {
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [stationDescription, setStationDescription] = useState("");
  const [boardId, setBoardId] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: fetchActiveProducts,
  });

  const { data: availableBoards } = useQuery({
    queryKey: ["boards", "available"],
    queryFn: fetchAvailableBoards,
  });

  const selectedProduct = (products ?? []).find((p: any) => p.id === productId);
  const selectedBoard = (availableBoards ?? []).find((b) => b.id === boardId);

  const reset = () => {
    setStep(1);
    setProductId("");
    setSerialNumber("");
    setStationDescription("");
    setBoardId("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const canNext = () => {
    if (step === 1) return !!productId;
    if (step === 2) return !!serialNumber.trim();
    if (step === 3) return !!boardId;
    return true;
  };

  const handleSubmit = async () => {
    await onSubmit({
      productId,
      productType: selectedProduct?.type ?? "",
      serialNumber: serialNumber.trim(),
      description: stationDescription.trim(),
      boardId,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-between px-2 py-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-1">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                    isDone && "bg-primary border-primary text-primary-foreground",
                    isActive && "border-primary text-primary bg-primary/10",
                    !isActive && !isDone && "border-muted-foreground/30 text-muted-foreground/50"
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:inline",
                    isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground/50"
                  )}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 mx-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[180px] py-2">
          {step === 1 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Seleziona il prodotto dal catalogo</Label>
              <div className="grid gap-2">
                {(products ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nessun prodotto nel catalogo. Creane uno prima.
                  </p>
                ) : (
                  (products ?? []).map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => setProductId(p.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                        productId === p.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      )}
                    >
                      <Package className={cn("h-5 w-5 flex-shrink-0", productId === p.id ? "text-primary" : "text-muted-foreground")} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                      </div>
                      <Badge variant="secondary" className="capitalize text-xs">{p.type}</Badge>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Numero Seriale *</Label>
                <Input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="SN-2024-001"
                  className="mt-1.5"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Identificativo univoco stampato sull'etichetta della stazione.
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Descrizione (opzionale)</Label>
                <Textarea
                  value={stationDescription}
                  onChange={(e) => setStationDescription(e.target.value)}
                  placeholder="Note aggiuntive sulla stazione..."
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Seleziona la scheda hardware da associare</Label>
              {(availableBoards ?? []).length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <Cpu className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-destructive">Nessuna scheda disponibile.</p>
                  <p className="text-xs text-muted-foreground">Chiedi all'admin di crearne una nella sezione Schede.</p>
                </div>
              ) : (
                <div className="grid gap-2 max-h-[240px] overflow-y-auto pr-1">
                  {(availableBoards ?? []).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBoardId(b.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                        boardId === b.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      )}
                    >
                      <Cpu className={cn("h-5 w-5 flex-shrink-0", boardId === b.id ? "text-primary" : "text-muted-foreground")} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-medium text-sm">{b.id}</p>
                        <p className="text-xs text-muted-foreground">{b.model || "—"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {b.type === "wifi" ? "WiFi" : "Ethernet"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Verifica i dati prima di confermare.</p>
              <div className="rounded-lg border bg-muted/30 divide-y">
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Prodotto</span>
                  <span className="text-sm font-medium">{selectedProduct?.name ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <Badge variant="secondary" className="capitalize">{selectedProduct?.type ?? "—"}</Badge>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Seriale</span>
                  <span className="text-sm font-mono font-medium">{serialNumber}</span>
                </div>
                {stationDescription && (
                  <div className="flex items-center justify-between p-3">
                    <span className="text-sm text-muted-foreground">Descrizione</span>
                    <span className="text-sm max-w-[200px] truncate">{stationDescription}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Scheda</span>
                  <span className="text-sm font-mono font-medium">{selectedBoard?.id ?? "—"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            onClick={() => step === 1 ? handleOpenChange(false) : setStep(step - 1)}
            disabled={isPending}
          >
            {step === 1 ? "Annulla" : "Indietro"}
          </Button>

          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Avanti <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crea Stazione
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateStationWizard;
