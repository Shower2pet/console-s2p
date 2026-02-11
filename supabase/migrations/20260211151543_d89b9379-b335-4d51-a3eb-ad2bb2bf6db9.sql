
-- 1. Fix structures RLS: remove public read, add manager read
DROP POLICY IF EXISTS "Public read structures" ON public.structures;

CREATE POLICY "Manager reads assigned structures"
ON public.structures
FOR SELECT
USING (is_manager_of(id));

-- 2. Add owner_id to stations to track which partner owns a station
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id);

-- Update RLS: owner can read their stations
CREATE POLICY "Owner reads own stations"
ON public.stations
FOR SELECT
USING (owner_id = auth.uid());

-- 3. Add must_change_password to profiles for first-login flow
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;
