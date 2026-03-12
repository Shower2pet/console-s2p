import { supabase } from "@/integrations/supabase/client";

export interface Board {
  id: string;
  type: "ethernet" | "wifi";
  model: string;
  station_id: string | null;
  created_at: string;
}

/** Fetch all boards (admin only) */
export const fetchBoards = async (): Promise<Board[]> => {
  const { data, error } = await supabase
    .from("boards" as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Board[];
};

/** Fetch boards not assigned to any station */
export const fetchAvailableBoards = async (): Promise<Board[]> => {
  const { data, error } = await supabase
    .from("boards" as any)
    .select("*")
    .is("station_id", null)
    .order("id");
  if (error) throw error;
  return (data ?? []) as unknown as Board[];
};

/** Generate next board ID via DB function, then insert */
export const createBoard = async (type: "ethernet" | "wifi", model: string): Promise<Board> => {
  const { data: idData, error: idErr } = await supabase.rpc("generate_board_id" as any, { board_type: type });
  if (idErr) throw idErr;
  const newId = idData as unknown as string;

  const { data, error } = await supabase
    .from("boards" as any)
    .insert({ id: newId, type, model } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Board;
};

/** Delete a board (only if not assigned) */
export const deleteBoard = async (id: string) => {
  const { error } = await supabase.from("boards" as any).delete().eq("id", id);
  if (error) throw error;
};

/** Assign a board to a station */
export const assignBoardToStation = async (boardId: string, stationId: string) => {
  const { error } = await supabase
    .from("boards" as any)
    .update({ station_id: stationId } as any)
    .eq("id", boardId);
  if (error) throw error;
};

/** Unassign a board from its station */
export const unassignBoard = async (boardId: string) => {
  const { error } = await supabase
    .from("boards" as any)
    .update({ station_id: null } as any)
    .eq("id", boardId);
  if (error) throw error;
};
