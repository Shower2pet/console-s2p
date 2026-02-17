
-- Rinominare colonne A-Cube → Fiskaly in profiles
ALTER TABLE public.profiles RENAME COLUMN acube_company_id TO fiskaly_system_id;

-- Rinominare colonne A-Cube → Fiskaly in transaction_receipts
ALTER TABLE public.transaction_receipts RENAME COLUMN acube_transaction_id TO fiskaly_record_id;

-- Rinominare colonne A-Cube → Fiskaly in daily_corrispettivi_logs
ALTER TABLE public.daily_corrispettivi_logs RENAME COLUMN acube_transaction_id TO fiskaly_record_id;
