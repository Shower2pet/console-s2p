import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type MaintenanceLog = Tables<"maintenance_logs">;

export const useMaintenanceLogs = () => {
  return useQuery({
    queryKey: ["maintenance_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_logs")
        .select("*, stations(id, type, structure_id, structures(name))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
};

export const useOpenMaintenanceTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stationId, reason, performedBy }: { stationId: string; reason: string; performedBy?: string }) => {
      // 1. Create maintenance log
      const { error: logError } = await supabase.from("maintenance_logs").insert({
        station_id: stationId,
        reason,
        performed_by: performedBy ?? null,
      });
      if (logError) throw logError;

      // 2. Update station status (trigger also does this, but explicit for safety)
      const { error: stError } = await supabase.from("stations").update({ status: "MAINTENANCE" as any }).eq("id", stationId);
      if (stError) throw stError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_logs"] });
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
  });
};

export const useCloseMaintenanceTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ logId, notes, stationId }: { logId: string; notes: string; stationId: string }) => {
      const { error: logError } = await supabase
        .from("maintenance_logs")
        .update({ ended_at: new Date().toISOString(), notes })
        .eq("id", logId);
      if (logError) throw logError;

      // Trigger should handle this, but explicit fallback
      const { error: stError } = await supabase.from("stations").update({ status: "AVAILABLE" as any }).eq("id", stationId);
      if (stError) throw stError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_logs"] });
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
  });
};
