
-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view structures" ON structures;
