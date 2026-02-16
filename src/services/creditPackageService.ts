import { supabase } from "@/integrations/supabase/client";

export const fetchCreditPackages = async (ownerId: string) => {
  const { data, error } = await supabase
    .from("credit_packages")
    .select("*")
    .eq("owner_id", ownerId)
    .order("price_eur", { ascending: true });
  if (error) throw error;
  return data;
};

export const createCreditPackage = async (pkg: {
  name: string | null;
  price_eur: number;
  credits_value: number;
  is_active: boolean;
  owner_id: string;
}) => {
  const { error } = await supabase.from("credit_packages").insert(pkg as any);
  if (error) throw error;
};

export const updateCreditPackage = async (
  id: string,
  updates: { name?: string | null; price_eur?: number; credits_value?: number; is_active?: boolean }
) => {
  const { error } = await supabase.from("credit_packages").update(updates).eq("id", id);
  if (error) throw error;
};

export const deleteCreditPackage = async (id: string) => {
  const { error } = await supabase.from("credit_packages").delete().eq("id", id);
  if (error) throw error;
};
