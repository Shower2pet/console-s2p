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

      // Fetch author profiles for performed_by
      const authorIds = [...new Set((data ?? []).map(d => d.performed_by).filter(Boolean))] as string[];
      let profileMap = new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", authorIds);
        (profiles ?? []).forEach(p => profileMap.set(p.id, p));
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
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_logs"] });
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
    }: {
      logId: string;
      status: string;
      notes?: string;
    }) => {
      const updateData: Record<string, any> = { status };
      if (notes !== undefined) updateData.notes = notes;
      const { error } = await supabase
        .from("maintenance_logs")
        .update(updateData)
        .eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_logs"] });
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
  });
};
