-- Fix existing orphaned DEPLOYED stations → reset to STOCK
UPDATE stations
SET phase = 'STOCK', status = 'OFFLINE', visibility = 'HIDDEN'
WHERE phase = 'DEPLOYED' AND owner_id IS NULL;

-- Create trigger to auto-reset DEPLOYED stations when owner is removed
CREATE OR REPLACE FUNCTION public.reset_orphaned_deployed_station()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When owner_id is set to NULL on a DEPLOYED station, reset to STOCK
  IF NEW.phase = 'DEPLOYED' AND NEW.owner_id IS NULL AND OLD.owner_id IS NOT NULL THEN
    NEW.phase := 'STOCK';
    NEW.status := 'OFFLINE';
    NEW.structure_id := NULL;
    NEW.visibility := 'HIDDEN';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reset_orphaned_deployed
BEFORE UPDATE ON stations
FOR EACH ROW
EXECUTE FUNCTION reset_orphaned_deployed_station();