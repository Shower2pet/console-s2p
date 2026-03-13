-- Fix orphaned TESTING station with no owner
UPDATE stations
SET phase = 'STOCK', status = 'OFFLINE', visibility = 'HIDDEN'
WHERE id = 'SN_t' AND phase = 'TESTING' AND owner_id IS NULL;

-- Extend trigger to also catch TESTING stations losing owner
CREATE OR REPLACE FUNCTION public.reset_orphaned_deployed_station()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phase = 'DEPLOYED' AND NEW.owner_id IS NULL AND OLD.owner_id IS NOT NULL THEN
    NEW.phase := 'STOCK';
    NEW.status := 'OFFLINE';
    NEW.structure_id := NULL;
    NEW.visibility := 'HIDDEN';
  END IF;
  IF NEW.phase = 'TESTING' AND NEW.owner_id IS NULL AND OLD.owner_id IS NOT NULL THEN
    NEW.phase := 'STOCK';
    NEW.status := 'OFFLINE';
    NEW.structure_id := NULL;
    NEW.visibility := 'HIDDEN';
  END IF;
  RETURN NEW;
END;
$$;