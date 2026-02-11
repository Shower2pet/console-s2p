import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Structure = Tables<"structures">;

export const useStructures = () => {
  const { role, structureIds } = useAuth();

  return useQuery({
    queryKey: ["structures", role, structureIds],
    queryFn: async () => {
      let query = supabase.from("structures").select("*");
      // RLS handles filtering, but for manager we explicitly filter
      if (role === "manager" && structureIds.length > 0) {
        query = query.in("id", structureIds);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as Structure[];
    },
  });
};

export const useStructure = (id: string | undefined) => {
  return useQuery({
    queryKey: ["structure", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("structures")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Structure | null;
    },
  });
};

export const useCreateStructure = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<"structures">) => {
      const { data, error } = await supabase.from("structures").insert(values).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["structures"] }),
  });
};

export const useUpdateStructure = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Structure> & { id: string }) => {
      const { data, error } = await supabase.from("structures").update(values).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["structures"] }),
  });
};
