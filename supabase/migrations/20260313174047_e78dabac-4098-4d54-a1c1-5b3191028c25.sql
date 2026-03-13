CREATE OR REPLACE FUNCTION public.promote_station_to_stock(p_station_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_tester boolean;
  v_station_phase text;
  v_station_owner uuid;
BEGIN
  v_caller_id := auth.uid();
  
  -- Check caller is a tester
  SELECT (role = 'tester') INTO v_is_tester FROM profiles WHERE id = v_caller_id;
  IF NOT COALESCE(v_is_tester, false) THEN
    RAISE EXCEPTION 'Only testers can promote stations to stock';
  END IF;
  
  -- Check station exists, is in TESTING, and owned by caller
  SELECT phase, owner_id INTO v_station_phase, v_station_owner
  FROM stations WHERE id = p_station_id;
  
  IF v_station_phase IS NULL THEN
    RAISE EXCEPTION 'Station not found';
  END IF;
  IF v_station_phase != 'TESTING' THEN
    RAISE EXCEPTION 'Station is not in TESTING phase';
  END IF;
  IF v_station_owner != v_caller_id THEN
    RAISE EXCEPTION 'You do not own this station';
  END IF;
  
  -- Promote
  UPDATE stations SET phase = 'STOCK', owner_id = NULL, status = 'OFFLINE'
  WHERE id = p_station_id;
END;
$$;