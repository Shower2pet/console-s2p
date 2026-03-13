import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { createTesterStation } from "@/services/stationService";
import { fetchAvailableBoards, assignBoardToStation } from "@/services/boardService";
import { Button } from "@/components/ui/button";
import CreateStationWizard, { type WizardData } from "@/components/CreateStationWizard";
import TesterStationCard from "@/components/TesterStationCard";

const TesterStations = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  // TESTING stations (owned by tester)
  const { data: testingStations, isLoading } = useQuery({
    queryKey: ["tester-stations", "testing", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("stations")
        .select("id, type, status, description, created_at, owner_id, product_id, last_heartbeat_at") as any)
        .eq("phase", "TESTING")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Boards assigned to testing stations
  const { data: testingBoards } = useQuery({
    queryKey: ["tester-boards-assigned", user?.id],
    queryFn: async () => {
      const stationIds = (testingStations ?? []).map((s: any) => s.id);
      if (stationIds.length === 0) return [];
      const { data, error } = await supabase
        .from("boards")
        .select("id, type, model, station_id, created_at")
        .in("station_id", stationIds);
      if (error) throw error;
      return data;
    },
    enabled: !!(testingStations && testingStations.length > 0),
  });

  const { data: availableBoards } = useQuery({
    queryKey: ["boards", "available"],
    queryFn: fetchAvailableBoards,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["tester-stations"] });
    qc.invalidateQueries({ queryKey: ["tester-boards-assigned"] });
    qc.invalidateQueries({ queryKey: ["tester-hw-stations"] });
    qc.invalidateQueries({ queryKey: ["boards"] });
    qc.invalidateQueries({ queryKey: ["stations"] });
  };

  const [createPending, setCreatePending] = useState(false);

  const handleCreate = async (data: WizardData) => {
    setCreatePending(true);
    try {
      await createTesterStation({
        id: data.serialNumber,
        type: data.productType,
        product_id: data.productId,
        description: data.description || null,
      }, user!.id);
      await assignBoardToStation(data.boardId, data.serialNumber);
      toast.success("Stazione creata e scheda associata");
      setCreateOpen(false);
      invalidateAll();
    } catch (err: any) {
      handleAppError(err, "TesterStations: creazione stazione");
    } finally {
      setCreatePending(false);
    }
  };

  const getBoardForStation = (stationId: string) =>
    (testingBoards ?? []).find((b: any) => b.station_id === stationId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> Stazioni
          </h1>
          <p className="text-muted-foreground">Crea stazioni, installa schede e collauda l'hardware</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuova Stazione
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !testingStations?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Monitor className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">Nessuna stazione in test</p>
          <p className="text-sm text-muted-foreground mt-1">Crea una nuova stazione per iniziare il collaudo.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Crea la prima stazione
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {testingStations.map((s: any) => (
            <TesterStationCard
              key={s.id}
              station={s}
              board={getBoardForStation(s.id) as any}
              availableBoards={(availableBoards ?? []) as any}
              onInvalidate={invalidateAll}
            />
          ))}
        </div>
      )}

      <CreateStationWizard
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isPending={createPending}
        title="Nuova Stazione di Test"
        description="Segui i passaggi per creare e configurare una stazione da collaudare."
      />
    </div>
  );
};

export default TesterStations;
