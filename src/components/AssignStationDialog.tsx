import { useState } from "react";
import { Monitor, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import { fetchStockStationsForDeploy, deployStation } from "@/services/stationService";

interface AssignStationDialogProps {
  partnerId: string;
  partnerName: string;
  prominent?: boolean;
}

const AssignStationDialog = ({ partnerId, partnerName, prominent = false }: AssignStationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: stockStations, isLoading } = useQuery({
    queryKey: ["stock-stations-for-deploy"],
    enabled: open,
    queryFn: fetchStockStationsForDeploy,
  });

  const handleAssign = async (stationId: string) => {
    setAssigning(stationId);
    try {
      await deployStation(stationId, partnerId);
      toast.success(`Stazione ${stationId} assegnata a ${partnerName}`);
      qc.invalidateQueries({ queryKey: ["stock-stations-for-deploy"] });
      qc.invalidateQueries({ queryKey: ["client-stations-all"] });
      qc.invalidateQueries({ queryKey: ["client-stations"] });
      qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      handleAppError(e, "AssignStationDialog: assegnazione stazione");
    } finally {
      setAssigning(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={prominent ? "default" : "outline"} size={prominent ? "default" : "sm"} className="gap-2">
          <Plus className="h-4 w-4" /> Assegna Stazione
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" /> Assegna Stazione
          </DialogTitle>
          <DialogDescription>
            Seleziona una stazione collaudata (Stock) da assegnare a {partnerName}.
            Sarà poi il partner a decidere in quale struttura posizionarla.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (stockStations ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nessuna stazione collaudata disponibile per l'assegnazione.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(stockStations ?? []).map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{st.id}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {st.type}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAssign(st.id)}
                  disabled={assigning === st.id}
                  className="gap-1"
                >
                  {assigning === st.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Assegna
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AssignStationDialog;
