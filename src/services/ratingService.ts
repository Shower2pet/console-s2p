import { supabase } from "@/integrations/supabase/client";

export interface StationRatingRow {
  id: string;
  station_id: string;
  user_id: string;
  session_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface StationAvgRating {
  avg_rating: number;
  total_count: number;
}

export const fetchStationAvgRating = async (stationId: string): Promise<StationAvgRating> => {
  const { data, error } = await supabase.rpc("get_station_avg_rating", {
    p_station_id: stationId,
  });
  if (error) throw error;
  const row = data?.[0];
  return {
    avg_rating: Number(row?.avg_rating ?? 0),
    total_count: Number(row?.total_count ?? 0),
  };
};

export const fetchStationRatings = async (
  stationId: string,
  limit = 10
): Promise<(StationRatingRow & { user_email?: string })[]> => {
  const { data, error } = await supabase
    .from("station_ratings")
    .select("id, station_id, user_id, session_id, rating, comment, created_at")
    .eq("station_id", stationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as unknown as StationRatingRow[];

  // Fetch user emails
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  let emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    (profiles ?? []).forEach((p) => emailMap.set(p.id, p.email ?? ""));
  }

  return rows.map((r) => ({
    ...r,
    user_email: emailMap.get(r.user_id) ?? undefined,
  }));
};
