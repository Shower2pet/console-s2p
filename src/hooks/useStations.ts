import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Station = Tables<"stations">;

export interface WashingOption {
  id: number;
  name: string;
  price: number;
  duration: number;
}

export const useStations = (structureId?: string) => {
  return useQuery({
    queryKey: ["stations", structureId],
    queryFn: async () => {
      let query = supabase.from("stations").select("*, structures(name)");
      if (structureId) query = query.eq("structure_id", structureId);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useStation = (id: string | undefined) => {
  return useQuery({
    queryKey: ["station", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("*, structures(name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateStation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Station> & { id: string }) => {
      const { data, error } = await supabase.from("stations").update(values).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["stations"] });
      qc.invalidateQueries({ queryKey: ["station", vars.id] });
    },
  });
};
