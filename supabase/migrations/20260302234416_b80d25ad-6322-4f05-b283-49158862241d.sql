
CREATE OR REPLACE FUNCTION public.enforce_station_active_requires_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_fiskaly_ok boolean;
BEGIN
  IF NEW.status = 'AVAILABLE' THEN
    -- Check washing options
    IF NEW.washing_options IS NULL OR NEW.washing_options = '[]'::jsonb OR jsonb_array_length(NEW.washing_options) = 0 THEN
      NEW.status := 'OFFLINE';
    END IF;
    -- Check heartbeat
    IF NEW.last_heartbeat_at IS NULL OR NEW.last_heartbeat_at < now() - interval '90 seconds' THEN
      NEW.status := 'OFFLINE';
    END IF;
    -- Check Fiskaly configuration of the owner
    IF NEW.status = 'AVAILABLE' THEN
      -- Determine owner: direct owner_id or via structure
      v_owner_id := NEW.owner_id;
      IF v_owner_id IS NULL AND NEW.structure_id IS NOT NULL THEN
        SELECT owner_id INTO v_owner_id FROM structures WHERE id = NEW.structure_id;
      END IF;
      IF v_owner_id IS NULL THEN
        NEW.status := 'OFFLINE';
      ELSE
        SELECT (fiskaly_system_id IS NOT NULL AND fiskaly_system_id != '')
        INTO v_fiskaly_ok
        FROM profiles WHERE id = v_owner_id;
        IF NOT COALESCE(v_fiskaly_ok, false) THEN
          NEW.status := 'OFFLINE';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
