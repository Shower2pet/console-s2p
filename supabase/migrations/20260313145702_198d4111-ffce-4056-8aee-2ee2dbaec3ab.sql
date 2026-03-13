
-- 1. Create station_phase enum
CREATE TYPE public.station_phase AS ENUM ('PRODUCTION', 'TESTING', 'STOCK', 'DEPLOYED', 'SHOWCASE');

-- 2. Add phase column to stations
ALTER TABLE public.stations ADD COLUMN phase public.station_phase NOT NULL DEFAULT 'PRODUCTION';

-- 3. Data migration: populate phase for existing stations
UPDATE public.stations SET phase = 'SHOWCASE' WHERE is_showcase = true;
UPDATE public.stations SET phase = 'DEPLOYED' WHERE is_showcase = false AND structure_id IS NOT NULL;
UPDATE public.stations SET phase = 'DEPLOYED' WHERE is_showcase = false AND owner_id IS NOT NULL AND structure_id IS NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = stations.owner_id AND p.role = 'partner');
UPDATE public.stations SET phase = 'TESTING' WHERE is_showcase = false AND owner_id IS NOT NULL AND structure_id IS NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = stations.owner_id AND p.role = 'tester');
-- Remaining unassigned stations stay PRODUCTION (default)

-- 4. Create helper function to check station phase (avoids recursion in RLS)
CREATE OR REPLACE FUNCTION public.get_station_phase(p_station_id text)
RETURNS public.station_phase
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phase FROM public.stations WHERE id = p_station_id;
$$;

-- 5. Drop old tester-specific RLS policies on stations
DROP POLICY IF EXISTS "Tester deletes own stations" ON public.stations;
DROP POLICY IF EXISTS "Tester inserts stations" ON public.stations;
DROP POLICY IF EXISTS "Tester manages own stations" ON public.stations;
DROP POLICY IF EXISTS "Tester reads own and stock stations" ON public.stations;

-- 6. Create new tester RLS policies based on phase
-- Tester can READ: PRODUCTION phase stations (to take them) + own TESTING stations
CREATE POLICY "Tester reads production and own testing stations" ON public.stations
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'tester'))
    AND (
      phase = 'PRODUCTION'
      OR (phase = 'TESTING' AND owner_id = auth.uid())
    )
  );

-- Tester can UPDATE: PRODUCTION (to take for testing) + own TESTING (to promote to STOCK)
CREATE POLICY "Tester updates production and own testing stations" ON public.stations
  FOR UPDATE TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'tester'))
    AND (
      phase = 'PRODUCTION'
      OR (phase = 'TESTING' AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'tester'))
    AND (
      phase = 'TESTING' AND owner_id = auth.uid()
      OR phase = 'STOCK' AND owner_id IS NULL
    )
  );

-- 7. Update enforce_station_active_requires_price trigger to be phase-aware
CREATE OR REPLACE FUNCTION public.enforce_station_active_requires_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_fiskaly_ok boolean;
  v_has_board boolean;
BEGIN
  -- Stations in PRODUCTION or STOCK must always be OFFLINE
  IF NEW.phase IN ('PRODUCTION', 'STOCK') THEN
    NEW.status := 'OFFLINE';
    RETURN NEW;
  END IF;

  -- Stations in TESTING bypass all checks (tester has full control)
  IF NEW.phase = 'TESTING' THEN
    RETURN NEW;
  END IF;

  -- DEPLOYED and SHOWCASE: normal validation
  IF NEW.status = 'AVAILABLE' THEN
    -- Check washing options
    IF NEW.washing_options IS NULL OR NEW.washing_options = '[]'::jsonb OR jsonb_array_length(NEW.washing_options) = 0 THEN
      NEW.status := 'OFFLINE';
    END IF;
    -- Check heartbeat
    IF NEW.last_heartbeat_at IS NULL OR NEW.last_heartbeat_at < now() - interval '90 seconds' THEN
      NEW.status := 'OFFLINE';
    END IF;
    -- Check board association
    IF NEW.status = 'AVAILABLE' THEN
      SELECT EXISTS (
        SELECT 1 FROM boards WHERE station_id = NEW.id
      ) INTO v_has_board;
      IF NOT v_has_board THEN
        NEW.status := 'OFFLINE';
      END IF;
    END IF;
    -- Check Fiskaly configuration of the owner
    IF NEW.status = 'AVAILABLE' THEN
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

-- 8. Update tester boards RLS: tester can only read and update (not insert/delete)
DROP POLICY IF EXISTS "Tester manages boards" ON public.boards;

-- Tester can read: unassigned boards + boards on their TESTING stations
CREATE POLICY "Tester reads boards" ON public.boards
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'tester'))
    AND (
      station_id IS NULL
      OR EXISTS (
        SELECT 1 FROM stations s
        WHERE s.id = boards.station_id AND s.owner_id = auth.uid() AND s.phase = 'TESTING'
      )
    )
  );

-- Tester can update boards (assign/unassign to their TESTING stations)
CREATE POLICY "Tester assigns boards" ON public.boards
  FOR UPDATE TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'tester'))
    AND (
      station_id IS NULL
      OR EXISTS (
        SELECT 1 FROM stations s
        WHERE s.id = boards.station_id AND s.owner_id = auth.uid() AND s.phase = 'TESTING'
      )
    )
  )
  WITH CHECK (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'tester'))
    AND (
      station_id IS NULL
      OR EXISTS (
        SELECT 1 FROM stations s
        WHERE s.id = boards.station_id AND s.owner_id = auth.uid() AND s.phase = 'TESTING'
      )
    )
  );
