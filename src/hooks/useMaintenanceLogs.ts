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
        .limit(500);
      if (error) throw error;

      // Fetch author profiles via security definer function
      const authorIds = [...new Set((data ?? []).map(d => d.performed_by).filter(Boolean))] as string[];
      let profileMap = new Map<string, { first_name: string | null; last_name: string | null; email: string | null; role: string | null }>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase.rpc("get_profiles_by_ids", {
          p_ids: authorIds,
        });
        ((profiles ?? []) as any[]).forEach((p: any) => profileMap.set(p.id, p));
      }

      return (data ?? []).map(d => ({
        ...d,
        author_profile: d.performed_by ? profileMap.get(d.performed_by) ?? null : null,
      }));
    },
  });
};

export const useCreateMaintenanceTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stationId,
      reason,
      severity,
      performedBy,
    }: {
      stationId: string;
      reason: string;
      severity: "low" | "high";
      performedBy?: string;
    }) => {
      const { error } = await supabase.from("maintenance_logs").insert({
        station_id: stationId,
        reason,
        severity,
        status: "open",
        performed_by: performedBy ?? null,
      });
      if (error) throw error;

      // Send email notification (non-blocking)
      supabase.functions.invoke("notify-maintenance", {
        body: { type: "opened", station_id: stationId, reason, severity },
      }).catch((e) => console.error("notify-maintenance email error:", e));
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["maintenance_logs"] });
      qc.invalidateQueries({ queryKey: ["station-maintenance-history", variables.stationId] });
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
  });
};

export const useUpdateMaintenanceStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      logId,
      status,
      notes,
      stationId,
    }: {
      logId: string;
      status: string;
      notes?: string;
      stationId?: string;
    }) => {
      const updateData: Record<string, any> = { status };
      if (notes !== undefined) updateData.notes = notes;
      const { error } = await supabase
        .from("maintenance_logs")
        .update(updateData)
        .eq("id", logId);
      if (error) throw error;

      // Send close notification if resolved
      if (status === "risolto" && stationId) {
        supabase.functions.invoke("notify-maintenance", {
          body: { type: "closed", station_id: stationId },
        }).catch((e) => console.error("notify-maintenance email error:", e));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_logs"] });
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
  });
};
