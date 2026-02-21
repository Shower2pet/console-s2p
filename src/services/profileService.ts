import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types/database";

export const fetchProfileById = async (id: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
};

export const fetchPartnerProfiles = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "partner")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Profile[];
};

export const fetchPartnersList = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, legal_name")
    .eq("role", "partner")
    .order("legal_name");
  if (error) throw error;
  return data;
};

export const updateProfile = async (
  userId: string,
  updates: { first_name?: string; last_name?: string; phone?: string | null }
) => {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);
  if (error) throw error;
};

export const updatePartnerData = async (
  userId: string,
  updates: {
    legal_name?: string | null;
    vat_number?: string | null;
    fiscal_code?: string | null;
    legal_rep_fiscal_code?: string | null;
    fiskaly_system_id?: string | null;
    address_street?: string | null;
    address_number?: string | null;
    zip_code?: string | null;
    city?: string | null;
    province?: string | null;
  }
) => {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);
  if (error) throw error;
};

export const updateMustChangePassword = async (userId: string, value: boolean) => {
  const { error } = await supabase
    .from("profiles")
    .update({ must_change_password: value })
    .eq("id", userId);
  if (error) throw error;
};

export const fetchUserStructureIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from("structures")
    .select("id")
    .eq("owner_id", userId);
  return (data ?? []).map((s) => s.id);
};

export const fetchManagerStructureIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from("structure_managers")
    .select("structure_id")
    .eq("user_id", userId);
  return (data ?? []).filter((m) => m.structure_id).map((m) => m.structure_id as string);
};
