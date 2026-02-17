
-- Add address fields to profiles for partner business info
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text;
