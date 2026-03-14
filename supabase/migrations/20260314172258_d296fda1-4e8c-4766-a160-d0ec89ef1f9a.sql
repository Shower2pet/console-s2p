-- Fix: handle_maintenance_status should only set MAINTENANCE for high severity tickets
CREATE OR REPLACE FUNCTION public.handle_maintenance_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') AND (NEW.ended_at IS NULL) AND (NEW.severity = 'high') THEN
    UPDATE public.stations SET status = 'MAINTENANCE' WHERE id = NEW.station_id;
  ELSIF (TG_OP = 'UPDATE') AND (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL) AND (NEW.severity = 'high') THEN
    -- Only restore if no other open high-severity tickets exist
    IF NOT EXISTS (
      SELECT 1 FROM maintenance_logs
      WHERE station_id = NEW.station_id
        AND id != NEW.id
        AND severity = 'high'
        AND ended_at IS NULL
    ) THEN
      UPDATE public.stations SET status = 'AVAILABLE' WHERE id = NEW.station_id AND status = 'MAINTENANCE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;