import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type CreditPackage = Tables<"credit_packages">;

export const useCreditPackages = (structureId?: string) => {
  return useQuery({
    queryKey: ["credit_packages", structureId],
    enabled: !!structureId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("structure_id", structureId!)
        .order("price_eur", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateCreditPackage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<"credit_packages">) => {
      const { data, error } = await supabase.from("credit_packages").insert(values).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit_packages"] }),
  });
};

export const useUpdateCreditPackage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<CreditPackage> & { id: string }) => {
      const { data, error } = await supabase.from("credit_packages").update(values).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit_packages"] }),
  });
};

export const useDeleteCreditPackage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit_packages"] }),
  });
};
