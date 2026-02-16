import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  type: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Product[];
};

export const fetchActiveProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data as Product[];
};

export const createProduct = async (product: { name: string; type: string; description?: string | null }) => {
  const { error } = await supabase.from("products").insert(product);
  if (error) throw error;
};

export const updateProduct = async (
  id: string,
  updates: { name?: string; type?: string; description?: string | null }
) => {
  const { error } = await supabase.from("products").update(updates).eq("id", id);
  if (error) throw error;
};

export const deactivateProduct = async (id: string) => {
  const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
  if (error) throw error;
};
