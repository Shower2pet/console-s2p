import { supabase } from "@/integrations/supabase/client";

export interface FreeStation {
  id: string;
  type: string;
}

/** Fetch unassigned, unowned stations (warehouse) */
export const fetchFreeStations = async (): Promise<FreeStation[]> => {
  const { data, error } = await supabase
    .from("stations")
    .select("id, type")
    .is("structure_id", null)
    .is("owner_id", null)
    .order("id");
  if (error) throw error;
  return data as FreeStation[];
};

/** Fetch stations owned by a user but not yet assigned to a structure */
export const fetchPendingStations = async (ownerId: string): Promise<FreeStation[]> => {
  const { data, error } = await supabase
    .from("stations")
    .select("id, type")
    .eq("owner_id", ownerId)
    .is("structure_id", null);
  if (error) throw error;
  return data as FreeStation[];
};

/** Fetch all stations owned by a partner (with structure join) */
export const fetchStationsByOwner = async (ownerId: string) => {
  const { data, error } = await supabase
    .from("stations")
    .select("*, structures(name)")
    .eq("owner_id", ownerId)
    .order("id");
  if (error) throw error;
  return data;
};

/** Assign a station to a partner (set owner_id) */
export const assignStationToPartner = async (stationId: string, partnerId: string) => {
  const { error } = await supabase
    .from("stations")
    .update({ owner_id: partnerId })
    .eq("id", stationId);
  if (error) throw error;
};

/** Invoke station hardware control edge function */
export const invokeStationControl = async (
  stationId: string,
  command: "ON" | "OFF" | "PULSE",
  durationMinutes?: number
) => {
  const body: Record<string, any> = { station_id: stationId, command };
  if (command === "PULSE" && durationMinutes != null) body.duration_minutes = durationMinutes;
  const { data, error } = await supabase.functions.invoke("station-control", { body });
  if (error) throw new Error(error.message ?? "Errore di comunicazione con la stazione");
  if (data?.error) throw new Error(data.error);
  return data;
};

/** Fetch stock stations (no owner, no structure) with product join */
export const fetchStockStations = async () => {
  const { data, error } = await supabase
    .from("stations")
    .select("*, products:product_id(name, type)")
    .is("structure_id", null)
    .is("owner_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

/** Create a new station in inventory */
export const createStation = async (station: {
  id: string;
  type: string;
  product_id: string;
  description?: string | null;
  status?: string;
}) => {
  const { error } = await supabase.from("stations").insert(station as any);
  if (error) throw error;
};

/** Delete a station */
export const deleteStation = async (id: string) => {
  const { error } = await supabase.from("stations").delete().eq("id", id);
  if (error) throw error;
};

/** Unassign stations from a structure (set structure_id null, status OFFLINE) */
export const unassignStationsFromStructure = async (structureId: string) => {
  const { error } = await supabase
    .from("stations")
    .update({ structure_id: null, status: "OFFLINE" } as any)
    .eq("structure_id", structureId);
  if (error) throw error;
};

/** Assign stations to a structure by IDs */
export const assignStationsToStructure = async (stationIds: string[], structureId: string) => {
  const { error } = await supabase
    .from("stations")
    .update({ structure_id: structureId })
    .in("id", stationIds);
  if (error) throw error;
};
