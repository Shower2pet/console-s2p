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

/** Invoke START_TIMED_WASH — returns { success, ends_at } */
export const invokeStartTimedWash = async (
  stationId: string,
  durationSeconds: number
): Promise<{ success: boolean; ends_at: string }> => {
  const body = { station_id: stationId, command: "START_TIMED_WASH", duration_seconds: durationSeconds };
  const { data, error } = await supabase.functions.invoke("station-control", { body });
  if (error) throw new Error(error.message ?? "Errore di comunicazione con la stazione");
  if (data?.error === "STATION_OFFLINE") {
    throw new Error("STATION_OFFLINE");
  }
  if (data?.error) throw new Error(data.message || data.error);
  return data;
};

/** Invoke START_TUB_CLEAN — returns { success, ends_at } */
export const invokeStartTubClean = async (
  stationId: string,
  durationSeconds: number
): Promise<{ success: boolean; ends_at: string }> => {
  const body = { station_id: stationId, command: "START_TUB_CLEAN", duration_seconds: durationSeconds };
  const { data, error } = await supabase.functions.invoke("station-control", { body });
  if (error) throw new Error(error.message ?? "Errore di comunicazione con la stazione");
  if (data?.error === "STATION_OFFLINE") {
    throw new Error("STATION_OFFLINE");
  }
  if (data?.error) throw new Error(data.message || data.error);
  return data;
};

/** Stop an active timed wash (relay1 OFF + cancel session) */
export const invokeStopWash = async (stationId: string): Promise<{ success: boolean }> => {
  const body = { station_id: stationId, command: "STOP_WASH" };
  const { data, error } = await supabase.functions.invoke("station-control", { body });
  if (error) throw new Error(error.message ?? "Errore di comunicazione con la stazione");
  if (data?.error) throw new Error(data.message || data.error);
  return data;
};

/** Stop an active tub clean (relay2 OFF + cancel session) */
export const invokeStopTubClean = async (stationId: string): Promise<{ success: boolean }> => {
  const body = { station_id: stationId, command: "STOP_TUB_CLEAN" };
  const { data, error } = await supabase.functions.invoke("station-control", { body });
  if (error) throw new Error(error.message ?? "Errore di comunicazione con la stazione");
  if (data?.error) throw new Error(data.message || data.error);
  return data;
};

/** Fetch stock stations — phase = PRODUCTION */
export const fetchStockStations = async () => {
  const { data, error } = await (supabase
    .from("stations")
    .select("*, products:product_id(name, type)") as any)
    .eq("phase", "PRODUCTION")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

/** Fetch STOCK stations ready for deployment to a partner */
export const fetchStockStationsForDeploy = async (): Promise<FreeStation[]> => {
  const { data, error } = await (supabase
    .from("stations")
    .select("id, type") as any)
    .eq("phase", "STOCK")
    .order("id");
  if (error) throw error;
  return data as FreeStation[];
};

/** Create a new station in inventory (phase defaults to PRODUCTION on DB) */
export const createStation = async (station: {
  id: string;
  type: string;
  product_id: string;
  description?: string | null;
  status?: string;
  visibility?: string;
}) => {
  const payload = { visibility: "PUBLIC", ...station };
  const { error } = await supabase.from("stations").insert(payload as any);
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

/** Create a showcase station (display-only, admin only) */
export const createShowcaseStation = async (station: {
  id: string;
  type: string;
  showcase_title: string;
  description?: string | null;
  geo_lat: number;
  geo_lng: number;
}) => {
  const payload = {
    ...station,
    is_showcase: true,
    phase: "SHOWCASE",
    status: "AVAILABLE" as const,
    visibility: "PUBLIC" as const,
  };
  const { error } = await supabase.from("stations").insert(payload as any);
  if (error) throw error;
};

/** Tester takes a PRODUCTION station for testing */
export const takeForTesting = async (stationId: string, testerId: string) => {
  const { error } = await (supabase
    .from("stations")
    .update({
      phase: "TESTING",
      owner_id: testerId,
      status: "OFFLINE",
      visibility: "HIDDEN",
    } as any) as any)
    .eq("id", stationId)
    .eq("phase", "PRODUCTION");
  if (error) throw error;
};

/** Tester promotes a TESTING station to STOCK (tested & ready) */
export const promoteToStock = async (stationId: string) => {
  const { error } = await (supabase
    .from("stations")
    .update({
      phase: "STOCK",
      owner_id: null,
      status: "OFFLINE",
    } as any) as any)
    .eq("id", stationId)
    .eq("phase", "TESTING");
  if (error) throw error;
};

/** Admin deploys a STOCK station to a partner */
export const deployStation = async (stationId: string, partnerId: string) => {
  const { error } = await (supabase
    .from("stations")
    .update({
      phase: "DEPLOYED",
      owner_id: partnerId,
    } as any) as any)
    .eq("id", stationId);
  if (error) throw error;
};
