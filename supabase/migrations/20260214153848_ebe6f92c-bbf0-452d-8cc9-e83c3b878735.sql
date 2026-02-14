
-- Create transaction_receipts table
CREATE TABLE public.transaction_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.wash_sessions(id) ON DELETE SET NULL,
  partner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  tax_rate numeric NOT NULL DEFAULT 22.0,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'ERROR')),
  acube_transaction_id text,
  error_details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_receipts ENABLE ROW LEVEL SECURITY;

-- Admin sees all
CREATE POLICY "Admins manage all receipts"
ON public.transaction_receipts
FOR ALL
TO authenticated
USING (is_admin());

-- Partners see own receipts
CREATE POLICY "Partners view own receipts"
ON public.transaction_receipts
FOR SELECT
TO authenticated
USING (auth.uid() = partner_id);

-- Edge functions (service role) can insert/update
CREATE POLICY "Service inserts receipts"
ON public.transaction_receipts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service updates receipts"
ON public.transaction_receipts
FOR UPDATE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_transaction_receipts_updated_at
BEFORE UPDATE ON public.transaction_receipts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
