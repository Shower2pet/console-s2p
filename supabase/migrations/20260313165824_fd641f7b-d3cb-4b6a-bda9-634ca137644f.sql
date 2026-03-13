-- Fix existing station with wrong type (product name instead of product type)
UPDATE stations SET type = 'vasca' WHERE id = 'AK_001' AND type = 'Akita';

-- Create trigger to auto-sync station.type from product.type on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.sync_station_type_from_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_type text;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT type INTO v_product_type FROM products WHERE id = NEW.product_id;
    IF v_product_type IS NOT NULL THEN
      NEW.type := v_product_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_station_type
  BEFORE INSERT OR UPDATE OF product_id ON stations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_station_type_from_product();