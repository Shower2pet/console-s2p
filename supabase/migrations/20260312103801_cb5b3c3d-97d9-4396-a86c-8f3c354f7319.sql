
-- Update handle_station_heartbeat to also support board_id
-- The edge function or hardware can call with either station_id or board_id
CREATE OR REPLACE FUNCTION public.handle_board_heartbeat(p_board_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_station_id text;
BEGIN
  -- Look up the station associated with this board
  SELECT station_id INTO v_station_id
  FROM boards
  WHERE id = p_board_id;

  IF v_station_id IS NOT NULL THEN
    -- Delegate to existing station heartbeat handler
    PERFORM handle_station_heartbeat(v_station_id);
  END IF;
END;
$$;
