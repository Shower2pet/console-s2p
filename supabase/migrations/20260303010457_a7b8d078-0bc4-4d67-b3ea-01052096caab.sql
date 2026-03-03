
-- Table for partner referents (contact persons)
CREATE TABLE public.partner_referents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_referents ENABLE ROW LEVEL SECURITY;

-- Partner manages own referents
CREATE POLICY "Partner manages own referents"
  ON public.partner_referents
  FOR ALL
  USING (auth.uid() = partner_id)
  WITH CHECK (auth.uid() = partner_id);

-- Admin manages all referents
CREATE POLICY "Admin manages all referents"
  ON public.partner_referents
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Index for fast lookups
CREATE INDEX idx_partner_referents_partner_id ON public.partner_referents(partner_id);
