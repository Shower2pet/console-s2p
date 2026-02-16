import { supabase } from "@/integrations/supabase/client";

/** Fetch structures owned by a user */
export const fetchStructuresByOwner = async (ownerId: string) => {
  const { data, error } = await supabase
    .from("structures")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

/** Fetch structures for station owner (lightweight: id, name, owner_id) */
export const fetchStructuresForOwner = async (ownerId: string) => {
  const { data, error } = await supabase
    .from("structures")
    .select("id, name, owner_id")
    .eq("owner_id", ownerId)
    .order("name");
  if (error) throw error;
  return data;
};

/** Fetch all structures (lightweight) */
export const fetchAllStructuresLight = async () => {
  const { data, error } = await supabase.from("structures").select("id, name, owner_id");
  if (error) throw error;
  return data;
};

/** Create a structure */
export const createStructure = async (structure: {
  name: string;
  address?: string | null;
  owner_id?: string | null;
  geo_lat?: number | null;
  geo_lng?: number | null;
}) => {
  const { data, error } = await supabase
    .from("structures")
    .insert(structure)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Delete a structure */
export const deleteStructure = async (id: string) => {
  const { error } = await supabase.from("structures").delete().eq("id", id);
  if (error) throw error;
};

/** Fetch structure managers with profile info */
export const fetchStructureManagers = async (structureId: string) => {
  const { data, error } = await supabase
    .from("structure_managers")
    .select("id, user_id, created_at, permissions")
    .eq("structure_id", structureId);
  if (error) throw error;

  const userIds = data.map((m) => m.user_id).filter(Boolean) as string[];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return data.map((m) => ({
    ...m,
    profile: m.user_id ? profileMap.get(m.user_id) : null,
  }));
};
