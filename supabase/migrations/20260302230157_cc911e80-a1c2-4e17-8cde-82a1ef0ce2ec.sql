-- Allow partner_id to be nullable in financial tables so data is preserved when a partner is deleted
ALTER TABLE public.daily_corrispettivi_logs ALTER COLUMN partner_id DROP NOT NULL;
ALTER TABLE public.transaction_receipts ALTER COLUMN partner_id DROP NOT NULL;

-- Also ensure wash_sessions.station_id can be nullable (it's currently NOT NULL)
-- We need this so we can nullify the station reference when a partner's stations are removed
ALTER TABLE public.wash_sessions ALTER COLUMN station_id DROP NOT NULL;