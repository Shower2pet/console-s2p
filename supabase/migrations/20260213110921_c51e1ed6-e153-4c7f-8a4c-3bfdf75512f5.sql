
-- Trigger: when a maintenance ticket with severity='high' is opened, set station to MAINTENANCE
-- When resolved, set back to AVAILABLE
CREATE OR REPLACE FUNCTION public.maintenance_severity_station_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On INSERT with high severity, set station to MAINTENANCE
  IF TG_OP = 'INSERT' AND NEW.severity = 'high' AND NEW.station_id IS NOT NULL THEN
    UPDATE stations SET status = 'MAINTENANCE' WHERE id = NEW.station_id;
  END IF;

  -- On UPDATE: if status changed to 'risolto', and severity was high, restore AVAILABLE
  IF TG_OP = 'UPDATE' AND NEW.status = 'risolto' AND OLD.status != 'risolto' AND NEW.severity = 'high' AND NEW.station_id IS NOT NULL THEN
    -- Only restore if no other open high-severity tickets exist for this station
    IF NOT EXISTS (
      SELECT 1 FROM maintenance_logs
      WHERE station_id = NEW.station_id
        AND id != NEW.id
        AND severity = 'high'
        AND status != 'risolto'
    ) THEN
      UPDATE stations SET status = 'AVAILABLE' WHERE id = NEW.station_id AND status = 'MAINTENANCE';
    END IF;
    -- Set ended_at
    NEW.ended_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_severity ON maintenance_logs;
CREATE TRIGGER trg_maintenance_severity
  BEFORE INSERT OR UPDATE ON maintenance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.maintenance_severity_station_status();
