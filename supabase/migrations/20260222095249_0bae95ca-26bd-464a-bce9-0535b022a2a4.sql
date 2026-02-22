-- Restrict partners from reading fiscal_api_credentials via RLS
-- Drop existing policy and recreate with column restriction approach
-- Since Postgres RLS doesn't support column-level restrictions directly,
-- we create a view that excludes sensitive columns and update the policy

-- Create a secure view for partner access to fiscal data (without credentials)
CREATE OR REPLACE VIEW public.partners_fiscal_data_safe AS
SELECT profile_id, business_name, vat_number, sdi_code, is_active
FROM public.partners_fiscal_data;

-- Grant access to the view
GRANT SELECT ON public.partners_fiscal_data_safe TO authenticated;

-- Drop old permissive partner policy that exposes credentials
DROP POLICY IF EXISTS "Partner sees own fiscal data" ON public.partners_fiscal_data;

-- Recreate: Admin has full access, partners can only UPDATE (not SELECT credentials)
CREATE POLICY "Admin manages fiscal data"
ON public.partners_fiscal_data
FOR ALL
USING (is_admin());

CREATE POLICY "Partner updates own fiscal data"
ON public.partners_fiscal_data
FOR UPDATE
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Partner inserts own fiscal data"
ON public.partners_fiscal_data
FOR INSERT
WITH CHECK (auth.uid() = profile_id);