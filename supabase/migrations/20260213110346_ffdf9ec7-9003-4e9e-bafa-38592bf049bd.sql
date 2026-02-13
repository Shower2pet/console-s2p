
-- Create products table for hardware catalog
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read active products
CREATE POLICY "Anyone can read active products"
  ON public.products FOR SELECT
  USING (is_active = true);

-- Only admins can manage products
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add product_id column to stations (optional FK to products)
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);
-- Add description column to stations
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS description text;
