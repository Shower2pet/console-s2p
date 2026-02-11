
-- Trigger function: enforce station can only be AVAILABLE with at least one washing option
CREATE OR REPLACE FUNCTION public.enforce_station_active_requires_price()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is being set to AVAILABLE, check washing_options
  IF NEW.status = 'AVAILABLE' THEN
    IF NEW.washing_options IS NULL OR NEW.washing_options = '[]'::jsonb OR jsonb_array_length(NEW.washing_options) = 0 THEN
      -- Prevent activation, set to OFFLINE instead
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_enforce_station_active_requires_price ON public.stations;
CREATE TRIGGER trg_enforce_station_active_requires_price
  BEFORE INSERT OR UPDATE ON public.stations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_station_active_requires_price();
