
-- Tighten INSERT policy: only service role or admin can insert
DROP POLICY "Service inserts receipts" ON public.transaction_receipts;
CREATE POLICY "Admin or partner inserts receipts"
ON public.transaction_receipts
FOR INSERT
TO authenticated
WITH CHECK (is_admin() OR auth.uid() = partner_id);

-- Tighten UPDATE policy: only admin or own partner
DROP POLICY "Service updates receipts" ON public.transaction_receipts;
CREATE POLICY "Admin or partner updates receipts"
ON public.transaction_receipts
FOR UPDATE
TO authenticated
USING (is_admin() OR auth.uid() = partner_id);
