
-- Create trigger to set visibility to PUBLIC when station is assigned to a partner
-- This triggers when owner_id is set from NULL to a value

CREATE OR REPLACE FUNCTION public.set_station_public_on_partner_assign()
RETURNS TRIGGER AS $$
BEGIN
    -- If owner_id is being set from NULL to a value (partner assignment)
    -- and visibility is not already PUBLIC, set it to PUBLIC
    IF (OLD.owner_id IS NULL AND NEW.owner_id IS NOT NULL AND NEW.visibility IS DISTINCT FROM 'PUBLIC') THEN
        NEW.visibility := 'PUBLIC';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS tr_set_station_public_on_partner_assign ON public.stations;

-- Create the trigger
CREATE TRIGGER tr_set_station_public_on_partner_assign
    BEFORE UPDATE OF owner_id ON public.stations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_station_public_on_partner_assign();
