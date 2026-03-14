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

export interface StationRatingWithUser extends StationRatingRow {
  user_first_name?: string;
  user_last_name?: string;
  user_email?: string;
  user_role?: string;
}

export const fetchStationRatings = async (
  stationId: string,
  limit = 10
): Promise<StationRatingWithUser[]> => {
  const { data, error } = await supabase.rpc("get_station_ratings_with_user", {
    p_station_id: stationId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as unknown as StationRatingWithUser[];
};
