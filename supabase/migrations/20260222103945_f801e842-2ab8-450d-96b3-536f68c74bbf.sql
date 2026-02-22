
-- Aggiorna il trigger enforce_station_active_requires_price per bloccare AVAILABLE senza heartbeat recente
CREATE OR REPLACE FUNCTION public.enforce_station_active_requires_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If status is being set to AVAILABLE, check requirements
  IF NEW.status = 'AVAILABLE' THEN
    -- Check washing_options
    IF NEW.washing_options IS NULL OR NEW.washing_options = '[]'::jsonb OR jsonb_array_length(NEW.washing_options) = 0 THEN
      NEW.status := 'OFFLINE';
    END IF;

    -- Check heartbeat recente (90 secondi)
    IF NEW.last_heartbeat_at IS NULL OR NEW.last_heartbeat_at < now() - interval '90 seconds' THEN
      NEW.status := 'OFFLINE';
    END IF;
  END IF;

  -- If washing_options are cleared, force OFFLINE
  IF (NEW.washing_options IS NULL OR NEW.washing_options = '[]'::jsonb OR jsonb_array_length(NEW.washing_options) = 0)
     AND NEW.status = 'AVAILABLE' THEN
    NEW.status := 'OFFLINE';
  END IF;

  RETURN NEW;
END;
$function$;
