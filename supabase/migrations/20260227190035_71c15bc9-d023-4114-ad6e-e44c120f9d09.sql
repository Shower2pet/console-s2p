
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read structures" ON public.structures;
