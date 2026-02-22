-- Fix: change view to SECURITY INVOKER (default, just recreate without SECURITY DEFINER)
DROP VIEW IF EXISTS public.partners_fiscal_data_safe;

CREATE VIEW public.partners_fiscal_data_safe
WITH (security_invoker = true) AS
SELECT profile_id, business_name, vat_number, sdi_code, is_active
FROM public.partners_fiscal_data;

GRANT SELECT ON public.partners_fiscal_data_safe TO authenticated;