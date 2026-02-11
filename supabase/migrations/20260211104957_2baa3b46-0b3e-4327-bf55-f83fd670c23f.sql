
-- Add owner_id to credit_packages so packages belong to a partner, not a structure
ALTER TABLE public.credit_packages ADD COLUMN owner_id uuid REFERENCES public.profiles(id);

-- Backfill owner_id from existing structure_id
UPDATE public.credit_packages cp
SET owner_id = s.owner_id
FROM public.structures s
WHERE cp.structure_id = s.id AND cp.owner_id IS NULL;

-- Drop the old RLS policies that reference structure_id
DROP POLICY IF EXISTS "Structure owners manage packages" ON public.credit_packages;
DROP POLICY IF EXISTS "Managers manage packages" ON public.credit_packages;

-- New policy: partner manages own packages via owner_id
CREATE POLICY "Partner manages own packages"
ON public.credit_packages
FOR ALL
USING (owner_id = auth.uid() OR is_admin())
WITH CHECK (owner_id = auth.uid() OR is_admin());
