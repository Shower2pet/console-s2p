
-- Drop and re-create foreign keys with ON DELETE CASCADE for all tables referencing stations

-- wash_sessions.station_id
ALTER TABLE public.wash_sessions DROP CONSTRAINT IF EXISTS wash_sessions_station_id_fkey;
ALTER TABLE public.wash_sessions ADD CONSTRAINT wash_sessions_station_id_fkey
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE CASCADE;

-- maintenance_logs.station_id
ALTER TABLE public.maintenance_logs DROP CONSTRAINT IF EXISTS maintenance_logs_station_id_fkey;
ALTER TABLE public.maintenance_logs ADD CONSTRAINT maintenance_logs_station_id_fkey
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE CASCADE;

-- gate_commands.station_id
ALTER TABLE public.gate_commands DROP CONSTRAINT IF EXISTS gate_commands_station_id_fkey;
ALTER TABLE public.gate_commands ADD CONSTRAINT gate_commands_station_id_fkey
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE CASCADE;

-- station_access_logs.station_id
ALTER TABLE public.station_access_logs DROP CONSTRAINT IF EXISTS station_access_logs_station_id_fkey;
ALTER TABLE public.station_access_logs ADD CONSTRAINT station_access_logs_station_id_fkey
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE CASCADE;

-- transactions.station_id
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_station_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_station_id_fkey
  FOREIGN KEY (station_id) REFERENCES public.stations(id) ON DELETE CASCADE;
